// electron_main.js

const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const DiscordRPC = require('discord-rpc');
const contextMenu = require('electron-context-menu');

const userHomeDir = os.homedir();

// --- Discord Rich Presence Setup ---
const clientId = '1326134917658185769';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let discordReady = false;
let startTimestamp = new Date();

function updatePresence(details = "Idle", state = "In the main menu", lineCount = 0) {
  if (!discordReady) return;
  
  let finalState = state;
  if(lineCount > 0) {
      finalState += ` (${lineCount} lines)`;
  }

  rpc.setActivity({
    details: details,
    state: finalState,
    startTimestamp,
    largeImageKey: 'icon_512x512',
    largeImageText: 'HT-IDE',
    instance: false,
  });
}

// --- NEW: Command Runner Class (from old project) ---
const runningProcesses = new Map();

function runCommand(command, cwd, event) {
    const [cmd, ...args] = command.split(' ');
    const process = spawn(cmd, args, { cwd, shell: true });
    const processId = process.pid;
    runningProcesses.set(processId, process);

    process.stdout.on('data', (data) => event.sender.send('command-output', data.toString()));
    process.stderr.on('data', (data) => event.sender.send('command-error', data.toString()));
    process.on('close', (code) => {
        runningProcesses.delete(processId);
        event.sender.send('command-close', code);
    });
    process.on('error', (err) => {
        runningProcesses.delete(processId);
        event.sender.send('command-error', `Error: ${err.message}`);
    });
}

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile('HT-IDE.html');
}

app.whenReady().then(async () => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    try {
        await rpc.login({ clientId });
        discordReady = true;
        console.log('Discord Rich Presence is ready.');
        updatePresence(); 
    } catch (error) {
        console.error('Failed to initialize Discord RPC:', error);
    }

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) focusedWindow.webContents.toggleDevTools();
    });
    globalShortcut.register('CommandOrControl+=', () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) focusedWindow.webContents.setZoomLevel(focusedWindow.webContents.getZoomLevel() + 0.5);
    });
    globalShortcut.register('CommandOrControl+-', () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) focusedWindow.webContents.setZoomLevel(focusedWindow.webContents.getZoomLevel() - 0.5);
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (discordReady) {
        rpc.destroy();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('show-tab-context-menu', (event, filePath) => {
    const template = [
        {
            label: 'Open File Location',
            click: () => shell.showItemInFolder(filePath)
        }
    ];
    const menu = contextMenu({
        prepend: () => template,
        window: BrowserWindow.fromWebContents(event.sender)
    });
});

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!canceled) return filePaths;
    return null;
});

ipcMain.handle('get-app-path', () => app.getAppPath());

ipcMain.handle('update-discord-presence', (event, { details, state, lineCount }) => {
    updatePresence(details, state, lineCount);
});

ipcMain.handle('run-command', (event, { command, cwd }) => {
    runCommand(command.replace(/~~~/g, ' '), cwd, event);
});


// --- BACKEND FILE SYSTEM API ---
ipcMain.handle('fs:getAllPaths', (event, dirPath) => {
    try {
        const resolvedPath = dirPath === '/' ? userHomeDir : dirPath;
        const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
        return items.map(item => ({ name: item.name, path: path.join(resolvedPath, item.name), isFile: item.isFile() }));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        console.error(`Error reading directory ${dirPath}:`, error);
        return [];
    }
});
ipcMain.handle('fs:getFileContent', (event, filePath) => { try { if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8'); return null; } catch (e) { console.error(e); return null; } });
ipcMain.handle('fs:saveFileContent', async (event, { filePath, content }) => { try { fs.writeFileSync(filePath, content); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.on('fs:saveFileContentSync', (event, { filePath, content }) => { fs.writeFileSync(filePath, content); });
ipcMain.handle('fs:deleteItem', async (event, { itemPath, isFile }) => { try { if (isFile) fs.unlinkSync(itemPath); else fs.rmSync(itemPath, { recursive: true, force: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('fs:createItem', async (event, { itemPath, isFile }) => { try { if (isFile) fs.writeFileSync(itemPath, ''); else fs.mkdirSync(itemPath, { recursive: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('fs:dropFile', async (event, { originalPath, targetDir }) => { 
    try {
        const stats = fs.statSync(originalPath);
        const itemName = path.basename(originalPath);
        const destinationPath = path.join(targetDir, itemName);
        
        if (stats.isDirectory()) {
            fs.cpSync(originalPath, destinationPath, { recursive: true });
        } else {
            fs.copyFileSync(originalPath, destinationPath);
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
// electron_main.js

const { app, BrowserWindow, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const DiscordRPC = require('discord-rpc'); // --- NEW ---

const userHomeDir = os.homedir();

// --- NEW: Discord Rich Presence Setup ---
const clientId = '1326134917658185769';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let discordReady = false;
let startTimestamp = new Date();

function updatePresence(details = "Idle", state = "In the main menu") {
  if (!discordReady) return;
  rpc.setActivity({
    details: details,
    state: state,
    startTimestamp,
    largeImageKey: 'icon_512x512',
    largeImageText: 'HT-IDE',
    smallImageKey: 'icon_512x512',
    smallImageText: 'Editing a file',
    instance: false,
  });
}
// --- END NEW ---

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

    // --- NEW: Connect to Discord ---
    try {
        await rpc.login({ clientId });
        discordReady = true;
        console.log('Discord Rich Presence is ready.');
        updatePresence(); // Set initial presence
    } catch (error) {
        console.error('Failed to initialize Discord RPC:', error);
    }
    // --- END NEW ---

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
    // --- NEW: Disconnect from Discord ---
    if (discordReady) {
        rpc.destroy();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (!canceled) {
        return filePaths;
    }
    return null;
});

// --- NEW: Discord Presence IPC Handler ---
ipcMain.handle('update-discord-presence', (event, { details, state }) => {
    updatePresence(details, state);
});
// --- END NEW ---

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
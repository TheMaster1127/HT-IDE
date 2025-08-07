// electron_main.js

const { app, BrowserWindow, ipcMain, globalShortcut, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const DiscordRPC = require('discord-rpc');
const contextMenu = require('electron-context-menu');

const userHomeDir = os.homedir();

// --- MODIFICATION START: File-based Storage ---
const storageFilePath = path.join(app.getPath('userData'), 'app-storage.json');
let storageCache = {};

function loadStorage() {
    try {
        if (fs.existsSync(storageFilePath)) {
            storageCache = JSON.parse(fs.readFileSync(storageFilePath, 'utf-8'));
        } else {
            storageCache = {};
        }
    } catch (e) {
        console.error("Failed to load storage file, starting fresh.", e);
        storageCache = {};
    }
}

function saveStorage() {
    try {
        // Use writeFileSync for atomicity and to prevent data loss on quit.
        fs.writeFileSync(storageFilePath, JSON.stringify(storageCache, null, 2));
    } catch (e) {
        console.error("Failed to save storage file.", e);
    }
}
// --- MODIFICATION END ---


// --- Discord Rich Presence Setup ---
const clientId = '1326134917658185769';
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let discordReady = false;
let startTimestamp = new Date();

const fileWatchers = new Map();

// --- MODIFICATION START: Add watcher for the file list sidebar ---
let currentDirectoryWatcher = null;
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};
// --- MODIFICATION END ---


let httpServer = null;
const mimeTypes = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff': 'application/font-woff', '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject', '.otf': 'application/font-otf', '.wasm': 'application/wasm'
};

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
  }).catch(console.error);
}

const terminalProcesses = new Map();

function runCommand(terminalId, command, cwd, event) {
    return new Promise((resolve, reject) => {
        const trimmedCommand = command.trim();
        if (!trimmedCommand) {
            if (!event.sender.isDestroyed()) {
                event.sender.send('command-close', { terminalId, code: 0 });
            }
            resolve(0);
            return;
        }
        
        const [cmd, ...args] = trimmedCommand.split(' ');
        if (cmd === 'cd') {
            let targetDir = args.join(' ').trim();
            if (!targetDir || targetDir === '~') {
                targetDir = userHomeDir;
            }
            const newCwd = path.resolve(cwd, targetDir);
            try {
                if (fs.statSync(newCwd).isDirectory()) {
                    if (!event.sender.isDestroyed()) event.sender.send('terminal:update-cwd', { terminalId, newPath: newCwd });
                } else {
                    if (!event.sender.isDestroyed()) event.sender.send('command-error', { terminalId, data: `\r\ncd: not a directory: ${newCwd}` });
                }
            } catch (error) {
                if (!event.sender.isDestroyed()) event.sender.send('command-error', { terminalId, data: `\r\ncd: no such file or directory: ${newCwd}` });
            }
            if (!event.sender.isDestroyed()) event.sender.send('command-close', { terminalId, code: 0 });
            resolve(0);
            return;
        }
        
        const spawnOptions = { 
            cwd, 
            shell: true,
            detached: process.platform !== 'win32' 
        };
        const childProcess = spawn(cmd, args, spawnOptions);
        terminalProcesses.set(terminalId, childProcess);

        childProcess.stdout.on('data', (data) => {
            if (!event.sender.isDestroyed()) event.sender.send('command-output', { terminalId, data: data.toString() })
        });
        childProcess.stderr.on('data', (data) => {
            if (!event.sender.isDestroyed()) event.sender.send('command-error', { terminalId, data: data.toString() })
        });
        
        childProcess.on('close', (code) => {
            terminalProcesses.delete(terminalId);
            resolve(code);
        });

        childProcess.on('error', (err) => {
            terminalProcesses.delete(terminalId);
            if (!event.sender.isDestroyed()) event.sender.send('command-error', { terminalId, data: `Error: ${err.message}` });
            reject(err);
        });
    });
}

ipcMain.handle('run-command-sequence', async (event, { terminalId, commands, cwd }) => {
    for (const command of commands) {
        try {
            const exitCode = await runCommand(terminalId, command, cwd, event);
            if (exitCode !== 0) {
                 console.error(`Command sequence failed at '${command}' with code ${exitCode}`);
                 if (!event.sender.isDestroyed()) event.sender.send('command-close', { terminalId, code: exitCode });
                 return;
            }
        } catch (error) {
            console.error(`Command sequence failed at '${command}':`, error);
            if (!event.sender.isDestroyed()) event.sender.send('command-close', { terminalId, code: 1 }); 
            return; 
        }
    }
    if (!event.sender.isDestroyed()) event.sender.send('command-close', { terminalId, code: 0 });
});


ipcMain.on('terminal:write-to-stdin', (event, { terminalId, data }) => {
    const process = terminalProcesses.get(terminalId);
    if (process && process.stdin && !process.stdin.destroyed) {
        process.stdin.write(data);
    }
});

ipcMain.on('terminal:kill-process', (event, terminalId) => {
    const processToKill = terminalProcesses.get(terminalId);
    if (processToKill) {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', processToKill.pid, '/f', '/t']);
        } else {
            try {
                process.kill(-processToKill.pid, 'SIGINT');
            } catch (e) {
                processToKill.kill('SIGINT');
            }
        }
    }
});

ipcMain.handle('terminal:autocomplete', (event, { terminalId, partial, cwd }) => {
    try {
        const baseName = path.basename(partial);
        const dirName = path.dirname(partial);
        
        const searchPath = path.resolve(cwd, dirName);

        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        
        const matches = entries
            .filter(entry => entry.name.toLowerCase().startsWith(baseName.toLowerCase()))
            .map(entry => {
                let name = entry.name;
                if (/\s/.test(name)) {
                    name = `"${name}"`;
                }
                if (entry.isDirectory()) {
                    name += (process.platform === 'win32' ? '\\' : '/');
                }
                return path.join(dirName, name).replace(/\\/g, '/');
            });
        return matches;
    } catch (e) {
        return [];
    }
});


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

    const registerDevShortcuts = () => {
        globalShortcut.register('CommandOrControl+Shift+I', () => {
            mainWindow.webContents.toggleDevTools();
        });
        globalShortcut.register('CommandOrControl+Shift+R', () => {
            mainWindow.webContents.reloadIgnoringCache();
        });
    };

    mainWindow.on('focus', () => {
        registerDevShortcuts();
    });

    mainWindow.on('blur', () => {
        globalShortcut.unregisterAll();
    });

    mainWindow.setMenu(null);
    mainWindow.loadFile('HT-IDE.html');
}

app.whenReady().then(async () => {
    loadStorage();

    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    rpc.on('error', (err) => {
        console.warn(`Discord RPC error: ${err.message}`);
    });

    try {
        await rpc.login({ clientId });
        discordReady = true;
        console.log('Discord Rich Presence is ready.');
        updatePresence(); 
    } catch (error) {
        console.error('Failed to initialize Discord RPC:', error);
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    fileWatchers.forEach(watcher => watcher.close());
    fileWatchers.clear();
    
    // --- MODIFICATION START: Close directory watcher on quit ---
    if (currentDirectoryWatcher) {
        currentDirectoryWatcher.close();
    }
    // --- MODIFICATION END ---

    if (httpServer && httpServer.listening) {
        httpServer.close();
    }
    
    terminalProcesses.forEach(processToKill => {
        if (!processToKill || processToKill.killed) {
            return;
        }
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', processToKill.pid, '/f', '/t']);
        } else {
            try {
                process.kill(-processToKill.pid, 'SIGKILL');
            } catch (e) {
                console.warn(`Could not kill process group for PID ${processToKill.pid}, falling back to single process.`);
                try {
                    processToKill.kill('SIGKILL');
                } catch(e2) {
                    console.error(`Final fallback to kill PID ${processToKill.pid} failed.`, e2);
                }
            }
        }
    });

    terminalProcesses.clear();
    if (discordReady) {
        rpc.destroy();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('storage:get-all', () => {
    return storageCache;
});
ipcMain.handle('storage:set-item', (event, { key, value }) => {
    storageCache[key] = value;
    saveStorage();
});
ipcMain.handle('storage:remove-item', (event, key) => {
    delete storageCache[key];
    saveStorage();
});
ipcMain.handle('storage:clear', () => {
    storageCache = {};
    saveStorage();
});


ipcMain.on('app:set-zoom-level', (event, level) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        win.webContents.setZoomLevel(level);
    }
});

ipcMain.on('app:reload', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const currentURL = new URL(win.webContents.getURL());
        const newURL = new URL(`file://${app.getAppPath()}/HT-IDE.html`);
        newURL.search = currentURL.search; 
        win.loadURL(newURL.href);
    }
});

ipcMain.on('app:switch-workspace', (event, newId) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        const newURL = new URL(`file://${app.getAppPath()}/HT-IDE.html`);
        newURL.searchParams.set('id', newId);
        win.loadURL(newURL.href);
    }
});

ipcMain.on('show-tab-context-menu', (event, filePath) => {
    const template = [
        {
            label: 'Close',
            click: () => {
                event.sender.send('close-tab-from-context-menu', filePath);
            }
        },
        { type: 'separator' },
        {
            label: 'Open File Location',
            click: () => {
                shell.showItemInFolder(filePath);
            }
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        menu.popup({ window: win });
    }
});

ipcMain.on('show-file-context-menu', (event, { itemPath, isFile }) => {
    const template = [
        {
            label: 'Open File Location',
            click: () => {
                if (isFile) {
                    shell.showItemInFolder(itemPath);
                } else {
                    shell.openPath(itemPath);
                }
            }
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        menu.popup({ window: win });
    }
});

ipcMain.handle('dialog:showExitConfirm', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    const { response } = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
        title: 'Confirm Exit',
        message: 'Do you want to exit HT-IDE?'
    });
    return response === 0;
});

ipcMain.on('watch-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) return;
    try {
        const watcher = fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                event.sender.send('file-changed', filePath);
            }
        });
        fileWatchers.set(filePath, watcher);
    } catch (error) {
        console.error(`Failed to watch ${filePath}:`, error.message);
    }
});

ipcMain.on('unwatch-file', (event, filePath) => {
    if (fileWatchers.has(filePath)) {
        fileWatchers.get(filePath).close();
        fileWatchers.delete(filePath);
    }
});

// --- MODIFICATION START: Add handler for watching the sidebar directory ---
ipcMain.on('fs:watch-directory', (event, dirPath) => {
    // Stop watching the previous directory
    if (currentDirectoryWatcher) {
        currentDirectoryWatcher.close();
        currentDirectoryWatcher = null;
    }

    const pathExists = fs.existsSync(dirPath);
    if (!pathExists) {
        console.warn(`Attempted to watch a directory that does not exist: ${dirPath}`);
        return;
    }

    // Debounce the event to prevent multiple re-renders for a single action
    const debouncedRefresh = debounce(() => {
        if (!event.sender.isDestroyed()) {
            event.sender.send('fs:directory-changed');
        }
    }, 150);

    try {
        currentDirectoryWatcher = fs.watch(dirPath, (eventType, filename) => {
            // eventType can be 'rename' (for create/delete/rename) or 'change' (for modification)
            // In either case, we just trigger a refresh.
            if (filename) {
                // console.log(`Directory change detected in ${dirPath}: ${eventType} on ${filename}`);
                debouncedRefresh();
            }
        });

        currentDirectoryWatcher.on('error', (err) => {
            console.error(`Error with directory watcher for ${dirPath}:`, err);
        });
    } catch (err) {
        console.error(`Failed to start directory watcher for ${dirPath}:`, err);
    }
});
// --- MODIFICATION END ---

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (!canceled) return filePaths;
    return null;
});

ipcMain.handle('http:toggle', async (event, { rootPath, port: startPort, defaultFile, terminalId }) => {
    if (httpServer && httpServer.listening) {
        return new Promise((resolve) => {
            httpServer.close(() => {
                httpServer = null;
                resolve({ status: 'stopped' });
            });
        });
    }

    const finalRootPath = rootPath === '/' ? os.homedir() : rootPath;
    let port = startPort; // Use the provided port setting
    const finalDefaultFile = defaultFile || 'index.html';

    const createServerHandler = (req, res) => {
        const startTime = process.hrtime();
        
        const logRequest = () => {
            const elapsedTime = process.hrtime(startTime);
            const elapsedTimeMs = (elapsedTime[0] * 1e3 + elapsedTime[1] * 1e-6).toFixed(2);
            const status = res.statusCode;
            let statusColor = status >= 200 && status < 300 ? '\x1b[32m' : (status >= 400 ? '\x1b[31m' : '\x1b[33m');
            const logMessage = `${statusColor}[${status}]\x1b[0m ${req.method} ${req.url} (${elapsedTimeMs}ms)`;
            if (!event.sender.isDestroyed()) {
                 event.sender.send('http-server-log', { terminalId, message: logMessage });
            }
        };
        
        res.on('finish', logRequest);
        res.on('close', () => {
            res.removeListener('finish', logRequest);
            logRequest();
        });
        
        const reqUrl = decodeURIComponent(req.url.split('?')[0]);
        let filePath = path.join(finalRootPath, reqUrl === '/' ? finalDefaultFile : reqUrl);

        const serve404 = () => {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>404 Not Found</h1>', 'utf-8');
        };
        
        fs.stat(filePath, (err, stats) => {
            if (err) return serve404();
            
            if (stats.isDirectory()) {
                filePath = path.join(filePath, finalDefaultFile);
            }

            fs.readFile(filePath, (error, content) => {
                if (error) return serve404();
                
                const extname = String(path.extname(filePath)).toLowerCase();
                let contentType = mimeTypes[extname] || 'application/octet-stream';
                if (contentType.startsWith('text/') || contentType === 'application/json' || contentType === 'application/javascript' || contentType === 'image/svg+xml') {
                    contentType += '; charset=utf-8';
                }

                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            });
        });
    };
    
    const tryListen = (listenPort) => {
        return new Promise((resolve, reject) => {
            const server = http.createServer(createServerHandler);
            server.on('listening', () => {
                httpServer = server;
                resolve({ status: 'started', port: listenPort });
            });
            server.on('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    event.sender.send('http-server-log', { terminalId, message: `\x1b[31mError: Port ${listenPort} is busy. Please choose another port in Settings.\x1b[0m` });
                    resolve({ status: 'error', message: `Port ${listenPort} is in use.` });
                } else {
                    reject(err);
                }
            });
            server.listen(listenPort);
        });
    };

    try {
        return await tryListen(port);
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-app-path', () => app.getAppPath());
ipcMain.handle('get-home-dir', () => os.homedir());
ipcMain.handle('update-discord-presence', (event, { details, state, lineCount }) => { updatePresence(details, state, lineCount); });

ipcMain.handle('run-command', async (event, { terminalId, command, cwd }) => {
    const code = await runCommand(terminalId, command, cwd, event).catch(() => 1);
    if (!event.sender.isDestroyed()) {
        event.sender.send('command-close', { terminalId, code });
    }
});

// --- MODIFICATION START: Added synchronous file reading handler for the compiler ---
ipcMain.on('fs:read-file-relative-sync', (event, { baseFile, targetPath }) => {
    try {
        const isAbsolute = path.isAbsolute(targetPath);
        const finalPath = isAbsolute ? targetPath : path.resolve(path.dirname(baseFile), targetPath);

        if (fs.existsSync(finalPath) && fs.statSync(finalPath).isFile()) {
            event.returnValue = fs.readFileSync(finalPath, 'utf-8');
        } else {
            event.returnValue = null;
        }
    } catch (e) {
        console.error(`Error in fs:read-file-relative-sync for base "${baseFile}" and target "${targetPath}":`, e);
        event.returnValue = null;
    }
});
// --- MODIFICATION END ---

ipcMain.handle('fs:getAllPaths', (event, dirPath) => { try { const p = dirPath === '/' ? userHomeDir : dirPath; const i = fs.readdirSync(p, { withFileTypes: true }); return i.map(t => { const isFile = t.isFile(); let icon = null; if (isFile) { const ext = path.extname(t.name).substring(1); const iconPath = path.join(app.getAppPath(), 'assets', `${ext}.png`); if (fs.existsSync(iconPath)) { icon = `${ext}.png`; } } return { name: t.name, path: path.join(p, t.name), isFile, icon }; }); } catch (e) { if (e.code === 'ENOENT') return []; console.error(`Error reading directory ${dirPath}:`, e); return []; } });
ipcMain.handle('fs:getFileContent', (event, filePath) => { try { if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8'); return null; } catch (e) { console.error(e); return null; } });
ipcMain.handle('fs:saveFileContent', async (event, { filePath, content }) => {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content);
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
});
ipcMain.on('fs:saveFileContentSync', (event, { filePath, content }) => { fs.writeFileSync(filePath, content); });
ipcMain.handle('fs:deleteItem', async (event, { itemPath, isFile }) => { try { if (isFile) fs.unlinkSync(itemPath); else fs.rmSync(itemPath, { recursive: true, force: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('fs:createItem', async (event, { itemPath, isFile }) => { try { if (isFile) fs.writeFileSync(itemPath, ''); else fs.mkdirSync(itemPath, { recursive: true }); return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
ipcMain.handle('fs:dropFile', async (event, { originalPath, targetDir }) => { try { const s = fs.statSync(originalPath); const n = path.basename(originalPath); const d = path.join(targetDir, n); if (s.isDirectory()) { fs.cpSync(originalPath, d, { recursive: true }); } else { fs.copyFileSync(originalPath, d); } return { success: true }; } catch (e) { return { success: false, error: e.message }; } });
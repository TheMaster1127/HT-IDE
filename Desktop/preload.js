// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- File System Functions ---
    getAllPaths: (dirPath) => ipcRenderer.invoke('fs:getAllPaths', dirPath),
    getFileContent: (filePath) => ipcRenderer.invoke('fs:getFileContent', filePath),
    saveFileContent: (filePath, content) => ipcRenderer.invoke('fs:saveFileContent', { filePath, content }),
    saveFileContentSync: (filePath, content) => ipcRenderer.send('fs:saveFileContentSync', { filePath, content }),
    deleteItem: (itemPath, isFile) => ipcRenderer.invoke('fs:deleteItem', { itemPath, isFile }),
    createItem: (itemPath, isFile) => ipcRenderer.invoke('fs:createItem', { itemPath, isFile }),
    dropFile: (originalPath, targetDir) => ipcRenderer.invoke('fs:dropFile', { originalPath, targetDir }),

    // --- OS Dialog ---
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    showExitConfirm: () => ipcRenderer.invoke('dialog:showExitConfirm'),

    // --- Discord Rich Presence ---
    updateDiscordPresence: (details, state, lineCount) => ipcRenderer.invoke('update-discord-presence', { details, state, lineCount }),
    
    // --- Context Menu & Command Execution ---
    showTabContextMenu: (filePath) => ipcRenderer.send('show-tab-context-menu', filePath),
    showFileContextMenu: (itemPath, isFile) => ipcRenderer.send('show-file-context-menu', { itemPath, isFile }),
    onCloseTabFromContextMenu: (callback) => ipcRenderer.on('close-tab-from-context-menu', (event, filePath) => callback(filePath)),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    runCommand: (command, cwd) => ipcRenderer.invoke('run-command', { command, cwd }),
    onCommandOutput: (callback) => ipcRenderer.on('command-output', (event, data) => callback(data)),
    onCommandError: (callback) => ipcRenderer.on('command-error', (event, data) => callback(data)),
    onCommandClose: (callback) => ipcRenderer.on('command-close', (event, code) => callback(code)),

    // --- File Watching ---
    watchFile: (filePath) => ipcRenderer.send('watch-file', filePath),
    unwatchFile: (filePath) => ipcRenderer.send('unwatch-file', filePath),
    onFileChanged: (callback) => ipcRenderer.on('file-changed', (event, filePath) => callback(filePath)),
    
    // NEW: App control functions for reloading and switching workspaces
    reloadApp: () => ipcRenderer.send('app:reload'),
    switchWorkspace: (newId) => ipcRenderer.send('app:switch-workspace', newId),
});
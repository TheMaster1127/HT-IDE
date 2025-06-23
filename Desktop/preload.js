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

    // --- NEW: Expose Discord Rich Presence handler ---
    updateDiscordPresence: (details, state) => ipcRenderer.invoke('update-discord-presence', { details, state }),
});
// preload.js

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // --- Storage Functions ---
    storageGetAll: () => ipcRenderer.invoke('storage:get-all'),
    storageSetItem: (key, value) => ipcRenderer.invoke('storage:set-item', { key, value }),
    storageRemoveItem: (key) => ipcRenderer.invoke('storage:remove-item', key),
    storageClear: () => ipcRenderer.invoke('storage:clear'),

    // --- File System Functions ---
    getAllPaths: (dirPath) => ipcRenderer.invoke('fs:getAllPaths', dirPath),
    getFileContent: (filePath) => ipcRenderer.invoke('fs:getFileContent', filePath),
    readFileRelativeSync: (baseFile, targetPath) => ipcRenderer.sendSync('fs:read-file-relative-sync', { baseFile, targetPath }),
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
    getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
    runCommand: (terminalId, command, cwd) => ipcRenderer.invoke('run-command', { terminalId, command, cwd }),
    runCommandSequence: (terminalId, commands, cwd) => ipcRenderer.invoke('run-command-sequence', { terminalId, commands, cwd }),
    onCommandOutput: (callback) => ipcRenderer.on('command-output', (event, data) => callback(data)),
    onCommandError: (callback) => ipcRenderer.on('command-error', (event, data) => callback(data)),
    onCommandClose: (callback) => ipcRenderer.on('command-close', (event, data) => callback(data)),
    onTerminalUpdateCwd: (callback) => ipcRenderer.on('terminal:update-cwd', (event, data) => callback(data)),
    terminalWriteToStdin: (terminalId, data) => ipcRenderer.send('terminal:write-to-stdin', { terminalId, data }),
    terminalKillProcess: (terminalId) => ipcRenderer.send('terminal:kill-process', terminalId),
    terminalAutocomplete: (terminalId, partial, cwd) => ipcRenderer.invoke('terminal:autocomplete', { terminalId, partial, cwd }),

    // --- File Watching ---
    watchFile: (filePath) => ipcRenderer.send('watch-file', filePath),
    unwatchFile: (filePath) => ipcRenderer.send('unwatch-file', filePath),
    onFileChanged: (callback) => ipcRenderer.on('file-changed', (event, filePath) => callback(filePath)),
    watchDirectory: (dirPath) => ipcRenderer.send('fs:watch-directory', dirPath),
    onDirectoryChanged: (callback) => ipcRenderer.on('fs:directory-changed', () => callback()),
    
    // --- App control functions ---
    reloadApp: () => ipcRenderer.send('app:reload'),
    switchWorkspace: (newId) => ipcRenderer.send('app:switch-workspace', newId),
    setZoomLevel: (level) => ipcRenderer.send('app:set-zoom-level', level),

    // --- HTTP Server ---
    toggleHttpServer: (rootPath, port, defaultFile, terminalId) => ipcRenderer.invoke('http:toggle', { rootPath, port, defaultFile, terminalId }),
    onHttpServerLog: (callback) => ipcRenderer.on('http-server-log', (event, data) => callback(data)),

    // --- PLUGIN API ---
    pluginsFetchMarketplace: () => ipcRenderer.invoke('plugins:fetch-marketplace'),
    pluginsFetchFile: (url) => ipcRenderer.invoke('plugins:fetch-file', url),
    pluginsFetchReadme: (pluginName) => ipcRenderer.invoke('plugins:fetch-readme', pluginName), // ADDED THIS LINE
    pluginsInstall: (pluginName, files) => ipcRenderer.invoke('plugins:install', { pluginName, files }),
    pluginsGetInstalled: () => ipcRenderer.invoke('plugins:get-installed'),
    pluginsGetCode: (pluginId) => ipcRenderer.invoke('plugins:get-code', pluginId),
    pluginsDelete: (pluginId) => ipcRenderer.invoke('plugins:delete', pluginId),
    pluginsLoadLocal: () => ipcRenderer.invoke('plugins:load-local'), // ADDED THIS LINE

});
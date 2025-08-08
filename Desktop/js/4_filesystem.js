// --- Virtual Filesystem & Command Functions ---

const getAllPaths = async () => {
    try {
        const paths = await window.electronAPI.getAllPaths(currentDirectory);
        return paths.sort((a, b) => {
            if (a.isFile === b.isFile) {
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            }
            return a.isFile ? 1 : -1;
        });
    } catch (error) {
        console.error("Error fetching paths from main process:", error);
        return [];
    }
};

async function saveFileContent(filename, content, silent = false) {
    if (!filename) return;
    
    window.electronAPI.unwatchFile(filename);

    try {
        await window.electronAPI.saveFileContent(filename, content);
        if (fileSessions.has(filename)) {
            fileSessions.get(filename).getUndoManager().markClean();
            checkDirtyState(filename);
        }
        if (!silent && getActiveTerminalSession()) {
            getActiveTerminalSession().xterm.writeln(`\x1b[32mFile saved: ${filename}\x1b[0m`);
        }
    } catch (error) {
        console.error(`Failed to save file ${filename}:`, error);
        if (getActiveTerminalSession()) {
            getActiveTerminalSession().xterm.writeln(`\x1b[31mError saving file: ${error.message}\x1b[0m`);
        }
    } finally {
        if (filename === currentOpenFile) {
            window.electronAPI.watchFile(filename);
        }
    }
}

function saveFileContentSync(filename, content) {
    if (!filename) return;
    try {
        window.electronAPI.saveFileContentSync(filename, content);
    } catch (error) {
        console.error(`Failed to save file synchronously ${filename}:`, error);
    }
}

async function deleteItem(pathToDelete, isFile) {
    const message = `Are you sure you want to delete the ${isFile ? "file" : "folder"} "${pathToDelete}"? This is permanent!`;
    openConfirmModal("Confirm Deletion", message, async (confirmed) => {
        if (!confirmed) return;

        // --- FIX: Stop watching all files inside a folder before deleting it ---
        if (!isFile) {
            openTabs.forEach(tabPath => {
                if (tabPath.startsWith(pathToDelete + (pathToDelete.includes('\\') ? '\\' : '/'))) {
                    window.electronAPI.unwatchFile(tabPath);
                }
            });
        }

        const { success, error } = await window.electronAPI.deleteItem(pathToDelete, isFile);
        if (!success) {
            return alert(`Error deleting item: ${error}`);
        }
        
        const activeTerm = getActiveTerminalSession();
        if (activeTerm) {
            activeTerm.xterm.writeln(`\x1b[31mDeleted: ${pathToDelete}\x1b[0m`);
        }

        const tabsToClose = openTabs.filter(tabPath => isFile ? tabPath === pathToDelete : tabPath.startsWith(pathToDelete + (pathToDelete.includes('\\') ? '\\' : '/')));
        const isActiveFileDeleted = tabsToClose.includes(currentOpenFile);

        for (const tabPath of tabsToClose) {
            const index = openTabs.indexOf(tabPath);
            if (index > -1) openTabs.splice(index, 1);
            fileSessions.delete(tabPath);
            lsRemove('state_' + tabPath);
            if (isFile) recentlyClosedTabs.push(tabPath);
            // Redundant unwatch call, but safe to keep.
            window.electronAPI.unwatchFile(tabPath);
        }

        if (isActiveFileDeleted) {
            currentOpenFile = null;
            const nextFileToOpen = openTabs[0] || null;
            if (nextFileToOpen) {
                await openFileInEditor(nextFileToOpen);
            } else {
                editor.setSession(ace.createEditSession("// No file open."));
                editor.setReadOnly(true);
                document.getElementById('htvm-controls').style.display = 'none';
                // MODIFICATION: Removed redundant renderAll call.
                // Tab rendering is handled by the logic above, and file list
                // rendering is handled by the directory watcher.
                renderTabs();
                renderTerminalTabs();
            }
        } else {
             // MODIFICATION: Removed redundant renderAll call.
             renderTabs();
             renderTerminalTabs();
        }
    });
}

async function handleNewFile() {
    openInputModal('New File', 'Enter file name:', '', async (name) => {
        if (!name?.trim()) return;

        const path = (currentDirectory.endsWith('/') || currentDirectory.endsWith('\\')) 
            ? `${currentDirectory}${name}` 
            : `${currentDirectory}/${name}`;
        
        const allPaths = (await getAllPaths()).map(p => p.path);
        if (allPaths.includes(path)) {
            alert("A file with that name already exists.");
            return;
        }

        const { success, error } = await window.electronAPI.createItem(path, true);
        if (success) {
            await openFileInEditor(path);
        } else {
            alert(`Error creating file: ${error}`);
        }
    });
}

async function handleNewFolder() {
    openInputModal('New Folder', 'Enter folder name:', '', async (name) => {
        if (!name?.trim()) return;
        
        let basePath = (currentDirectory.endsWith('/') || currentDirectory.endsWith('\\')) 
            ? currentDirectory 
            : `${currentDirectory}/`;
        const path = `${basePath}${name}`;
        
        const allPaths = (await getAllPaths()).map(p => p.path);
        if (allPaths.some(p => p.startsWith(path))) {
            alert("A folder with that name already exists.");
            return;
        }
        
        const { success, error } = await window.electronAPI.createItem(path, false);
        if (success) {
            // MODIFICATION: Removed redundant renderFileList call.
            // The directory watcher will automatically handle this refresh.
        } else {
             alert(`Error creating folder: ${error}`);
        }
    });
}

async function handleOpenFolder() {
    const result = await window.electronAPI.openDirectory();
    if (result && result.length > 0) {
        setCurrentDirectory(result[0]);
    }
}

async function runPropertyCommand(type) {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) {
        alert("No active terminal found to run the command.");
        return;
    }

    if (!currentOpenFile) {
        activeSession.xterm.writeln(`\x1b[31mError: No file is open to ${type}.\x1b[0m`);
        return;
    }

    await saveFileContent(currentOpenFile, editor.getValue());

    const fileExt = currentOpenFile.split('.').pop();
    const propExt = type === 'compile' ? 'htpc' : 'htpr';
    const propFileName = `${fileExt}.${propExt}`;
    
    const appPath = await window.electronAPI.getAppPath();
    const separator = appPath.includes('\\') ? '\\' : '/';
    const propFilePath = `${appPath}${separator}property files${separator}${propFileName}`;

    const commandsStr = await window.electronAPI.getFileContent(propFilePath);
    if (!commandsStr) {
        activeSession.xterm.writeln(`\x1b[33mWarning: No property file found for ".${fileExt}" files (${propFileName}).\x1b[0m`);
        activeSession.isExecuting = false;
        writePrompt(activeSession);
        return;
    }

    const dirFullPath = currentOpenFile.substring(0, currentOpenFile.lastIndexOf(separator));
    const onlyFileName = currentOpenFile.substring(currentOpenFile.lastIndexOf(separator) + 1).split('.').slice(0, -1).join('.');
    
    const rawCommands = commandsStr.split(/[\r\n]+/).filter(cmd => cmd.trim() && !cmd.trim().startsWith(';'));

    const processedCommands = rawCommands.map(command => {
        let processedCmd = command.replace(/%FILENAME%/g, currentOpenFile);
        processedCmd = processedCmd.replace(/%ONLYFILENAME%/g, onlyFileName);
        processedCmd = processedCmd.replace(/%DIRFULLPATH%/g, dirFullPath);
        activeSession.xterm.writeln(`\x1b[36m> ${processedCmd}\x1b[0m`);
        return processedCmd;
    });

    // MODIFIED: Pass the active terminal ID to the sequence handler
    await window.electronAPI.runCommandSequence(activeSession.id, processedCommands, dirFullPath);
}
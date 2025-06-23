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

// MODIFIED: Temporarily unwatches a file during save to prevent the "changed on disk"
// prompt from being incorrectly triggered by the app's own save action.
async function saveFileContent(filename, content, silent = false) {
    if (!filename) return;
    
    // Stop watching the file to prevent the save action from triggering a "file changed" event.
    window.electronAPI.unwatchFile(filename);

    try {
        await window.electronAPI.saveFileContent(filename, content);
        if (fileSessions.has(filename)) {
            // Mark the session as clean (no unsaved changes).
            fileSessions.get(filename).getUndoManager().markClean();
            checkDirtyState(filename);
        }
        if (!silent && term) term.writeln(`\x1b[32mFile saved: ${filename}\x1b[0m`);
    } catch (error) {
        console.error(`Failed to save file ${filename}:`, error);
        if (term) term.writeln(`\x1b[31mError saving file: ${error.message}\x1b[0m`);
    } finally {
        // Resume watching the file only if it is the currently active file in the editor.
        if (filename === currentOpenFile) {
            window.electronAPI.watchFile(filename);
        }
    }
}

function saveFileContentSync(filename, content) {
    if (!filename) return;
    try {
        window.electronAPI.saveFileContentSync(filename, content);
    } catch (error) { // <-- FIXED: Removed incorrect '=>' token here.
        console.error(`Failed to save file synchronously ${filename}:`, error);
    }
}

async function deleteItem(pathToDelete, isFile) {
    if (!confirm(`Are you sure you want to delete the ${isFile ? "file" : "folder"} "${pathToDelete}"? This is permanent!`)) return;

    const { success, error } = await window.electronAPI.deleteItem(pathToDelete, isFile);
    if (!success) {
        return alert(`Error deleting item: ${error}`);
    }

    term.writeln(`\x1b[31mDeleted: ${pathToDelete}\x1b[0m`);

    const tabsToClose = openTabs.filter(tabPath => isFile ? tabPath === pathToDelete : tabPath.startsWith(pathToDelete + (pathToDelete.includes('\\') ? '\\' : '/')));
    const isActiveFileDeleted = tabsToClose.includes(currentOpenFile);

    for (const tabPath of tabsToClose) {
        const index = openTabs.indexOf(tabPath);
        if (index > -1) openTabs.splice(index, 1);
        fileSessions.delete(tabPath);
        lsRemove('state_' + tabPath);
        if (isFile) recentlyClosedTabs.push(tabPath);
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
            await renderAll();
        }
    } else {
        await renderAll();
    }
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
            await renderFileList();
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

// --- NEW: Property File Command Runner ---
async function runPropertyCommand(type) {
    if (!currentOpenFile) {
        term.writeln(`\x1b[31mError: No file is open to ${type}.\x1b[0m`);
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
        term.writeln(`\x1b[33mWarning: No property file found for ".${fileExt}" files (${propFileName}).\x1b[0m`);
        printExecutionEndMessage();
        return;
    }

    const dirFullPath = currentOpenFile.substring(0, currentOpenFile.lastIndexOf(separator));
    const onlyFileName = currentOpenFile.substring(currentOpenFile.lastIndexOf(separator) + 1).split('.').slice(0, -1).join('.');
    
    const commands = commandsStr.split(/[\r\n]+/).filter(cmd => cmd.trim() && !cmd.trim().startsWith(';'));

    for (const command of commands) {
        let processedCmd = command.replace(/%FILENAME%/g, currentOpenFile);
        processedCmd = processedCmd.replace(/%ONLYFILENAME%/g, onlyFileName);
        processedCmd = processedCmd.replace(/%DIRFULLPATH%/g, dirFullPath);
        
        term.writeln(`\x1b[36m> ${processedCmd}\x1b[0m`);
        await window.electronAPI.runCommand(processedCmd, dirFullPath);
    }
}
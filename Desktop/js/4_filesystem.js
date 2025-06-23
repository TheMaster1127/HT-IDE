// --- Virtual Filesystem Functions ---

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
    try {
        await window.electronAPI.saveFileContent(filename, content);
        if (fileSessions.has(filename)) {
            fileSessions.get(filename).getUndoManager().markClean();
            checkDirtyState(filename);
        }
        if (!silent && term) term.writeln(`\x1b[32mFile saved: ${filename}\x1b[0m`);
    } catch (error) {
        console.error(`Failed to save file ${filename}:`, error);
        if (term) term.writeln(`\x1b[31mError saving file: ${error.message}\x1b[0m`);
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
    if (!confirm(`Are you sure you want to delete the ${isFile ? "file" : "folder"} "${pathToDelete}"? This is permanent!`)) return;

    const { success, error } = await window.electronAPI.deleteItem(pathToDelete, isFile);
    if (!success) {
        return alert(`Error deleting item: ${error}`);
    }

    term.writeln(`\x1b[31mDeleted: ${pathToDelete}\x1b[0m`);

    // --- STATE UPDATE ---
    // 1. Get a list of all tab paths that will be affected by this deletion
    const tabsToClose = openTabs.filter(tabPath => {
        if (isFile) {
            return tabPath === pathToDelete;
        } else {
            // It's a directory. Check if the tab path starts with the directory path.
            const separator = pathToDelete.includes('\\') ? '\\' : '/';
            return tabPath.startsWith(pathToDelete + separator);
        }
    });
    
    // 2. Check if the currently active file is among those to be closed
    const isActiveFileDeleted = tabsToClose.includes(currentOpenFile);

    // 3. Clean up all state related to the affected tabs
    for (const tabPath of tabsToClose) {
        const index = openTabs.indexOf(tabPath);
        if (index > -1) {
            openTabs.splice(index, 1);
        }
        fileSessions.delete(tabPath);
        lsRemove('state_' + tabPath);
        if (isFile) {
            recentlyClosedTabs.push(tabPath);
        }
    }

    // --- RENDER ---
    // 4. Decide what to render next, now that the state is clean
    if (isActiveFileDeleted) {
        currentOpenFile = null;
        const nextFileToOpen = openTabs[0] || null;

        if (nextFileToOpen) {
            await openFileInEditor(nextFileToOpen); // This will handle all rendering
        } else {
            // No tabs left, clear editor and render the empty state
            editor.setSession(ace.createEditSession("// No file open."));
            editor.setReadOnly(true);
            document.getElementById('htvm-controls').style.display = 'none';
            await renderAll();
        }
    } else {
        // The active file wasn't deleted, just refresh the UI
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
            let newFileContent = '';
            if (path.endsWith('.htvm')) {
                const instructions = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
                const commentChar = (instructions && instructions.length > 100) ? instructions[100] : ';';
                newFileContent = `${commentChar.trim()} Welcome!`;
                await saveFileContent(path, newFileContent, true);
            }
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
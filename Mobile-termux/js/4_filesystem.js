// --- Filesystem & Command Functions (Flask API Version) ---

// Helper for making API calls
async function apiCall(endpoint, body) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
        const term = getActiveTerminalSession()?.xterm;
        if (term) {
            term.writeln(`\x1b[31mAPI Error: ${error.message}\x1b[0m`);
        }
        return null;
    }
}


const getAllPaths = async () => {
    const paths = await apiCall('/api/fs/list', { path: currentDirectory });
    if (!paths) return [];

    return paths.sort((a, b) => {
        if (a.isFile === b.isFile) {
            return a.name.localeCompare(b.name, undefined, { numeric: true });
        }
        return a.isFile ? 1 : -1;
    });
};

async function getFileContent(filename) {
    const result = await apiCall('/api/fs/get', { path: filename });
    return result ? result.content : null;
}

async function saveFileContent(filename, content, silent = false) {
    if (!filename) return;

    const result = await apiCall('/api/fs/save', { path: filename, content: content });
    
    if (result && result.success) {
        if (fileSessions.has(filename)) {
            fileSessions.get(filename).getUndoManager().markClean();
            checkDirtyState(filename);
        }
        if (!silent && getActiveTerminalSession()) {
            getActiveTerminalSession().xterm.writeln(`\x1b[32mFile saved: ${filename}\x1b[0m`);
        }
    }
}

async function saveFileContentSync(filename, content) {
    // True sync is not possible with fetch, but we can make it blocking.
    // In beforeunload, we can't use async, but beacon might work.
    // For simplicity, we'll just call the async version and hope for the best on unload.
    if (!filename) return;
    await saveFileContent(filename, content, true);
}

async function deleteItem(pathToDelete, isFile) {
    const message = `Are you sure you want to delete the ${isFile ? "file" : "folder"} "${pathToDelete}"? This is permanent!`;
    openConfirmModal("Confirm Deletion", message, async (confirmed) => {
        if (!confirmed) return;

        const result = await apiCall('/api/fs/delete', { path: pathToDelete, isFile: isFile });
        if (!result || !result.success) {
            return alert(`Error deleting item: ${result?.error || 'Unknown error'}`);
        }
        
        const activeTerm = getActiveTerminalSession();
        if (activeTerm) {
            activeTerm.xterm.writeln(`\x1b[31mDeleted: ${pathToDelete}\x1b[0m`);
        }

        const tabsToClose = openTabs.filter(tabPath => isFile ? tabPath === pathToDelete : tabPath.startsWith(pathToDelete + '/'));
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
    });
}

async function handleNewFile() {
    openInputModal('New File', 'Enter file name:', '', async (name) => {
        if (!name?.trim()) return;
        
        const path = (currentDirectory === '/' ? '' : currentDirectory) + `/${name}`;
        
        const allPaths = (await getAllPaths()).map(p => p.path);
        if (allPaths.includes(path)) {
            alert("A file with that name already exists.");
            return;
        }

        const result = await apiCall('/api/fs/create', { path: path, isFile: true });
        if (result && result.success) {
            await openFileInEditor(path);
        } else {
            alert(`Error creating file: ${result?.error || 'Unknown error'}`);
        }
    });
}

async function handleNewFolder() {
    openInputModal('New Folder', 'Enter folder name:', '', async (name) => {
        if (!name?.trim()) return;
        
        const path = (currentDirectory === '/' ? '' : currentDirectory) + `/${name}`;
        
        const allPaths = (await getAllPaths()).map(p => p.path);
        if (allPaths.some(p => p.startsWith(path))) {
            alert("A folder with that name already exists.");
            return;
        }
        
        const result = await apiCall('/api/fs/create', { path: path, isFile: false });
        if (result && result.success) {
            await renderFileList();
        } else {
             alert(`Error creating folder: ${result?.error || 'Unknown error'}`);
        }
    });
}

async function handleOpenFolder() {
    // This functionality is not available in the web version.
    alert("Changing the root folder must be done by restarting the server in a new directory.");
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
    
    const term = getActiveTerminalSession()?.xterm;
    if(term) {
        term.writeln(`\x1b[33mRunning property commands (.htpc/.htpr) is not supported in the web version.\x1b[0m`);
        term.writeln(`\x1b[33mPlease run commands manually in the terminal.\x1b[0m`);
        writePrompt(activeSession);
    }
}
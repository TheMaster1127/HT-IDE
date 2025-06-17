// --- Virtual Filesystem Functions ---

const getAllPaths = () => {
    const p = new Set();
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(STORAGE_PREFIX)) {
            const tp = k.substring(STORAGE_PREFIX.length);
            if (tp.startsWith('file_')) p.add(tp.substring(5));
            if (tp.startsWith('folder_')) p.add(tp.substring(7));
        }
    }
    return Array.from(p).sort((a, b) => a.localeCompare(b, void 0, { numeric: true }));
};

function saveFileContent(filename, content, silent = false) {
    if (!filename) return;
    lsSet('file_' + filename, content);
    if (fileSessions.has(filename)) {
        fileSessions.get(filename).getUndoManager().markClean();
        checkDirtyState(filename);
    }
    if (!silent && term) term.writeln(`\x1b[32mFile saved: ${filename}\x1b[0m`);
}

function deleteItem(path, isFile) {
    if (!confirm(`Are you sure you want to delete the ${isFile ? "file" : "folder"} "${path}"?`)) return;
    const pathsToDelete = isFile ? [path] : getAllPaths().filter(p => p.startsWith(path));
    pathsToDelete.forEach(p => {
        lsRemove(p.endsWith('/') ? 'folder_' + p : 'file_' + p);
        lsRemove('state_' + p);
        fileSessions.delete(p);
        closeTab(p, true);
    });
    term.writeln(`\x1b[31m${isFile ? "File" : "Folder"} deleted: ${path}\x1b[0m`);

    const sessionList = lsGet('session_list') || [];
    sessionList.forEach(sessionName => {
        let sessionTabs = lsGet(`session_data_${sessionName}`);
        const initialLength = sessionTabs.length;
        sessionTabs = sessionTabs.filter(tabPath => !pathsToDelete.includes(tabPath));
        if (sessionTabs.length < initialLength) {
            lsSet(`session_data_${sessionName}`, sessionTabs);
            term.writeln(`\x1b[33mUpdated session "${sessionName}" to remove deleted files.\x1b[0m`);
        }
    });
    renderFileList();
}

function handleNewFile() {
    const name = prompt("File name:");
    if (name?.trim()) {
        const path = currentDirectory === '/' ? name : `${currentDirectory}${name}`;
        if (getAllPaths().includes(path)) {
            alert("File exists.");
            return;
        }
        let newFileContent = '';
        if (path.endsWith('.htvm')) {
            const instructions = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
            const commentChar = (instructions && instructions.length > 100) ? instructions[100] : ';';
            newFileContent = `${commentChar.trim()} Welcome!`;
        }
        saveFileContent(path, newFileContent, true);
        openFileInEditor(path);
    }
}

function handleNewFolder() {
    const name = prompt("Folder name:");
    if (name?.trim()) {
        const path = (currentDirectory === '/' ? name : `${currentDirectory}${name}`) + '/';
        if (getAllPaths().some(p => p.startsWith(path))) {
            alert("Folder exists.");
            return;
        }
        lsSet(`folder_${path}`, true);
        renderFileList();
    }
}
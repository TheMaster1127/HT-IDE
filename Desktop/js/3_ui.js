// --- Drag & Drop State ---
let draggedTab = null;
// MODIFIED: This global is removed, each terminal will have its own CWD.
// let terminalCwd = '/'; 

// --- UI Rendering Functions ---
async function renderAll() {
    await renderFileList();
    renderTabs();
    renderTerminalTabs();
}

async function renderFileList() {
    const el = document.getElementById('file-list');
    el.innerHTML = '';
    
    el.ondragover = (e) => {
        e.preventDefault();
        el.style.backgroundColor = 'var(--sidebar-file-active-bg)';
    };
    el.ondragleave = el.ondragend = () => {
        el.style.backgroundColor = '';
    };
    el.ondrop = async (e) => {
        e.preventDefault();
        el.style.backgroundColor = '';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            for (const file of files) {
                await window.electronAPI.dropFile(file.path, currentDirectory);
            }
            await renderFileList();
        }
    };

    const allPaths = await getAllPaths();

    if (currentDirectory !== '/') {
        const li = document.createElement('li');
        li.innerHTML = `<strong>📁 ..</strong>`;
        li.onclick = () => {
            let parentDir = currentDirectory.replace(/[\/\\]$/, '').split(/[\/\\]/).slice(0, -1).join('/');
            if (parentDir === '' || /^[a-zA-Z]:$/.test(parentDir)) {
                 setCurrentDirectory('/');
            } else {
                 setCurrentDirectory(parentDir + '/');
            }
        };
        el.appendChild(li);
    }

    allPaths.forEach(item => {
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = 'file-item-name';
        span.textContent = item.name;
        li.title = item.path;

        let iconElement;
        if (item.isFile) {
            if (item.icon) {
                iconElement = document.createElement('img');
                iconElement.src = `assets/${item.icon}`;
                iconElement.className = 'file-icon';
            } else {
                iconElement = document.createTextNode('📄 ');
            }
        } else {
            iconElement = document.createTextNode('📁 ');
        }
        li.appendChild(iconElement);

        li.onclick = () => (item.isFile ? openFileInEditor(item.path) : setCurrentDirectory(item.path + '/'));

        li.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            window.electronAPI.showFileContextMenu(item.path, item.isFile);
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.style.cssText = 'background:none;border:none;color:#aaa;cursor:pointer;margin-left:auto;visibility:hidden;';
        li.onmouseenter = () => delBtn.style.visibility = 'visible';
        li.onmouseleave = () => delBtn.style.visibility = 'hidden';
        
        delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteItem(item.path, item.isFile);
        };

        li.appendChild(span);
        li.appendChild(delBtn);
        el.appendChild(li);
    });

    updateActiveFileVisuals(currentOpenFile);
}

function renderTabs() {
    const container = document.getElementById('tabs-container');
    container.innerHTML = '';
    openTabs.forEach(filename => {
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.filename = filename;
        tab.title = filename;
        tab.draggable = true;

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = filename.replace(/^.*[\\\/]/, '');
        tab.appendChild(name);

        const close = document.createElement('span');
        close.textContent = '×';
        close.className = 'close-tab';
        close.onclick = e => {
            e.stopPropagation();
            handleCloseTabRequest(filename);
        };
        tab.appendChild(close);
        
        tab.addEventListener('dragstart', handleDragStart);
        tab.addEventListener('dragend', handleDragEnd);
        tab.addEventListener('dragover', handleDragOver);
        tab.addEventListener('dragleave', handleDragLeave);
        tab.addEventListener('drop', handleDrop);
        
        tab.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            window.electronAPI.showTabContextMenu(filename);
        });
        
        tab.onclick = () => openFileInEditor(filename);
        container.appendChild(tab);
        checkDirtyState(filename);
    });
    updateActiveFileVisuals(currentOpenFile);
}

// --- NEW: Terminal UI Functions ---

function renderTerminalTabs() {
    const container = document.getElementById('terminal-tabs-container');
    // Clear existing tabs, but not the '+' button
    while (container.firstChild && container.firstChild.id !== 'new-terminal-btn') {
        container.removeChild(container.firstChild);
    }

    const newBtn = document.getElementById('new-terminal-btn');
    
    terminalSessions.forEach(session => {
        const tab = document.createElement('div');
        tab.className = 'terminal-tab';
        tab.dataset.id = session.id;
        tab.textContent = `Terminal ${session.id}`;
        if (session.id === activeTerminalId) {
            tab.classList.add('active');
        }

        tab.onclick = () => handleSwitchTerminal(session.id);

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-terminal-tab';
        closeBtn.textContent = '×';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            handleCloseTerminal(session.id);
        };
        tab.appendChild(closeBtn);

        container.insertBefore(tab, newBtn);
    });
}

async function handleNewTerminal() {
    // MODIFIED: Check if this is the first terminal *before* adding the new one.
    const isFirstTerminal = terminalSessions.size === 0;
    const id = isFirstTerminal ? 1 : Math.max(...Array.from(terminalSessions.keys())) + 1;
    const homeDir = await window.electronAPI.getHomeDir();

    const session = {
        id: id,
        xterm: null,
        fitAddon: null,
        cwd: currentDirectory === '/' ? homeDir : currentDirectory,
        isExecuting: false,
        commandHistory: [],
        historyIndex: -1,
        currentLine: "",
        cursorPos: 0,
        processInputLine: ""
    };

    terminalSessions.set(id, session);
    await handleSwitchTerminal(id); // This will create the DOM elements and xterm instance
    renderTerminalTabs();
    
    // MODIFIED: If it's the very first terminal, write the welcome message.
    if (isFirstTerminal && session.xterm) {
        session.xterm.writeln(`\x1b[1;32mWelcome to HT-IDE! (Workspace ID: ${IDE_ID})\x1b[0m`);
    }

    // Focus the new terminal
    const activeSession = getActiveTerminalSession();
    if(activeSession && activeSession.xterm) {
        activeSession.xterm.focus();
    }
}

function handleCloseTerminal(id) {
    const session = terminalSessions.get(id);
    if (session) {
        window.electronAPI.terminalKillProcess(id);
        session.xterm.dispose();
        session.pane.remove();
        terminalSessions.delete(id);
    }

    if (activeTerminalId === id) {
        const remainingIds = Array.from(terminalSessions.keys());
        const newActiveId = remainingIds.length > 0 ? remainingIds[0] : null;
        if (newActiveId) {
            handleSwitchTerminal(newActiveId);
        } else {
            activeTerminalId = null;
        }
    }
    
    renderTerminalTabs();
}

async function handleSwitchTerminal(id) {
    if (activeTerminalId === id && terminalSessions.get(id)?.xterm) return; // Already active

    activeTerminalId = id;
    const panesContainer = document.getElementById('terminal-panes');
    
    // Hide all panes
    document.querySelectorAll('.terminal-pane').forEach(p => p.classList.remove('active'));

    let session = terminalSessions.get(id);
    if (!session.pane) {
        // Create the DOM element and xterm instance if it doesn't exist
        session.pane = document.createElement('div');
        session.pane.className = 'terminal-pane';
        session.pane.dataset.id = id;
        panesContainer.appendChild(session.pane);

        // This is where the magic happens - `createTerminalInstanceForSession` is defined in 8_main.js
        await createTerminalInstanceForSession(session);
        writePrompt(session);
    }
    
    session.pane.classList.add('active');
    renderTerminalTabs();

    if (session.xterm) {
        session.xterm.focus();
        session.fitAddon.fit();
    }
}


// --- END: Terminal UI Functions ---

function updateActiveFileVisuals(filename) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filename === filename));
    const activeFileItem = Array.from(document.querySelectorAll('#file-list li')).find(li => li.title === filename);
    document.querySelectorAll('#file-list li').forEach(li => li.classList.remove('active-file-list-item'));
    if (activeFileItem) {
        activeFileItem.classList.add('active-file-list-item');
    }
}

function checkDirtyState(filename) {
    const tab = document.querySelector(`.tab[data-filename="${filename}"]`);
    if (!tab) return;
    const isDirty = fileSessions.has(filename) && !fileSessions.get(filename).getUndoManager().isClean();
    tab.classList.toggle('dirty', isDirty);
}

async function setCurrentDirectory(path) {
    const homeDir = await window.electronAPI.getHomeDir();
    if (path === '/') {
        currentDirectory = '/';
    } else {
        currentDirectory = path.replace(/[\\\/]$/, '') + '/';
    }
    
    document.getElementById('current-path-display').textContent = currentDirectory;
    lsSet('lastCwd', currentDirectory);
    
    const activeSession = getActiveTerminalSession();
    if(activeSession && !activeSession.isExecuting) {
        const newCwd = currentDirectory === '/' ? homeDir : currentDirectory;
        activeSession.cwd = newCwd;
        activeSession.xterm.writeln(`\r\n(Directory changed to: ${newCwd})`);
        writePrompt(activeSession);
    }
    
    renderFileList();
}

const toggleDropdown = () => {
    const el = document.getElementById('lang-dropdown');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};
window.toggleDropdown = toggleDropdown;

function changeLanguage(name, img, lang) {
    document.getElementById('selected-lang-name').textContent = name;
    document.getElementById('selected-lang-img').src = img;
    lsSet('selectedLangExtension', lang);
    toggleDropdown();
}
window.changeLanguage = changeLanguage;

function initResizer(resizerEl, containerEl, lsKey, direction) {
    resizerEl.onmousedown = e => {
        e.preventDefault();
        const start = direction === 'x' ? e.clientX : e.clientY;
        const startSize = direction === 'x' ? containerEl.offsetWidth : containerEl.offsetHeight;
        const doDrag = m => {
            const delta = (direction === 'x' ? m.clientX - start : m.clientY - start);
            let newSize;
            if (direction === 'y') newSize = startSize - delta;
            else if (resizerEl.id === 'output-panel-resizer') newSize = startSize - delta;
            else newSize = startSize + delta;
            if (newSize > 100 && newSize < window[direction === 'x' ? 'innerWidth' : 'innerHeight'] - 50) {
                containerEl.style[direction === 'x' ? 'width' : 'height'] = `${newSize}px`;
                editor.resize();
                // MODIFIED: Fit all terminal addons
                terminalSessions.forEach(s => s.fitAddon?.fit());
            }
        };
        const stopDrag = () => {
            window.removeEventListener('mousemove', doDrag);
            window.removeEventListener('mouseup', stopDrag);
            lsSet(lsKey, containerEl.style[direction === 'x' ? 'width' : 'height']);
        };
        window.addEventListener('mousemove', doDrag);
        window.addEventListener('mouseup', stopDrag);
    };
}

function printExecutionEndMessage() {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) return;
    if (lsGet('clearTerminalOnRun') === true) {
        activeSession.xterm.writeln(`\n\x1b[1;31m=== Execution is over ===\x1b[0m`);
    }
}

function runHtmlCode(code) {
    const panel = document.getElementById('output-panel');
    const iframe = document.getElementById('html-output');
    iframe.srcdoc = code;
    panel.classList.add('visible');
    printExecutionEndMessage();
    const activeSession = getActiveTerminalSession();
    if (activeSession) {
        writePrompt(activeSession);
    }
}

function handleDownloadHtml() {
    const iframe = document.getElementById('html-output');
    const htmlContent = iframe.srcdoc;
    if (!htmlContent) return alert('No HTML content to download.');

    // Use the custom input modal which is already defined in 7_modals_1.js
    openInputModal(
        "Download HTML File",
        "Please enter a name for the HTML file:",
        "output.html",
        (fileName) => {
            // This is the callback function that runs after the user enters a name
            if (!fileName || !fileName.trim()) return; // User cancelled or entered an empty string

            let finalName = fileName.trim();
            if (!finalName.toLowerCase().endsWith('.html')) {
                finalName += '.html';
            }
            
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = finalName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    );
}

function handleDragStart(e) {
    draggedTab = e.target;
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    if(e.target.classList.contains('dragging')) {
      e.target.classList.remove('dragging');
    }
    document.querySelectorAll('.tab.drag-over').forEach(tab => tab.classList.remove('drag-over'));
    draggedTab = null;
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.tab');
    if (target && target !== draggedTab) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.tab');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    const targetTab = e.target.closest('.tab');
    if (!targetTab || targetTab === draggedTab) {
        return;
    }

    const draggedFilename = draggedTab.dataset.filename;
    const targetFilename = targetTab.dataset.filename;

    const draggedIndex = openTabs.indexOf(draggedFilename);
    const targetIndex = openTabs.indexOf(targetFilename);
    
    openTabs.splice(draggedIndex, 1);
    openTabs.splice(targetIndex, 0, draggedFilename);

    renderTabs();
}
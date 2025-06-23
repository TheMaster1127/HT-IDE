// --- Drag & Drop State ---
let draggedTab = null;

// --- UI Rendering Functions ---
async function renderAll() {
    await renderFileList();
    renderTabs();
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
        
        span.textContent = `${item.isFile ? '📄' : '📁'} ${item.name}`;
        li.title = item.path;

        li.onclick = () => (item.isFile ? openFileInEditor(item.path) : setCurrentDirectory(item.path + '/'));

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
        
        // --- NEW: Add context menu for right-click ---
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

function setCurrentDirectory(path) {
    if (path === '/') {
        currentDirectory = '/';
    } else {
        currentDirectory = path.replace(/[\\\/]$/, '') + '/';
    }
    
    document.getElementById('current-path-display').textContent = currentDirectory;
    lsSet('lastCwd', currentDirectory);
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
                if(fitAddon) fitAddon.fit();
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
    if (lsGet('clearTerminalOnRun') === true) {
        term.writeln(`\n\x1b[1;31m=== Execution is over ===\x1b[0m`);
        term.write('$ ');
    }
}

function runHtmlCode(code) {
    const panel = document.getElementById('output-panel');
    const iframe = document.getElementById('html-output');
    iframe.srcdoc = code;
    panel.classList.add('visible');
    printExecutionEndMessage();
}

function handleDownloadHtml() {
    const iframe = document.getElementById('html-output');
    const htmlContent = iframe.srcdoc;
    if (!htmlContent) return alert('No HTML content to download.');
    let fileName = prompt("Please enter a name for the HTML file:", "output.html")?.trim();
    if (!fileName) return;
    if (!fileName.toLowerCase().endsWith('.html')) fileName += '.html';
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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
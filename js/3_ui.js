// --- UI Rendering Functions ---

function renderAll() {
    renderFileList();
    renderTabs();
}

function renderFileList() {
    const el = document.getElementById('file-list');
    el.innerHTML = '';
    const tree = {};
    getAllPaths().forEach(p => {
        let l = tree;
        p.split('/').filter(Boolean).forEach((part, i, a) => {
            if (!l[part]) l[part] = { _children: {} };
            if (i === a.length - 1) {
                l[part]._isFile = !p.endsWith('/');
                l[part]._path = p;
            }
            l = l[part]._children;
        });
    });

    let node = tree;
    currentDirectory.split('/').filter(Boolean).forEach(part => {
        if (node && node[part]?._children) node = node[part]._children;
    });

    if (currentDirectory !== '/') {
        const li = document.createElement('li');
        li.innerHTML = `<strong>..</strong>`;
        li.onclick = () => {
            const parts = currentDirectory.split('/').filter(Boolean);
            parts.pop();
            setCurrentDirectory(parts.length ? `/${parts.join('/')}/` : '/');
        };
        el.appendChild(li);
    }

    Object.keys(node || {}).sort((a, b) => (node[a]._isFile === node[b]._isFile) ? a.localeCompare(b) : node[a]._isFile ? 1 : -1).forEach(key => {
        const item = node[key];
        const li = document.createElement('li');
        const span = document.createElement('span');
        span.className = 'file-item-name';
        span.textContent = `${item._isFile ? '📄' : '📁'} ${key}`;
        li.onclick = () => (item._isFile ? openFileInEditor(item._path) : setCurrentDirectory(item._path));

        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.style.cssText = 'background:none;border:none;color:#aaa;cursor:pointer;margin-left:auto;visibility:hidden;';
        li.onmouseenter = () => delBtn.style.visibility = 'visible';
        li.onmouseleave = () => delBtn.style.visibility = 'hidden';
        delBtn.onclick = e => {
            e.stopPropagation();
            deleteItem(item._path, item._isFile);
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

        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = filename.split('/').pop();
        tab.appendChild(name);

        const close = document.createElement('span');
        close.textContent = '×';
        close.className = 'close-tab';
        close.onclick = e => {
            e.stopPropagation();
            handleCloseTabRequest(filename);
        };
        tab.appendChild(close);
        tab.onclick = () => openFileInEditor(filename);
        container.appendChild(tab);
        checkDirtyState(filename);
    });
    updateActiveFileVisuals(currentOpenFile);
}

function updateActiveFileVisuals(filename) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.filename === filename));
    document.querySelectorAll('#file-list li').forEach(li => li.classList.toggle('active-file-list-item', li.textContent.includes(filename?.split('/').pop() || '')));
}

function checkDirtyState(filename) {
    const tab = document.querySelector(`.tab[data-filename="${filename}"]`);
    if (!tab) return;
    const isDirty = fileSessions.has(filename) && !fileSessions.get(filename).getUndoManager().isClean();
    tab.classList.toggle('dirty', isDirty);
}

function setCurrentDirectory(path) {
    currentDirectory = path;
    document.getElementById('current-path-display').textContent = path;
    lsSet('lastCwd', path);
    renderFileList();
}

const toggleDropdown = () => {
    const el = document.getElementById('lang-dropdown');
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};
window.toggleDropdown = toggleDropdown; // Make it globally accessible for onclick

function changeLanguage(name, img, lang) {
    document.getElementById('selected-lang-name').textContent = name;
    document.getElementById('selected-lang-img').src = img;
    lsSet('selectedLangExtension', lang);
    toggleDropdown();
}
window.changeLanguage = changeLanguage; // Make it globally accessible for onclick

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
                fitAddon.fit();
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
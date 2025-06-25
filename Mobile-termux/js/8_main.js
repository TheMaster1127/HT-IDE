// js/8_main.js

let hotkeyListener = null;

const tabCycleState = {
    isCycling: false,
};
window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
        tabCycleState.isCycling = false;
    }
});

function writePrompt(session) {
    if (!session || !session.xterm) return;
    session.currentLine = "";
    session.cursorPos = 0;
    session.isExecuting = false;
    const shortCwd = session.cwd.length > 30 ? `...${session.cwd.slice(-27)}` : session.cwd;
    session.xterm.write(`\r\n\x1b[1;32m${shortCwd}\x1b[0m $ `);
}
window.writePrompt = writePrompt;

async function createTerminalInstanceForSession(session) {
    session.xterm = new Terminal({
        cursorBlink: true,
        fontFamily: 'monospace',
        fontSize: 13,
        theme: { background: '#000000', foreground: '#00DD00', cursor: '#00FF00' }
    });
    session.fitAddon = new FitAddon.FitAddon();
    session.xterm.loadAddon(session.fitAddon);
    session.xterm.open(session.pane);
    session.fitAddon.fit();

    // Initialize session-specific state
    session.commandHistory = [];
    session.historyIndex = -1;
    session.currentLine = "";
    session.cursorPos = 0;

    session.xterm.onKey(async ({ key, domEvent }) => {
        const term = session.xterm;
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

        if (domEvent.ctrlKey && domEvent.key.toLowerCase() === 'c') {
            socket.emit('terminal_kill', { terminalId: session.id });
            return;
        }

        if (session.isExecuting) {
            if (socket && socket.connected) {
                socket.emit('terminal_input', { terminalId: session.id, data: key });
            }
            return;
        }

        const shortCwd = session.cwd.length > 30 ? `...${session.cwd.slice(-27)}` : session.cwd;
        const promptText = `\x1b[1;32m${shortCwd}\x1b[0m $ `;
        const promptVisibleLength = shortCwd.length + 3;

        const redrawLine = () => {
            term.write('\r\x1b[K');
            term.write(promptText + session.currentLine);
            term.write('\r\x1b[' + (promptVisibleLength + session.cursorPos) + 'C');
        };

        switch (domEvent.key) {
            case 'Enter':
                if (session.currentLine.trim()) {
                    term.writeln('');
                    session.isExecuting = true;
                    if (session.currentLine) {
                        session.commandHistory = session.commandHistory.filter(c => c !== session.currentLine);
                        session.commandHistory.unshift(session.currentLine);
                        if (session.commandHistory.length > 50) session.commandHistory.pop();
                    }
                    session.historyIndex = -1;
                    if (socket && socket.connected) {
                         socket.emit('terminal_input', { terminalId: session.id, data: session.currentLine + '\r' });
                    }
                } else {
                    writePrompt(session);
                }
                break;

            case 'Backspace':
                if (session.cursorPos > 0) {
                    session.currentLine = session.currentLine.substring(0, session.cursorPos - 1) + session.currentLine.substring(session.cursorPos);
                    session.cursorPos--;
                    redrawLine();
                }
                break;

            case 'ArrowLeft':
                if (session.cursorPos > 0) { session.cursorPos--; redrawLine(); }
                break;

            case 'ArrowRight':
                if (session.cursorPos < session.currentLine.length) { session.cursorPos++; redrawLine(); }
                break;

            case 'ArrowUp':
                if (session.historyIndex < session.commandHistory.length - 1) {
                    session.historyIndex++;
                    session.currentLine = session.commandHistory[session.historyIndex];
                    session.cursorPos = session.currentLine.length;
                    redrawLine();
                }
                break;

            case 'ArrowDown':
                if (session.historyIndex > 0) {
                    session.historyIndex--;
                    session.currentLine = session.commandHistory[session.historyIndex];
                } else {
                    session.historyIndex = -1;
                    session.currentLine = "";
                }
                session.cursorPos = session.currentLine.length;
                redrawLine();
                break;
            
            case 'Tab': {
                domEvent.preventDefault();
                const lineBeforeCursor = session.currentLine.substring(0, session.cursorPos);
                const lastWordMatch = lineBeforeCursor.match(/(?:"[^"]*"|'[^']*'|[^"\s]+)\s*$/);
                if (!lastWordMatch) break;
                
                const partial = lastWordMatch[0].trim();
                const matches = await apiCall('/api/fs/autocomplete', { partial, cwd: session.cwd });

                if (!matches || matches.length === 0) break;
                
                if (matches.length === 1) {
                    const completion = matches[0];
                    session.currentLine = session.currentLine.substring(0, lastWordMatch.index) + completion + session.currentLine.substring(session.cursorPos);
                    session.cursorPos = lastWordMatch.index + completion.length;
                    redrawLine();
                } else {
                    let lcp = '';
                    const first = matches[0];
                    for (let i = 0; i < first.length; i++) {
                        const char = first[i];
                        if (matches.every(m => m[i] === char)) { lcp += char; }
                        else { break; }
                    }

                    if (lcp.length > partial.length) {
                        session.currentLine = session.currentLine.substring(0, lastWordMatch.index) + lcp + session.currentLine.substring(session.cursorPos);
                        session.cursorPos = lastWordMatch.index + lcp.length;
                        redrawLine();
                    } else {
                        const displayNames = matches.map(m => m.split(/[\\\/]/).pop().replace(/"/g, ''));
                        term.writeln('\r\n' + displayNames.join('   '));
                        redrawLine();
                    }
                }
                break;
            }

            default:
                if (printable) {
                    session.currentLine = session.currentLine.substring(0, session.cursorPos) + key + session.currentLine.substring(session.cursorPos);
                    session.cursorPos++;
                    redrawLine();
                }
                break;
        }
    });
}
window.createTerminalInstanceForSession = createTerminalInstanceForSession;


async function handleToggleHttpServer() {
    const btn = document.getElementById('http-server-btn');
    const activeTerm = getActiveTerminalSession();
    if (!activeTerm) {
        alert("No active terminal to show server status.");
        return;
    }

    const port = lsGet('serverPort') || 8080;
    const rootPath = currentDirectory === '/' ? '' : currentDirectory; 
    
    const result = await apiCall('/api/http_server/toggle', { rootPath, port });

    if (!result) return;
        
    if (result.status === 'started') {
        isServerRunning = true;
        serverPort = result.port;
        btn.textContent = `⏹ Stop Server (Port: ${serverPort})`;
        btn.classList.add('running');
        btn.title = `Stop the local web server running on http://localhost:${serverPort}`;
        activeTerm.xterm.writeln(`\r\n\x1b[32m✔ HTTP Server started on http://localhost:${serverPort}\x1b[0m`);
        activeTerm.xterm.writeln(`\x1b[32m  Serving files from: ${rootPath || '/'}\x1b[0m`);
    } else if (result.status === 'stopped') {
        isServerRunning = false;
        serverPort = null;
        btn.textContent = '▶ Start Server';
        btn.classList.remove('running');
        btn.title = 'Start a local web server in the current directory';
        activeTerm.xterm.writeln(`\r\n\x1b[31m✖ HTTP Server stopped.\x1b[0m`);
    } else if (result.status === 'error') {
        activeTerm.xterm.writeln(`\r\n\x1b[31mServer Error: ${result.message}\x1b[0m`);
    }
    writePrompt(activeTerm);
}

function applyZoomLevel(level) {
    const zoomFactor = 1.0 + (level * 0.15);
    document.body.style.zoom = zoomFactor;
}

function applyAndSetHotkeys() {
    if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener);

    const customHotkeys = lsGet('customHotkeys') || {};
    const activeHotkeys = {};
    for (const id in hotkeyConfig) {
        activeHotkeys[id] = customHotkeys[id] || hotkeyConfig[id].default;
    }

    hotkeyListener = async (e) => {
        const activeTermSession = getActiveTerminalSession();
        if (activeTermSession && activeTermSession.xterm.element.contains(document.activeElement)) {
            return;
        }

        const checkMatch = (config) => {
            if (!config) return false;
            const key = e.key.toLowerCase();
            const targetKey = config.key.toLowerCase();
            if (key !== targetKey && e.key !== config.key) return false;
            const ctrl = e.ctrlKey || e.metaKey;
            return ctrl === config.ctrl && e.shiftKey === config.shift && e.altKey === config.alt;
        };
        
        if (e.ctrlKey || e.metaKey) {
            let currentZoom = lsGet('zoomLevel') || 0;
            if (e.key === '=') { e.preventDefault(); currentZoom += 0.5; applyZoomLevel(currentZoom); lsSet('zoomLevel', currentZoom); return; }
            if (e.key === '-') { e.preventDefault(); currentZoom -= 0.5; applyZoomLevel(currentZoom); lsSet('zoomLevel', currentZoom); return; }
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'tab') {
            e.preventDefault();
            if (openTabs.length < 2) return;

            if (!tabCycleState.isCycling) {
                if (lastActiveTab && openTabs.includes(lastActiveTab) && lastActiveTab !== currentOpenFile) {
                    await openFileInEditor(lastActiveTab);
                } else {
                    await openFileInEditor(openTabs[(openTabs.indexOf(currentOpenFile) + 1) % openTabs.length]);
                }
                tabCycleState.isCycling = true; 
            } else {
                const currentIndex = openTabs.indexOf(currentOpenFile);
                let nextIndex = e.shiftKey ? (currentIndex - 1 + openTabs.length) % openTabs.length : (currentIndex + 1) % openTabs.length;
                await openFileInEditor(openTabs[nextIndex]);
            }
            return;
        }

        if (e.key === 'F5') { e.preventDefault(); await handleRun(e); return; }
        if (checkMatch(activeHotkeys.runFile)) { e.preventDefault(); await handleRun(e); }
        else if (checkMatch(activeHotkeys.compileFile)) { e.preventDefault(); await runPropertyCommand('compile'); }
        else if (checkMatch(activeHotkeys.saveFile)) { e.preventDefault(); await saveFileContent(currentOpenFile, editor.getValue()); }
        else if (checkMatch(activeHotkeys.formatFile)) {
            e.preventDefault();
            if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) { alert("The formatter only works with .htvm files."); return; }
            try { editor.session.setValue(formatHtvmCode(editor.getValue())); }
            catch (err) { getActiveTerminalSession()?.xterm.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`); }
        }
        else if (checkMatch(activeHotkeys.closeTab)) {
            e.preventDefault();
            if (openTabs.length > 0) { await handleCloseTabRequest(currentOpenFile); }
        }
        else if (checkMatch(activeHotkeys.reopenTab)) { e.preventDefault(); await handleReopenTab(); }
        else if (checkMatch(activeHotkeys.toggleSidebar)) { e.preventDefault(); document.getElementById('main-toggle-sidebar-btn').click(); }
    };

    document.addEventListener('keydown', hotkeyListener);
    updateHotkeyTitles();
}

document.addEventListener('DOMContentLoaded', async () => {
    IDE_ID = getIdeId();
    STORAGE_PREFIX = `HT-IDE-id${IDE_ID}-`;
    langTools = ace.require("ace/ext/language_tools");

    applyZoomLevel(lsGet('zoomLevel') || 0);

    applyEditorColorSettings();
    applyUiThemeSettings();

    editor = ace.edit("editor");
    
    // --- Socket.IO setup ---
    socket = io();
    socket.on('connect', () => {
        console.log('Connected to backend server.');
        terminalSessions.forEach(session => {
            if (session.pane) {
                 socket.emit('terminal_start', { terminalId: session.id, cwd: session.cwd });
            }
        });
    });
    socket.on('disconnect', () => {
        console.error('Disconnected from backend server.');
        terminalSessions.forEach(session => {
            session.xterm.writeln('\r\n\x1b[31m--- SERVER DISCONNECTED ---');
        });
    });
    socket.on('terminal_output', ({ terminalId, data }) => {
        terminalSessions.get(terminalId)?.xterm.write(data);
    });
    socket.on('terminal_close', ({ terminalId }) => {
        const session = terminalSessions.get(terminalId);
        if (session) {
            writePrompt(session);
        }
    });
    
    Object.keys(draftCompletions).forEach(lang => lsSet(`lang_completions_${lang}`, draftCompletions[lang]));

    initializeInstructionSetManagement();
    
    if (!lsGet(instructionSetKeys.activeId)) {
        promptForInitialInstructionSet();
    } else {
        await loadDefinitions();
    }

    editor.setTheme("ace/theme/monokai");
    editor.setOptions({
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        behavioursEnabled: lsGet('autoPair') !== false,
        wrap: true,
        printMargin: lsGet('printMarginColumn') || 80
    });
    editor.setShowPrintMargin(lsGet('showPrintMargin') ?? true);
    editor.setFontSize(parseInt(lsGet('fontSize') || 14, 10));

    const keybindingMode = lsGet('keybindingMode') || 'normal';
    if (keybindingMode !== 'normal') editor.setKeyboardHandler(`ace/keyboard/${keybindingMode}`);
    
    setupGutterEvents();
    editor.on('changeSelection', debounce(updateEditorModeForHtvm, 200));

    // --- Button Event Listeners ---
    document.getElementById('new-file-btn').addEventListener('click', handleNewFile);
    document.getElementById('new-folder-btn').addEventListener('click', handleNewFolder);
    document.getElementById('save-session-btn').addEventListener('click', () => openSessionModal('save'));
    document.getElementById('load-session-btn').addEventListener('click', () => openSessionModal('load'));
    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('load-instructions-btn').addEventListener('click', openInstructionManagerModal);
    document.getElementById('htvm-to-htvm-btn').addEventListener('click', openHtvmToHtvmModal);
    document.getElementById('export-import-btn').addEventListener('click', openExportImportModal);
    document.getElementById('open-folder-btn').addEventListener('click', handleOpenFolder);
    document.getElementById('new-terminal-btn').addEventListener('click', handleNewTerminal);
    document.getElementById('http-server-btn').addEventListener('click', handleToggleHttpServer);
    
    const toggleBtn = document.getElementById('main-toggle-sidebar-btn'), sidebar = document.querySelector('.sidebar'), backdrop = document.getElementById('sidebar-backdrop'), closeBtn = document.getElementById('sidebar-close-btn');
    function toggleSidebar() {
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        lsSet('sidebarCollapsed', !isCollapsed);
        const isMobileView = getComputedStyle(sidebar).position === 'absolute';
        if (isMobileView) backdrop.style.display = isCollapsed ? 'block' : 'none';
        setTimeout(() => { editor.resize(); terminalSessions.forEach(s => s.fitAddon?.fit()); }, 310);
    }
    toggleBtn.addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', toggleSidebar);
    closeBtn.addEventListener('click', toggleSidebar);

    const tabsContainer = document.getElementById('tabs-container');
    tabsContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    tabsContainer.addEventListener('drop', async (e) => { e.preventDefault(); e.stopPropagation(); });

    document.getElementById('lang-dropdown').addEventListener('click', e => { if (e.target.closest('.dropdown-item')) changeLanguage(e.target.closest('.dropdown-item').dataset.name, e.target.closest('.dropdown-item').dataset.img, e.target.closest('.dropdown-item').dataset.lang); });
    document.getElementById('run-js-after-htvm').onchange = e => lsSet('runJsAfterHtvm', e.target.checked);
    document.getElementById('full-html-checkbox').onchange = e => lsSet('fullHtml', e.target.checked);
    document.getElementById('run-btn').addEventListener('click', handleRun);
    document.getElementById('format-btn').addEventListener('click', () => {
        if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) { alert("The formatter only works with .htvm files."); return; }
        try { editor.session.setValue(formatHtvmCode(editor.getValue())); }
        catch (err) { getActiveTerminalSession()?.xterm.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`); }
    });
    document.getElementById('close-output-btn').addEventListener('click', () => document.getElementById('output-panel').classList.remove('visible'));
    document.getElementById('download-html-btn').addEventListener('click', handleDownloadHtml);

    applyAndSetHotkeys();
    
    initResizer(document.getElementById('sidebar-resizer'), document.querySelector('.sidebar'), 'sidebarWidth', 'x');
    initResizer(document.getElementById('terminal-resizer'), document.getElementById('terminal-container'), 'terminalHeight', 'y');
    initResizer(document.getElementById('output-panel-resizer'), document.getElementById('output-panel'), 'outputPanelWidth', 'x');

    await handleNewTerminal();
    
    document.getElementById('run-js-after-htvm').checked = lsGet('runJsAfterHtvm') !== false;
    document.getElementById('full-html-checkbox').checked = lsGet('fullHtml') === true;

    const savedBreakpoints = lsGet('fileBreakpoints');
    if (savedBreakpoints) { for (const file in savedBreakpoints) { fileBreakpoints.set(file, new Set(savedBreakpoints[file])); } }

    const sidebarWidth = lsGet('sidebarWidth'); if (sidebarWidth) document.querySelector('.sidebar').style.width = sidebarWidth;
    const terminalHeight = lsGet('terminalHeight'); if (terminalHeight) document.getElementById('terminal-container').style.height = terminalHeight;
    const outputWidth = lsGet('outputPanelWidth'); if (outputWidth) document.getElementById('output-panel').style.width = outputWidth;
    
    if (lsGet('sidebarCollapsed') !== false) { document.querySelector('.sidebar').classList.add('collapsed'); }
    else { document.querySelector('.sidebar').classList.remove('collapsed'); }

    const savedLang = lsGet('selectedLangExtension');
    if (savedLang) {
        const item = document.querySelector(`.dropdown-item[data-lang="${savedLang}"]`);
        if (item) {
            document.getElementById('selected-lang-name').textContent = item.dataset.name;
            document.getElementById('selected-lang-img').src = item.dataset.img;
        }
    }

    let lastCwd = lsGet('lastCwd') || '/';
    await setCurrentDirectory(lastCwd); 

    const savedOpenTabs = lsGet('openTabs') || [];
    const lastFile = lsGet('lastOpenFile');
    lastActiveTab = lsGet('lastActiveTab'); 

    for (const path of savedOpenTabs) { await openFileInEditor(path); }

    if (lastFile && openTabs.includes(lastFile)) { await openFileInEditor(lastFile); }
    else if (openTabs.length > 0) { await openFileInEditor(openTabs[0]); }
    else {
        editor.setSession(ace.createEditSession("// No file open."));
        editor.setReadOnly(true);
        renderTabs();
    }
    
    window.addEventListener('resize', debounce(() => {
        editor.resize();
        terminalSessions.forEach(s => s.fitAddon?.fit());
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        const isDesktopView = getComputedStyle(sidebar).position !== 'absolute';
        if (isDesktopView) backdrop.style.display = 'none';
    }, 200));

    window.addEventListener('beforeunload', () => {
        if (currentOpenFile) {
            saveFileContentSync(currentOpenFile, editor.getValue());
            lsSet('state_' + currentOpenFile, { scrollTop: editor.session.getScrollTop(), cursor: editor.getCursorPosition() });
        }
        terminalSessions.forEach(s => socket.emit('terminal_kill', {terminalId: s.id}));
        lsSet('openTabs', openTabs);
        lsSet('lastOpenFile', currentOpenFile);
        lsSet('lastActiveTab', lastActiveTab);
        lsSet('lastCwd', currentDirectory);

        const serializableBreakpoints = {};
        for (const [file, bpSet] of fileBreakpoints.entries()) { serializableBreakpoints[file] = Array.from(bpSet); }
        lsSet('fileBreakpoints', serializableBreakpoints);
    });

    editor.on('mousemove', function (e) {
        const tooltip = document.getElementById('value-tooltip');
        if (!tooltip || !debuggerState.isPaused) { if (tooltip) tooltip.style.display = 'none'; return; }
        
        const pos = e.getDocumentPosition();
        const token = editor.session.getTokenAt(pos.row, pos.column);

        if (token && (token.type.includes('variable') || token.type.includes('identifier'))) {
            const varName = token.value;
            if (debuggerState.scope && debuggerState.scope.hasOwnProperty(varName)) {
                let value = debuggerState.scope[varName];
                try {
                    value = JSON.stringify(value, null, 2);
                    if (value && value.length > 200) value = value.substring(0, 200) + '...';
                } catch { value = String(value); }

                tooltip.innerText = `${varName}: ${value}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            } else { tooltip.style.display = 'none'; }
        } else { tooltip.style.display = 'none'; }
    });

    setTimeout(() => {
        document.body.classList.remove('preload');
        getActiveTerminalSession()?.fitAddon.fit();
    }, 50);
});

function applyEditorColorSettings() {
    if (lsGet('syntaxHighlightingEnabled') === false) {
        document.body.classList.add('syntax-highlighting-disabled');
    } else {
        document.body.classList.remove('syntax-highlighting-disabled');
    }

    const root = document.documentElement;
    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        const savedColor = lsGet(`color_${key}`) || item.default;
        root.style.setProperty(`--${key}`, savedColor);

        if (item.isText) {
            const isBold = lsGet(`boldness_${key}`) ?? item.defaultBold;
            root.style.setProperty(`--${key}-font-weight`, isBold ? 'bold' : 'normal');
        }
    }
}

function applyUiThemeSettings() {
    const root = document.documentElement;
    for (const key in uiThemeConfig) {
        const item = uiThemeConfig[key];
        
        const savedValue = lsGet(`theme_${key}`) ?? item.default;
        const unit = item.unit || '';
        root.style.setProperty(key, savedValue + unit);
        
        if (item.hasBoldToggle) {
            const isBold = lsGet(`theme_bold_${key}`) ?? item.defaultBold;
            root.style.setProperty(key + '-bold', isBold ? 'bold' : 'normal');
        }
    }
}
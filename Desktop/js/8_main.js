// js/8_main.js

let hotkeyListener = null;

// NEW: Global state and listener for correct tab cycling.
// This is reset whenever the Control/Meta key is released.
const tabCycleState = {
    isCycling: false,
};
window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.metaKey) {
        tabCycleState.isCycling = false;
    }
});

// MODIFIED: Function to display the command prompt for a specific terminal session.
function writePrompt(session) {
    if (!session || !session.xterm) return;
    session.currentLine = "";
    session.cursorPos = 0;
    session.processInputLine = "";
    session.isExecuting = false;
    const shortCwd = session.cwd.length > 30 ? `...${session.cwd.slice(-27)}` : session.cwd;
    session.xterm.write(`\r\n\x1b[1;32m${shortCwd}\x1b[0m $ `);
}
window.writePrompt = writePrompt;

// MODIFIED: This function now contains the fully restored, robust key handling logic.
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

    // --- NEW: Shared redraw function for the command prompt ---
    const redrawLine = () => {
        const shortCwd = session.cwd.length > 30 ? `...${session.cwd.slice(-27)}` : session.cwd;
        const promptText = `\x1b[1;32m${shortCwd}\x1b[0m $ `;
        const promptVisibleLength = shortCwd.length + 3;
        session.xterm.write('\r\x1b[K'); // Clear the current line
        session.xterm.write(promptText + session.currentLine); // Redraw prompt and input
        session.xterm.write('\r\x1b[' + (promptVisibleLength + session.cursorPos) + 'C'); // Move cursor to correct position
    };
    
    // --- NEW: Context Menu (Right-Click) Handler for Pasting ---
    session.pane.addEventListener('contextmenu', async (e) => {
        e.preventDefault(); // Prevent the default browser right-click menu
        const textToPaste = await navigator.clipboard.readText();
        if (textToPaste) {
            if (session.isExecuting) {
                // Paste into a running process that is waiting for input
                session.processInputLine += textToPaste;
                session.xterm.write(textToPaste);
            } else {
                // Paste into the normal command prompt
                session.currentLine = session.currentLine.substring(0, session.cursorPos) + textToPaste + session.currentLine.substring(session.cursorPos);
                session.cursorPos += textToPaste.length;
                redrawLine();
            }
        }
    });

    // --- onKey HANDLER WITH COPY/PASTE SUPPORT ---
    session.xterm.onKey(async ({ key, domEvent }) => {
        const term = session.xterm;
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

        // --- Copy/Paste/Interrupt logic ---
        if (domEvent.ctrlKey) {
            // --- COPY / INTERRUPT (Ctrl+C) ---
            if (domEvent.key.toLowerCase() === 'c') {
                if (term.hasSelection()) {
                    domEvent.preventDefault();
                    navigator.clipboard.writeText(term.getSelection());
                } else {
                    if (session.isExecuting) {
                        window.electronAPI.terminalKillProcess(session.id);
                    } else {
                        term.write('^C');
                        writePrompt(session);
                    }
                }
                return;
            }
            // --- PASTE (Ctrl+V) ---
            if (domEvent.key.toLowerCase() === 'v') {
                domEvent.preventDefault();
                const textToPaste = await navigator.clipboard.readText();
                if (textToPaste) {
                    if (session.isExecuting) {
                        // This handles pasting into a running process that is waiting for input
                        session.processInputLine += textToPaste;
                        term.write(textToPaste);
                    } else {
                        // This handles pasting into the normal command prompt
                        session.currentLine = session.currentLine.substring(0, session.cursorPos) + textToPaste + session.currentLine.substring(session.cursorPos);
                        session.cursorPos += textToPaste.length;
                        redrawLine();
                    }
                }
                return;
            }
        }
        // --- END: Copy/Paste logic ---


        // This block handles input for a process that is already running (e.g., waiting for a password)
        if (session.isExecuting) {
            if (domEvent.key === 'Enter') {
                window.electronAPI.terminalWriteToStdin(session.id, session.processInputLine + '\n');
                term.writeln('');
                session.processInputLine = "";
            } else if (domEvent.key === 'Backspace') {
                if (session.processInputLine.length > 0) {
                    term.write('\b \b');
                    session.processInputLine = session.processInputLine.slice(0, -1);
                }
            } else if (printable) {
                session.processInputLine += key;
                term.write(key);
            }
            return;
        }

        // This block handles the interactive command prompt when no process is running
        switch (domEvent.key) {
            case 'Enter':
                if (session.currentLine.trim()) {
                    session.commandHistory = session.commandHistory.filter(c => c !== session.currentLine);
                    session.commandHistory.unshift(session.currentLine);
                    if (session.commandHistory.length > 50) session.commandHistory.pop();
                    session.historyIndex = -1;
                    term.writeln('');
                    session.isExecuting = true;
                    await window.electronAPI.runCommand(session.id, session.currentLine, session.cwd);
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
                const lastWordMatch = lineBeforeCursor.match(/([^\s]+)$/);
                if (!lastWordMatch) break;
                
                const partial = lastWordMatch[0];
                const matches = await window.electronAPI.terminalAutocomplete(session.id, partial, session.cwd);

                if (matches.length === 0) {
                    break;
                } else if (matches.length === 1) {
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

// MODIFIED: HTTP Server toggle handler now reads from settings
async function handleToggleHttpServer() {
    const btn = document.getElementById('http-server-btn');
    const activeTerm = getActiveTerminalSession();
    if (!activeTerm) {
        alert("No active terminal to show server status.");
        return;
    }

    try {
        const homeDir = await window.electronAPI.getHomeDir();
        const rootDir = currentDirectory === '/' ? homeDir : currentDirectory;
        
        // Read port and default file from settings, with defaults
        const port = lsGet('serverPort') || 8080;
        const defaultFile = lsGet('serverDefaultFile') || 'index.html';
        
        const result = await window.electronAPI.toggleHttpServer(rootDir, port, defaultFile, activeTerm.id);
        
        if (result.status === 'started') {
            isServerRunning = true;
            serverPort = result.port;
            btn.textContent = `⏹ Stop Server (Port: ${serverPort})`;
            btn.classList.add('running');
            btn.title = `Stop the local web server running on http://localhost:${serverPort}`;
            activeTerm.xterm.writeln(`\r\n\x1b[32m✔ HTTP Server started on http://localhost:${serverPort}\x1b[0m`);
            activeTerm.xterm.writeln(`\x1b[32m  Serving files from: ${rootDir}\x1b[0m`);
            writePrompt(activeTerm);
        } else if (result.status === 'stopped') {
            isServerRunning = false;
            serverPort = null;
            btn.textContent = '▶ Start Server';
            btn.classList.remove('running');
            btn.title = 'Start a local web server in the current directory';
            activeTerm.xterm.writeln(`\r\n\x1b[31m✖ HTTP Server stopped.\x1b[0m`);
            writePrompt(activeTerm);
        } else if (result.status === 'error') {
            // Error is now logged by the main process, so we just redraw the prompt.
            writePrompt(activeTerm);
        }
    } catch (error) {
        activeTerm.xterm.writeln(`\r\n\x1b[31mIPC Error toggling server: ${error.message}\x1b[0m`);
        writePrompt(activeTerm);
    }
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
            if (e.key === '=') { e.preventDefault(); currentZoom += 0.5; window.electronAPI.setZoomLevel(currentZoom); lsSet('zoomLevel', currentZoom); return; }
            if (e.key === '-') { e.preventDefault(); currentZoom -= 0.5; window.electronAPI.setZoomLevel(currentZoom); lsSet('zoomLevel', currentZoom); return; }
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
        
        // MODIFIED: The if/else if chain is critical for correct hotkey logic.
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
            if (openTabs.length === 0) { if (await window.electronAPI.showExitConfirm()) { window.close(); } }
            else { await handleCloseTabRequest(currentOpenFile); }
        }
        else if (checkMatch(activeHotkeys.reopenTab)) { e.preventDefault(); await handleReopenTab(); }
        else if (checkMatch(activeHotkeys.toggleSidebar)) { e.preventDefault(); document.getElementById('main-toggle-sidebar-btn').click(); }
        // --- THIS IS THE CRITICAL FIX ---
        else if (checkMatch(activeHotkeys.newProject)) { e.preventDefault(); await openNewProjectModal(); }
    };

    document.addEventListener('keydown', hotkeyListener);
    updateHotkeyTitles();
}

document.addEventListener('DOMContentLoaded', async () => {
    IDE_ID = getIdeId();
    STORAGE_PREFIX = `HT-IDE-id${IDE_ID}-`;
    langTools = ace.require("ace/ext/language_tools");

    window.electronAPI.setZoomLevel(lsGet('zoomLevel') || 0);

    applyEditorColorSettings();
    applyUiThemeSettings();

    editor = ace.edit("editor");
    
    // MODIFIED: Global IPC listeners now route data to the correct terminal.
    window.electronAPI.onCommandOutput(({ terminalId, data }) => {
        terminalSessions.get(terminalId)?.xterm.write(data.replace(/\n/g, "\r\n"));
    });
    window.electronAPI.onCommandError(({ terminalId, data }) => {
        terminalSessions.get(terminalId)?.xterm.write(`\x1b[31m${data.replace(/\n/g, "\r\n")}\x1b[0m`);
    });
    window.electronAPI.onCommandClose(({ terminalId, code }) => {
        const session = terminalSessions.get(terminalId);
        if (session) writePrompt(session);
    });
    window.electronAPI.onTerminalUpdateCwd(({ terminalId, newPath }) => {
        const session = terminalSessions.get(terminalId);
        if (session) session.cwd = newPath;
    });

    // MODIFIED: Added server log listener
    window.electronAPI.onHttpServerLog(({ terminalId, message }) => {
        const session = terminalSessions.get(terminalId);
        if (session && session.xterm) {
            // Write log in grey, then redraw the prompt on a new line
            session.xterm.write('\r\x1b[K'); // Clear current line
            session.xterm.writeln(`\x1b[90m${message}\x1b[0m`); // Write log in grey
            writePrompt(session); // Redraw prompt
            session.xterm.write(session.currentLine); // Rewrite user's current input
        }
    });
    
    window.electronAPI.onCloseTabFromContextMenu(async (filePath) => await handleCloseTabRequest(filePath));

    window.electronAPI.onFileChanged(async (filePath) => {
        const msg = `The file "${filePath.split(/[\\\/]/).pop()}" has changed on disk. Do you want to reload it? Your unsaved changes in the editor will be lost.`;
        if (filePath === currentOpenFile) {
            openConfirmModal("File Changed on Disk", msg, async (confirmed) => {
                if (confirmed) {
                    const newContent = await window.electronAPI.getFileContent(filePath);
                    if (newContent !== null) {
                        const session = editor.session;
                        const cursor = session.selection.getCursor();
                        const scrollTop = session.getScrollTop();
                        session.setValue(newContent);
                        session.getUndoManager().markClean();
                        checkDirtyState(filePath);
                        session.selection.moveCursorToPosition(cursor);
                        session.setScrollTop(scrollTop);
                        editor.focus();
                    }
                }
            });
        } 
        else if (openTabs.includes(filePath) && fileSessions.has(filePath)) {
            fileSessions.delete(filePath);
        }
    });
    
    const appPath = await window.electronAPI.getAppPath();
    const separator = appPath.includes('\\') ? '\\' : '/';
    await window.electronAPI.createItem(`${appPath}${separator}property files`, false);

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
    document.getElementById('new-terminal-btn').addEventListener('click', handleNewTerminal); // NEW
    // MODIFIED: Added server button listener
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
    tabsContainer.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedTab) return;
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].path) await openFileInEditor(files[0].path);
    });

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

    // MODIFIED: This call now handles its own welcome message logic.
    await handleNewTerminal(); // Create the first terminal on startup.
    
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
    
    const mainContent = document.querySelector('.main-content-wrapper');
    mainContent.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    mainContent.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (draggedTab) return;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            if (e.target.closest('#editor-container')) { for (const file of files) { if (file.path) await openFileInEditor(file.path); } }
            else {
                for (const file of files) {
                    if (file.path) {
                        const { success, error } = await window.electronAPI.dropFile(file.path, currentDirectory);
                        if (!success) getActiveTerminalSession()?.xterm.writeln(`\x1b[31mError dropping file ${file.name}: ${error}\x1b[0m`);
                    }
                }
                await renderFileList();
            }
        }
    });

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
        openTabs.forEach(tab => window.electronAPI.unwatchFile(tab));
        terminalSessions.forEach(s => window.electronAPI.terminalKillProcess(s.id));

        // MODIFIED: Ensure server is stopped on close/reload to prevent orphaned processes
        if (isServerRunning) {
            window.electronAPI.toggleHttpServer(currentDirectory, serverPort, getActiveTerminalSession()?.id);
        }

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
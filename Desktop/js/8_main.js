// js/8_main.js

let hotkeyListener = null;

// NEW: Global state and listener for correct tab cycling.
// This is reset whenever the Control/Meta key is released.
const tabCycleState = {
    isCycling: false,
};
window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta') {
        tabCycleState.isCycling = false;
    }
});

// --- NEW: Terminal Interaction State ---
let commandHistory = [];
let historyIndex = -1;
let currentLine = ""; // For building commands
let isExecuting = false;
let processInputLine = ""; // For sending input to running processes

// --- NEW: Function to display the command prompt ---
function writePrompt() {
    currentLine = "";
    processInputLine = "";
    isExecuting = false;
    const shortCwd = terminalCwd.length > 30 ? `...${terminalCwd.slice(-27)}` : terminalCwd;
    term.write(`\r\n\x1b[1;32m${shortCwd}\x1b[0m $ `);
}
window.writePrompt = writePrompt;


function applyAndSetHotkeys() {
    if (hotkeyListener) document.removeEventListener('keydown', hotkeyListener);

    const customHotkeys = lsGet('customHotkeys') || {};
    const activeHotkeys = {};
    for (const id in hotkeyConfig) {
        activeHotkeys[id] = customHotkeys[id] || hotkeyConfig[id].default;
    }

    hotkeyListener = async (e) => {
        // If the terminal is focused, let it handle the key event first.
        if (term.element.contains(document.activeElement)) {
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
            if (e.key === '=') {
                e.preventDefault();
                currentZoom += 0.5;
                window.electronAPI.setZoomLevel(currentZoom);
                lsSet('zoomLevel', currentZoom);
                return;
            }
            if (e.key === '-') {
                e.preventDefault();
                currentZoom -= 0.5;
                window.electronAPI.setZoomLevel(currentZoom);
                lsSet('zoomLevel', currentZoom);
                return;
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'tab') {
            e.preventDefault();
            if (openTabs.length < 2) return;

            if (!tabCycleState.isCycling) {
                if (lastActiveTab && openTabs.includes(lastActiveTab) && lastActiveTab !== currentOpenFile) {
                    await openFileInEditor(lastActiveTab);
                } else {
                    const currentIndex = openTabs.indexOf(currentOpenFile);
                    await openFileInEditor(openTabs[(currentIndex + 1) % openTabs.length]);
                }
                tabCycleState.isCycling = true; 
            } else {
                const currentIndex = openTabs.indexOf(currentOpenFile);
                let nextIndex;
                if (e.shiftKey) { 
                    nextIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
                } else { 
                    nextIndex = (currentIndex + 1) % openTabs.length;
                }
                await openFileInEditor(openTabs[nextIndex]);
            }
            return;
        }


        if (e.key === 'F5') {
            e.preventDefault();
            await handleRun(e);
            return;
        }
        
        if (checkMatch(activeHotkeys.runFile)) { e.preventDefault(); await handleRun(e); }
        else if (checkMatch(activeHotkeys.compileFile)) { e.preventDefault(); await runPropertyCommand('compile'); }
        else if (checkMatch(activeHotkeys.saveFile)) { e.preventDefault(); await saveFileContent(currentOpenFile, editor.getValue()); }
        else if (checkMatch(activeHotkeys.formatFile)) {
            e.preventDefault();
            if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) {
                alert("The formatter only works with .htvm files.");
                return;
            }
            try { editor.session.setValue(formatHtvmCode(editor.getValue())); }
            catch (err) { term.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`); }
        }
        else if (checkMatch(activeHotkeys.closeTab)) {
            e.preventDefault();
            if (openTabs.length === 0) {
                if (await window.electronAPI.showExitConfirm()) {
                    window.close();
                }
            } else {
                await handleCloseTabRequest(currentOpenFile);
            }
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

    window.electronAPI.setZoomLevel(lsGet('zoomLevel') || 0);

    applyEditorColorSettings();
    applyUiThemeSettings();

    editor = ace.edit("editor");
    term = new Terminal({ cursorBlink: true, fontFamily: 'monospace', fontSize: 13, theme: { background: '#000000', foreground: '#00DD00', cursor: '#00FF00' } });
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // MODIFIED: Complete overhaul of terminal key handling
    term.onKey(async ({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.metaKey;

        // --- Ctrl+C Handler ---
        if (domEvent.ctrlKey && domEvent.key.toLowerCase() === 'c') {
            if (isExecuting) {
                window.electronAPI.terminalKillProcess();
            } else {
                term.write('^C');
                writePrompt();
            }
            return;
        }
        
        // --- State 1: A process is running and waiting for input ---
        if (isExecuting) {
            const printableForProcess = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;
            if (domEvent.key === 'Enter') {
                window.electronAPI.terminalWriteToStdin(processInputLine + '\n');
                term.writeln('');
                processInputLine = "";
            } else if (domEvent.key === 'Backspace') {
                if (processInputLine.length > 0) {
                    term.write('\b \b');
                    processInputLine = processInputLine.slice(0, -1);
                }
            } else if (printableForProcess) {
                processInputLine += key;
                term.write(key);
            }
            return;
        }

        // --- State 2: Building a command at the prompt ---
        if (domEvent.key === 'Enter') {
            if (currentLine) {
                commandHistory = commandHistory.filter(c => c !== currentLine);
                commandHistory.unshift(currentLine);
                if(commandHistory.length > 50) commandHistory.pop();
                historyIndex = -1;
                term.writeln('');
                isExecuting = true; // Set state to executing
                window.electronAPI.runCommand(currentLine, terminalCwd);
            } else {
                writePrompt();
            }
        } else if (domEvent.key === 'Backspace') {
            if (currentLine.length > 0) {
                term.write('\b \b');
                currentLine = currentLine.slice(0, -1);
            }
        } else if (domEvent.key === 'ArrowUp') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                const prompt = `\r\x1b[1;32m${terminalCwd.length > 30 ? `...${terminalCwd.slice(-27)}` : terminalCwd}\x1b[0m $ `;
                term.write('\x1b[2K' + prompt);
                currentLine = commandHistory[historyIndex];
                term.write(currentLine);
            }
        } else if (domEvent.key === 'ArrowDown') {
             if (historyIndex > 0) {
                historyIndex--;
                const prompt = `\r\x1b[1;32m${terminalCwd.length > 30 ? `...${terminalCwd.slice(-27)}` : terminalCwd}\x1b[0m $ `;
                term.write('\x1b[2K' + prompt);
                currentLine = commandHistory[historyIndex];
                term.write(currentLine);
            } else {
                historyIndex = -1;
                const prompt = `\r\x1b[1;32m${terminalCwd.length > 30 ? `...${terminalCwd.slice(-27)}` : terminalCwd}\x1b[0m $ `;
                term.write('\x1b[2K' + prompt);
                currentLine = "";
            }
        } else if (domEvent.key === 'Tab') {
            domEvent.preventDefault();
            const words = currentLine.split(/\s+/);
            const partial = words.pop() || "";
            if (!partial) return;

            const matches = await window.electronAPI.terminalAutocomplete(partial, terminalCwd);

            if (matches.length === 1) {
                const completed = matches[0];
                const diff = completed.substring(partial.length);
                term.write(diff);
                currentLine += diff;
            } else if (matches.length > 1) {
                const commonPrefix = matches.reduce((prefix, current) => {
                    while (current.slice(0, prefix.length) !== prefix) {
                        prefix = prefix.slice(0, -1);
                    }
                    return prefix;
                });

                if (commonPrefix.length > partial.length) {
                    const diff = commonPrefix.substring(partial.length);
                    term.write(diff);
                    currentLine += diff;
                }
                
                const displayNames = matches.map(m => path.basename(m.replace(/["\/\\]/g, '')));
                term.writeln('\r\n' + displayNames.join('   '));
                writePrompt();
                term.write(currentLine);
            }
        } else if (printable) {
            currentLine += key;
            term.write(key);
        }
    });

    window.electronAPI.onCommandOutput((data) => term.write(data.replace(/\n/g, "\r\n")));
    window.electronAPI.onCommandError((data) => term.write(`\x1b[31m${data.replace(/\n/g, "\r\n")}\x1b[0m`));
    window.electronAPI.onCommandClose((code) => writePrompt());
    window.electronAPI.onTerminalUpdateCwd((newPath) => { terminalCwd = newPath; });
    
    window.electronAPI.onCloseTabFromContextMenu(async (filePath) => {
        await handleCloseTabRequest(filePath);
    });

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
        else if (openTabs.includes(filePath)) {
            if (fileSessions.has(filePath)) {
                fileSessions.delete(filePath);
            }
        }
    });
    
    const appPath = await window.electronAPI.getAppPath();
    const separator = appPath.includes('\\') ? '\\' : '/';
    await window.electronAPI.createItem(`${appPath}${separator}property files`, false);


    Object.keys(draftCompletions).forEach(lang => {
        lsSet(`lang_completions_${lang}`, draftCompletions[lang]);
    });

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
    if (keybindingMode !== 'normal') {
        editor.setKeyboardHandler(`ace/keyboard/${keybindingMode}`);
    }
    
    setupGutterEvents();

    editor.on('changeSelection', debounce(updateEditorModeForHtvm, 200));

    document.getElementById('new-file-btn').addEventListener('click', handleNewFile);
    document.getElementById('new-folder-btn').addEventListener('click', handleNewFolder);
    document.getElementById('save-session-btn').addEventListener('click', () => openSessionModal('save'));
    document.getElementById('load-session-btn').addEventListener('click', () => openSessionModal('load'));
    document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
    document.getElementById('load-instructions-btn').addEventListener('click', openInstructionManagerModal);
    document.getElementById('htvm-to-htvm-btn').addEventListener('click', openHtvmToHtvmModal);
    document.getElementById('export-import-btn').addEventListener('click', openExportImportModal);
    document.getElementById('open-folder-btn').addEventListener('click', handleOpenFolder);
    
    const toggleBtn = document.getElementById('main-toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeBtn = document.getElementById('sidebar-close-btn');

    function toggleSidebar() {
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        lsSet('sidebarCollapsed', !isCollapsed);
        const isMobileView = getComputedStyle(sidebar).position === 'absolute';
        if (isMobileView) backdrop.style.display = isCollapsed ? 'block' : 'none';
        setTimeout(() => { editor.resize(); fitAddon.fit(); }, 310);
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
        if (files.length > 0 && files[0].path) {
            await openFileInEditor(files[0].path);
        }
    });


    document.getElementById('lang-dropdown').addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) changeLanguage(item.dataset.name, item.dataset.img, item.dataset.lang);
    });
    document.getElementById('run-js-after-htvm').onchange = e => lsSet('runJsAfterHtvm', e.target.checked);
    document.getElementById('full-html-checkbox').onchange = e => lsSet('fullHtml', e.target.checked);
    document.getElementById('run-btn').addEventListener('click', handleRun);
    document.getElementById('format-btn').addEventListener('click', () => {
        if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) {
            alert("The formatter only works with .htvm files."); return;
        }
        try { editor.session.setValue(formatHtvmCode(editor.getValue())); }
        catch (err) { term.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`); }
    });
    document.getElementById('close-output-btn').addEventListener('click', () => document.getElementById('output-panel').classList.remove('visible'));
    document.getElementById('download-html-btn').addEventListener('click', handleDownloadHtml);

    applyAndSetHotkeys();
    
    initResizer(document.getElementById('sidebar-resizer'), document.querySelector('.sidebar'), 'sidebarWidth', 'x');
    initResizer(document.getElementById('terminal-resizer'), document.getElementById('terminal-container'), 'terminalHeight', 'y');
    initResizer(document.getElementById('output-panel-resizer'), document.getElementById('output-panel'), 'outputPanelWidth', 'x');

    term.writeln(`\x1b[1;32mWelcome to HT-IDE! (Workspace ID: ${IDE_ID})\x1b[0m`);
    
    document.getElementById('run-js-after-htvm').checked = lsGet('runJsAfterHtvm') !== false;
    document.getElementById('full-html-checkbox').checked = lsGet('fullHtml') === true;

    const savedBreakpoints = lsGet('fileBreakpoints');
    if (savedBreakpoints) {
        for (const file in savedBreakpoints) {
            fileBreakpoints.set(file, new Set(savedBreakpoints[file]));
        }
    }

    const sidebarWidth = lsGet('sidebarWidth'); if (sidebarWidth) document.querySelector('.sidebar').style.width = sidebarWidth;
    const terminalHeight = lsGet('terminalHeight'); if (terminalHeight) document.getElementById('terminal-container').style.height = terminalHeight;
    const outputWidth = lsGet('outputPanelWidth'); if (outputWidth) document.getElementById('output-panel').style.width = outputWidth;
    
    if (lsGet('sidebarCollapsed') !== false) {
        document.querySelector('.sidebar').classList.add('collapsed');
    } else {
        document.querySelector('.sidebar').classList.remove('collapsed');
    }

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

    for (const path of savedOpenTabs) {
        await openFileInEditor(path);
    }

    if (lastFile && openTabs.includes(lastFile)) {
        await openFileInEditor(lastFile);
    } else if (openTabs.length > 0) {
        await openFileInEditor(openTabs[0]);
    } else {
        editor.setSession(ace.createEditSession("// No file open."));
        editor.setReadOnly(true);
        renderTabs();
    }
    
    writePrompt();

    const mainContent = document.querySelector('.main-content-wrapper');
    mainContent.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    mainContent.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (draggedTab) return;
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const isOverEditor = e.target.closest('#editor-container');
            if (isOverEditor) {
                for (const file of files) {
                    if (file.path) await openFileInEditor(file.path);
                }
            } else {
                for (const file of files) {
                    if (file.path) {
                        const { success, error } = await window.electronAPI.dropFile(file.path, currentDirectory);
                        if (!success) {
                            term.writeln(`\x1b[31mError dropping file ${file.name}: ${error}\x1b[0m`);
                        }
                    }
                }
                await renderFileList();
            }
        }
    });

    window.addEventListener('resize', debounce(() => {
        editor.resize();
        fitAddon.fit();
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

        lsSet('openTabs', openTabs);
        lsSet('lastOpenFile', currentOpenFile);
        lsSet('lastActiveTab', lastActiveTab);
        lsSet('lastCwd', currentDirectory);

        const serializableBreakpoints = {};
        for (const [file, bpSet] of fileBreakpoints.entries()) {
            serializableBreakpoints[file] = Array.from(bpSet);
        }
        lsSet('fileBreakpoints', serializableBreakpoints);
    });

    editor.on('mousemove', function (e) {
        const tooltip = document.getElementById('value-tooltip');
        if (!tooltip || !debuggerState.isPaused) {
            if (tooltip) tooltip.style.display = 'none';
            return;
        }
        
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
        fitAddon.fit();
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
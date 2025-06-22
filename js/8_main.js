let hotkeyListener = null; // Keep a reference to the listener to remove it later

function applyAndSetHotkeys() {
    // Remove the old listener to prevent duplicates
    if (hotkeyListener) {
        document.removeEventListener('keydown', hotkeyListener);
    }

    const customHotkeys = lsGet('customHotkeys') || {};
    
    // Merge custom hotkeys with defaults
    const activeHotkeys = {};
    for (const id in hotkeyConfig) {
        activeHotkeys[id] = customHotkeys[id] || hotkeyConfig[id].default;
    }

    hotkeyListener = (e) => {
        // F5 is a special, non-customizable secondary key for Run
        if (e.key === 'F5') {
            e.preventDefault();
            handleRun(e);
            return;
        }

        const checkMatch = (config) => {
            const key = e.key.toLowerCase();
            const targetKey = config.key.toLowerCase();
             // Special case for 'Enter' which is sometimes just 'Enter'
            if (key !== targetKey && e.key !== config.key) return false;

            const ctrl = e.ctrlKey || e.metaKey;
            return ctrl === config.ctrl && e.shiftKey === config.shift && e.altKey === config.alt;
        };

        if (checkMatch(activeHotkeys.runFile)) {
            e.preventDefault(); handleRun(e);
        } else if (checkMatch(activeHotkeys.saveFile)) {
            e.preventDefault(); saveFileContent(currentOpenFile, editor.getValue());
        } else if (checkMatch(activeHotkeys.formatFile)) {
            e.preventDefault();
            if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) {
                alert("The formatter only works with .htvm files.");
                return;
            }
            try {
                editor.session.setValue(formatHtvmCode(editor.getValue()));
            } catch (err) {
                term.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`);
            }
        } else if (checkMatch(activeHotkeys.closeTab)) {
            e.preventDefault(); handleCloseTabRequest(currentOpenFile);
        } else if (checkMatch(activeHotkeys.reopenTab)) {
            e.preventDefault(); handleReopenTab();
        } else if (checkMatch(activeHotkeys.toggleSidebar)) {
            e.preventDefault(); document.getElementById('main-toggle-sidebar-btn').click();
        }
    };

    document.addEventListener('keydown', hotkeyListener);
    updateHotkeyTitles();
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Initialization ---
    IDE_ID = getIdeId();
    STORAGE_PREFIX = `HT-IDE-id${IDE_ID}-`;
    langTools = ace.require("ace/ext/language_tools");

    // Apply custom themes and colors before editor initialization
    applyEditorColorSettings();
    applyUiThemeSettings();

    // Initialize core components
    editor = ace.edit("editor");
    term = new Terminal({ cursorBlink: true, fontFamily: 'monospace', fontSize: 13, theme: { background: '#000000', foreground: '#00DD00', cursor: '#00FF00' } });
    fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // Populate language completions into localStorage
    Object.keys(draftCompletions).forEach(lang => {
        lsSet(`lang_completions_${lang}`, draftCompletions[lang]);
    });

    // Load HTVM definitions and instruction sets
    initializeInstructionSetManagement();
    
    // Check for instruction set and start onboarding if necessary
    if (!lsGet(instructionSetKeys.activeId)) {
        promptForInitialInstructionSet();
    } else {
        await loadDefinitions();
    }


    // Configure Ace Editor
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

    // --- Event Listeners ---
    editor.on('changeSelection', debounce(updateEditorModeForHtvm, 200));

    // Sidebar and Top Bar listeners
    document.getElementById('new-file-btn').onclick = handleNewFile;
    document.getElementById('new-folder-btn').onclick = handleNewFolder;
    document.getElementById('save-session-btn').onclick = () => openSessionModal('save');
    document.getElementById('load-session-btn').onclick = () => openSessionModal('load');
    document.getElementById('settings-btn').onclick = openSettingsModal;
    document.getElementById('load-instructions-btn').onclick = openInstructionManagerModal;
    document.getElementById('htvm-to-htvm-btn').onclick = openHtvmToHtvmModal;
    document.getElementById('export-import-btn').onclick = openExportImportModal;
    document.getElementById('open-folder-btn').onclick = () => alert("This feature is for the desktop version.");
    
    const toggleBtn = document.getElementById('main-toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeBtn = document.getElementById('sidebar-close-btn');

    function toggleSidebar() {
        const isCollapsed = sidebar.classList.contains('collapsed');
        sidebar.classList.toggle('collapsed');
        lsSet('sidebarCollapsed', !isCollapsed);

        const isMobileView = getComputedStyle(sidebar).position === 'absolute';
        if (isMobileView) {
            backdrop.style.display = isCollapsed ? 'block' : 'none';
        }

        setTimeout(() => { editor.resize(); fitAddon.fit(); }, 310);
    }

    toggleBtn.onclick = toggleSidebar;
    backdrop.onclick = toggleSidebar;
    closeBtn.onclick = toggleSidebar;

    // HTVM controls listeners
    document.getElementById('lang-dropdown').addEventListener('click', e => {
        const item = e.target.closest('.dropdown-item');
        if (item) changeLanguage(item.dataset.name, item.dataset.img, item.dataset.lang);
    });
    document.getElementById('run-js-after-htvm').checked = lsGet('runJsAfterHtvm') !== false;
    document.getElementById('run-js-after-htvm').onchange = e => lsSet('runJsAfterHtvm', e.target.checked);
    document.getElementById('full-html-checkbox').checked = lsGet('fullHtml') === true;
    document.getElementById('full-html-checkbox').onchange = e => lsSet('fullHtml', e.target.checked);

    // Run and Output Panel listeners
    document.getElementById('run-btn').onclick = handleRun;
    document.getElementById('format-btn').onclick = () => {
        if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) {
            alert("The formatter only works with .htvm files.");
            return;
        }
        try {
            editor.session.setValue(formatHtvmCode(editor.getValue()));
        } catch (err) {
            term.writeln(`\x1b[31mAn error occurred during formatting: ${err.message}\x1b[0m`);
        }
    };
    document.getElementById('close-output-btn').onclick = () => document.getElementById('output-panel').classList.remove('visible');
    document.getElementById('download-html-btn').onclick = handleDownloadHtml;

    // Apply custom hotkeys on startup
    applyAndSetHotkeys();
    
    // Resizers
    initResizer(document.getElementById('sidebar-resizer'), document.querySelector('.sidebar'), 'sidebarWidth', 'x');
    initResizer(document.getElementById('terminal-resizer'), document.getElementById('terminal-container'), 'terminalHeight', 'y');
    initResizer(document.getElementById('output-panel-resizer'), document.getElementById('output-panel'), 'outputPanelWidth', 'x');

    // --- Application Startup Logic ---
    term.writeln(`\x1b[1;32mWelcome to HT-IDE! (Workspace ID: ${IDE_ID})\x1b[0m`);
    term.write('$ ');

    // --- LOAD BREAKPOINTS ---
    const savedBreakpoints = lsGet('fileBreakpoints');
    if (savedBreakpoints) {
        for (const file in savedBreakpoints) {
            fileBreakpoints.set(file, new Set(savedBreakpoints[file]));
        }
    }

    // Restore UI state from localStorage
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

    // Restore file state
    const lastCwd = lsGet('lastCwd') || '/';
    setCurrentDirectory(lastCwd);
    const savedOpenTabs = lsGet('openTabs') || [];
    openTabs = savedOpenTabs.filter(f => getAllPaths().includes(f));
    const lastFile = lsGet('lastOpenFile');

    if (lastFile && getAllPaths().includes(lastFile)) {
        openFileInEditor(lastFile);
    } else if (openTabs.length > 0) {
        openFileInEditor(openTabs[0]);
    } else {
        editor.setSession(ace.createEditSession("// No file open."));
        editor.setReadOnly(true);
        renderTabs();
    }

    // Window Listeners
    window.addEventListener('resize', debounce(() => { editor.resize(); fitAddon.fit(); }, 200));
    window.addEventListener('beforeunload', () => {
        if (currentOpenFile) {
            saveFileContent(currentOpenFile, editor.getValue(), true);
            lsSet('state_' + currentOpenFile, { scrollTop: editor.session.getScrollTop(), cursor: editor.getCursorPosition() });
        }
        lsSet('openTabs', openTabs);
        lsSet('lastOpenFile', currentOpenFile);
        lsSet('lastCwd', currentDirectory);

        const serializableBreakpoints = {};
        for (const [file, bpSet] of fileBreakpoints.entries()) {
            serializableBreakpoints[file] = Array.from(bpSet);
        }
        lsSet('fileBreakpoints', serializableBreakpoints);
    });

    // --- DEBUGGER VALUE HOVER ---
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
                    if (value && value.length > 200) {
                        value = value.substring(0, 200) + '...';
                    }
                } catch {
                    value = String(value);
                }

                tooltip.innerText = `${varName}: ${value}`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
            } else {
                tooltip.style.display = 'none';
            }
        } else {
            tooltip.style.display = 'none';
        }
    });

    // Final UI adjustments
    setTimeout(() => {
        document.body.classList.remove('preload');
        fitAddon.fit();
    }, 50);
});

function applyEditorColorSettings() {
    // Master toggle for syntax highlighting
    if (lsGet('syntaxHighlightingEnabled') === false) {
        document.body.classList.add('syntax-highlighting-disabled');
    } else {
        document.body.classList.remove('syntax-highlighting-disabled');
    }

    // Apply custom colors and boldness by setting CSS variables on the root element
    const root = document.documentElement;
    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        
        // Apply color
        const savedColor = lsGet(`color_${key}`) || item.default;
        root.style.setProperty(`--${key}`, savedColor);

        // Apply boldness for text items
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
        
        // Apply color or range value
        const savedValue = lsGet(`theme_${key}`) ?? item.default;
        const unit = item.unit || '';
        root.style.setProperty(key, savedValue + unit);
        
        // Apply boldness for text items
        if (item.hasBoldToggle) {
            const isBold = lsGet(`theme_bold_${key}`) ?? item.defaultBold;
            root.style.setProperty(key + '-bold', isBold ? 'bold' : 'normal');
        }
    }
}
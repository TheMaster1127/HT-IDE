document.addEventListener('DOMContentLoaded', async () => {
    // --- Initialization ---
    IDE_ID = getIdeId();
    STORAGE_PREFIX = `HT-IDE-id${IDE_ID}-`;
    langTools = ace.require("ace/ext/language_tools");

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
    await loadDefinitions();

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
    if (lsGet('vimMode')) editor.setKeyboardHandler("ace/keyboard/vim");

    // --- Event Listeners ---
    editor.on('changeSelection', debounce(updateEditorModeForHtvm, 200));

    // Sidebar and Top Bar listeners
    document.getElementById('new-file-btn').onclick = handleNewFile;
    document.getElementById('new-folder-btn').onclick = handleNewFolder;
    document.getElementById('save-session-btn').onclick = () => openSessionModal('save');
    document.getElementById('load-session-btn').onclick = () => openSessionModal('load');
    document.getElementById('settings-btn').onclick = openSettingsModal;
    document.getElementById('load-instructions-btn').onclick = openInstructionManagerModal;
    document.getElementById('open-folder-btn').onclick = () => alert("This feature is for the desktop version.");
    
    // --- FINAL SIDEBAR TOGGLE LOGIC ---
    const toggleBtn = document.getElementById('main-toggle-sidebar-btn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const closeBtn = document.getElementById('sidebar-close-btn'); // Get the new button

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
    closeBtn.onclick = toggleSidebar; // MAKE THE NEW 'X' BUTTON WORK

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
    document.getElementById('close-output-btn').onclick = () => document.getElementById('output-panel').classList.remove('visible');
    document.getElementById('download-html-btn').onclick = handleDownloadHtml;

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
        const ctrl = e.ctrlKey || e.metaKey;
        if (e.key === 'F5' || (ctrl && e.key === 'Enter')) { e.preventDefault(); handleRun(e); }
        else if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); saveFileContent(currentOpenFile, editor.getValue()); }
        else if (ctrl && e.key.toLowerCase() === 'w') { e.preventDefault(); handleCloseTabRequest(currentOpenFile); }
        else if (ctrl && e.key.toLowerCase() === 'b') { e.preventDefault(); document.getElementById('main-toggle-sidebar-btn').click(); }
        else if (ctrl && e.shiftKey && e.key.toLowerCase() === 't') { e.preventDefault(); handleReopenTab(); }
    });
    
    // Resizers
    initResizer(document.getElementById('sidebar-resizer'), document.querySelector('.sidebar'), 'sidebarWidth', 'x');
    initResizer(document.getElementById('terminal-resizer'), document.getElementById('terminal-container'), 'terminalHeight', 'y');
    initResizer(document.getElementById('output-panel-resizer'), document.getElementById('output-panel'), 'outputPanelWidth', 'x');

    // --- Application Startup Logic ---
    term.writeln(`\x1b[1;32mWelcome to HT-IDE! (Workspace ID: ${IDE_ID})\x1b[0m`);
    term.write('$ ');

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
    });

    // Final UI adjustments
    setTimeout(() => {
        document.body.classList.remove('preload');
        fitAddon.fit();
    }, 50);
});
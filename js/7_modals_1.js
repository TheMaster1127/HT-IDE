// --- Modal Dialog Functions ---

function openSessionModal(mode) {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    overlay.innerHTML = `<div class="modal-box"><h3 id="modal-title"></h3><div id="modal-save-content" style="display:none;"><p>Enter/overwrite session name:</p><input type="text" id="modal-input" style="width:calc(100% - 22px);padding:10px;margin-bottom:15px;background-color:#252525;border:1px solid #333;color:#e0e0e0;"></div><ul class="modal-list" id="modal-list"></ul><div class="modal-buttons"><button id="modal-cancel-btn">Cancel</button><button id="modal-confirm-btn" style="margin-left:8px;">Save</button></div></div>`;
    
    const list = document.getElementById('modal-list');
    const populate = (cb) => {
        list.innerHTML = '';
        const sessions = lsGet('session_list') || [];
        if (!sessions.length) {
            list.innerHTML = "<li class='no-sessions'>No sessions found.</li>";
            return;
        }
        sessions.forEach(name => {
            const li = document.createElement('li');
            li.onclick = () => cb(name);
            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;
            const delBtn = document.createElement('button');
            delBtn.textContent = '🗑️';
            delBtn.style.cssText = 'background:none;border:none;color:#aaa;';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete session "${name}"?`)) {
                    let s = lsGet('session_list').filter(i => i !== name);
                    lsSet('session_list', s);
                    lsRemove(`session_data_${name}`);
                    populate(cb);
                }
            };
            li.appendChild(nameSpan);
            li.appendChild(delBtn);
            list.appendChild(li);
        });
    };

    document.getElementById('modal-cancel-btn').onclick = () => {
        overlay.style.display = 'none';
    };

    if (mode === 'save') {
        document.getElementById('modal-title').textContent = 'Save Session';
        document.getElementById('modal-save-content').style.display = 'block';
        document.getElementById('modal-confirm-btn').textContent = 'Save';
        populate(name => document.getElementById('modal-input').value = name);
        document.getElementById('modal-confirm-btn').onclick = () => {
            const name = document.getElementById('modal-input').value.trim();
            if (!name) return alert('Name cannot be empty.');
            let sessions = lsGet('session_list') || [];
            if (!sessions.includes(name)) sessions.push(name);
            lsSet('session_list', sessions);
            lsSet(`session_data_${name}`, openTabs);
            overlay.style.display = 'none';
            term.writeln(`\x1b[32mSession '${name}' saved.\x1b[0m`);
        };
    } else { // 'load' mode
        document.getElementById('modal-title').textContent = 'Load Session';
        document.getElementById('modal-save-content').style.display = 'none';
        document.getElementById('modal-confirm-btn').style.display = 'none';
        populate(name => {
            const tabs = lsGet(`session_data_${name}`);
            if (tabs) {
                [...openTabs].forEach(t => closeTab(t, true));
                tabs.forEach(t => {
                    if (getAllPaths().includes(t)) openFileInEditor(t);
                });
            }
            overlay.style.display = 'none';
            term.writeln(`\x1b[32mSession '${name}' loaded.\x1b[0m`);
        });
    }
    overlay.style.display = 'flex';
}

function openSettingsModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.innerHTML = `<div class="modal-box" style="max-width: 850px;">
        <h3>Settings + Help</h3>
        <div id="settings-columns-container" style="display: flex; gap: 20px; border-top: 1px solid #333; padding-top: 15px; overflow-x: auto; padding-bottom: 15px;">
            <div class="settings-column" style="flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 240px;">
                <h4>Editor</h4>
                <div><label for="font-size-input">Font Size: </label><input type="number" id="font-size-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
                <div>
                    <h4>Keybinding Mode</h4>
                    <div id="keybinding-mode-group" style="padding-left: 10px;">
                        <label><input type="radio" name="keybinding-mode" value="normal"> Normal (Ace)</label>
                        <label><input type="radio" name="keybinding-mode" value="vim"> Vim</label>
                        <label><input type="radio" name="keybinding-mode" value="emacs"> Emacs</label>
                        <label><input type="radio" name="keybinding-mode" value="vscode"> VSCode</label>
                        <label><input type="radio" name="keybinding-mode" value="sublime"> Sublime</label>
                    </div>
                </div>
                <div><label><input type="checkbox" id="auto-pair-checkbox"> Auto-pair Brackets/Quotes</label></div>
                <div><label><input type="checkbox" id="print-margin-checkbox"> Show Vertical Guide Line</label></div>
                <div style="padding-left: 20px;"><label for="print-margin-column-input">Guide Line Column: </label><input type="number" id="print-margin-column-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
            </div>
            <div class="settings-column" style="flex: 1.2; padding-left: 20px; border-left: 1px solid #333; display: flex; flex-direction: column; gap: 15px; min-width: 280px;">
                <div>
                    <h4>Syntax Highlighting (HTVM mostly)</h4>
                    <div><label><input type="checkbox" id="syntax-highlighting-master-checkbox"> Enable Syntax Highlighting</label></div>
                    <div style="padding-left: 20px;"><label><input type="checkbox" id="symbol-operator-highlighting-checkbox"> Highlight Symbol Operators (e.g., =, ++, *)</label></div>
                    <button id="customize-colors-btn" style="margin-top: 10px; padding: 8px; background-color: #0e639c;">Customize Highlighting Colors</button>
                    <p style="font-size:0.8em; color:#aaa; margin-top:5px;">Color changes may affect other languages.</p>
                </div>
                <div>
                    <h4>Terminal</h4>
                    <div><label><input type="checkbox" id="clear-terminal-on-run-checkbox"> Clear terminal before each run</label></div>
                </div>
                 <div>
                    <h4>Autocomplete</h4>
                    <div><label><input type="checkbox" id="autocomplete-master-checkbox"> Enable Autocomplete</label></div>
                    <div style="padding-left: 20px;"><label><input type="checkbox" id="autocomplete-keywords-checkbox"> Language Keywords/Functions</label></div>
                    <div style="padding-left: 20px;"><label><input type="checkbox" id="autocomplete-local-checkbox"> Words from document</label></div>
                </div>
            </div>
            <div class="settings-column" style="flex: 1; padding-left: 20px; border-left: 1px solid #333; min-width: 220px;">
                 <h4>Hotkeys</h4>
                 <ul style="padding-left:20px;margin:0; font-size: 0.9em; list-style-type: none;">
                    <li><b>Ctrl+Enter / F5:</b> Run File</li>
                    <li><b>Ctrl+S:</b> Save File</li>
                    <li><b>Ctrl+W:</b> Close Tab</li>
                    <li><b>Ctrl+Shift+T:</b> Re-open last closed tab</li>
                    <li><b>Ctrl+B:</b> Toggle Sidebar</li>
                 </ul>
            </div>
        </div>
        <div class="modal-buttons" style="margin-top: 20px;"><button id="modal-ok-btn" style="padding: 10px 24px; font-size: 1.1em; font-weight: bold;">OK</button></div>
    </div>`;
    
    // --- CORRECTED LOGIC ---

    // 1. Get the initial state of settings that require a reload.
    const initialSyntaxEnabled = lsGet('syntaxHighlightingEnabled') !== false;
    const initialHighlightOperators = lsGet('highlightSymbolOperators') !== false;

    // 2. Load all current settings into the form elements.
    document.getElementById('font-size-input').value = editor.getFontSize();
    const currentMode = lsGet('keybindingMode') || 'normal';
    document.querySelector(`input[name="keybinding-mode"][value="${currentMode}"]`).checked = true;
    document.getElementById('auto-pair-checkbox').checked = editor.getBehavioursEnabled();
    document.getElementById('print-margin-checkbox').checked = editor.getShowPrintMargin();
    document.getElementById('print-margin-column-input').value = editor.getOption('printMargin');
    document.getElementById('syntax-highlighting-master-checkbox').checked = initialSyntaxEnabled;
    document.getElementById('symbol-operator-highlighting-checkbox').checked = initialHighlightOperators;
    document.getElementById('clear-terminal-on-run-checkbox').checked = lsGet('clearTerminalOnRun') === true;
    document.getElementById('autocomplete-master-checkbox').checked = lsGet('autocomplete-master') !== false;
    document.getElementById('autocomplete-keywords-checkbox').checked = lsGet('autocomplete-keywords') !== false;
    document.getElementById('autocomplete-local-checkbox').checked = lsGet('autocomplete-local') !== false;

    // 3. Wire up buttons
    document.getElementById('customize-colors-btn').onclick = openSyntaxColorModal;

    document.getElementById('modal-ok-btn').onclick = () => {
        // 4. Save settings that DON'T require a reload immediately.
        editor.setFontSize(parseInt(document.getElementById('font-size-input').value, 10)); lsSet('fontSize', editor.getFontSize());
        const keybinding = document.querySelector('input[name="keybinding-mode"]:checked').value;
        lsSet('keybindingMode', keybinding);
        editor.setKeyboardHandler(keybinding === 'normal' ? null : `ace/keyboard/${keybinding}`);
        editor.setBehavioursEnabled(document.getElementById('auto-pair-checkbox').checked); lsSet('autoPair', editor.getBehavioursEnabled());
        editor.setShowPrintMargin(document.getElementById('print-margin-checkbox').checked); lsSet('showPrintMargin', editor.getShowPrintMargin());
        editor.setOption('printMargin', parseInt(document.getElementById('print-margin-column-input').value, 10) || 80); lsSet('printMarginColumn', editor.getOption('printMargin'));
        lsSet('clearTerminalOnRun', document.getElementById('clear-terminal-on-run-checkbox').checked);
        lsSet('autocomplete-master', document.getElementById('autocomplete-master-checkbox').checked);
        lsSet('autocomplete-keywords', document.getElementById('autocomplete-keywords-checkbox').checked);
        lsSet('autocomplete-local', document.getElementById('autocomplete-local-checkbox').checked);

        // 5. Check if any settings that require a reload have changed.
        const newSyntaxEnabled = document.getElementById('syntax-highlighting-master-checkbox').checked;
        const newHighlightOperators = document.getElementById('symbol-operator-highlighting-checkbox').checked;

        const needsReload = (initialSyntaxEnabled !== newSyntaxEnabled) || (initialHighlightOperators !== newHighlightOperators);

        if (needsReload) {
            // 6. If they changed, ask for confirmation BEFORE saving.
            if (confirm("Some syntax highlighting settings have changed. A reload is required for them to take full effect. Your work will be saved.\n\nReload now?")) {
                // 7a. User confirmed: SAVE the settings and then reload.
                lsSet('syntaxHighlightingEnabled', newSyntaxEnabled);
                lsSet('highlightSymbolOperators', newHighlightOperators);
                window.dispatchEvent(new Event('beforeunload'));
                window.location.reload();
            } else {
                // 7b. User cancelled: Do NOT save the changes. The old values remain in localStorage.
            }
        }
        
        // 8. Close the modal regardless of the outcome.
        overlay.style.display = 'none';
    };
    overlay.style.display = 'flex';
}

function openSyntaxColorModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';

    let colorItemsHtml = '';
    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        const savedColor = lsGet(`color_${key}`) || item.default;
        colorItemsHtml += `
            <div class="color-picker-item">
                <label for="${key}">${item.label}</label>
                <input type="color" id="${key}" value="${savedColor}">
            </div>
        `;
    }

    overlay.innerHTML = `<div class="modal-box" style="width:90%; max-width:550px;">
        <h3>Customize Syntax Colors</h3>
        <div id="color-picker-list" style="max-height: 60vh; overflow-y: auto; padding-right: 10px; border-top: 1px solid #333; border-bottom: 1px solid #333; margin: 15px 0; padding-top: 10px; padding-bottom: 10px;">
            ${colorItemsHtml}
        </div>
        <div class="modal-buttons">
            <button id="modal-colors-reset-btn" style="float:left;">Reset to Defaults</button>
            <button id="modal-colors-cancel-btn">Cancel</button>
            <button id="modal-colors-save-btn" style="margin-left:8px; background-color:#3d8b40;">Save & Apply</button>
        </div>
    </div>`;

    document.getElementById('modal-colors-cancel-btn').onclick = () => {
        openSettingsModal(); // Go back to the main settings modal
    };
    
    document.getElementById('modal-colors-reset-btn').onclick = () => {
        if (confirm("Are you sure you want to reset all colors to their defaults?")) {
            for (const key in syntaxColorConfig) {
                 document.getElementById(key).value = syntaxColorConfig[key].default;
            }
        }
    };

    document.getElementById('modal-colors-save-btn').onclick = () => {
        for (const key in syntaxColorConfig) {
            const colorValue = document.getElementById(key).value;
            lsSet(`color_${key}`, colorValue);
        }
        
        overlay.style.display = 'none';

        if (confirm("Colors have been saved. A reload is required for changes to take full effect. Your work will be saved.\n\nReload now?")) {
            window.dispatchEvent(new Event('beforeunload'));
            window.location.reload();
        }
    };
}
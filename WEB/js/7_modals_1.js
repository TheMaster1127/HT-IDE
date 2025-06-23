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

function renderHotkeyDisplayList() {
    const customHotkeys = lsGet('customHotkeys') || {};
    let html = '';

    for (const id in hotkeyConfig) {
        const config = hotkeyConfig[id];
        const activeHotkey = customHotkeys[id] || config.default;
        let displayText = formatHotkey(activeHotkey);

        if (id === 'runFile' && config.secondary) {
            displayText += ` / ${formatHotkey(config.secondary)}`;
        }
        
        let label = config.label;
        if(id === 'formatFile') label = 'Format .htvm File';

        html += `<li><b>${displayText}:</b> ${label}</li>`;
    }
    return `<ul style="padding-left:20px;margin:0; font-size: 0.9em; list-style-type: none;">${html}</ul>`;
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
                    <h4>Theme & Appearance</h4>
                    <button id="customize-theme-btn" style="margin-top: 5px; padding: 8px; background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text); font-weight: var(--btn-new-file-text-bold);">Customize UI Theme</button>
                    <h4 style="margin-top:20px;">Syntax Highlighting (HTVM mostly)</h4>
                    <div><label><input type="checkbox" id="syntax-highlighting-master-checkbox"> Enable Syntax Highlighting</label></div>
                    <div style="padding-left: 20px;"><label><input type="checkbox" id="symbol-operator-highlighting-checkbox"> Highlight Symbol Operators (e.g., =, ++, *)</label></div>
                    <button id="customize-colors-btn" style="margin-top: 10px; padding: 8px; background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text); font-weight: var(--btn-new-file-text-bold);">Customize Syntax Colors</button>
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
                 <div id="hotkey-display-list">${renderHotkeyDisplayList()}</div>
                 <button id="customize-hotkeys-btn" style="margin-top: 15px; padding: 8px; background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text); font-weight: var(--btn-new-file-text-bold);">Customize Hotkeys</button>
            </div>
        </div>
        <div class="modal-buttons" style="margin-top: 20px;"><button id="modal-ok-btn" style="padding: 10px 24px; font-size: 1.1em; font-weight: bold;">OK</button></div>
    </div>`;
    
    const initialSyntaxEnabled = lsGet('syntaxHighlightingEnabled') !== false;
    const initialHighlightOperators = lsGet('highlightSymbolOperators') !== false;

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

    document.getElementById('customize-colors-btn').onclick = openSyntaxColorModal;
    document.getElementById('customize-theme-btn').onclick = openThemeEditorModal;
    document.getElementById('customize-hotkeys-btn').onclick = openHotkeyEditorModal;


    document.getElementById('modal-ok-btn').onclick = () => {
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

        const newSyntaxEnabled = document.getElementById('syntax-highlighting-master-checkbox').checked;
        const newHighlightOperators = document.getElementById('symbol-operator-highlighting-checkbox').checked;
        const needsReload = (initialSyntaxEnabled !== newSyntaxEnabled) || (initialHighlightOperators !== newHighlightOperators);

        if (needsReload) {
            if (confirm("Some syntax highlighting settings have changed. A reload is required for them to take full effect. Your work will be saved.\n\nReload now?")) {
                lsSet('syntaxHighlightingEnabled', newSyntaxEnabled);
                lsSet('highlightSymbolOperators', newHighlightOperators);
                window.dispatchEvent(new Event('beforeunload'));
                window.location.reload();
            }
        }
        overlay.style.display = 'none';
    };
    overlay.style.display = 'flex';
}

function formatHotkey(config) {
    if (!config || !config.key) return 'None';
    const parts = [];
    if (config.ctrl) parts.push('Ctrl');
    if (config.shift) parts.push('Shift');
    if (config.alt) parts.push('Alt');
    
    let keyName = config.key;
    if (keyName.length === 1) keyName = keyName.toUpperCase();
    parts.push(keyName);

    return parts.join(' + ');
}

function openHotkeyEditorModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';
    const customHotkeys = lsGet('customHotkeys') || {};

    let itemsHtml = '';
    for (const id in hotkeyConfig) {
        const config = hotkeyConfig[id];
        const activeHotkey = customHotkeys[id] || config.default;
        
        itemsHtml += `
            <div class="color-picker-item" style="gap: 10px;">
                <label style="flex-basis: 200px;">${config.label}</label>
                <input type="text" readonly class="hotkey-input" data-id="${id}" value="${formatHotkey(activeHotkey)}" style="flex-grow: 1; text-align: center; cursor: pointer; background-color: #333;">
                <button class="hotkey-reset-btn" data-id="${id}" style="padding: 4px 8px; font-size: 0.8em; background-color: #777;">Reset</button>
            </div>
        `;
    }

    overlay.innerHTML = `<div class="modal-box" style="width:90%; max-width:600px;">
        <h3>Customize Hotkeys</h3>
        <p style="font-size:0.9em; color:#ccc; margin-top:0;">Click on an input box and press your desired key combination. F5 for Run is a non-customizable secondary hotkey.</p>
        <div id="hotkey-picker-list" style="max-height: 60vh; overflow-y: auto; padding: 10px; border-top: 1px solid #333; border-bottom: 1px solid #333; margin: 15px 0;">
            ${itemsHtml}
        </div>
        <div class="modal-buttons">
            <button id="modal-hotkeys-reset-all-btn" class="modal-btn-reset">Reset All to Defaults</button>
            <button id="modal-hotkeys-cancel-btn" class="modal-btn-cancel">Cancel</button>
            <button id="modal-hotkeys-save-btn" class="modal-btn-confirm">Save & Apply</button>
        </div>
    </div>`;

    const container = document.getElementById('hotkey-picker-list');
    
    container.querySelectorAll('.hotkey-input').forEach(input => {
        // Store the initial config
        const id = input.dataset.id;
        input.dataset.config = JSON.stringify(customHotkeys[id] || hotkeyConfig[id].default);

        input.onkeydown = e => {
            e.preventDefault();
            e.stopPropagation(); // Stop the event from triggering global listeners
            
            const newConfig = {
                key: e.key,
                ctrl: e.ctrlKey || e.metaKey,
                shift: e.shiftKey,
                alt: e.altKey
            };

            const currentId = e.target.dataset.id;
            const allInputs = container.querySelectorAll('.hotkey-input');
            
            // Check for duplicates
            for (const otherInput of allInputs) {
                const otherId = otherInput.dataset.id;
                if (currentId === otherId) continue; // Skip self-comparison

                const otherConfig = JSON.parse(otherInput.dataset.config);
                const isDuplicate = (
                    otherConfig.key.toLowerCase() === newConfig.key.toLowerCase() &&
                    otherConfig.ctrl === newConfig.ctrl &&
                    otherConfig.shift === newConfig.shift &&
                    otherConfig.alt === newConfig.alt
                );

                if (isDuplicate) {
                    const conflictLabel = hotkeyConfig[otherId].label;
                    alert(`Hotkey '${formatHotkey(newConfig)}' is already in use by '${conflictLabel}'. Please choose a different combination.`);
                    return; // Revert by not applying the change
                }
            }
            
            // If no duplicates, apply the new hotkey
            input.value = formatHotkey(newConfig);
            input.dataset.config = JSON.stringify(newConfig);
        };
    });

    container.querySelectorAll('.hotkey-reset-btn').forEach(button => {
        button.onclick = () => {
            const id = button.dataset.id;
            const input = container.querySelector(`.hotkey-input[data-id="${id}"]`);
            const defaultConfig = hotkeyConfig[id].default;
            input.value = formatHotkey(defaultConfig);
            input.dataset.config = JSON.stringify(defaultConfig);
        };
    });

    document.getElementById('modal-hotkeys-cancel-btn').onclick = openSettingsModal;
    
    document.getElementById('modal-hotkeys-reset-all-btn').onclick = () => {
        if (confirm("Are you sure you want to reset all hotkeys to their defaults?")) {
            lsRemove('customHotkeys');
            applyAndSetHotkeys();
            openHotkeyEditorModal();
        }
    };
    
    document.getElementById('modal-hotkeys-save-btn').onclick = () => {
        const newCustomHotkeys = {};
        container.querySelectorAll('.hotkey-input').forEach(input => {
            newCustomHotkeys[input.dataset.id] = JSON.parse(input.dataset.config);
        });
        lsSet('customHotkeys', newCustomHotkeys);
        applyAndSetHotkeys();
        openSettingsModal();
    };
}


function openSyntaxColorModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';

    let colorItemsHtml = '';
    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        const savedColor = lsGet(`color_${key}`) || item.default;
        
        const controlHtml = item.isText
            ? `<label style="cursor:pointer; display:flex; align-items:center; gap: 4px; user-select: none;">
                   <input type="checkbox" id="bold_${key}"> Bold
               </label>`
            : `<span class="info-icon" data-info-text="Boldness is a text property that changes the thickness of letters and numbers. This setting controls a background color, which is a solid block of color behind the text. Since there's no text in the background itself, the 'bold' option doesn't apply here." style="cursor:help; font-size: 1.2em;">ℹ️</span>`;

        colorItemsHtml += `
            <div class="color-picker-item">
                <label for="${key}" class="color-picker-main-label">${item.label}</label>
                <div class="color-controls-wrapper" style="display: flex; align-items: center; gap: 15px;">
                    ${controlHtml}
                    <input type="color" id="${key}" value="${savedColor}">
                </div>
            </div>
        `;
    }

    overlay.innerHTML = `<div class="modal-box" style="width:90%; max-width:550px;">
        <h3>Customize Syntax Colors</h3>
        <div id="color-picker-list" style="max-height: 60vh; overflow-y: auto; padding: 10px; border-top: 1px solid #333; border-bottom: 1px solid #333; margin: 15px 0;">
            ${colorItemsHtml}
        </div>
        <div class="modal-buttons">
            <button id="modal-colors-reset-btn" class="modal-btn-reset">Reset to Defaults</button>
            <button id="modal-colors-cancel-btn" class="modal-btn-cancel">Cancel</button>
            <button id="modal-colors-save-btn" class="modal-btn-confirm">Save & Apply</button>
        </div>
    </div>`;

    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        if (item.isText) {
            const boldCheckbox = document.getElementById(`bold_${key}`);
            boldCheckbox.checked = lsGet(`boldness_${key}`) ?? item.defaultBold;
        }
    }

    const listContainer = document.getElementById('color-picker-list');
    const infoTooltip = document.getElementById('info-tooltip');
    listContainer.addEventListener('mouseover', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.textContent = e.target.dataset.infoText; infoTooltip.style.display = 'block'; } });
    listContainer.addEventListener('mouseout', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.style.display = 'none'; } });
    listContainer.addEventListener('mousemove', e => { if (infoTooltip.style.display === 'block') { const t = infoTooltip, w = window, m=15; let l = e.clientX + m, p = e.clientY + m; if (l + t.offsetWidth > w.innerWidth) l = e.clientX - t.offsetWidth - m; if (p + t.offsetHeight > w.innerHeight) p = e.clientY - t.offsetHeight - m; if(l<0)l=0; if(p<0)p=0; t.style.left = l + 'px'; t.style.top = p + 'px'; } });

    document.getElementById('modal-colors-cancel-btn').onclick = () => openSettingsModal();
    
    document.getElementById('modal-colors-reset-btn').onclick = () => {
        if (confirm("Are you sure you want to reset all syntax colors and styles to their defaults?")) {
            for (const key in syntaxColorConfig) {
                const item = syntaxColorConfig[key];
                document.getElementById(key).value = item.default;
                if (item.isText) document.getElementById(`bold_${key}`).checked = item.defaultBold;
            }
        }
    };

    document.getElementById('modal-colors-save-btn').onclick = () => {
        for (const key in syntaxColorConfig) {
            lsSet(`color_${key}`, document.getElementById(key).value);
            if (syntaxColorConfig[key].isText) lsSet(`boldness_${key}`, document.getElementById(`bold_${key}`).checked);
        }
        overlay.style.display = 'none';
        if (confirm("Syntax colors and styles have been saved. A reload is required. Your work will be saved.\n\nReload now?")) {
            window.dispatchEvent(new Event('beforeunload'));
            window.location.reload();
        }
    };
}

function openThemeEditorModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';
    const root = document.documentElement;

    const originalValues = {};
    for (const key in uiThemeConfig) {
        originalValues[key] = root.style.getPropertyValue(key);
        if (uiThemeConfig[key].hasBoldToggle) {
            originalValues[key + '-bold'] = root.style.getPropertyValue(key + '-bold');
        }
    }

    const groupedItems = Object.entries(uiThemeConfig).reduce((acc, [key, item]) => {
        const category = item.category || 'General';
        (acc[category] = acc[category] || []).push([key, item]);
        return acc;
    }, {});
    
    const categories = Object.keys(groupedItems).sort();

    let tabButtonsHtml = categories.map((cat, index) => 
        `<button class="theme-tab-btn ${index === 0 ? 'active' : ''}" data-category="${cat}">${cat}</button>`
    ).join('');

    let tabPanesHtml = categories.map((cat, index) => {
        let itemsHtml = groupedItems[cat].map(([key, item]) => {
            const savedValue = lsGet(`theme_${key}`) ?? item.default;
            let boldToggleHtml = '';
            if (item.hasBoldToggle) {
                const isBold = lsGet(`theme_bold_${key}`) ?? item.defaultBold;
                boldToggleHtml = `<label class="color-picker-sub-label"><input type="checkbox" data-bold-key="${key}" ${isBold ? 'checked' : ''}> Bold</label>`;
            }

            let controlHtml = '';
            if (item.type === 'color') {
                controlHtml = `<input type="color" data-key="${key}" value="${savedValue}">`;
            } else if (item.type === 'range') {
                controlHtml = `<div class="range-control-wrapper">
                                <input type="range" data-key="${key}" value="${savedValue}" min="${item.min}" max="${item.max}">
                                <span id="range-value-${key.replace(/--/g, '')}">${savedValue}${item.unit || ''}</span>
                               </div>`;
            }

            return `
                <div class="color-picker-item">
                    <label class="color-picker-main-label">
                        ${item.label}
                        <span class="info-icon" data-info-text='${item.description}'>ℹ️</span>
                    </label>
                    <div class="color-controls-wrapper">
                        ${boldToggleHtml}
                        ${controlHtml}
                    </div>
                </div>`;
        }).join('');

        return `<div class="theme-tab-pane ${index === 0 ? 'active' : ''}" data-category="${cat}">${itemsHtml}</div>`;
    }).join('');

    overlay.innerHTML = `<div class="modal-box" style="width:90%; max-width:800px;">
        <h3>Customize UI Theme</h3>
        <p style="font-size:0.9em; color:#ccc; margin-top:0;">Changes are applied live. Hover over ℹ️ for details. Click Save to make them permanent.</p>
        <div class="theme-editor-container">
            <div class="theme-tabs">${tabButtonsHtml}</div>
            <div id="theme-picker-list" class="theme-panes">${tabPanesHtml}</div>
        </div>
        <div class="modal-buttons" style="margin-top: 15px;">
            <button id="modal-theme-reset-btn" class="modal-btn-reset">Reset All to Defaults</button>
            <button id="modal-theme-cancel-btn" class="modal-btn-cancel">Cancel</button>
            <button id="modal-theme-save-btn" class="modal-btn-confirm">Save Changes</button>
        </div>
    </div>`;

    const container = document.getElementById('theme-picker-list');

    // Tab switching logic
    overlay.querySelector('.theme-tabs').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            const category = e.target.dataset.category;
            overlay.querySelectorAll('.theme-tab-btn, .theme-tab-pane').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            overlay.querySelector(`.theme-tab-pane[data-category="${category}"]`).classList.add('active');
        }
    });

    container.addEventListener('input', e => {
        const key = e.target.dataset.key;
        const boldKey = e.target.dataset.boldKey;

        if (key) {
            let value = e.target.value;
            const item = uiThemeConfig[key];
            const unit = item.unit || '';
            root.style.setProperty(key, value + unit);
            if(item.type === 'range') {
                document.getElementById(`range-value-${key.replace(/--/g, '')}`).textContent = value + unit;
            }
        } else if (boldKey) {
            const isBold = e.target.checked;
            root.style.setProperty(boldKey + '-bold', isBold ? 'bold' : 'normal');
        }
    });
    
    const infoTooltip = document.getElementById('info-tooltip');
    container.addEventListener('mouseover', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.textContent = e.target.dataset.infoText; infoTooltip.style.display = 'block'; } });
    container.addEventListener('mouseout', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.style.display = 'none'; } });
    container.addEventListener('mousemove', e => { if (infoTooltip.style.display === 'block') { const t = infoTooltip, w = window, m=15; let l = e.clientX + m, p = e.clientY + m; if (l + t.offsetWidth > w.innerWidth) l = e.clientX - t.offsetWidth - m; if (p + t.offsetHeight > w.innerHeight) p = e.clientY - t.offsetHeight - m; if(l<0)l=0; if(p<0)p=0; t.style.left = l + 'px'; t.style.top = p + 'px'; } });


    document.getElementById('modal-theme-cancel-btn').onclick = () => {
        for (const key in originalValues) {
            root.style.setProperty(key, originalValues[key]);
        }
        openSettingsModal();
    };
    
    document.getElementById('modal-theme-reset-btn').onclick = () => {
        if (confirm("Are you sure you want to reset all UI theme settings to their defaults? This will apply the changes live.")) {
            for (const key in uiThemeConfig) {
                lsRemove(`theme_${key}`);
                if (uiThemeConfig[key].hasBoldToggle) {
                    lsRemove(`theme_bold_${key}`);
                }
            }
            applyUiThemeSettings(); 
            openThemeEditorModal(); 
        }
    };

    document.getElementById('modal-theme-save-btn').onclick = () => {
        container.querySelectorAll('input[data-key]').forEach(input => lsSet(`theme_${input.dataset.key}`, input.value));
        container.querySelectorAll('input[data-bold-key]').forEach(input => lsSet(`theme_bold_${input.dataset.boldKey}`, input.checked));
        openSettingsModal();
    };
}

function openExportImportModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.style.pointerEvents = 'auto';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const triggerDownload = (data, filename) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileUpload = (callback) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const data = JSON.parse(event.target.result);
                    callback(data);
                } catch (err) {
                    alert(`Error parsing JSON file: ${err.message}`);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    
    const getAllWorkspaceIds = () => {
        const ids = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const match = key.match(/^HT-IDE-id(\d+)-/);
            if (match) {
                ids.add(match[1]);
            }
        }
        return Array.from(ids).sort((a,b) => a - b);
    };

    const clearWorkspaceData = (id) => {
        const prefix = `HT-IDE-id${id}-`;
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    };

    const workspaceOptions = getAllWorkspaceIds().map(id => `<option value="${id}">Workspace ${id}</option>`).join('');

    overlay.innerHTML = `
        <div class="modal-box" style="max-width: 600px;">
            <h3>Export / Import Data</h3>
            <p style="font-size:0.9em; color:#ccc; margin-top:0;">Importing data will overwrite existing settings and requires a reload.</p>
            
            <div style="border-top: 1px solid #333; margin-top: 15px; padding-top: 15px;">
                <h4><span style="color: #f51000; font-weight: bold;">⚠</span> Everything</h4>
                <p style="font-size:0.8em; margin:0 0 10px 0;">Exports or imports all workspaces, themes, and settings. Use with caution.</p>
                <div style="display:flex; gap: 10px;">
                    <button id="export-all-btn" class="modal-btn-confirm" style="flex:1;">Export All Data</button>
                    <button id="import-all-btn" class="modal-btn-reset" style="flex:1;">Import All Data</button>
                </div>
            </div>

            <div style="border-top: 1px solid #333; margin-top: 15px; padding-top: 15px;">
                <h4><span style="color: #a6e22e;">🎨</span> IDE Theme</h4>
                <p style="font-size:0.8em; margin:0 0 10px 0;">Exports or imports only the UI and syntax color settings for the current workspace.</p>
                <div style="display:flex; gap: 10px;">
                    <button id="export-theme-btn" class="modal-btn-confirm" style="flex:1;">Export Theme</button>
                    <button id="import-theme-btn" class="modal-btn-reset" style="flex:1;">Import Theme</button>
                </div>
            </div>
            
            <div style="border-top: 1px solid #333; margin-top: 15px; padding-top: 15px;">
                <h4><span style="color: #569cd6;">💻</span> Workspace</h4>
                <p style="font-size:0.8em; margin:0 0 10px 0;">Exports a single workspace or imports a file into a new or existing workspace.</p>
                <select id="workspace-select" style="width:100%; padding: 8px; margin-bottom: 10px; background: #252525; color: #e0e0e0; border: 1px solid #444;">
                    ${workspaceOptions.length > 0 ? workspaceOptions : '<option disabled>No workspaces found</option>'}
                </select>
                <div style="display:flex; gap: 10px; margin-bottom: 10px;">
                    <button id="export-workspace-btn" class="modal-btn-confirm" style="flex:1;">Export Selected</button>
                    <button id="import-workspace-btn" style="flex:1; background-color: #3d8b40;">Import to New ID</button>
                </div>
                <button id="import-overwrite-workspace-btn" class="modal-btn-reset" style="width:100%;">Import & Overwrite Selected</button>
            </div>

            <div class="modal-buttons" style="margin-top: 25px;">
                <button id="export-import-close-btn" class="modal-btn-cancel">Close</button>
            </div>
        </div>`;

    document.getElementById('export-import-close-btn').onclick = () => { overlay.style.display = 'none'; };
    
    // --- Event Listeners ---

    // EVERYTHING
    document.getElementById('export-all-btn').onclick = () => {
        let filename = prompt("Enter a filename for the full backup:", "ht-ide-backup-all.json");
        if (!filename) return;
        if (!filename.endsWith('.json')) filename += '.json';
        
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('HT-IDE-')) {
                data[key] = localStorage.getItem(key);
            }
        }
        triggerDownload(data, filename);
    };
    document.getElementById('import-all-btn').onclick = () => {
        if (!confirm("WARNING: This will delete ALL current workspaces and settings and replace them with the data from the file. This cannot be undone. Continue?")) return;
        handleFileUpload(data => {
            localStorage.clear();
            for (const key in data) {
                localStorage.setItem(key, data[key]);
            }
            alert("Import complete. The IDE will now reload.");
            window.location.reload();
        });
    };

    // THEME
    document.getElementById('export-theme-btn').onclick = () => {
        let filename = prompt("Enter a filename for the theme backup:", "ht-ide-theme.json");
        if (!filename) return;
        if (!filename.endsWith('.json')) filename += '.json';

        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(STORAGE_PREFIX) && (key.includes('-theme_') || key.includes('-color_') || key.includes('-boldness_') || key.includes('syntaxHighlighting'))) {
                data[key.replace(STORAGE_PREFIX, '')] = localStorage.getItem(key);
            }
        }
        triggerDownload(data, filename);
    };
    document.getElementById('import-theme-btn').onclick = () => {
        if (!confirm("This will overwrite your current theme settings for this workspace. Continue?")) return;
        handleFileUpload(data => {
            for (const key in data) {
                 localStorage.setItem(STORAGE_PREFIX + key, data[key]);
            }
            alert("Theme import complete. The IDE will now reload to apply changes.");
            window.location.reload();
        });
    };
    
    // WORKSPACE
    document.getElementById('export-workspace-btn').onclick = () => {
        const id = document.getElementById('workspace-select').value;
        if (!id) return alert("Please select a workspace to export.");
        
        let filename = prompt(`Enter a filename for the Workspace ${id} backup:`, `ht-ide-workspace-${id}.json`);
        if (!filename) return;
        if (!filename.endsWith('.json')) filename += '.json';

        const prefix = `HT-IDE-id${id}-`;
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) {
                data[key.replace(prefix, '')] = localStorage.getItem(key);
            }
        }
        triggerDownload(data, filename);
    };

    document.getElementById('import-workspace-btn').onclick = () => {
        const allIds = getAllWorkspaceIds().map(Number);
        const newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 0;
        if (!confirm(`This will import the workspace from the file into a new workspace with ID ${newId}. Continue?`)) return;
        
        handleFileUpload(data => {
            const newPrefix = `HT-IDE-id${newId}-`;
            for (const key in data) {
                localStorage.setItem(newPrefix + key, data[key]);
            }
            alert(`Workspace imported successfully to ID ${newId}. You will now be redirected to the new workspace.`);
            window.location.href = window.location.pathname + `?id=${newId}`;
        });
    };

    document.getElementById('import-overwrite-workspace-btn').onclick = () => {
        const idToOverwrite = document.getElementById('workspace-select').value;
        if (!idToOverwrite) return alert("Please select a workspace to overwrite.");

        if (!confirm(`EXTREME WARNING:\n\nYou are about to permanently delete all data in Workspace ${idToOverwrite} and replace it with data from a file.\n\nTHIS CANNOT BE UNDONE.\n\nAre you absolutely sure you want to proceed?`)) return;

        handleFileUpload(data => {
            clearWorkspaceData(idToOverwrite);
            const prefix = `HT-IDE-id${idToOverwrite}-`;
             for (const key in data) {
                localStorage.setItem(prefix + key, data[key]);
            }
            alert(`Workspace ${idToOverwrite} has been overwritten. The IDE will now reload.`);
            window.location.href = window.location.pathname + `?id=${idToOverwrite}`;
        });
    };
}

function updateHotkeyTitles() {
    const customHotkeys = lsGet('customHotkeys') || {};
    const activeHotkeys = {};
    for (const id in hotkeyConfig) {
        activeHotkeys[id] = customHotkeys[id] || hotkeyConfig[id].default;
    }

    // Update Run Button Title
    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        const runHotkeyStr = formatHotkey(activeHotkeys.runFile);
        // F5 is a non-customizable secondary key
        runBtn.title = `Run (F5 or ${runHotkeyStr})`;
    }

    // Update Format Button Title
    const formatBtn = document.getElementById('format-btn');
    if (formatBtn) {
        const formatHotkeyStr = formatHotkey(activeHotkeys.formatFile);
        formatBtn.title = `Format HTVM File (${formatHotkeyStr})`;
    }

    // Update Toggle Sidebar Button Title
    const toggleSidebarBtn = document.getElementById('main-toggle-sidebar-btn');
    if (toggleSidebarBtn) {
        const toggleHotkeyStr = formatHotkey(activeHotkeys.toggleSidebar);
        toggleSidebarBtn.title = `Toggle File Explorer (${toggleHotkeyStr})`;
    }
}	
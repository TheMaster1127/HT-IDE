// js/7_modals_1.js

//---Modal Dialog Functions---

function openConfirmModal(title, message, callback) {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.innerHTML = `
        <h3>${title}</h3>
        <p style="margin: 5px 0 15px 0; white-space: pre-wrap;">${message}</p>
        <div class="modal-buttons">
            <button class="modal-btn-cancel">Cancel</button>
            <button class="modal-btn-confirm">OK</button>
        </div>
    `;

    const confirmBtn = modalInstance.querySelector('.modal-btn-confirm');
    const cancelBtn = modalInstance.querySelector('.modal-btn-cancel');

    const closeModal = (result) => {
        if (overlay.contains(modalInstance)) {
            overlay.removeChild(modalInstance);
        }
        if (overlay.childElementCount === 0) {
            overlay.classList.remove('visible');
        }
        if (callback) callback(result);
    };

    confirmBtn.onclick = () => closeModal(true);
    cancelBtn.onclick = () => closeModal(false);
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}


function openSessionModal(mode) {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.innerHTML = `<h3 id="modal-title"></h3><div id="modal-save-content" style="display:none;"><p>Enter/overwrite session name:</p><input type="text" id="modal-input" style="width:calc(100% - 22px);padding:10px;margin-bottom:15px;background-color:#252525;border:1px solid #333;color:#e0e0e0;"></div><ul class="modal-list" id="modal-list"></ul><div class="modal-buttons"><button class="modal-btn-cancel">Cancel</button><button class="modal-btn-confirm" style="margin-left:8px;">Save</button></div>`;

    const list = modalInstance.querySelector('#modal-list');
    
    const closeModal = () => {
        if (overlay.contains(modalInstance)) {
            overlay.removeChild(modalInstance);
        }
        if (overlay.childElementCount === 0) {
            overlay.classList.remove('visible');
        }
    };

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
            delBtn.onclick = (e) => {
                e.stopPropagation();
                openConfirmModal('Delete Session', `Are you sure you want to delete the session "${name}"?`, (confirmed) => {
                    if (confirmed) {
                        let s = lsGet('session_list').filter(i => i !== name);
                        lsSet('session_list', s);
                        lsRemove(`session_data_${name}`);
                        populate(cb);
                    }
                });
            };
            li.appendChild(nameSpan);
            li.appendChild(delBtn);
            list.appendChild(li);
        });
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;

    if (mode === 'save') {
        modalInstance.querySelector('#modal-title').textContent = 'Save Session';
        modalInstance.querySelector('#modal-save-content').style.display = 'block';
        modalInstance.querySelector('.modal-btn-confirm').textContent = 'Save';
        populate(name => modalInstance.querySelector('#modal-input').value = name);
        modalInstance.querySelector('.modal-btn-confirm').onclick = () => {
            const name = modalInstance.querySelector('#modal-input').value.trim();
            if (!name) return alert('Name cannot be empty.');
            let sessions = lsGet('session_list') || [];
            if (!sessions.includes(name)) sessions.push(name);
            lsSet('session_list', sessions);
            // MODIFICATION START: Save an object containing both tabs and the current directory.
            const sessionData = {
                tabs: openTabs,
                directory: currentDirectory
            };
            lsSet(`session_data_${name}`, sessionData);
            // MODIFICATION END
            closeModal();
            getActiveTerminalSession()?.xterm.writeln(`\x1b[32mSession '${name}' saved.\x1b[0m`);
        };
    } else { // 'load' mode
        modalInstance.querySelector('#modal-title').textContent = 'Load Session';
        modalInstance.querySelector('#modal-save-content').style.display = 'none';
        modalInstance.querySelector('.modal-btn-confirm').style.display = 'none';
        
        populate(async (name) => {
            // MODIFICATION START: Handle both old (array) and new (object) session formats.
            const sessionData = lsGet(`session_data_${name}`);
            if (!sessionData) return;

            let tabsToLoad;
            let directoryToLoad;

            // Check for backward compatibility with old session format.
            if (Array.isArray(sessionData)) {
                tabsToLoad = sessionData;
                directoryToLoad = '/'; // Default to root if directory isn't specified.
            } else if (typeof sessionData === 'object' && sessionData.tabs) {
                tabsToLoad = sessionData.tabs;
                directoryToLoad = sessionData.directory || '/';
            } else {
                return; // Invalid session data
            }

            // Clear the current state before loading the new one.
            currentOpenFile = null;
            openTabs.forEach(tab => window.electronAPI.unwatchFile(tab));
            openTabs = [];
            fileSessions.clear();

            // Set the directory FIRST.
            await setCurrentDirectory(directoryToLoad);

            // Then, load all the files.
            for (const tabPath of tabsToLoad) {
                await openFileInEditor(tabPath);
            }

            // Handle the case where the session was empty.
            if (openTabs.length === 0) {
                editor.setSession(ace.createEditSession("// No file open."));
                editor.setReadOnly(true);
                await renderAll();
            }
            // MODIFICATION END

            closeModal();
            getActiveTerminalSession()?.xterm.writeln(`\x1b[32mSession '${name}' loaded.\x1b[0m`);
        });
    }
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}

function openInputModal(title, label, defaultValue, callback) {
    const overlay = document.getElementById('modal-overlay');

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.innerHTML = `
        <h3>${title}</h3>
        <p style="margin: 5px 0 10px 0;">${label}</p>
        <input type="text" class="input-modal-field" value="${defaultValue}" style="width:calc(100% - 22px);padding:10px;margin-bottom:15px;background-color:#252525;border:1px solid #333;color:#e0e0e0;">
        <div class="modal-buttons">
            <button class="modal-btn-cancel">Cancel</button>
            <button class="modal-btn-confirm">OK</button>
        </div>
    `;

    const inputField = modalInstance.querySelector('.input-modal-field');
    const confirmBtn = modalInstance.querySelector('.modal-btn-confirm');
    const cancelBtn = modalInstance.querySelector('.modal-btn-cancel');

    const closeModal = (value) => {
        if(overlay.contains(modalInstance)) {
             overlay.removeChild(modalInstance);
        }
        if (overlay.childElementCount === 0) {
            overlay.classList.remove('visible');
        }
        if (callback) callback(value);
    };

    const confirmAction = () => {
        closeModal(inputField.value);
    };

    cancelBtn.onclick = () => closeModal(null);
    confirmBtn.onclick = confirmAction;

    inputField.onkeydown = (e) => {
        if (e.key === 'Enter') confirmAction();
        if (e.key === 'Escape') cancelBtn.onclick();
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
    setTimeout(() => {
        inputField.focus();
        inputField.select();
    }, 50);
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
        
        const label = config.label;
        html += `<li><b>${displayText}:</b> ${label}</li>`;
    }
    return `<ul style="padding-left:20px;margin:0; font-size: 0.9em; list-style-type: none;">${html}</ul>`;
}

function captureSettingsState() {
    const container = document.querySelector('.modal-box');
    if (!container) return null;
    try {
        const state = {};
        state.fontSize = container.querySelector('#font-size-input').value;
        state.keybindingMode = container.querySelector('input[name="keybinding-mode"]:checked').value;
        state.autoPair = container.querySelector('#auto-pair-checkbox').checked;
        state.showPrintMargin = container.querySelector('#print-margin-checkbox').checked;
        state.printMarginColumn = container.querySelector('#print-margin-column-input').value;
        state.syntaxHighlightingEnabled = container.querySelector('#syntax-highlighting-master-checkbox').checked;
        state.highlightSymbolOperators = container.querySelector('#symbol-operator-highlighting-checkbox').checked;
        state.clearTerminalOnRun = container.querySelector('#clear-terminal-on-run-checkbox').checked;
        state.autocompleteMaster = container.querySelector('#autocomplete-master-checkbox').checked;
        state.autocompleteKeywords = container.querySelector('#autocomplete-keywords-checkbox').checked;
        state.autocompleteLocal = container.querySelector('#autocomplete-local-checkbox').checked;
        state.serverPort = container.querySelector('#server-port-input').value;
        state.serverDefaultFile = container.querySelector('#server-file-input').value;
        if(container.querySelector('#project-dir-input')) {
            state.projectDirectory = container.querySelector('#project-dir-input').value;
        }
        return state;
    } catch (e) {
        console.error("Could not capture settings state, elements might not be in DOM.", e);
        return null;
    }
}

async function openSettingsModal(initialState = null) {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '850px';

    modalInstance.innerHTML = `
        <h3>Settings + Help</h3>
        <div id="settings-columns-container" style="display: flex; flex-wrap: wrap; gap: 20px; border-top: 1px solid #333; padding-top: 15px; padding-bottom: 15px;">
            <div class="settings-column" style="flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 240px;">
                <h4>Editor</h4>
                <div><label for="font-size-input">Font Size: </label><input type="number" id="font-size-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
                <div><label><input type="checkbox" id="auto-pair-checkbox"> Auto-pair Brackets/Quotes</label></div>
                <div><label><input type="checkbox" id="print-margin-checkbox"> Show Vertical Guide Line</label></div>
                <div style="padding-left: 20px;"><label for="print-margin-column-input">Guide Line Column: </label><input type="number" id="print-margin-column-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>

                <div style="margin-top: 10px;">
                    <h4>Keybinding Mode</h4>
                    <div id="keybinding-mode-group" style="padding-left: 10px;">
                        <label><input type="radio" name="keybinding-mode" value="normal"> Normal (Ace)</label>
                        <label><input type="radio" name="keybinding-mode" value="vim"> Vim</label>
                        <label><input type="radio" name="keybinding-mode" value="emacs"> Emacs</label>
                        <label><input type="radio" name="keybinding-mode" value="vscode"> VSCode</label>
                        <label><input type="radio" name="keybinding-mode" value="sublime"> Sublime</label>
                    </div>
                </div>

                <div style="margin-top: 10px;">
                    <h4>Web Server</h4>
                    <div style="padding-left: 10px;">
                        <div><label for="server-port-input">Port: </label><input type="number" id="server-port-input" style="width:80px;background:#252525;color:#e0e0e0;border:1px solid #333; margin-bottom: 5px;"></div>
                        <div><label for="server-file-input">Default File: </label><input type="text" id="server-file-input" style="width:120px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
                    </div>
                </div>
            </div>
            <div class="settings-column" style="flex: 1.2; padding-left: 20px; border-left: 1px solid #333; display: flex; flex-direction: column; gap: 15px; min-width: 280px;">
                <div>
                    <h4>Theme & Appearance</h4>
                    <button id="customize-theme-btn" style="margin-top: 5px; padding: 8px; background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text); font-weight: var(--btn-new-file-text-bold);">Customize UI Theme</button>
                    <h4 style="margin-top:20px;">Syntax Highlighting (HTVM mostly)</h4>
                    <div><label><input type="checkbox" id="syntax-highlighting-master-checkbox"> Enable Syntax Highlighting</label></div>
                    <div style="padding-left: 20px;"><label><input type="hidden" id="symbol-operator-highlighting-checkbox"> Highlight Symbol Operators (e.g., =, ++, *)</label></div>
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
                 
                 <div style="margin-top: 15px; border-top: 1px solid #333; padding-top: 15px;">
                    <h4>Projects</h4>
                    <div style="padding-left: 10px;">
                        <div style="margin-bottom: 10px;">
                            <label for="project-dir-input" style="display: block; margin-bottom: 5px;">Default Project Directory:</label>
                            <div style="display:flex; gap: 5px;">
                                <input type="text" id="project-dir-input" readonly style="flex-grow:1; background:#202020; color:#ccc; border:1px solid #333; padding: 5px;">
                                <button id="select-project-dir-btn" style="padding: 4px 8px;">Select</button>
                            </div>
                        </div>
                        <button id="manage-project-templates-btn" style="padding: 8px; background-color: var(--btn-new-file-bg); color: var(--btn-new-file-text); font-weight: var(--btn-new-file-text-bold);">Manage Project Structures</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-buttons" style="margin-top: 20px;"><button id="modal-ok-btn" style="padding: 10px 24px; font-size: 1.1em; font-weight: bold;">OK</button></div>
    `;
    
    const closeModal = () => {
        if (overlay.contains(modalInstance)) {
            overlay.removeChild(modalInstance);
        }
        if (overlay.childElementCount === 0) {
            overlay.classList.remove('visible');
        }
    };

    const initialSyntaxEnabled = lsGet('syntaxHighlightingEnabled') !== false;
    const initialHighlightOperators = lsGet('highlightSymbolOperators') !== false;

    modalInstance.querySelector('#font-size-input').value = editor.getFontSize();
    const currentMode = lsGet('keybindingMode') || 'normal';
    modalInstance.querySelector(`input[name="keybinding-mode"][value="${currentMode}"]`).checked = true;
    modalInstance.querySelector('#auto-pair-checkbox').checked = editor.getBehavioursEnabled();
    modalInstance.querySelector('#print-margin-checkbox').checked = editor.getShowPrintMargin();
    modalInstance.querySelector('#print-margin-column-input').value = editor.getOption('printMargin');
    modalInstance.querySelector('#syntax-highlighting-master-checkbox').checked = initialSyntaxEnabled;
    modalInstance.querySelector('#symbol-operator-highlighting-checkbox').checked = initialHighlightOperators;
    modalInstance.querySelector('#clear-terminal-on-run-checkbox').checked = lsGet('clearTerminalOnRun') === true;
    modalInstance.querySelector('#autocomplete-master-checkbox').checked = lsGet('autocomplete-master') !== false;
    modalInstance.querySelector('#autocomplete-keywords-checkbox').checked = lsGet('autocomplete-keywords') !== false;
    modalInstance.querySelector('#autocomplete-local-checkbox').checked = lsGet('autocomplete-local') !== false;
    modalInstance.querySelector('#server-port-input').value = lsGet('serverPort') || 8080;
    modalInstance.querySelector('#server-file-input').value = lsGet('serverDefaultFile') || 'index.html';
    
    const appPath = await window.electronAPI.getAppPath();
    const separator = appPath.includes('\\') ? '\\' : '/';
    const defaultProjectsPath = `${appPath}${separator}projects`;
    modalInstance.querySelector('#project-dir-input').value = lsGet('projectDirectory') || defaultProjectsPath;

    if (initialState) {
        if (initialState.fontSize !== undefined) modalInstance.querySelector('#font-size-input').value = initialState.fontSize;
        if (initialState.keybindingMode) modalInstance.querySelector(`input[name="keybinding-mode"][value="${initialState.keybindingMode}"]`).checked = true;
        if (initialState.autoPair !== undefined) modalInstance.querySelector('#auto-pair-checkbox').checked = initialState.autoPair;
        if (initialState.showPrintMargin !== undefined) modalInstance.querySelector('#print-margin-checkbox').checked = initialState.showPrintMargin;
        if (initialState.printMarginColumn !== undefined) modalInstance.querySelector('#print-margin-column-input').value = initialState.printMarginColumn;
        if (initialState.syntaxHighlightingEnabled !== undefined) modalInstance.querySelector('#syntax-highlighting-master-checkbox').checked = initialState.syntaxHighlightingEnabled;
        if (initialState.highlightSymbolOperators !== undefined) modalInstance.querySelector('#symbol-operator-highlighting-checkbox').checked = initialState.highlightSymbolOperators;
        if (initialState.clearTerminalOnRun !== undefined) modalInstance.querySelector('#clear-terminal-on-run-checkbox').checked = initialState.clearTerminalOnRun;
        if (initialState.autocompleteMaster !== undefined) modalInstance.querySelector('#autocomplete-master-checkbox').checked = initialState.autocompleteMaster;
        if (initialState.autocompleteKeywords !== undefined) modalInstance.querySelector('#autocomplete-keywords-checkbox').checked = initialState.autocompleteKeywords;
        if (initialState.autocompleteLocal !== undefined) modalInstance.querySelector('#autocomplete-local-checkbox').checked = initialState.autocompleteLocal;
        if (initialState.serverPort !== undefined) modalInstance.querySelector('#server-port-input').value = initialState.serverPort;
        if (initialState.serverDefaultFile !== undefined) modalInstance.querySelector('#server-file-input').value = initialState.serverDefaultFile;
        if (initialState.projectDirectory !== undefined) modalInstance.querySelector('#project-dir-input').value = initialState.projectDirectory;
    }
    
    modalInstance.querySelector('#select-project-dir-btn').onclick = async () => {
        const result = await window.electronAPI.openDirectory();
        if (result && result.length > 0) {
            modalInstance.querySelector('#project-dir-input').value = result[0];
        }
    };
    modalInstance.querySelector('#manage-project-templates-btn').onclick = () => {
        const currentState = captureSettingsState();
        closeModal();
        openProjectManagerModal(currentState);
    };

    modalInstance.querySelector('#customize-colors-btn').onclick = () => { closeModal(); openSyntaxColorModal(captureSettingsState()); };
    modalInstance.querySelector('#customize-theme-btn').onclick = () => { closeModal(); openThemeEditorModal(captureSettingsState()); };
    modalInstance.querySelector('#customize-hotkeys-btn').onclick = () => { closeModal(); openHotkeyEditorModal(captureSettingsState()); };

    modalInstance.querySelector('#modal-ok-btn').onclick = () => {
        editor.setFontSize(parseInt(modalInstance.querySelector('#font-size-input').value, 10)); lsSet('fontSize', editor.getFontSize());
        const keybinding = modalInstance.querySelector('input[name="keybinding-mode"]:checked').value;
        lsSet('keybindingMode', keybinding);
        editor.setKeyboardHandler(keybinding === 'normal' ? null : `ace/keyboard/${keybinding}`);
        editor.setBehavioursEnabled(modalInstance.querySelector('#auto-pair-checkbox').checked); lsSet('autoPair', editor.getBehavioursEnabled());
        editor.setShowPrintMargin(modalInstance.querySelector('#print-margin-checkbox').checked); lsSet('showPrintMargin', editor.getShowPrintMargin());
        editor.setOption('printMargin', parseInt(modalInstance.querySelector('#print-margin-column-input').value, 10) || 80); lsSet('printMarginColumn', editor.getOption('printMargin'));
        lsSet('clearTerminalOnRun', modalInstance.querySelector('#clear-terminal-on-run-checkbox').checked);
        lsSet('autocomplete-master', modalInstance.querySelector('#autocomplete-master-checkbox').checked);
        lsSet('autocomplete-keywords', modalInstance.querySelector('#autocomplete-keywords-checkbox').checked);
        lsSet('autocomplete-local', modalInstance.querySelector('#autocomplete-local-checkbox').checked);
        lsSet('serverPort', parseInt(modalInstance.querySelector('#server-port-input').value, 10) || 8080);
        lsSet('serverDefaultFile', modalInstance.querySelector('#server-file-input').value.trim() || 'index.html');
        lsSet('projectDirectory', modalInstance.querySelector('#project-dir-input').value);

        const newSyntaxEnabled = modalInstance.querySelector('#syntax-highlighting-master-checkbox').checked;
        const newHighlightOperators = modalInstance.querySelector('#symbol-operator-highlighting-checkbox').checked;
        const needsReload = (initialSyntaxEnabled !== newSyntaxEnabled) || (initialHighlightOperators !== newHighlightOperators);

        lsSet('syntaxHighlightingEnabled', newSyntaxEnabled);
        lsSet('highlightSymbolOperators', newHighlightOperators);
        
        if (needsReload) {
            const msg = "Some syntax highlighting settings have changed. A reload is required for them to take full effect. Your work will be saved.\n\nReload now?";
            openConfirmModal("Reload Required", msg, (confirmed) => {
                if(confirmed) {
                    window.dispatchEvent(new Event('beforeunload'));
                    window.electronAPI.reloadApp();
                } else {
                    closeModal();
                }
            });
        } else {
            closeModal();
        }
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
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

function openHotkeyEditorModal(settingsState) {
    const overlay = document.getElementById('modal-overlay');
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

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '600px';
    modalInstance.innerHTML = `
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
    `;

    const closeModal = () => {
        if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        openSettingsModal(settingsState);
    };

    const container = modalInstance.querySelector('#hotkey-picker-list');
    
    container.querySelectorAll('.hotkey-input').forEach(input => {
        const id = input.dataset.id;
        input.dataset.config = JSON.stringify(customHotkeys[id] || hotkeyConfig[id].default);

        input.onkeydown = e => {
            e.preventDefault();
            e.stopPropagation();
            
            const newConfig = { key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
            const currentId = e.target.dataset.id;
            const allInputs = container.querySelectorAll('.hotkey-input');
            
            for (const otherInput of allInputs) {
                const otherId = otherInput.dataset.id;
                if (currentId === otherId) continue;
                const otherConfig = JSON.parse(otherInput.dataset.config);
                if (otherConfig.key.toLowerCase() === newConfig.key.toLowerCase() && otherConfig.ctrl === newConfig.ctrl && otherConfig.shift === newConfig.shift && otherConfig.alt === newConfig.alt) {
                    alert(`Hotkey '${formatHotkey(newConfig)}' is already in use by '${hotkeyConfig[otherId].label}'.`);
                    return;
                }
            }
            
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

    modalInstance.querySelector('#modal-hotkeys-cancel-btn').onclick = closeModal;
    
    modalInstance.querySelector('#modal-hotkeys-reset-all-btn').onclick = () => {
        openConfirmModal("Reset All Hotkeys", "Are you sure?", (confirmed) => {
            if (confirmed) {
                lsRemove('customHotkeys');
                applyAndSetHotkeys();
                if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
                openHotkeyEditorModal(settingsState);
            }
        });
    };
    
    modalInstance.querySelector('#modal-hotkeys-save-btn').onclick = () => {
        const newCustomHotkeys = {};
        container.querySelectorAll('.hotkey-input').forEach(input => {
            newCustomHotkeys[input.dataset.id] = JSON.parse(input.dataset.config);
        });
        lsSet('customHotkeys', newCustomHotkeys);
        applyAndSetHotkeys();
        closeModal();
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}


function openSyntaxColorModal(settingsState) {
    const overlay = document.getElementById('modal-overlay');

    let colorItemsHtml = '';
    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        const savedColor = lsGet(`color_${key}`) || item.default;
        
        const controlHtml = item.isText
            ? `<label style="cursor:pointer; display:flex; align-items:center; gap: 4px; user-select: none;">
                   <input type="checkbox" id="bold_${key}"> Bold
               </label>`
            : `<span class="info-icon" data-info-text="This setting controls a background color, so 'bold' does not apply." style="cursor:help; font-size: 1.2em;">ℹ️</span>`;

        colorItemsHtml += `
            <div class="color-picker-item">
                <label for="${key}" class="color-picker-main-label">${item.label}</label>
                <div class="color-controls-wrapper">
                    ${controlHtml}
                    <input type="color" id="${key}" value="${savedColor}">
                </div>
            </div>`;
    }

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '550px';
    modalInstance.innerHTML = `
        <h3>Customize Syntax Colors</h3>
        <div id="color-picker-list" style="max-height: 60vh; overflow-y: auto; padding: 10px; border-top: 1px solid #333; border-bottom: 1px solid #333; margin: 15px 0;">
            ${colorItemsHtml}
        </div>
        <div class="modal-buttons">
            <button class="modal-btn-reset">Reset to Defaults</button>
            <button class="modal-btn-cancel">Cancel</button>
            <button class="modal-btn-confirm">Save & Apply</button>
        </div>
    `;
    
    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        openSettingsModal(settingsState);
    };

    for (const key in syntaxColorConfig) {
        const item = syntaxColorConfig[key];
        if (item.isText) {
            const boldCheckbox = modalInstance.querySelector(`#bold_${key}`);
            boldCheckbox.checked = lsGet(`boldness_${key}`) ?? item.defaultBold;
        }
    }

    const listContainer = modalInstance.querySelector('#color-picker-list');
    const infoTooltip = document.getElementById('info-tooltip');
    listContainer.addEventListener('mouseover', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.textContent = e.target.dataset.infoText; infoTooltip.style.display = 'block'; } });
    listContainer.addEventListener('mouseout', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.style.display = 'none'; } });
    listContainer.addEventListener('mousemove', e => { if (infoTooltip.style.display === 'block') { const t = infoTooltip, w = window, m=15; let l = e.clientX + m, p = e.clientY + m; if (l + t.offsetWidth > w.innerWidth) l = e.clientX - t.offsetWidth - m; if(l<0)l=0; if(p<0)p=0; t.style.left = l + 'px'; t.style.top = p + 'px'; } });

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;
    
    modalInstance.querySelector('.modal-btn-reset').onclick = () => {
        openConfirmModal("Reset Colors", "Are you sure?", (confirmed) => {
            if (confirmed) {
                for (const key in syntaxColorConfig) {
                    const item = syntaxColorConfig[key];
                    modalInstance.querySelector(`#${key}`).value = item.default;
                    if (item.isText) modalInstance.querySelector(`#bold_${key}`).checked = item.defaultBold;
                }
            }
        });
    };

    modalInstance.querySelector('.modal-btn-confirm').onclick = () => {
        for (const key in syntaxColorConfig) {
            lsSet(`color_${key}`, modalInstance.querySelector(`#${key}`).value);
            if (syntaxColorConfig[key].isText) lsSet(`boldness_${key}`, modalInstance.querySelector(`#bold_${key}`).checked);
        }
        
        openConfirmModal("Reload Required", "Syntax colors have been saved. A reload is required. Reload now?", (confirmed) => {
             if (confirmed) {
                window.dispatchEvent(new Event('beforeunload'));
                window.electronAPI.reloadApp();
            }
            closeModal();
        });
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}

function openThemeEditorModal(settingsState) {
    const overlay = document.getElementById('modal-overlay');
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
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '800px';
    modalInstance.innerHTML = `
        <h3>Customize UI Theme</h3>
        <p style="font-size:0.9em; color:#ccc; margin-top:0;">Changes are applied live. Hover over ℹ️ for details. Click Save to make them permanent.</p>
        <div class="theme-editor-container">
            <div class="theme-tabs">${tabButtonsHtml}</div>
            <div id="theme-picker-list" class="theme-panes">${tabPanesHtml}</div>
        </div>
        <div class="modal-buttons" style="margin-top: 15px;">
            <button class="modal-btn-reset">Reset All to Defaults</button>
            <button class="modal-btn-cancel">Cancel</button>
            <button class="modal-btn-confirm">Save Changes</button>
        </div>
    `;

    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        openSettingsModal(settingsState);
    }
    
    const container = modalInstance.querySelector('#theme-picker-list');

    modalInstance.querySelector('.theme-tabs').addEventListener('click', e => {
        if (e.target.tagName === 'BUTTON') {
            const category = e.target.dataset.category;
            modalInstance.querySelectorAll('.theme-tab-btn, .theme-tab-pane').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            modalInstance.querySelector(`.theme-tab-pane[data-category="${category}"]`).classList.add('active');
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
                modalInstance.querySelector(`#range-value-${key.replace(/--/g, '')}`).textContent = value + unit;
            }
        } else if (boldKey) {
            const isBold = e.target.checked;
            root.style.setProperty(boldKey + '-bold', isBold ? 'bold' : 'normal');
        }
    });
    
    const infoTooltip = document.getElementById('info-tooltip');
    container.addEventListener('mouseover', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.textContent = e.target.dataset.infoText; infoTooltip.style.display = 'block'; } });
    container.addEventListener('mouseout', e => { if (e.target.classList.contains('info-icon')) { infoTooltip.style.display = 'none'; } });
    container.addEventListener('mousemove', e => { if (infoTooltip.style.display === 'block') { const t = infoTooltip, w = window, m=15; let l = e.clientX + m, p = e.clientY + m; if (l + t.offsetWidth > w.innerWidth) l = e.clientX - t.offsetWidth - m; if(l<0)l=0; if(p<0)p=0; t.style.left = l + 'px'; t.style.top = p + 'px'; } });


    modalInstance.querySelector('.modal-btn-cancel').onclick = () => {
        for (const key in originalValues) {
            root.style.setProperty(key, originalValues[key]);
        }
        closeModal();
    };
    
    modalInstance.querySelector('.modal-btn-reset').onclick = () => {
        openConfirmModal("Reset Theme", "Are you sure? This applies changes live.", (confirmed) => {
            if (confirmed) {
                for (const key in uiThemeConfig) {
                    lsRemove(`theme_${key}`);
                    if (uiThemeConfig[key].hasBoldToggle) lsRemove(`theme_bold_${key}`);
                }
                applyUiThemeSettings();
                if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
                openThemeEditorModal(settingsState); 
            }
        });
    };

    modalInstance.querySelector('.modal-btn-confirm').onclick = () => {
        container.querySelectorAll('input[data-key]').forEach(input => lsSet(`theme_${input.dataset.key}`, input.value));
        container.querySelectorAll('input[data-bold-key]').forEach(input => lsSet(`theme_bold_${input.dataset.boldKey}`, input.checked));
        closeModal();
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}

function openExportImportModal() {
    const overlay = document.getElementById('modal-overlay');
    
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
    
    // --- MODIFICATION START: Corrected workspace ID detection ---
    window.getAllWorkspaceIds = () => {
        const ids = new Set();
        // Always include the current workspace ID, even if no data is stored for it yet.
        // This ensures that when starting fresh, the current workspace "0" is recognized.
        ids.add(getIdeId());
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const match = key.match(/^HT-IDE-id(\d+)-/);
            if (match) ids.add(match[1]);
        }
        return Array.from(ids).sort((a,b) => Number(a) - Number(b));
    };
    // --- MODIFICATION END ---

    window.clearWorkspaceData = (id) => {
        const prefix = `HT-IDE-id${id}-`;
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(prefix)) keysToRemove.push(key);
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    };

    const workspaceOptions = getAllWorkspaceIds().map(id => `<option value="${id}">Workspace ${id}</option>`).join('');

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '600px';
    modalInstance.innerHTML = `
        <h3>Export / Import Data</h3>
        <p style="font-size:0.9em; color:#ccc; margin-top:0;">Importing data will overwrite existing settings and requires a reload.</p>
        
        <div style="border-top: 1px solid #333; margin-top: 15px; padding-top: 15px;">
            <h4><span style="color: #569cd6;">💻</span> Workspaces</h4>
            <p style="font-size:0.8em; margin:0 0 10px 0;">Switch between different workspaces, or create new ones.</p>
            <button id="manage-workspaces-btn" class="modal-btn-confirm" style="width:100%;">Manage Workspaces</button>
        </div>
        
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
            <h4><span style="color: #569cd6;">💾</span> Workspace File</h4>
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
            <button class="modal-btn-cancel">Close</button>
        </div>
    `;

    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if(overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;
    
    modalInstance.querySelector('#manage-workspaces-btn').onclick = () => { closeModal(); openWorkspaceManagerModal(); };
    
    modalInstance.querySelector('#export-all-btn').onclick = () => {
        openInputModal('Export All Data', 'Enter filename:', 'ht-ide-backup-all.json', (filename) => {
            if (!filename) return;
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('HT-IDE-')) data[key] = localStorage.getItem(key);
            }
            triggerDownload(data, filename.endsWith('.json') ? filename : filename + '.json');
        });
    };
    modalInstance.querySelector('#import-all-btn').onclick = () => {
        openConfirmModal("Import All Data", "WARNING: This will delete ALL current data. Continue?", (confirmed) => {
            if (confirmed) handleFileUpload(data => {
                localStorage.clear();
                for (const key in data) localStorage.setItem(key, data[key]);
                alert("Import complete. IDE will reload.");
                window.electronAPI.reloadApp();
            });
        });
    };
    modalInstance.querySelector('#export-theme-btn').onclick = () => {
        openInputModal('Export Theme', 'Enter filename:', 'ht-ide-theme.json', (filename) => {
            if (!filename) return;
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(STORAGE_PREFIX) && (key.includes('-theme_') || key.includes('-color_') || key.includes('-boldness_') || key.includes('syntaxHighlighting'))) {
                    data[key.replace(STORAGE_PREFIX, '')] = localStorage.getItem(key);
                }
            }
            triggerDownload(data, filename.endsWith('.json') ? filename : filename + '.json');
        });
    };
    modalInstance.querySelector('#import-theme-btn').onclick = () => {
        openConfirmModal("Import Theme", "This will overwrite current theme settings. Continue?", (confirmed) => {
            if (confirmed) handleFileUpload(data => {
                for (const key in data) localStorage.setItem(STORAGE_PREFIX + key, data[key]);
                alert("Theme import complete. IDE will reload.");
                window.electronAPI.reloadApp();
            });
        });
    };
    modalInstance.querySelector('#export-workspace-btn').onclick = () => {
        const id = modalInstance.querySelector('#workspace-select').value;
        if (!id) return alert("Please select a workspace.");
        openInputModal('Export Workspace', `Enter filename for Workspace ${id}:`, `ht-ide-workspace-${id}.json`, (filename) => {
            if (!filename) return;
            const prefix = `HT-IDE-id${id}-`;
            const data = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith(prefix)) data[key.replace(prefix, '')] = localStorage.getItem(key);
            }
            triggerDownload(data, filename.endsWith('.json') ? filename : filename + '.json');
        });
    };
    modalInstance.querySelector('#import-workspace-btn').onclick = () => {
        const allIds = getAllWorkspaceIds().map(Number);
        const newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 0;
        openConfirmModal("Import to New Workspace", `This will import to a new workspace (ID ${newId}). Continue?`, (confirmed) => {
            if (confirmed) handleFileUpload(data => {
                const newPrefix = `HT-IDE-id${newId}-`;
                for (const key in data) localStorage.setItem(newPrefix + key, data[key]);
                alert(`Workspace imported to ID ${newId}. Switching now.`);
                window.electronAPI.switchWorkspace(newId);
            });
        });
    };
    modalInstance.querySelector('#import-overwrite-workspace-btn').onclick = () => {
        const id = modalInstance.querySelector('#workspace-select').value;
        if (!id) return alert("Please select a workspace to overwrite.");
        openConfirmModal("Overwrite Workspace", `EXTREME WARNING: This will permanently delete all data in Workspace ${id}. Continue?`, (confirmed) => {
            if(confirmed) handleFileUpload(data => {
                clearWorkspaceData(id);
                const prefix = `HT-IDE-id${id}-`;
                for (const key in data) localStorage.setItem(prefix + key, data[key]);
                alert(`Workspace ${id} overwritten. Reloading.`);
                window.electronAPI.switchWorkspace(id);
            });
        });
    };

    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}

function openWorkspaceManagerModal() {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '600px';

    const populateList = () => {
        const listEl = modalInstance.querySelector('#workspace-manager-list');
        listEl.innerHTML = '';
        const allIds = window.getAllWorkspaceIds();
        const currentId = getIdeId();

        allIds.forEach(id => {
            const li = document.createElement('li');
            const isActive = id === currentId;
            li.style.cssText = `display:flex; align-items:center; gap:10px; ${isActive ? 'background-color:#004a6e; font-weight:bold;' : ''}`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `Workspace ${id} ${isActive ? '(Active)' : ''}`;
            nameSpan.style.flexGrow = '1';
            const btnGroup = document.createElement('div');

            if (!isActive) {
                const switchBtn = document.createElement('button');
                switchBtn.textContent = 'Switch';
                switchBtn.style.backgroundColor = '#0e639c';
                switchBtn.onclick = () => {
                    window.dispatchEvent(new Event('beforeunload'));
                    window.electronAPI.switchWorkspace(id);
                };
                btnGroup.appendChild(switchBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '🗑️';
                deleteBtn.title = 'Delete Workspace';
                deleteBtn.style.marginLeft = '8px';
                deleteBtn.onclick = () => {
                    openConfirmModal("Delete Workspace", `Permanently delete all data for Workspace ${id}?`, (confirmed) => {
                        if (confirmed) {
                            window.clearWorkspaceData(id);
                            populateList();
                        }
                    });
                };
                btnGroup.appendChild(deleteBtn);
            }
            li.appendChild(nameSpan);
            li.appendChild(btnGroup);
            listEl.appendChild(li);
        });
    };

    modalInstance.innerHTML = `
        <h3>Manage Workspaces</h3>
        <p style="margin-top:0; color:#ccc;">Each workspace has its own separate files, settings, and themes.</p>
        <ul class="modal-list" id="workspace-manager-list"></ul>
        <div class="modal-buttons">
             <button id="workspace-add-new-btn" style="float:left; background-color:#2a8f2a;">Create New Workspace</button>
             <button id="workspace-manager-back-btn">Back to Export/Import</button>
        </div>
    `;
    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if(overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('#workspace-manager-back-btn').onclick = () => { closeModal(); openExportImportModal(); };
    modalInstance.querySelector('#workspace-add-new-btn').onclick = () => {
        const allIds = window.getAllWorkspaceIds().map(Number);
        const newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 0;
        openConfirmModal("Create New Workspace", `Create and switch to a new, empty workspace (ID ${newId})?`, (confirmed) => {
            if (confirmed) {
                window.dispatchEvent(new Event('beforeunload'));
                window.electronAPI.switchWorkspace(newId);
            }
        });
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
    populateList();
}


function updateHotkeyTitles() {
    const customHotkeys = lsGet('customHotkeys') || {};
    const activeHotkeys = {};
    for (const id in hotkeyConfig) {
        activeHotkeys[id] = customHotkeys[id] || hotkeyConfig[id].default;
    }

    const runBtn = document.getElementById('run-btn');
    if (runBtn) {
        const runConfig = hotkeyConfig['runFile'];
        const runHotkeyStr = formatHotkey(activeHotkeys.runFile);
        runBtn.title = `${runConfig.label} (${formatHotkey(runConfig.secondary)} or ${runHotkeyStr})`;
    }

    const formatBtn = document.getElementById('format-btn');
    if (formatBtn) {
        const formatHotkeyStr = formatHotkey(activeHotkeys.formatFile);
        formatBtn.title = `Format HTVM File (${formatHotkeyStr})`;
    }
    
    const mapLineBtn = document.getElementById('map-line-btn');
    if (mapLineBtn) {
        const mapLineHotkeyStr = formatHotkey(activeHotkeys.mapLine);
        mapLineBtn.title = `Map Target Line to HTVM (${mapLineHotkeyStr})`;
    }

    const toggleSidebarBtn = document.getElementById('main-toggle-sidebar-btn');
    if (toggleSidebarBtn) {
        const toggleHotkeyStr = formatHotkey(activeHotkeys.toggleSidebar);
        toggleSidebarBtn.title = `Toggle File Explorer (${toggleHotkeyStr})`;
    }
}

async function openNewProjectModal() {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    
    let templates = lsGet('projectTemplates') || [];
    if (templates.length === 0) {
        templates = [{ id: 'template_default_empty', name: 'Empty Project', files: [] }];
        lsSet('projectTemplates', templates);
    }
    const templateOptions = templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    modalInstance.innerHTML = `
        <h3>Create New Project</h3>
        <label for="new-project-name-input" style="display: block; margin: 15px 0 5px 0;">Project Name:</label>
        <input type="text" id="new-project-name-input" placeholder="my-awesome-project" style="width:calc(100% - 22px);padding:10px;margin-bottom:15px;background-color:#252525;border:1px solid #333;color:#e0e0e0;">
        
        <label for="project-template-select" style="display: block; margin: 15px 0 5px 0;">Select Structure:</label>
        <select id="project-template-select" style="width:100%; padding: 10px; background-color: #252525; border: 1px solid #333; color: #e0e0e0; margin-bottom: 15px;">
            ${templateOptions}
        </select>

        <div class="modal-buttons">
            <button class="modal-btn-cancel">Cancel</button>
            <button class="modal-btn-confirm">Create Project</button>
        </div>
    `;

    const closeModal = () => {
        if(overlay.contains(modalInstance)) {
            overlay.removeChild(modalInstance);
        }
        if(overlay.childElementCount === 0) {
            overlay.classList.remove('visible');
        }
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;

    modalInstance.querySelector('.modal-btn-confirm').onclick = async () => {
        const projectName = modalInstance.querySelector('#new-project-name-input').value.trim();
        if (!projectName.match(/^[a-zA-Z0-9._-]+$/)) {
            return alert("Project name can only contain letters, numbers, dots, hyphens, and underscores.");
        }
        
        const templateId = modalInstance.querySelector('#project-template-select').value;
        const template = (lsGet('projectTemplates') || []).find(t => t.id === templateId);
        if (!template) return alert("Selected structure not found.");
        
        const appPath = await window.electronAPI.getAppPath();
        const separator = appPath.includes('\\') ? '\\' : '/';
        const defaultProjectsPath = `${appPath}${separator}projects`;
        const projectBaseDir = lsGet('projectDirectory') || defaultProjectsPath;
        
        await window.electronAPI.createItem(projectBaseDir, false);

        const newProjectPath = `${projectBaseDir}${separator}${projectName}`;
        const itemsInBaseDir = await window.electronAPI.getAllPaths(projectBaseDir);
        if (itemsInBaseDir.some(item => item.path === newProjectPath)) {
            return alert(`A project named "${projectName}" already exists in the target directory.`);
        }

        let result = await window.electronAPI.createItem(newProjectPath, false);
        if (!result.success) return alert(`Error creating project directory: ${result.error}`);
        
        const filesToOpen = [];
        for (const file of template.files) {
            if (!file.path) continue;
            const filePath = `${newProjectPath}${separator}${file.path.replace(/[\/\\]/g, separator)}`;
            await window.electronAPI.saveFileContent(filePath, file.content || '');
            filesToOpen.push(filePath);
        }
        
        closeModal();

        openConfirmModal("Project Created", `Project "${projectName}" was created successfully.\n\nDo you want to open it now? All current tabs will be closed.`, async (confirmed) => {
            if (confirmed) {
                window.dispatchEvent(new Event('beforeunload'));

                openTabs.forEach(tab => window.electronAPI.unwatchFile(tab));
                openTabs = [];
                fileSessions.clear();
                recentlyClosedTabs = [];
                currentOpenFile = null;
                
                await setCurrentDirectory(newProjectPath);

                for (const fileToOpen of filesToOpen) {
                    await openFileInEditor(fileToOpen);
                }
                
                if (filesToOpen.length === 0) {
                    editor.setSession(ace.createEditSession("// New empty project."));
                    editor.setReadOnly(true);
                } else {
                    await openFileInEditor(filesToOpen[0]);
                }
                renderAll();
            }
        });
    };

    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
    setTimeout(() => {
        modalInstance.querySelector('#new-project-name-input')?.focus();
    }, 50);
}

function openProjectManagerModal(settingsState) {
    const overlay = document.getElementById('modal-overlay');

    let memory = {
        templates: lsGet('projectTemplates') || [],
        activeTemplateId: null,
        activeFilePath: null,
    };
    
    if (memory.templates.length === 0) {
        memory.templates.push({ id: 'template_default_empty', name: 'Empty Project', files: [] });
    }

    let templateEditor;
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.cssText = "width:90%; max-width:1000px; height: 80vh; display: flex; flex-direction: column;";

    const saveActiveFileContent = () => {
        if (!memory.activeTemplateId || !memory.activeFilePath || !templateEditor) return;
        const tpl = memory.templates.find(t => t.id === memory.activeTemplateId);
        if (!tpl) return;
        const file = tpl.files.find(f => f.path === memory.activeFilePath);
        if (file) {
            file.content = templateEditor.getValue();
        }
    };
    
    const closeModal = (save = false) => {
        if (save) {
            saveActiveFileContent();
            lsSet('projectTemplates', memory.templates);
        }
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        openSettingsModal(settingsState);
    };

    const render = () => {
        modalInstance.innerHTML = `
            <h3>Manage Project Structures</h3>
            <div style="display: flex; flex-grow: 1; gap: 15px; overflow: hidden; border-top: 1px solid #333; padding-top: 15px;">
                <div style="width: 250px; display: flex; flex-direction: column; border-right: 1px solid #333; padding-right: 15px;">
                    <h4>Structures</h4>
                    <ul id="structure-manager-list" class="modal-list" style="flex-grow: 1;"></ul>
                    <div style="display:flex; gap: 5px; margin-top: 5px;">
                        <button id="structure-add-btn" style="flex:1;">Add</button>
                        <button id="structure-rename-btn" style="flex:1;">Rename</button>
                        <button id="structure-delete-btn" style="flex:1;">Delete</button>
                    </div>
                </div>
                <div style="width: 250px; display: flex; flex-direction: column; border-right: 1px solid #333; padding-right: 15px;">
                    <h4>Files in Structure</h4>
                    <ul id="structure-file-list" class="modal-list" style="flex-grow: 1;"></ul>
                    <div style="display:flex; gap: 5px; margin-top: 5px;">
                        <button id="structure-file-add-btn" style="flex:1;">Add</button>
                        <button id="structure-file-delete-btn" style="flex:1;">Delete</button>
                    </div>
                </div>
                <div style="flex-grow: 1; display: flex; flex-direction: column;">
                    <h4>File Content</h4>
                    <div id="structure-file-editor" style="flex-grow: 1; border: 1px solid #444;"></div>
                </div>
            </div>
            <div class="modal-buttons" style="margin-top: 15px;">
                <button class="modal-btn-cancel">Cancel</button>
                <button class="modal-btn-confirm">Save & Close</button>
            </div>
        `;
        
        templateEditor = ace.edit(modalInstance.querySelector("#structure-file-editor"));
        templateEditor.setTheme("ace/theme/monokai");
        templateEditor.setOptions({ wrap: true });
        
        attachButtonHandlers();
        
        const templateListEl = modalInstance.querySelector('#structure-manager-list');
        templateListEl.innerHTML = '';
        memory.templates.forEach(t => {
            const li = document.createElement('li');
            li.textContent = t.name;
            li.dataset.id = t.id;
            li.className = (t.id === memory.activeTemplateId) ? 'active-file-list-item' : '';
            templateListEl.appendChild(li);
        });

        const fileListEl = modalInstance.querySelector('#structure-file-list');
        fileListEl.innerHTML = '';
        const activeTemplate = memory.templates.find(t => t.id === memory.activeTemplateId);

        if (activeTemplate) {
            activeTemplate.files.sort((a,b) => a.path.localeCompare(b.path)).forEach(file => {
                const li = document.createElement('li');
                li.textContent = file.path;
                li.title = file.path;
                li.dataset.path = file.path;
                li.className = (file.path === memory.activeFilePath) ? 'active-file-list-item' : '';
                fileListEl.appendChild(li);
            });
        } else {
            fileListEl.innerHTML = '<li class="no-sessions" style="text-align:center; padding: 10px;">Select a structure</li>';
        }

        const activeFile = activeTemplate?.files.find(f => f.path === memory.activeFilePath);
        if (activeFile) {
            templateEditor.setValue(activeFile.content || '', -1);
            templateEditor.setReadOnly(false);
            const mode = ace.require("ace/ext/modelist").getModeForPath(activeFile.path).mode;
            templateEditor.session.setMode(mode);
        } else {
            templateEditor.setValue('// Select a file to edit its content.', -1);
            templateEditor.setReadOnly(true);
            templateEditor.session.setMode("ace/mode/text");
        }
    };

    const attachButtonHandlers = () => {
        modalInstance.querySelector('#structure-manager-list').onclick = (e) => {
            if (e.target.tagName === 'LI') {
                saveActiveFileContent();
                memory.activeTemplateId = e.target.dataset.id;
                memory.activeFilePath = null;
                render();
            }
        };

        modalInstance.querySelector('#structure-file-list').onclick = (e) => {
            if (e.target.tagName === 'LI') {
                saveActiveFileContent();
                memory.activeFilePath = e.target.dataset.path;
                render();
            }
        };

        modalInstance.querySelector('#structure-add-btn').onclick = () => {
            openInputModal('New Structure', 'Enter name for new structure:', 'New Web Project', (name) => {
                if (name && name.trim() && !memory.templates.some(t => t.name === name.trim())) {
                    memory.templates.push({ id: `template_${Date.now()}`, name: name.trim(), files: [] });
                    render();
                }
            });
        };
        
        modalInstance.querySelector('#structure-rename-btn').onclick = () => {
            if (!memory.activeTemplateId) return;
            const tpl = memory.templates.find(t => t.id === memory.activeTemplateId);
            openInputModal('Rename Structure', 'Enter new name:', tpl.name, (name) => {
                if (name && name.trim() && !memory.templates.some(t => t.name === name.trim() && t.id !== tpl.id)) {
                    tpl.name = name.trim();
                    render();
                }
            });
        };

        modalInstance.querySelector('#structure-delete-btn').onclick = () => {
            if (!memory.activeTemplateId || memory.templates.length <= 1) {
                return alert("Cannot delete the last remaining project structure.");
            }
            const tpl = memory.templates.find(t => t.id === memory.activeTemplateId);
            openConfirmModal('Delete Structure', `Delete "${tpl.name}"?`, (confirmed) => {
                if (confirmed) {
                    memory.templates = memory.templates.filter(t => t.id !== memory.activeTemplateId);
                    memory.activeTemplateId = null;
                    memory.activeFilePath = null;
                    render();
                }
            });
        };

        modalInstance.querySelector('#structure-file-add-btn').onclick = () => {
            const tpl = memory.templates.find(t => t.id === memory.activeTemplateId);
            if (!tpl) return;
            openInputModal('Add File', 'Enter file path (e.g., "js/main.js"):', '', (path) => {
                if (path && path.trim() && !tpl.files.some(f => f.path === path.trim())) {
                    tpl.files.push({ path: path.trim(), content: '' });
                    memory.activeFilePath = path.trim();
                    render();
                }
            });
        };

        modalInstance.querySelector('#structure-file-delete-btn').onclick = () => {
            const tpl = memory.templates.find(t => t.id === memory.activeTemplateId);
            if (!tpl || !memory.activeFilePath) return;
            openConfirmModal('Delete File', `Delete "${memory.activeFilePath}"?`, (confirmed) => {
                if (confirmed) {
                    tpl.files = tpl.files.filter(f => f.path !== memory.activeFilePath);
                    memory.activeFilePath = null;
                    render();
                }
            });
        };

        modalInstance.querySelector('.modal-btn-confirm').onclick = () => closeModal(true);
        modalInstance.querySelector('.modal-btn-cancel').onclick = () => closeModal(false);
    };
    
    overlay.appendChild(modalInstance);
    render();
    overlay.classList.add('visible');
}

// --- NEW/FIXED LINE MAPPING LOGIC ---

async function startLineMappingProcess() {
    let sourceCode, targetCode;
    
    if (currentOpenFile && currentOpenFile.endsWith('.htvm')) {
        sourceCode = editor.getValue();
        openConfirmModal("Paste Target Code", "The HTVM code has been pre-filled.\n\nPlease copy the target language code, then click OK.", async (ok) => {
            if (!ok) return;
            try {
                targetCode = await navigator.clipboard.readText();
                if (!targetCode) throw new Error("Clipboard is empty.");
                openLineMapperModal(sourceCode, targetCode);
            } catch (err) {
                alert(`Could not read from clipboard. Please manually copy the target code and try again.\nError: ${err.message}`);
            }
        });
    } else if (currentOpenFile) {
        targetCode = editor.getValue();
        openConfirmModal("Paste HTVM Code", "The target code has been pre-filled.\n\nPlease copy the HTVM source code, then click OK.", async (ok) => {
            if (!ok) return;
            try {
                sourceCode = await navigator.clipboard.readText();
                 if (!sourceCode) throw new Error("Clipboard is empty.");
                openLineMapperModal(sourceCode, targetCode);
            } catch (err) {
                 alert(`Could not read from clipboard. Please manually copy the HTVM code and try again.\nError: ${err.message}`);
            }
        });
    } else {
         openLineMapperModal("", "");
    }
}


function openLineMapperModal(htvmCode = "", targetCode = "") {
    const overlay = document.getElementById('modal-overlay');

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '90vw';
    modalInstance.style.width = '1200px';

    modalInstance.innerHTML = `
        <h3>HTVM Line Mapper</h3>
        <p style="margin-top:0; color:#ccc;">Paste the source HTVM code and the target language code into the boxes below, then provide the line number from the target code to find the corresponding HTVM line.</p>
        <div style="display: flex; gap: 15px; margin: 15px 0;">
            <div style="flex: 1; display: flex; flex-direction: column;">
                <label for="mapper-htvm-code">HTVM Code:</label>
                <textarea id="mapper-htvm-code" style="flex-grow: 1; resize: none; background-color: #252525; color: #e0e0e0; border: 1px solid #333; height: 300px;"></textarea>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column;">
                <label for="mapper-target-code">Target Language Code:</label>
                <textarea id="mapper-target-code" style="flex-grow: 1; resize: none; background-color: #252525; color: #e0e0e0; border: 1px solid #333;"></textarea>
            </div>
        </div>
        <div style="display: flex; gap: 15px; align-items: flex-end; margin-bottom: 15px;">
            <div>
                <label for="mapper-line-number">Target Line Number:</label>
                <input type="number" id="mapper-line-number" style="width: 100px; padding: 8px; background-color: #252525; color: #e0e0e0; border: 1px solid #333;">
            </div>
            <button id="mapper-run-btn" class="modal-btn-confirm" style="padding: 8px 16px;">Map Line</button>
        </div>
        <div>
            <h4>Result:</h4>
            <div id="mapper-result" style="background-color: #1a1a1a; padding: 10px; border-radius: 3px; border: 1px solid #333; min-height: 24px; white-space: pre-wrap; font-family: monospace;"></div>
        </div>
        <div class="modal-buttons">
            <button class="modal-btn-cancel">Close</button>
        </div>
    `;

    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if(overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;

    const htvmCodeEl = modalInstance.querySelector('#mapper-htvm-code');
    const targetCodeEl = modalInstance.querySelector('#mapper-target-code');
    htvmCodeEl.value = htvmCode;
    targetCodeEl.value = targetCode;

    modalInstance.querySelector('#mapper-run-btn').onclick = () => {
        const htvmCodeVal = htvmCodeEl.value;
        const targetCodeVal = targetCodeEl.value;
        const lineNumber = modalInstance.querySelector('#mapper-line-number').value;

        if (!htvmCodeVal || !targetCodeVal || !lineNumber) {
            alert("Please fill in all fields.");
            return;
        }

        try {
            const result = tryToMapHTVMlineToTargetLine(htvmCodeVal, targetCodeVal, lineNumber);
            modalInstance.querySelector('#mapper-result').textContent = result;
        } catch (e) {
            modalInstance.querySelector('#mapper-result').textContent = `An error occurred: ${e.message}`;
            console.error("Line mapping error:", e);
        }
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}
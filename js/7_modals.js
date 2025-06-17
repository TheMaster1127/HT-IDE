// --- Modal Dialog Functions ---

function openSessionModal(mode) {
    const overlay = document.getElementById('modal-overlay');
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

    document.getElementById('modal-cancel-btn').onclick = () => overlay.style.display = 'none';

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

function openInstructionManagerModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal-box" style="width:90%; max-width:600px;">
        <h3>HTVM Instruction Sets</h3>
        <ul class="modal-list" id="instruction-sets-list"></ul>
        <div class="modal-buttons">
             <button id="instr-add-new-btn" style="float:left; background-color:#2a8f2a;">Add New from File</button>
             <button id="instr-cancel-btn">Close</button>
        </div>
    </div>`;

    const listEl = document.getElementById('instruction-sets-list');
    const populateList = () => {
        listEl.innerHTML = '';
        let sets = lsGet(instructionSetKeys.list) || [];
        const activeId = lsGet(instructionSetKeys.activeId);

        if (!sets.length) {
            listEl.innerHTML = "<li class='no-sessions' style='text-align:center; padding: 20px;'>No instruction sets found. Click 'Add New' to begin.</li>";
            return;
        }

        sets.forEach(set => {
            const li = document.createElement('li');
            const isActive = set.id === activeId;
            li.style.cssText = `display:flex; align-items:center; gap:10px; ${isActive ? 'background-color:#004a6e; font-weight:bold;' : ''}`;
            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${set.name} ${isActive ? '(Active)' : ''}`;
            nameSpan.style.flexGrow = '1';
            const btnGroup = document.createElement('div');

            if (!isActive) {
                const applyBtn = document.createElement('button');
                applyBtn.textContent = 'Apply';
                applyBtn.style.backgroundColor = '#0e639c';
                applyBtn.onclick = () => {
                    if (confirm(`This will apply the "${set.name}" instruction set and reload the IDE.\n\nYour current work will be saved, but undo/redo history will be lost.\n\nContinue?`)) {
                        lsSet(instructionSetKeys.activeId, set.id);
                        window.dispatchEvent(new Event('beforeunload'));
                        window.location.reload();
                    }
                };
                btnGroup.appendChild(applyBtn);
            }

            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.style.marginLeft = '8px';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                let newName = prompt(`Rename instruction set "${set.name}":`, set.name);
                if (newName && newName.trim() && newName !== set.name) {
                    newName = newName.trim();
                    if (sets.some(s => s.name === newName && s.id !== set.id)) {
                        alert("An instruction set with that name already exists.");
                        return;
                    }
                    set.name = newName;
                    lsSet(instructionSetKeys.list, sets);
                    populateList();
                }
            };
            btnGroup.appendChild(renameBtn);

            const editBtn = document.createElement('button');
            editBtn.textContent = '📜';
            editBtn.title = 'Edit Instruction Set Content';
            editBtn.style.marginLeft = '8px';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openInstructionEditorModal(set.id, set.name);
            };
            btnGroup.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.title = 'Delete';
            deleteBtn.style.marginLeft = '8px';
            if (isActive) {
                deleteBtn.disabled = true;
                deleteBtn.title = "Cannot delete the active set.";
            }
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete the instruction set "${set.name}"? This cannot be undone.`)) {
                    const newSets = sets.filter(s => s.id !== set.id);
                    lsSet(instructionSetKeys.list, newSets);
                    localStorage.removeItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + set.id);
                    populateList();
                }
            };
            btnGroup.appendChild(deleteBtn);

            li.appendChild(nameSpan);
            li.appendChild(btnGroup);
            listEl.appendChild(li);
        });
    };

    document.getElementById('instr-add-new-btn').onclick = () => {
        const fileInput = document.getElementById('instruction-file-input');
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            let sets = lsGet(instructionSetKeys.list) || [];
            let newName = prompt("Enter a name for this new instruction set:", file.name.replace(/\.[^/.]+$/, ""));
            if (!newName || !newName.trim()) return;
            newName = newName.trim();
            if (sets.some(s => s.name === newName)) return alert("An instruction set with that name already exists.");

            const reader = new FileReader();
            reader.onload = r => {
                const content = r.target.result;
                const newId = 'custom_' + Date.now();
                sets.push({ name: newName, id: newId });
                lsSet(instructionSetKeys.list, sets);
                localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + newId, content);
                if (sets.length === 1) lsSet(instructionSetKeys.activeId, newId);
                populateList();
            };
            reader.readAsText(file);
            fileInput.value = '';
        };
        fileInput.click();
    };

    document.getElementById('instr-cancel-btn').onclick = () => {
        overlay.style.display = 'none';
    };

    populateList();
    overlay.style.display = 'flex';
}

function openInstructionEditorModal(setId, setName) {
    const langOptions = "cpp,py,js,go,lua,cs,java,kt,rb,nim,ahk,swift,dart,ts,groovy".split(',');
    const langToAceModeMap = {'js':'javascript','py':'python','cpp':'c_cpp','go':'golang','lua':'lua','cs':'csharp','java':'java','kt':'kotlin','rb':'ruby','nim':'nim','ahk':'autohotkey','swift':'swift','dart':'dart','ts':'typescript','groovy':'groovy'};
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal-box instr-editor-modal">
        <h3>Editing: ${setName}</h3>
        <div class="instr-editor-content">
            <div class="instr-editor-sidebar">
                <input type="search" id="instr-editor-search" placeholder="Search functions..." style="margin-bottom: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <label class="toggle-switch-label" title="Show internal functions"><input type="checkbox" id="instr-show-internal-check"><span>Show Internal</span></label>
                    <button id="instr-add-func-btn" style="background-color: #2a8f2a; font-size: 0.9em; padding: 4px 8px;">+ New</button>
                </div>
                <ul id="instr-editor-func-list"></ul>
            </div>
            <div class="instr-editor-main">
                <div style="display: flex; gap: 10px;">
                    <div style="flex:2"><label>Name: <input type="text" id="instr-editor-name"></label></div>
                    <div style="flex:1"><label>Language: 
                        <select id="instr-editor-lang">${langOptions.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
                    </label></div>
                </div>
                <div><label>Libraries (pipe-separated): <input type="text" id="instr-editor-libs"></label></div>
                 <div style="display: flex; gap: 10px; align-items: flex-end;">
                    <div style="flex:1;"><label>Category: <input type="text" id="instr-editor-category"></label></div>
                    <button id="instr-delete-func-btn" style="background-color: #c12a2a;">Delete Func</button>
                </div>
                <label>Description (use ~~~ for new lines):</label>
                <div style="display: flex; gap: 10px; flex-grow: 1; min-height: 120px;">
                    <textarea id="instr-editor-desc" style="flex: 1; resize: vertical;"></textarea>
                    <div id="instr-editor-desc-preview" style="flex: 1; border: 1px solid #444; padding: 8px; background: #1a1a1a; overflow-y: auto; white-space: pre-wrap; font-family: monospace;"></div>
                </div>
                <div><label>Function Body:</label></div>
                <div id="instr-editor-body-ace"></div>
            </div>
        </div>
        <div class="modal-buttons" style="margin-top: 15px;">
            <button id="instr-editor-cancel-btn">Cancel</button>
            <button id="instr-editor-save-btn" style="margin-left:8px; background-color: #3d8b40;">Save & Close</button>
        </div>
    </div>`;
    
    const fullContent = localStorage.getItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + setId) || "";
    const funcMarker = 'func======================func==============';
    const endMarker = 'funcEND======================funcEND==============';
    let bodyEditor;

    let fileHeader = '';
    let functionsText = fullContent;
    const firstFuncIndex = fullContent.indexOf(funcMarker);
    if (firstFuncIndex > -1) {
        fileHeader = fullContent.substring(0, firstFuncIndex).trim();
        functionsText = fullContent.substring(firstFuncIndex);
    }
    
    const parseInstructions = (text) => {
        const functions = [];
        const blocks = text.split(new RegExp(`\n*${funcMarker}\n*`)).filter(b => b.trim());
        
        blocks.forEach((block, index) => {
            const endBlockIndex = block.indexOf(endMarker);
            if (endBlockIndex === -1) return;
            
            const contentPart = block.substring(0, endBlockIndex).trim();
            const lines = contentPart.split('\n');
            const funcData = { id: Date.now() + index, lang: '', name: '', libs: '', category: 'uncategorized', description: '', body: '', isInternal: false };
            
            let bodyStartIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith('lang:')) funcData.lang = line.substring(5).trim();
                else if (line.startsWith('name:')) funcData.name = line.substring(5).trim();
                else if (line.startsWith('libs:')) funcData.libs = line.substring(5).trim();
                else if (line.startsWith('description:')) {
                    let descContent = line.substring(12).trim();
                    if (descContent === 'null') {
                        funcData.isInternal = true;
                        funcData.category = 'internal';
                        funcData.description = '';
                    } else {
                        const descParts = descContent.split('~~~');
                        funcData.category = descParts.shift() || 'uncategorized';
                        funcData.description = descParts.join('~~~').replace(/~~~$/, '');
                    }
                } else if (line === '' && bodyStartIndex === -1 && funcData.name) {
                    bodyStartIndex = i + 1;
                    break; 
                }
            }
            
            if (bodyStartIndex !== -1) funcData.body = lines.slice(bodyStartIndex).join('\n');
            else funcData.body = lines.slice(4).join('\n');
            
            functions.push(funcData);
        });
        return functions;
    };

    let instructions = parseInstructions(functionsText);
    let activeFuncId = null;

    bodyEditor = ace.edit("instr-editor-body-ace");
    bodyEditor.setTheme("ace/theme/monokai");
    bodyEditor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true, behavioursEnabled: true, wrap: true });

    const listEl = document.getElementById('instr-editor-func-list');
    const searchInput = document.getElementById('instr-editor-search');
    const showInternalCheck = document.getElementById('instr-show-internal-check');
    const nameInput = document.getElementById('instr-editor-name');
    const langSelect = document.getElementById('instr-editor-lang');
    const libsInput = document.getElementById('instr-editor-libs');
    const categoryInput = document.getElementById('instr-editor-category');
    const descTextarea = document.getElementById('instr-editor-desc');
    const descPreview = document.getElementById('instr-editor-desc-preview');

    langSelect.addEventListener('change', () => {
        const newLang = langSelect.value;
        const aceMode = langToAceModeMap[newLang] || 'text';
        bodyEditor.session.setMode(`ace/mode/${aceMode}`);
    });

    descTextarea.addEventListener('input', () => {
        descPreview.textContent = descTextarea.value.replace(/~~~/g, '\n');
    });

    const saveCurrentFunc = () => {
        if (activeFuncId === null) return;
        const func = instructions.find(f => f.id === activeFuncId);
        if (!func) return;
        
        func.name = nameInput.value.trim();
        func.lang = langSelect.value;
        func.libs = libsInput.value.trim();
        func.category = categoryInput.value.trim().toLowerCase() || 'uncategorized';
        func.isInternal = (func.category === 'internal');
        func.description = descTextarea.value;
        func.body = bodyEditor.getValue();
    };
    
    const displayFunc = (funcId) => {
        if (activeFuncId !== null) saveCurrentFunc();
        activeFuncId = funcId;
        const func = instructions.find(f => f.id === funcId);
        if (!func) {
            nameInput.value = ''; langSelect.value = 'js'; libsInput.value = ''; categoryInput.value = ''; descTextarea.value = ''; bodyEditor.setValue('', -1);
            descPreview.textContent = '';
            return;
        }

        nameInput.value = func.name;
        langSelect.value = func.lang;
        libsInput.value = func.libs;
        categoryInput.value = func.category;
        descTextarea.value = func.description;
        descPreview.textContent = func.description.replace(/~~~/g, '\n');
        
        bodyEditor.setValue(func.body, -1);
        const aceMode = langToAceModeMap[func.lang] || 'text';
        bodyEditor.session.setMode(`ace/mode/${aceMode}`);
        
        document.querySelectorAll('#instr-editor-func-list li').forEach(li => {
            li.classList.toggle('active', parseInt(li.dataset.id) === funcId);
        });
    };

    const populateList = () => {
        saveCurrentFunc();
        const searchTerm = searchInput.value.toLowerCase();
        const showInternal = showInternalCheck.checked;
        
        const filtered = instructions.filter(f => 
            (showInternal || !f.isInternal) && 
            (f.name.toLowerCase().includes(searchTerm) || f.category.toLowerCase().includes(searchTerm) || f.lang.toLowerCase().includes(searchTerm))
        );

        const grouped = filtered.reduce((acc, func) => {
            const category = func.category || 'uncategorized';
            (acc[category] = acc[category] || []).push(func);
            return acc;
        }, {});

        listEl.innerHTML = '';
        Object.keys(grouped).sort().forEach(category => {
            const header = document.createElement('h4');
            header.textContent = category;
            header.onclick = () => header.scrollIntoView({ behavior: 'smooth' });
            listEl.appendChild(header);
            
            grouped[category].sort((a,b) => a.name.localeCompare(b.name)).forEach(func => {
                const li = document.createElement('li');
                li.textContent = `${func.name} (${func.lang})`;
                li.dataset.id = func.id;
                li.onclick = () => displayFunc(func.id);
                if (func.id === activeFuncId) li.classList.add('active');
                listEl.appendChild(li);
            });
        });
    };
    
    searchInput.oninput = populateList;
    showInternalCheck.onchange = populateList;
    
    document.getElementById('instr-add-func-btn').onclick = () => {
        saveCurrentFunc();
        const newFunc = { id: Date.now(), name: 'NewFunction', lang: 'js', libs: 'null', category: 'new', description: '', body: '// Your code here', isInternal: false };
        instructions.push(newFunc);
        populateList();
        displayFunc(newFunc.id);
        nameInput.focus();
        nameInput.select();
    };

    document.getElementById('instr-delete-func-btn').onclick = () => {
        if (activeFuncId === null || !confirm(`Are you sure you want to delete the function "${nameInput.value} (${langSelect.value})"?`)) return;
        instructions = instructions.filter(f => f.id !== activeFuncId);
        const oldActiveId = activeFuncId;
        activeFuncId = null;
        displayFunc(null); 
        populateList();
        const nextLi = document.querySelector(`#instr-editor-func-list li:not([data-id='${oldActiveId}'])`);
        if(nextLi) nextLi.click();
    };

    document.getElementById('instr-editor-save-btn').onclick = () => {
        saveCurrentFunc();
        
        const reconstruct = () => {
            return instructions.map(func => {
                let descString = func.isInternal ? 'null' : `${func.category}~~~${func.description}`;
                const parts = [
                    `lang: ${func.lang}`, `name: ${func.name}`, `libs: ${func.libs || 'null'}`,
                    `description: ${descString}`, '', func.body
                ];
                return `${funcMarker}\n${parts.join('\n')}\n${endMarker}`;
            }).join('\n\n');
        };

        const newFunctionsText = reconstruct();
        const newContent = (fileHeader ? fileHeader + '\n\n' : '') + newFunctionsText;

        localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + setId, newContent);
        overlay.style.display = 'none';
        if(confirm("Instruction set saved. Reload the IDE now for changes to take effect? Your work is saved.")) {
            window.dispatchEvent(new Event('beforeunload'));
            window.location.reload();
        }
    };

    document.getElementById('instr-editor-cancel-btn').onclick = () => {
        if(confirm("Are you sure? All unsaved changes in this editor will be lost.")) {
            overlay.style.display = 'none';
            openInstructionManagerModal();
        }
    };

    populateList();
    if (instructions.length > 0) displayFunc(instructions[0].id);
    overlay.style.display = 'flex';
    bodyEditor.resize();
}

function openSettingsModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `<div class="modal-box" style="max-width: 850px;">
        <h3>Settings + Help</h3>
        <div id="settings-columns-container" style="display: flex; gap: 20px; border-top: 1px solid #333; padding-top: 15px; overflow-x: auto; padding-bottom: 15px;">
            <div class="settings-column" style="flex: 1; display: flex; flex-direction: column; gap: 10px; min-width: 240px;">
                <h4>Editor</h4>
                <div><label for="font-size-input">Font Size: </label><input type="number" id="font-size-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
                <div><label><input type="checkbox" id="vim-mode-checkbox"> Vim Mode</label></div>
                <div><label><input type="checkbox" id="auto-pair-checkbox"> Auto-pair Brackets/Quotes</label></div>
                <div><label><input type="checkbox" id="print-margin-checkbox"> Show Vertical Guide Line</label></div>
                <div style="padding-left: 20px;"><label for="print-margin-column-input">Guide Line Column: </label><input type="number" id="print-margin-column-input" style="width:60px;background:#252525;color:#e0e0e0;border:1px solid #333;"></div>
            </div>
            <div class="settings-column" style="flex: 1.2; padding-left: 20px; border-left: 1px solid #333; display: flex; flex-direction: column; gap: 15px; min-width: 280px;">
                <div>
                    <h4>Syntax Highlighting</h4>
                    <div><label><input type="checkbox" id="symbol-operator-highlighting-checkbox"> Highlight Symbol Operators (e.g., :=, ++, *)</label></div>
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
    
    document.getElementById('font-size-input').value = editor.getFontSize();
    document.getElementById('vim-mode-checkbox').checked = editor.getKeyboardHandler().$id === 'ace/keyboard/vim';
    document.getElementById('auto-pair-checkbox').checked = editor.getBehavioursEnabled();
    document.getElementById('print-margin-checkbox').checked = editor.getShowPrintMargin();
    document.getElementById('print-margin-column-input').value = editor.getOption('printMargin');
    document.getElementById('symbol-operator-highlighting-checkbox').checked = lsGet('highlightSymbolOperators') !== false;
    document.getElementById('clear-terminal-on-run-checkbox').checked = lsGet('clearTerminalOnRun') === true;
    document.getElementById('autocomplete-master-checkbox').checked = lsGet('autocomplete-master') !== false;
    document.getElementById('autocomplete-keywords-checkbox').checked = lsGet('autocomplete-keywords') !== false;
    document.getElementById('autocomplete-local-checkbox').checked = lsGet('autocomplete-local') !== false;

    document.getElementById('modal-ok-btn').onclick = () => {
        editor.setFontSize(parseInt(document.getElementById('font-size-input').value, 10)); lsSet('fontSize', editor.getFontSize());
        const vimMode = document.getElementById('vim-mode-checkbox').checked; if ((editor.getKeyboardHandler().$id === 'ace/keyboard/vim') !== vimMode) { editor.setKeyboardHandler(vimMode ? "ace/keyboard/vim" : null); lsSet('vimMode', vimMode); }
        editor.setBehavioursEnabled(document.getElementById('auto-pair-checkbox').checked); lsSet('autoPair', editor.getBehavioursEnabled());
        editor.setShowPrintMargin(document.getElementById('print-margin-checkbox').checked); lsSet('showPrintMargin', editor.getShowPrintMargin());
        editor.setOption('printMargin', parseInt(document.getElementById('print-margin-column-input').value, 10) || 80); lsSet('printMarginColumn', editor.getOption('printMargin'));
        const highlightOperators = document.getElementById('symbol-operator-highlighting-checkbox').checked;
        if ((lsGet('highlightSymbolOperators') !== false) !== highlightOperators) { lsSet('highlightSymbolOperators', highlightOperators); loadDefinitions(); }
        lsSet('clearTerminalOnRun', document.getElementById('clear-terminal-on-run-checkbox').checked);
        lsSet('autocomplete-master', document.getElementById('autocomplete-master-checkbox').checked);
        lsSet('autocomplete-keywords', document.getElementById('autocomplete-keywords-checkbox').checked);
        lsSet('autocomplete-local', document.getElementById('autocomplete-local-checkbox').checked);
        overlay.style.display = 'none';
    };
    overlay.style.display = 'flex';
}
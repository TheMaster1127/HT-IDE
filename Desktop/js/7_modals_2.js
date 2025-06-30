function promptForInitialInstructionSet() {
    const overlay = document.getElementById('modal-overlay');

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.textAlign = 'center';
    modalInstance.innerHTML = `
        <h3 style="margin-top: 0;">Welcome to HT-IDE!</h3>
        <p>To enable <b>HTVM</b> features like transpiling and syntax highlighting, an instruction set file is required.</p>
        <p style="color: #ccc; font-size: 0.9em;">You can manage or change instruction sets later via the button in the sidebar.</p>
        <div class="modal-buttons" style="margin-top: 20px; justify-content: center; display: flex; gap: 15px;">
            <button id="initial-instr-cancel-btn" style="background-color: #555;">Continue without HTVM</button>
            <button id="initial-instr-upload-btn" style="background-color: #3d8b40; font-weight: bold;">Upload Instruction Set</button>
        </div>
    `;

    const closeModal = () => {
        if (overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if (overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    modalInstance.querySelector('#initial-instr-cancel-btn').onclick = () => {
        const msg = "Are you sure? HTVM features will be disabled until an instruction set is provided and the IDE is reloaded. You can still use the IDE for standard file editing using other programming languages, e.g., JavaScript, Python, C++, etc.";
        openConfirmModal("Continue without HTVM?", msg, (confirmed) => {
            if (confirmed) {
                closeModal();
            }
        });
    };

    modalInstance.querySelector('#initial-instr-upload-btn').onclick = () => {
        const fileInput = document.getElementById('instruction-file-input');
        
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;

            openInputModal('Name Instruction Set', 'Enter a name for this new instruction set:', file.name.replace(/\.[^/.]+$/, ""), (newName) => {
                if (!newName || !newName.trim()) return;

                const reader = new FileReader();
                reader.onload = r => {
                    const content = r.target.result;
                    const newId = 'initial_setup_' + Date.now();
                    const newSet = { name: newName, id: newId };

                    lsSet(instructionSetKeys.list, [newSet]);
                    localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + newId, content);
                    lsSet(instructionSetKeys.activeId, newId);
                    
                    closeModal(); // Close the initial prompt
                    alert(`Instruction set "${newName}" has been added and activated. The IDE will now reload to apply the changes.`);
                    window.dispatchEvent(new Event('beforeunload'));
                    window.electronAPI.reloadApp();
                };
                reader.readAsText(file);
                fileInput.value = ''; 
            });
        };
        
        fileInput.click();
    };
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}


function openInstructionManagerModal() {
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '600px';
    modalInstance.innerHTML = `
        <h3>HTVM Instruction Sets</h3>
        <ul class="modal-list" id="instruction-sets-list"></ul>
        <div class="modal-buttons">
             <button id="instr-add-new-btn" style="float:left; background-color:#2a8f2a;">Add New from File</button>
             <button id="instr-cancel-btn">Close</button>
        </div>
    `;

    const listEl = modalInstance.querySelector('#instruction-sets-list');
    
    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if(overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

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
                    openConfirmModal("Apply Instruction Set", "This will reload the IDE. Continue?", (confirmed) => {
                        if (confirmed) {
                            lsSet(instructionSetKeys.activeId, set.id);
                            window.dispatchEvent(new Event('beforeunload'));
                            window.electronAPI.reloadApp();
                        }
                    });
                };
                btnGroup.appendChild(applyBtn);
            }

            const renameBtn = document.createElement('button');
            renameBtn.textContent = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.style.marginLeft = '8px';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                openInputModal('Rename Set', `New name for "${set.name}":`, set.name, (newName) => {
                    if (newName && newName.trim() && newName !== set.name) {
                        if (sets.some(s => s.name === newName.trim() && s.id !== set.id)) {
                            return alert("A set with that name already exists.");
                        }
                        set.name = newName.trim();
                        lsSet(instructionSetKeys.list, sets);
                        populateList();
                    }
                });
            };
            btnGroup.appendChild(renameBtn);

            const editBtn = document.createElement('button');
            editBtn.textContent = '📜';
            editBtn.title = 'Edit Content';
            editBtn.style.marginLeft = '8px';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                closeModal();
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
                openConfirmModal("Delete Instruction Set", `Delete "${set.name}"?`, (confirmed) => {
                    if (confirmed) {
                        lsSet(instructionSetKeys.list, sets.filter(s => s.id !== set.id));
                        localStorage.removeItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + set.id);
                        populateList();
                    }
                });
            };
            btnGroup.appendChild(deleteBtn);

            li.appendChild(nameSpan);
            li.appendChild(btnGroup);
            listEl.appendChild(li);
        });
    };

    modalInstance.querySelector('#instr-add-new-btn').onclick = () => {
        const fileInput = document.getElementById('instruction-file-input');
        fileInput.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            let sets = lsGet(instructionSetKeys.list) || [];
            
            openInputModal('Name Instruction Set', "Enter a name for this set:", file.name.replace(/\.[^/.]+$/, ""), (newName) => {
                if (!newName || !newName.trim()) return;
                if (sets.some(s => s.name === newName.trim())) return alert("A set with that name already exists.");

                const reader = new FileReader();
                reader.onload = r => {
                    const newId = 'custom_' + Date.now();
                    sets.push({ name: newName.trim(), id: newId });
                    lsSet(instructionSetKeys.list, sets);
                    localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + newId, r.target.result);

                    if (sets.length === 1) {
                        lsSet(instructionSetKeys.activeId, newId);
                        openConfirmModal("Reload Required", "First set added and activated. Reload now?", (confirmed) => {
                            if(confirmed) {
                                window.dispatchEvent(new Event('beforeunload'));
                                window.electronAPI.reloadApp();
                            } else {
                                populateList();
                            }
                        });
                    } else {
                        populateList();
                    }
                };
                reader.readAsText(file);
                fileInput.value = '';
            });
        };
        fileInput.click();
    };

    modalInstance.querySelector('#instr-cancel-btn').onclick = closeModal;
    
    overlay.appendChild(modalInstance);
    populateList();
    overlay.classList.add('visible');
}

function openInstructionEditorModal(setId, setName) {
    const langOptions = "cpp,py,js,go,lua,cs,java,kt,rb,nim,ahk,swift,dart,ts,groovy".split(',');
    const langToAceModeMap = {'js':'javascript','py':'python','cpp':'c_cpp','go':'golang','lua':'lua','cs':'csharp','java':'java','kt':'kotlin','rb':'ruby','nim':'nim','ahk':'autohotkey','swift':'swift','dart':'dart','ts':'typescript','groovy':'groovy'};
    const overlay = document.getElementById('modal-overlay');
    
    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box instr-editor-modal';
    
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

    const closeModal = (save = false) => {
        if (save) {
            saveCurrentFunc();
            const reconstruct = () => instructions.map(func => {
                let descString = func.isInternal ? 'null' : `${func.category}~~~${func.description}`;
                const parts = [`lang: ${func.lang}`, `name: ${func.name}`, `libs: ${func.libs || 'null'}`, `description: ${descString}`, '', func.body];
                return `${funcMarker}\n${parts.join('\n')}\n${endMarker}`;
            }).join('\n\n');
            const newFunctionsText = reconstruct();
            const newContent = (fileHeader ? fileHeader + '\n\n' : '') + newFunctionsText;
            localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + setId, newContent);
        }
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        
        if (save) {
            openConfirmModal("Reload Required", "Set saved. Reload now?", (confirmed) => {
                if (confirmed) {
                    window.dispatchEvent(new Event('beforeunload'));
                    window.electronAPI.reloadApp();
                } else {
                    openInstructionManagerModal();
                }
            });
        } else {
            openInstructionManagerModal();
        }
    };
    
    const saveCurrentFunc = () => {
        if (activeFuncId === null || !modalInstance.parentNode) return;
        const func = instructions.find(f => f.id === activeFuncId);
        if (!func) return;
        func.name = modalInstance.querySelector('#instr-editor-name').value.trim();
        func.lang = modalInstance.querySelector('#instr-editor-lang').value;
        func.libs = modalInstance.querySelector('#instr-editor-libs').value.trim();
        func.category = modalInstance.querySelector('#instr-editor-category').value.trim().toLowerCase() || 'uncategorized';
        func.isInternal = (func.category === 'internal');
        func.description = modalInstance.querySelector('#instr-editor-desc').value;
        func.body = bodyEditor.getValue();
    };
    
    const displayFunc = (funcId) => {
        if (activeFuncId !== null) saveCurrentFunc();
        activeFuncId = funcId;
        const func = instructions.find(f => f.id === funcId);
        if (!func) {
            modalInstance.querySelector('#instr-editor-name').value = ''; 
            modalInstance.querySelector('#instr-editor-lang').value = 'js';
            // ... clear other fields
            bodyEditor.setValue('', -1);
            return;
        }
        modalInstance.querySelector('#instr-editor-name').value = func.name;
        modalInstance.querySelector('#instr-editor-lang').value = func.lang;
        modalInstance.querySelector('#instr-editor-libs').value = func.libs;
        modalInstance.querySelector('#instr-editor-category').value = func.category;
        modalInstance.querySelector('#instr-editor-desc').value = func.description;
        modalInstance.querySelector('#instr-editor-desc-preview').textContent = func.description.replace(/~~~/g, '\n');
        bodyEditor.setValue(func.body, -1);
        const aceMode = langToAceModeMap[func.lang] || 'text';
        bodyEditor.session.setMode(`ace/mode/${aceMode}`);
        modalInstance.querySelectorAll('#instr-editor-func-list li').forEach(li => {
            li.classList.toggle('active', parseInt(li.dataset.id) === funcId);
        });
    };

    const populateList = () => {
        saveCurrentFunc();
        const searchTerm = modalInstance.querySelector('#instr-editor-search').value.toLowerCase();
        const showInternal = modalInstance.querySelector('#instr-show-internal-check').checked;
        const filtered = instructions.filter(f => (showInternal || !f.isInternal) && (f.name.toLowerCase().includes(searchTerm) || f.category.toLowerCase().includes(searchTerm)));
        const grouped = filtered.reduce((acc, func) => {
            (acc[func.category] = acc[func.category] || []).push(func);
            return acc;
        }, {});
        const listEl = modalInstance.querySelector('#instr-editor-func-list');
        listEl.innerHTML = '';
        Object.keys(grouped).sort().forEach(category => {
            const header = document.createElement('h4');
            header.textContent = category;
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

    modalInstance.innerHTML = `<h3>Editing: ${setName}</h3><div class="instr-editor-content"><div class="instr-editor-sidebar"><input type="search" id="instr-editor-search" placeholder="Search functions..." style="margin-bottom: 5px;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;"><label class="toggle-switch-label" title="Show internal functions"><input type="checkbox" id="instr-show-internal-check"><span>Show Internal</span></label><button id="instr-add-func-btn" style="background-color: #2a8f2a; font-size: 0.9em; padding: 4px 8px;">+ New</button></div><ul id="instr-editor-func-list"></ul></div><div class="instr-editor-main"><div style="display: flex; gap: 10px;"><div style="flex:2"><label>Name: <input type="text" id="instr-editor-name"></label></div><div style="flex:1"><label>Language: <select id="instr-editor-lang">${langOptions.map(l => `<option value="${l}">${l}</option>`).join('')}</select></label></div></div><div><label>Libraries (pipe-separated): <input type="text" id="instr-editor-libs"></label></div><div style="display: flex; gap: 10px; align-items: flex-end;"><div style="flex:1;"><label>Category: <input type="text" id="instr-editor-category"></label></div><button id="instr-delete-func-btn" style="background-color: #c12a2a;">Delete Func</button></div><label>Description (use ~~~ for new lines):</label><div style="display: flex; gap: 10px; flex-grow: 1; min-height: 120px;"><textarea id="instr-editor-desc" style="flex: 1; resize: vertical;"></textarea><div id="instr-editor-desc-preview" style="flex: 1; border: 1px solid #444; padding: 8px; background: #1a1a1a; overflow-y: auto; white-space: pre-wrap; font-family: monospace;"></div></div><div><label>Function Body:</label></div><div id="instr-editor-body-ace"></div></div></div><div class="modal-buttons" style="margin-top: 15px;"><button id="instr-editor-cancel-btn">Cancel</button><button id="instr-editor-save-btn" style="margin-left:8px; background-color: #3d8b40;">Save & Close</button></div>`;
    
    bodyEditor = ace.edit(modalInstance.querySelector("#instr-editor-body-ace"));
    bodyEditor.setTheme("ace/theme/monokai");
    bodyEditor.setOptions({ enableBasicAutocompletion: true, enableLiveAutocompletion: true, behavioursEnabled: true, wrap: true });

    modalInstance.querySelector('#instr-editor-lang').addEventListener('change', () => bodyEditor.session.setMode(`ace/mode/${langToAceModeMap[modalInstance.querySelector('#instr-editor-lang').value] || 'text'}`));
    modalInstance.querySelector('#instr-editor-desc').addEventListener('input', () => modalInstance.querySelector('#instr-editor-desc-preview').textContent = modalInstance.querySelector('#instr-editor-desc').value.replace(/~~~/g, '\n'));
    modalInstance.querySelector('#instr-editor-search').oninput = populateList;
    modalInstance.querySelector('#instr-show-internal-check').onchange = populateList;
    modalInstance.querySelector('#instr-add-func-btn').onclick = () => {
        saveCurrentFunc();
        const newFunc = { id: Date.now(), name: 'NewFunction', lang: 'js', libs: 'null', category: 'new', description: '', body: '// Your code here', isInternal: false };
        instructions.push(newFunc);
        populateList();
        displayFunc(newFunc.id);
        modalInstance.querySelector('#instr-editor-name').focus();
        modalInstance.querySelector('#instr-editor-name').select();
    };
    modalInstance.querySelector('#instr-delete-func-btn').onclick = () => {
        if (activeFuncId === null) return;
        openConfirmModal("Delete Function", `Delete "${modalInstance.querySelector('#instr-editor-name').value}"?`, (confirmed) => {
            if (confirmed) {
                instructions = instructions.filter(f => f.id !== activeFuncId);
                activeFuncId = null;
                displayFunc(null); 
                populateList();
            }
        });
    };
    modalInstance.querySelector('#instr-editor-save-btn').onclick = () => closeModal(true);
    modalInstance.querySelector('#instr-editor-cancel-btn').onclick = () => openConfirmModal("Cancel?", "All unsaved changes will be lost.", c => c && closeModal(false));
    
    overlay.appendChild(modalInstance);
    populateList();
    if (instructions.length > 0) displayFunc(instructions[0].id);
    overlay.classList.add('visible');
}

function openHtvmToHtvmModal() {
    const overlay = document.getElementById('modal-overlay');

    const modalInstance = document.createElement('div');
    modalInstance.className = 'modal-box';
    modalInstance.style.maxWidth = '600px';
    modalInstance.innerHTML = `
        <h3>HTVM to HTVM Converter</h3>
        <p style="margin-top:0; color:#ccc;">The currently active instruction set is the <b>TARGET</b>. Select the <b>SOURCE</b> set to convert from.</p>
        <ul class="modal-list" id="htvm-converter-list"></ul>
        <div class="modal-buttons">
             <button class="modal-btn-cancel">Close</button>
        </div>
    `;
    
    const closeModal = () => {
        if(overlay.contains(modalInstance)) overlay.removeChild(modalInstance);
        if(overlay.childElementCount === 0) overlay.classList.remove('visible');
    };

    const listEl = modalInstance.querySelector('#htvm-converter-list');
    const sets = lsGet(instructionSetKeys.list) || [];
    const activeId = lsGet(instructionSetKeys.activeId);
    
    if (!sets.find(s => s.id === activeId)) {
        listEl.innerHTML = `<li class='no-sessions'>No active (TARGET) instruction set found.</li>`;
    } else {
        const handleSourceSelection = (sourceId) => {
            const sourceContent = localStorage.getItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + sourceId);
            const targetContent = localStorage.getItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + activeId);
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.multiple = true;
            fileInput.accept = '.htvm';
            fileInput.onchange = async (e) => {
                if (!e.target.files?.length) return;
                closeModal();
                const activeTerm = getActiveTerminalSession();
                activeTerm?.writeln(`\x1b[36mStarting HTVM conversion for ${e.target.files.length} file(s)...\x1b[0m`);
                let allKnownPaths = (await getAllPaths()).map(item => item.path);

                for (const file of Array.from(e.target.files)) {
                    try {
                        const code = await file.text();
                        resetGlobalVarsOfHTVMjs();
                        argHTVMinstrMORE.push(targetContent.replace(/\r/g, ''));
                        const convertedCode = compiler(code, sourceContent, "full", "htvm");
                        
                        let newName = file.name.replace(/(\.htvm)$/i, '.converted.htvm');
                        let finalName = newName, counter = 1;
                        const prefix = currentDirectory === '/' ? '' : currentDirectory;
                        while(allKnownPaths.includes(prefix + finalName)) {
                            finalName = newName.replace(/(\.htvm)$/, `(${counter++})$1`);
                        }
                        
                        await saveFileContent(prefix + finalName, convertedCode, false);
                        allKnownPaths.push(prefix + finalName);
                        activeTerm?.writeln(`\x1b[32mConverted ${file.name} -> ${finalName}\x1b[0m`);
                    } catch (error) {
                        activeTerm?.writeln(`\x1b[31mError processing ${file.name}: ${error.message}\x1b[0m`);
                    }
                }
                await renderFileList();
                activeTerm?.writeln(`\x1b[32m\nConversion process finished.\x1b[0m`);
            };
            fileInput.click();
        };

        listEl.innerHTML = '';
        sets.forEach(set => {
            const li = document.createElement('li');
            if (set.id === activeId) {
                li.textContent = `${set.name} (TARGET)`;
                li.style.cssText = 'background-color:#004a6e; font-weight:bold;';
            } else {
                li.textContent = set.name;
                li.onclick = () => handleSourceSelection(set.id);
            }
            listEl.appendChild(li);
        });
    }

    modalInstance.querySelector('.modal-btn-cancel').onclick = closeModal;
    
    overlay.appendChild(modalInstance);
    overlay.classList.add('visible');
}
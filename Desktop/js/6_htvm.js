// js/6_htvm.js

// --- PLUGIN API START: The new plugin loader function ---
async function loadActivePlugins() {
    const hookNames = Array.from({ length: 30 }, (_, i) => `htvm_hook${i + 1}`);
    const placeholderFunction = () => { /* This is a unique placeholder function. */ };

    // This object will hold the ordered lists of functions for each hook.
    const pluginExecutionOrder = {};
    for (const hookName of hookNames) {
        pluginExecutionOrder[hookName] = [];
    }

    const activePluginIds = lsGet('active_plugin_ids') || [];
    if (activePluginIds.length === 0) {
        console.log("No active plugins.");
        // If there are no plugins, make sure the global hooks exist as pass-through functions.
        for (const hookName of hookNames) {
            window[hookName] = (input) => input;
        }
        return;
    }

    console.log(`Loading ${activePluginIds.length} active plugin(s) in order:`, activePluginIds);

    // 1. Loop through each plugin, execute its code in isolation, and capture its defined hooks.
    for (const pluginId of activePluginIds) {
        let pluginCode = '';
        if (pluginId === 'local-dev-plugin') {
            pluginCode = sessionStorage.getItem('temp_local_plugin_code');
        } else {
            pluginCode = await window.electronAPI.pluginsGetCode(pluginId);
        }

        if (!pluginCode) {
            console.warn(`Could not fetch code for plugin ${pluginId}. Skipping.`);
            continue;
        }

        try {
            // A. Reset all global hooks to our placeholder before running the plugin code.
            // This creates a clean slate for us to detect what this specific plugin defines.
            for (const hookName of hookNames) {
                window[hookName] = placeholderFunction;
            }

            // B. Execute the plugin's code. This will overwrite some of the global placeholders.
            new Function(pluginCode)();

            // C. Capture the functions that were just defined by this plugin.
            for (const hookName of hookNames) {
                if (window[hookName] !== placeholderFunction) {
                    // This hook was defined by the plugin, so add it to our execution list.
                    pluginExecutionOrder[hookName].push(window[hookName]);
                }
            }
        } catch (e) {
            console.error(`Error executing code for plugin ${pluginId}:`, e);
        }
    }

    // 2. Now that all plugins have been processed, create the final "orchestrator" for each hook.
    for (const hookName of hookNames) {
        // This single function will be the global hook that HTVM.js calls.
        window[hookName] = (initialInput) => {
            let processedData = initialInput;
            // It loops through the list of functions we collected and executes them in order.
            for (const pluginFunc of pluginExecutionOrder[hookName]) {
                processedData = pluginFunc(processedData);
            }
            return processedData;
        };
    }

    console.log("All active plugins loaded and registered for execution.", pluginExecutionOrder);
}
// --- PLUGIN API END ---

// --- HTVM and Code Execution ---

function initializeInstructionSetManagement() {
    const legacyDataRaw = localStorage.getItem(instructionSetKeys.legacyKey);
    if (legacyDataRaw && !lsGet(instructionSetKeys.list)) {
        const newId = 'default_migrated_' + Date.now();
        const newList = [{ name: 'Default', id: newId }];
        let legacyContentAsString = '';
        try {
            const legacyDataParsed = JSON.parse(legacyDataRaw);
            legacyContentAsString = Array.isArray(legacyDataParsed) ? legacyDataParsed.join('\n') : '';
        } catch {
            legacyContentAsString = legacyDataRaw;
        }
        lsSet(instructionSetKeys.list, newList);
        localStorage.setItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + newId, legacyContentAsString);
        lsSet(instructionSetKeys.activeId, newId);
        localStorage.removeItem(instructionSetKeys.legacyKey);
        console.log("Migrated legacy instruction set to new management system.");
    }

    const activeId = lsGet(instructionSetKeys.activeId);
    let activeContent = "";
    if (activeId) {
        activeContent = localStorage.getItem(STORAGE_PREFIX + instructionSetKeys.contentPrefix + activeId) || "";
    }
    
    const sanitizedContent = activeContent.replace(/\r\n?/g, '\n');

    localStorage.setItem(instructionSetKeys.legacyKey, JSON.stringify(sanitizedContent.split('\n')));
}

async function loadDefinitions(instructionContent = null) {
    await window.initializeHtvmMode(IDE_ID, instructionContent);
    await window.initializeCompleters(IDE_ID, editor);
    if (editor && currentOpenFile && currentOpenFile.endsWith('.htvm')) {
        editor.session.setMode("ace/mode/text");
        editor.session.setMode("ace/mode/htvm");
    }
}

// --- THIS IS THE OLD DEBUGGER LOGIC, WE WILL REPLACE IT WITH YOUR HTVM-BASED ONE ---
let activeLineMarker = null;
function highlightLine(row) {
    clearHighlight();
    activeLineMarker = editor.session.addMarker(
        new ace.Range(row, 0, row, 1), "ace_debugger_active_line", "fullLine", true
    );
}
function clearHighlight() {
    if (activeLineMarker) {
        editor.session.removeMarker(activeLineMarker);
        activeLineMarker = null;
    }
}
async function __debug_pause__(line, scopeFn) { /* This function is now deprecated and will be replaced by HTVM's logic */ }
function stopDebugger() { /* This function is now deprecated */ }
// --- END DEPRECATED DEBUGGER ---


function formatHtvmCode(code) {
    const activeSession = getActiveTerminalSession();
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    
    if (activeSession) activeSession.xterm.writeln(`\x1b[32mFormatting HTVM file...\x1b[0m`);
    // MODIFIED: REMOVED resetGlobalVarsOfHTVMjs() CALL
    argHTVMinstrMORE.push(instructionSet.join('\n'));

    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const formattedCode = compiler(code, instructionSet.join('\n'), "full", "htvm");
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; 

    // MODIFIED: REMOVED resetGlobalVarsOfHTVMjs() CALL
    
    if (activeSession) activeSession.xterm.writeln(`\x1b[32mFormatting complete.\x1b[0m`);
    return formattedCode;
}

async function runHtvmCode(code) {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) return;

    let codeToTranspile = code;
    const breakpoints = fileBreakpoints.get(currentOpenFile);

    if (breakpoints && breakpoints.size > 0) {
        activeSession.xterm.writeln(`\x1b[36mDebugger attached. Injecting breakpoints into HTVM code.\x1b[0m`);
        const lines = codeToTranspile.split('\n');
        const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => b - a);
        sortedBreakpoints.forEach(row => {
            if(lines[row] !== undefined) {
               lines.splice(row + 1, 0, `debuger--aJHCBAKCAhtvmnHTVM--ACJAKHBaSSshad88sjhb-DEBUGER--HTVM--sjcvas`);
            }
        });
        codeToTranspile = lines.join('\n');
    }

    // MODIFIED: REMOVED resetGlobalVarsOfHTVMjs() CALL
    const lang = lsGet('selectedLangExtension') || 'js';
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    const isFullHtml = lang === 'js' && document.getElementById('full-html-checkbox').checked;

    if (isFullHtml && Array.isArray(instructionSet) && instructionSet.length > 158) {
        instructionSet[158] = "on";
    }
    
    activeSession.xterm.writeln(`\x1b[32mTranspiling HTVM to ${isFullHtml ? 'HTML' : lang.toUpperCase()}...\x1b[0m`);
    
    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const compiled = compiler(codeToTranspile, instructionSet.join('\n'), "full", lang);
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; 
    // MODIFIED: REMOVED resetGlobalVarsOfHTVMjs() CALL
    
    const newFileExt = isFullHtml ? 'html' : lang;
    const sourcePath = currentOpenFile;
    const dirName = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || sourcePath.substring(0, sourcePath.lastIndexOf('\\'));
    const baseName = sourcePath.split(/[\\\/]/).pop().replace(/\.htvm$/, '');
    const newFile = `${dirName}/${baseName}.${newFileExt}`;

    const wasAlreadyOpen = openTabs.includes(newFile);
    if (fileSessions.has(newFile)) {
        fileSessions.delete(newFile);
    }

    await saveFileContent(newFile, compiled, false);
    await renderFileList();

    if (!wasAlreadyOpen) {
        await openFileInEditor(newFile);
    }
    
    const shouldRunAfter = document.getElementById('run-js-after-htvm').checked;
    if (shouldRunAfter) {
        if (isFullHtml) {
            runHtmlCode(compiled);
        } else if (lang === 'js') {
            await window.electronAPI.runCommand(activeSession.id, `node "${newFile}"`, dirName);
        } else {
            printExecutionEndMessage();
            writePrompt(activeSession);
        }
    } else {
        printExecutionEndMessage();
        writePrompt(activeSession);
    }
}


async function handleRun(e) {
    e?.preventDefault();
    if (!currentOpenFile) return;

    const activeSession = getActiveTerminalSession();
    if (!activeSession) {
        alert("No active terminal found to run the command.");
        return;
    }

    if (activeSession.isExecuting) {
        activeSession.xterm.writeln(`\x1b[31mError: Cannot start a new execution while another process is active.\x1b[0m`);
        return;
    }
    
    if (lsGet('clearTerminalOnRun') === true) {
        activeSession.xterm.clear();
    }

    await saveFileContent(currentOpenFile, editor.getValue());
    activeSession.xterm.writeln(`\x1b[36m> Running ${currentOpenFile}...\x1b[0m`);
    const ext = currentOpenFile.split('.').pop();
    
    if (ext === 'htvm') {
        await runHtvmCode(editor.getValue());
    } else if (ext === 'html') {
        runHtmlCode(editor.getValue());
    } else {
        const dirName = currentOpenFile.substring(0, currentOpenFile.lastIndexOf('/')) || currentOpenFile.substring(0, currentOpenFile.lastIndexOf('\\'));
        activeSession.isExecuting = true;
        if (ext === 'js') {
             await window.electronAPI.runCommand(activeSession.id, `node "${currentOpenFile}"`, dirName);
        } else {
            await runPropertyCommand('run');
        }
    }
}
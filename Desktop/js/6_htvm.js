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

// --- SELF-CONTAINED DEBUGGER ---

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

async function __debug_pause__(line, scopeFn) {
    debuggerState.isPaused = true;
    debuggerState.scope = scopeFn();
    highlightLine(line);
    openDebuggerModal();

    return new Promise((resolve, reject) => {
        debuggerState.resolve = resolve;
        debuggerState.reject = reject;
    });
}

function stopDebugger() {
    if (debuggerState.reject) {
        debuggerState.reject(new Error("Execution stopped by user."));
    }
    debuggerState.isActive = false;
    debuggerState.isPaused = false;
    clearHighlight();
    printExecutionEndMessage();
}

function getDeclaredVariables(code) {
    const varRegex = /(?:let|const|var)\s+([a-zA-Z0-9_,\s]+)/g;
    const funcRegex = /function\s+([a-zA-Z0-9_]+)/g;
    const declared = new Set();
    let match;
    while ((match = varRegex.exec(code)) !== null) {
        match[1].split(',').forEach(v => declared.add(v.trim()));
    }
    while ((match = funcRegex.exec(code)) !== null) {
        declared.add(match[1].trim());
    }
    return Array.from(declared);
}


async function runJsCode(code) {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) return;

    activeSession.xterm.writeln(`\x1b[1;33m--- JS Execution ---\x1b[0m`);
    const originalLog = window.console.log;
    
    debuggerState.isActive = true;
    debuggerState.isPaused = false;

    try {
        let codeToRun = code;
        const breakpoints = fileBreakpoints.get(currentOpenFile);
        const declaredVars = getDeclaredVariables(code);

        if (breakpoints && breakpoints.size > 0) {
            activeSession.xterm.writeln(`\x1b[36mDebugger attached. Running with breakpoints.\x1b[0m`);
            const lines = code.split('\n');
            const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => b - a);
            
            const scopeCapture = `(() => { const scope = {}; ${declaredVars.map(v => `try { if(typeof ${v} !== 'undefined') scope['${v}'] = ${v}; } catch(e){}`).join(' ')} return scope; })`;
            
            sortedBreakpoints.forEach(row => {
                lines.splice(row, 0, `await __debug_pause__(${row}, ${scopeCapture});`);
            });
            codeToRun = lines.join('\n');
        }
        
        window.console.log = (...args) => activeSession.xterm.writeln(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const userFunc = new AsyncFunction('__debug_pause__', codeToRun);

        activeSession.isExecuting = true;
        await userFunc(__debug_pause__);

    } catch (e) {
        if (e.message !== "Execution stopped by user.") {
             activeSession.xterm.writeln(`\x1b[31mError: ${e.message}\x1b[0m`);
        } else {
             activeSession.xterm.writeln(`\x1b[33mExecution stopped by user.\x1b[0m`);
        }
    } finally {
        window.console.log = originalLog;
        if (debuggerState.isActive) {
            printExecutionEndMessage();
        }
        debuggerState.isActive = false;
        debuggerState.isPaused = false;
        activeSession.isExecuting = false;
        writePrompt(activeSession);
        clearHighlight();
    }
}

function formatHtvmCode(code) {
    const activeSession = getActiveTerminalSession();
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    
    if (activeSession) activeSession.xterm.writeln(`\x1b[32mFormatting HTVM file...\x1b[0m`);
    resetGlobalVarsOfHTVMjs();
    argHTVMinstrMORE.push(instructionSet.join('\n'));

    // --- MODIFICATION START: Set compiler context ---
    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const formattedCode = compiler(code, instructionSet.join('\n'), "full", "htvm");
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; // Clean up context
    // --- MODIFICATION END ---

    resetGlobalVarsOfHTVMjs();
    
    if (activeSession) activeSession.xterm.writeln(`\x1b[32mFormatting complete.\x1b[0m`);
    return formattedCode;
}

async function runHtvmCode(code) {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) return;

    resetGlobalVarsOfHTVMjs();
    const lang = lsGet('selectedLangExtension') || 'js';
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    const isFullHtml = lang === 'js' && document.getElementById('full-html-checkbox').checked;

    if (isFullHtml && Array.isArray(instructionSet) && instructionSet.length > 158) {
        instructionSet[158] = "on";
    }
    
    activeSession.xterm.writeln(`\x1b[32mTranspiling HTVM to ${isFullHtml ? 'HTML' : lang.toUpperCase()}...\x1b[0m`);
    
    // --- MODIFICATION START: Set compiler context ---
    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const compiled = compiler(code, instructionSet.join('\n'), "full", lang);
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; // Clean up context
    // --- MODIFICATION END ---

    resetGlobalVarsOfHTVMjs();
    
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
            await runJsCode(compiled);
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

    if (activeSession.isExecuting || debuggerState.isActive) {
        activeSession.xterm.writeln(`\x1b[31mError: Cannot start a new execution while another process is active.\x1b[0m`);
        return;
    }
    
    if (lsGet('clearTerminalOnRun') === true) {
        activeSession.xterm.clear();
    }

    await saveFileContent(currentOpenFile, editor.getValue());
    activeSession.xterm.writeln(`\x1b[36m> Running ${currentOpenFile}...\x1b[0m`);
    const ext = currentOpenFile.split('.').pop();
    
    if (ext === 'js') {
        await runJsCode(editor.getValue());
    } else if (ext === 'htvm') {
        await runHtvmCode(editor.getValue());
    } else if (ext === 'html') {
        runHtmlCode(editor.getValue());
    } else {
        activeSession.isExecuting = true;
        await runPropertyCommand('run');
    }
}
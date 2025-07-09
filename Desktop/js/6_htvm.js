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
    const declared = new Set();
    let match;

    const varRegex = /(?:let|const|var)\s+([a-zA-Z0-9_$]+(?:\s*,\s*[a-zA-Z0-9_$]+)*)/g;
    while ((match = varRegex.exec(code)) !== null) {
        match[1].split(',').forEach(v => declared.add(v.trim()));
    }

    const forLoopRegex = /for\s*\(\s*(?:let|const|var)\s+([a-zA-Z0-9_$]+)\s+(in|of)/g;
    while ((match = forLoopRegex.exec(code)) !== null) {
        declared.add(match[1].trim());
    }

    const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
    while ((match = funcRegex.exec(code)) !== null) {
        declared.add(match[1].trim());
    }

    return Array.from(declared);
}

function getAllFunctionNames(code) {
    const names = new Set();
    const funcRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
    let match;
    while ((match = funcRegex.exec(code)) !== null) {
        names.add(match[1]);
    }
    return Array.from(names);
}

function protectAndTransform(code, transformFn) {
    const placeholders = new Map();
    let placeholderId = 0;
    // Add a random component to the placeholder to make it "super unique"
    const runId = Math.random().toString(36).substring(2);
    
    const regex = /(["'`])(?:\\.|(?!\1).)*\1|\/\*[\s\S]*?\*\/|\/\/.*/g;

    let protectedCode = code.replace(regex, (match) => {
        const placeholder = `__DBG_PROTECT_${runId}_${placeholderId++}__`;
        placeholders.set(placeholder, match);
        return placeholder;
    });

    let transformedCode = transformFn(protectedCode);

    placeholders.forEach((original, placeholder) => {
        transformedCode = transformedCode.replace(new RegExp(placeholder, 'g'), original);
    });

    return transformedCode;
}

async function runJsCode(code) {
    const activeSession = getActiveTerminalSession();
    if (!activeSession) return;

    activeSession.xterm.writeln(`\x1b[1;33m--- JS Execution ---\x1b[0m`);
    const originalLog = window.console.log;

    debuggerState.isActive = true;
    debuggerState.isPaused = false;
    activeSession.isExecuting = true;

    const cleanup = () => {
        delete window.__debug_pause__;
        delete window.__execution_resolver__;
        window.console.log = originalLog;
        if (debuggerState.isActive) printExecutionEndMessage();
        debuggerState.isActive = false;
        debuggerState.isPaused = false;
        activeSession.isExecuting = false;
        writePrompt(activeSession);
        clearHighlight();
    };

    try {
        await new Promise((resolve, reject) => {
            window.__debug_pause__ = __debug_pause__;
            window.__execution_resolver__ = { resolve, reject };

            let codeToRun = code;
            const breakpoints = fileBreakpoints.get(currentOpenFile);

            if (breakpoints && breakpoints.size > 0) {
                activeSession.xterm.writeln(`\x1b[36mDebugger attached. Transforming code for breakpoints.\x1b[0m`);

                const funcNames = getAllFunctionNames(codeToRun);
                
                codeToRun = protectAndTransform(codeToRun, (sanitizedCode) => {
                    let transformed = sanitizedCode.replace(/(?<!async\s)function(\s+[a-zA-Z0-9_$]*\s*\()/g, "async function$1");
                    transformed = transformed.replace(/(=|\:)\s*function(\s*\()/g, "$1 async function$2");

                    if (funcNames.length > 0) {
                        const callRegex = new RegExp(`(?<!function |async function |await )\\b(${funcNames.join('|')})\\b(?=\\s*\\()`, 'g');
                        transformed = transformed.replace(callRegex, 'await $&');
                    }
                    return transformed;
                });
                
                const lines = codeToRun.split('\n');
                const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => b - a);
                const declaredVars = getDeclaredVariables(codeToRun);
                const scopeCapture = `(() => { const scope = {}; ${declaredVars.map(v => `try { if(typeof ${v} !== 'undefined') scope['${v}'] = ${v}; } catch(e){}`).join(' ')} return scope; })`;
                
                sortedBreakpoints.forEach(row => {
                    if(lines[row] !== undefined) {
                       lines.splice(row, 0, `await window.__debug_pause__(${row}, ${scopeCapture});`);
                    }
                });
                codeToRun = lines.join('\n');
            } else {
                 activeSession.xterm.writeln(`\x1b[32mRunning code without debugger.\x1b[0m`);
            }

            window.console.log = (...args) => activeSession.xterm.writeln(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
            
            const executionWrapper = 'try {\n' +
                                     codeToRun + '\n' +
                                     'window.__execution_resolver__.resolve();\n' +
                                     '} catch (e) {\n' +
                                     'window.__execution_resolver__.reject(e);\n' +
                                     '}';

            // Wrap the entire execution block in an async IIFE (Immediately Invoked Function Expression).
            // This provides a top-level async context, allowing `await` to be used
            // for function calls when the debugger is active, which is not allowed
            // in a non-module context like the one created by `new Function`.
            const finalCodeToExecute = `(async () => { ${executionWrapper} })()`;

            try {
                // `new Function()` will throw a SyntaxError immediately if the code is invalid.
                const executable = new Function(finalCodeToExecute);
                // If it's valid, we run it.
                executable();
            } catch (e) {
                // This catch block handles the SyntaxErrors from `new Function`.
                reject(e);
            }
        });
    } catch (e) {
        if (e.message !== "Execution stopped by user.") {
             activeSession.xterm.writeln(`\x1b[31mError: ${e.message}\x1b[0m`);
        } else {
             activeSession.xterm.writeln(`\x1b[33mExecution stopped by user.\x1b[0m`);
        }
    } finally {
        cleanup();
    }
}


function formatHtvmCode(code) {
    const activeSession = getActiveTerminalSession();
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    
    if (activeSession) activeSession.xterm.writeln(`\x1b[32mFormatting HTVM file...\x1b[0m`);
    resetGlobalVarsOfHTVMjs();
    argHTVMinstrMORE.push(instructionSet.join('\n'));

    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const formattedCode = compiler(code, instructionSet.join('\n'), "full", "htvm");
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; 

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
    
    window.__HTVM_COMPILER_CONTEXT_FILE__ = currentOpenFile;
    const compiled = compiler(code, instructionSet.join('\n'), "full", lang);
    window.__HTVM_COMPILER_CONTEXT_FILE__ = ''; 

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
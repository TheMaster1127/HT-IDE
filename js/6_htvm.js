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
            legacyContentAsString = legacyDataRaw; // Assume it was already a string
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
    // Repopulate the legacy key for the HTVM.js compiler to use
    localStorage.setItem(instructionSetKeys.legacyKey, JSON.stringify(activeContent.split('\n')));
}

async function loadDefinitions(instructionContent = null) {
    // When called with null (like on startup), it will use the legacy key we pre-populated.
    await window.initializeHtvmMode(IDE_ID, instructionContent);
    await window.initializeCompleters(IDE_ID, editor);
    if (editor && currentOpenFile && currentOpenFile.endsWith('.htvm')) {
        editor.session.setMode("ace/mode/text"); // Force re-evaluation
        editor.session.setMode("ace/mode/htvm");
    }
}

async function runJsCode(code) {
    term.writeln(`\x1b[1;33m--- JS Execution ---\x1b[0m`);
    const originalLog = window.console.log;
    try {
        window.console.log = (...args) => term.writeln(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const userFunc = new AsyncFunction(code);
        await userFunc();
    } catch (e) {
        term.writeln(`\x1b[31mError: ${e.stack}\x1b[0m`);
    } finally {
        window.console.log = originalLog;
        printExecutionEndMessage();
    }
}

async function runHtvmCode(code) {
    const lang = lsGet('selectedLangExtension') || 'js';
    let instructionSet = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    const isFullHtml = lang === 'js' && document.getElementById('full-html-checkbox').checked;

    if (isFullHtml && Array.isArray(instructionSet) && instructionSet.length > 158) {
        instructionSet[158] = "on"; // A specific flag in the instruction set for full HTML
    }
    
    term.writeln(`\x1b[32mTranspiling HTVM to ${isFullHtml ? 'HTML' : lang.toUpperCase()}...\x1b[0m`);
    const compiled = compiler(code, instructionSet.join('\n'), "full", lang);
    resetGlobalVarsOfHTVMjs();
    
    const newFileExt = isFullHtml ? 'html' : lang;
    const newFile = currentOpenFile.replace(/\.htvm$/, `.${newFileExt}`);

    saveFileContent(newFile, compiled, false);
    if (!openTabs.includes(newFile)) openFileInEditor(newFile);
    
    const shouldRunAfter = document.getElementById('run-js-after-htvm').checked;
    if (shouldRunAfter) {
        if (isFullHtml) {
            runHtmlCode(compiled);
        } else if (lang === 'js') {
            await runJsCode(compiled);
        } else {
            printExecutionEndMessage();
        }
    } else {
        printExecutionEndMessage();
    }
}

async function handleRun(e) {
    e?.preventDefault();
    if (!currentOpenFile) return;
    
    if (lsGet('clearTerminalOnRun') === true) {
        term.clear();
    }

    saveFileContent(currentOpenFile, editor.getValue());
    term.writeln(`\x1b[36m> Running ${currentOpenFile}...\x1b[0m`);
    const ext = currentOpenFile.split('.').pop();
    
    if (ext === 'js') await runJsCode(editor.getValue());
    else if (ext === 'htvm') await runHtvmCode(editor.getValue());
    else if (ext === 'html') runHtmlCode(editor.getValue());
    else {
        term.writeln(`\x1b[31mError: Cannot execute ".${ext}" files.\x1b[0m`);
        printExecutionEndMessage();
    }
}
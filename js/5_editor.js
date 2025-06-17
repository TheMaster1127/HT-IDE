// --- Editor and Tab Management ---

function openFileInEditor(filename) {
    if (!filename || currentOpenFile === filename) return;
    if (currentOpenFile) {
        saveFileContent(currentOpenFile, editor.getValue(), true);
        lsSet('state_' + currentOpenFile, {
            scrollTop: editor.session.getScrollTop(),
            cursor: editor.getCursorPosition()
        });
    }

    if (!fileSessions.has(filename)) {
        const content = lsGet('file_' + filename) ?? "";
        const mode = ace.require("ace/ext/modelist").getModeForPath(filename).mode;
        const session = ace.createEditSession(content, filename.endsWith('.htvm') ? 'ace/mode/htvm' : mode);
        session.on('change', () => checkDirtyState(filename));
        fileSessions.set(filename, session);
    }

    editor.setSession(fileSessions.get(filename));
    const state = lsGet('state_' + filename);
    if (state) {
        setTimeout(() => {
            editor.gotoLine(state.cursor.row + 1, state.cursor.column, false);
            editor.session.setScrollTop(state.scrollTop);
        }, 1);
    }

    editor.setReadOnly(false);
    editor.focus();
    currentOpenFile = filename;
    if (!openTabs.includes(filename)) openTabs.push(filename);

    renderAll();
    updateEditorModeForHtvm();
}

function closeTab(filenameToClose, force = false) {
    if (!force && fileSessions.has(filenameToClose) && !fileSessions.get(filenameToClose).getUndoManager().isClean()) {
        if (!confirm("You have unsaved changes. Close anyway?")) return;
    }

    const index = openTabs.indexOf(filenameToClose);
    if (index === -1) return;

    if (!force) recentlyClosedTabs.push(filenameToClose);
    openTabs.splice(index, 1);

    if (currentOpenFile === filenameToClose) {
        currentOpenFile = null;
        if (openTabs.length > 0) {
            openFileInEditor(openTabs[Math.max(0, index - 1)]);
        } else {
            editor.setSession(ace.createEditSession("// No file open."));
            editor.setReadOnly(true);
            document.getElementById('htvm-controls').style.display = 'none';
        }
    }
    renderAll();
}

function handleCloseTabRequest(filename) {
    if (!filename) return;
    if (fileSessions.has(filename)) {
        if (!fileSessions.get(filename).getUndoManager().isClean()) {
            saveFileContent(filename, editor.getValue(), true);
        }
    }
    closeTab(filename);
}

const handleReopenTab = () => {
    const f = recentlyClosedTabs.pop();
    if (f && getAllPaths().includes(f)) {
        openFileInEditor(f);
    }
};

function updateEditorModeForHtvm() {
    const htvmControls = document.getElementById('htvm-controls');
    if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) {
        htvmControls.style.display = 'none';
        return;
    }
    htvmControls.style.display = 'flex';
    const keywords = JSON.parse(localStorage.getItem(instructionSetKeys.legacyKey) || '[]');
    if (!keywords || keywords.length < 42) return;

    const currentLine = editor.getSelectionRange().start.row;
    const lines = editor.getValue().split('\n');

    const markers = {
        [keywords[16]]: { lang: "js" }, [keywords[14]]: { lang: "py" }, [keywords[12]]: { lang: "cpp" },
        [keywords[18]]: { lang: "go" }, [keywords[20]]: { lang: "lua" }, [keywords[22]]: { lang: "cs" },
        [keywords[24]]: { lang: "java" }, [keywords[26]]: { lang: "kt" }, [keywords[28]]: { lang: "rb" },
        [keywords[30]]: { lang: "nim" }, [keywords[32]]: { lang: "ahk" }, [keywords[34]]: { lang: "swift" },
        [keywords[36]]: { lang: "dart" }, [keywords[38]]: { lang: "ts" }, [keywords[40]]: { lang: "groovy" }
    };
    
    let lang = "htvm";
    for (let i = currentLine; i >= 0; i--) {
        let foundEnd = false;
        for (const startMarker in markers) {
            if (!startMarker || startMarker === 'undefined') continue;
            const endMarker = keywords[keywords.indexOf(startMarker) + 1];
            if (lines[i].includes(endMarker)) {
                foundEnd = true;
                break;
            }
            if (lines[i].includes(startMarker)) {
                lang = markers[startMarker].lang;
                i = -1; // End the outer loop
                break;
            }
        }
        if (foundEnd) break;
    }
    const modeMap = {'js':'javascript','py':'python','cpp':'c_cpp','go':'golang','lua':'lua','cs':'csharp','java':'java','kt':'kotlin','rb':'ruby','nim':'nim','ahk':'autohotkey','swift':'swift','dart':'dart','ts':'typescript','groovy':'groovy','htvm':'htvm'};
    const finalMode = `ace/mode/${modeMap[lang] || 'text'}`;
    
    if (editor.session.getMode().$id !== finalMode) {
        editor.session.setMode(finalMode);
    }
}
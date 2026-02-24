// js/5_editor.js

// --- Editor and Tab Management ---

async function injectPluginHeaders() {
    if (!currentOpenFile || !currentOpenFile.endsWith('.htvm')) return;

    const activePluginIds = lsGet('active_plugin_ids') || [];
    if (activePluginIds.length === 0) return;

    const installedPlugins = await window.electronAPI.pluginsGetInstalled();
    const headersToInsert = [];

    const normalizeVersion = (version) => {
        const parts = version.split('.');
        while (parts.length < 3) parts.push('0');
        return parts.join('.');
    };

    activePluginIds.forEach(id => {
        if (id.startsWith('local-dev-plugin|')) {
            // For local plugins, we don't have a reliable version, so we skip adding a header.
            return;
        }
        const [pluginId, version] = id.split('|');
        const pluginInfo = installedPlugins.find(p => p.id === pluginId && p.version === version);
        if (pluginInfo) {
            const normalized = normalizeVersion(pluginInfo.version);
            headersToInsert.push(`#plugin#${pluginInfo.id}/${normalized}#`);
        }
    });

    if (headersToInsert.length === 0) return;

    const session = editor.session;
    const content = session.getValue();
    const existingHeaders = content.match(/^#plugin#.*\n?/gm) || [];
    
    // Create a sorted, unique string of required headers for easy comparison
    const requiredHeaderBlock = headersToInsert.sort().join('\n') + (headersToInsert.length > 0 ? '\n' : '');
    const existingHeaderBlock = existingHeaders.sort().join('');

    if (requiredHeaderBlock !== existingHeaderBlock) {
        // Remove old headers and insert new ones
        const newContent = requiredHeaderBlock + content.replace(/^#plugin#.*\n?/gm, '');
        
        const fullRange = new ace.Range(0, 0, session.getLength(), Infinity);
        session.replace(fullRange, newContent);
    }
}

/**
 * A comprehensive formatter for a single line of C code.
 * This function applies several convenient shortcuts and fixes common errors.
 * @param {string} line The line of code to format.
 * @returns {string} The potentially modified line of code.
 */
function formatCLine(line) {
    // 1. Preserve original indentation to re-apply at the end.
    const leadingWhitespaceMatch = line.match(/^\s*/);
    const leadingWhitespace = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '';
    let processedLine = line.trim();

    // If line is empty or a comment, return immediately.
    if (processedLine.length === 0 || processedLine.startsWith('//') || processedLine.startsWith('/*') || processedLine.startsWith(' *')) {
        return line;
    }

    /**
     * Helper function to apply regex replacements safely, ignoring content inside strings.
     * This handles backreferences like $1, $2 correctly.
     */
    const replaceOutsideStrings = (text, pattern, replacer) => {
        const masterPattern = new RegExp(
            `"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|'([^'\\\\]*(?:\\\\.[^'\\\\]*)*)'|(${pattern.source})`,
            pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
        );

        return text.replace(masterPattern, (match, double, single, target) => {
            if (double !== undefined || single !== undefined) return match;
            if (target !== undefined) {
                // Apply the specific pattern to the matched target
                if (typeof replacer === 'function') {
                    return target.replace(pattern, replacer);
                } else {
                    return target.replace(pattern, replacer);
                }
            }
            return match;
        });
    };

    // --- 2. Assignment & Logical Operators ---
    // Convert := to =
    processedLine = replaceOutsideStrings(processedLine, /:=/g, '=');
    // Convert 'and' to '&&' and 'or' to '||' (case-insensitive)
    processedLine = replaceOutsideStrings(processedLine, /\band\b/gi, '&&');
    processedLine = replaceOutsideStrings(processedLine, /\bor\b/gi, '||');

    // --- 3. The IF Statement Fix ---
    // Fixes 'if (var = val)' to 'if (var == val)' without adding extra spaces
    processedLine = replaceOutsideStrings(processedLine, /if\s*\((.+)\)/gi, (match, inner) => {
        // Find single '=' not preceded or followed by other operators, consuming surrounding spaces
        const fixedInner = inner.replace(/([^<>!=])\s*=\s*([^=])/g, '$1 == $2');
        return `if (${fixedInner})`;
    });

    // --- 4. Parentheses Simplification ---
    // Converts '(cond) && (cond)' to 'cond && cond' inside expressions
    processedLine = replaceOutsideStrings(processedLine, /\)\s*(&&|\|\|)\s*\(/g, ' $1 ');

    // --- 5. Convert 'loop' to 'for' ---
    // Handles 'loop 10', 'Loop, var', 'loop func(x) {', etc.
    const loopRegex = /^loop\s*,?\s*(.+?)\s*({?)$/i;
    const loopMatch = processedLine.match(loopRegex);
    if (loopMatch) {
        const condition = loopMatch[1].trim();
        const brace = loopMatch[2] || '';
        processedLine = `for (int i = 0; i < ${condition}; i++) ${brace}`.trim();
    }

    // --- 6. Final Semicolon Logic ---
    const trimmed = processedLine.trim();

    // Do not add semicolon to preprocessor, comments, or already-ended lines
    const noSemicolonEndings = ['{', '}', ';', '>', ':', ','];
    const noSemicolonStarts = ['#', '//', '/*', ' *'];
    if (noSemicolonStarts.some(s => trimmed.startsWith(s))) return leadingWhitespace + trimmed;
    if (noSemicolonEndings.some(e => trimmed.endsWith(e))) return leadingWhitespace + trimmed;

    // Do not add semicolon to control structures (if, for, while, etc.)
    const controlKeywords = ['if', 'for', 'while', 'switch', 'else', 'do'];
    const isControl = controlKeywords.some(kw => {
        const reg = new RegExp(`^${kw}(\\s*\\(.*\\))?\\s*({?)$`, 'i');
        return reg.test(trimmed);
    });
    if (isControl) return leadingWhitespace + trimmed;

    // Do not add semicolon to function headers/definitions
    const isHeader = /^((?:void|int|char|float|double|static|size_t|const|unsigned|long|inline|volatile|restrict)\s+)+\**\w+\s*\(.*\)$/i.test(trimmed);
    if (isHeader) return leadingWhitespace + trimmed;

    // Add semicolon to everything else (variable assignments, function calls like printf(s))
    return leadingWhitespace + trimmed + ';';
}

function setupGutterEvents() {
    editor.on("guttermousedown", function(e) {
        const target = e.domEvent.target;
        if (target.className.indexOf("ace_gutter-cell") == -1) return;
        if (!editor.isFocused()) return;
        if (e.clientX > 25 + target.getBoundingClientRect().left) return;

        const row = e.getDocumentPosition().row;
        const currentBreakpoints = fileBreakpoints.get(currentOpenFile) || new Set();

        if (currentBreakpoints.has(row)) {
            editor.session.clearBreakpoint(row);
            currentBreakpoints.delete(row);
        } else {
            editor.session.setBreakpoint(row, "ace_breakpoint");
            currentBreakpoints.add(row);
        }
        fileBreakpoints.set(currentOpenFile, currentBreakpoints);
        e.stop();
    });

    // --- NEW: C Auto-Formatter Logic ---
    // This listener is attached once and handles the auto-semicolon feature.
    editor.on('changeSelection', () => {
        // Use a small timeout to let the editor state settle before we process the line.
        setTimeout(() => {
            const currentRow = editor.getSelectionRange().start.row;

            // Process the *previous* line if the cursor has moved to a new line.
            if (lastEditedRow !== null && lastEditedRow !== currentRow) {
                // Check the global toggle, ensure a .c file is open.
                if (isCAutoSemicolonEnabled && currentOpenFile && currentOpenFile.endsWith('.c')) {
                    
                    const session = editor.session;
                    const lineToProcess = session.getLine(lastEditedRow);
                    const formattedLine = formatCLine(lineToProcess);
                    
                    if (lineToProcess !== formattedLine) {
                        const range = new ace.Range(lastEditedRow, 0, lastEditedRow, Infinity);
                        // The user has already moved their cursor, so we just replace the line content
                        // without trying to manage the cursor position.
                        session.replace(range, formattedLine);
                    }
                }
            }
            
            // Update the last known row to the current one for the next event.
            lastEditedRow = currentRow;
        }, 10); // A 10ms delay is negligible for the user but robust for the event loop.
    });
}

async function openFileInEditor(filename) {
    if (!filename) return;
    
    // If we are just re-focusing the same file, do nothing.
    if (currentOpenFile === filename) return;
    
    const content = await window.electronAPI.getFileContent(filename);
    if (content === null) {
        const staleTabIndex = openTabs.indexOf(filename);
        if (staleTabIndex > -1) {
            openTabs.splice(staleTabIndex, 1);
        }
        return; 
    }
    
    if (currentOpenFile) {
        lastActiveTab = currentOpenFile;
        // Do not save here, as it can be disruptive. Saving is handled on close/run.
        lsSet('state_' + currentOpenFile, {
            scrollTop: editor.session.getScrollTop(),
            cursor: editor.getCursorPosition()
        });
    }
    
    // Reset the auto-formatter's line tracking when switching files.
    lastEditedRow = null;

    if (!fileSessions.has(filename)) {
        // MODIFICATION: Add .htrs to the list of HTVM-like file extensions.
        const isHtvmLike = filename.endsWith('.htvm') || filename.endsWith('.htpc') || filename.endsWith('.htpr') || filename.endsWith('.htsh') || filename.endsWith('.htll') || filename.endsWith('.htrs');
        const mode = ace.require("ace/ext/modelist").getModeForPath(filename).mode;
        const session = ace.createEditSession(content, isHtvmLike ? 'ace/mode/htvm' : mode);
        session.on('change', () => checkDirtyState(filename));
        fileSessions.set(filename, session);
        // MODIFICATION: Watch the file as soon as its session is created.
        window.electronAPI.watchFile(filename);
    }

    editor.setSession(fileSessions.get(filename));

    const breakpoints = fileBreakpoints.get(filename) || new Set();
    editor.session.clearBreakpoints();
    breakpoints.forEach(row => editor.session.setBreakpoint(row, "ace_breakpoint"));

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

    const name = filename.split(/[\\\/]/).pop();
    const separator = filename.includes('\\') ? '\\' : '/';
    const folderName = filename.substring(0, filename.lastIndexOf(separator)).split(separator).pop();
    const lineCount = editor.session.getLength();
    window.electronAPI.updateDiscordPresence(`Editing: ${name}`, `In folder: ${folderName}`, lineCount);

    await renderAll();
    updateEditorModeForHtvm();
    await injectPluginHeaders(); // INJECT PLUGIN HEADERS HERE

    // Scroll the active tab into view
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        activeTab.scrollIntoView({
            block: 'nearest',
            inline: 'nearest' 
        });
    }
}

async function closeTab(filenameToClose, force = false) {
    if (!force && fileSessions.has(filenameToClose) && !fileSessions.get(filenameToClose).getUndoManager().isClean()) {
        if (!confirm("You have unsaved changes. Close anyway?")) return;
    }

    const index = openTabs.indexOf(filenameToClose);
    if (index === -1) return;
    
    // MODIFIED: Stop watching the file that is being closed.
    window.electronAPI.unwatchFile(filenameToClose);

    if (!force) recentlyClosedTabs.push(filenameToClose);
    
    openTabs.splice(index, 1);
    
    if (!force) {
        fileSessions.delete(filenameToClose);
    }

    if (currentOpenFile === filenameToClose) {
        currentOpenFile = null;
        lastActiveTab = null;
        const nextFileToOpen = openTabs[Math.max(0, index - 1)] || null;
        
        if (nextFileToOpen) {
            await openFileInEditor(nextFileToOpen); 
        } else {
            editor.setSession(ace.createEditSession("// No file open."));
            editor.setReadOnly(true);
            document.getElementById('htvm-controls').style.display = 'none';
            window.electronAPI.updateDiscordPresence("Idle", "No file open", 0);
            await renderAll(); 
        }
    } else {
        await renderAll();
    }
}

async function handleCloseTabRequest(filename) {
    if (!filename) return;
    if (fileSessions.has(filename)) {
        if (!fileSessions.get(filename).getUndoManager().isClean()) {
            const contentToSave = fileSessions.get(filename).getValue();
            await saveFileContent(filename, contentToSave, true); // Pass true for silent save
        }
    }
    await closeTab(filename);
}

const handleReopenTab = async () => {
    // MODIFIED: This function is now fixed. It checks the actual file system
    // instead of relying on the currently displayed file list.
    const fileToReopen = recentlyClosedTabs.pop();
    if (!fileToReopen) {
        return; // No tabs to reopen
    }

    // Use getFileContent to check for the file's existence.
    // It returns null if the file doesn't exist or isn't accessible.
    const content = await window.electronAPI.getFileContent(fileToReopen);

    if (content !== null) {
        await openFileInEditor(fileToReopen);
    } else {
        console.warn(`Attempted to reopen a tab for a file that no longer exists: ${fileToReopen}`);
        // Optionally, try to reopen the next one if this one failed
        if (recentlyClosedTabs.length > 0) {
            await handleReopenTab();
        }
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
    
    const languageMarkers = {
        [keywords[12]]: { end: keywords[13], lang: "cpp" }, [keywords[14]]: { end: keywords[15], lang: "py" },
        [keywords[16]]: { end: keywords[17], lang: "js" }, [keywords[18]]: { end: keywords[19], lang: "go" },
        [keywords[20]]: { end: keywords[21], lang: "lua" }, [keywords[22]]: { end: keywords[23], lang: "cs" },
        [keywords[24]]: { end: keywords[25], lang: "java" }, [keywords[26]]: { end: keywords[27], lang: "kt" },
        [keywords[28]]: { end: keywords[29], lang: "rb" }, [keywords[30]]: { end: keywords[31], lang: "nim" },
        [keywords[32]]: { end: keywords[33], lang: "ahk" }, [keywords[34]]: { end: keywords[35], lang: "swift" },
        [keywords[36]]: { end: keywords[37], lang: "dart" }, [keywords[38]]: { end: keywords[39], lang: "ts" },
        [keywords[40]]: { end: keywords[41], lang: "groovy" }
    };

    const detectedBlocks = [];
    let currentBlock = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!currentBlock) {
            for (const marker in languageMarkers) {
                if (marker && marker !== 'undefined' && line.includes(marker)) {
                    currentBlock = { start: i, lang: languageMarkers[marker].lang, endMarker: languageMarkers[marker].end };
                    break;
                }
            }
        }
        
        if (currentBlock) {
            if (currentBlock.endMarker && currentBlock.endMarker !== 'undefined' && line.includes(currentBlock.endMarker)) {
                detectedBlocks.push({ start: currentBlock.start, end: i, lang: currentBlock.lang });
                currentBlock = null; 
            }
        }
    }
    
    if (currentBlock) {
         detectedBlocks.push({ start: currentBlock.start, end: lines.length -1, lang: currentBlock.lang });
    }

    let lang = "htvm";
    for (const block of detectedBlocks) {
        if (currentLine >= block.start && currentLine <= block.end) {
            lang = block.lang;
            break;
        }
    }

    const modeMap = {'js':'javascript','py':'python','cpp':'c_cpp','go':'golang','lua':'lua','cs':'csharp','java':'java','kt':'kotlin','rb':'ruby','nim':'nim','ahk':'autohotkey','swift':'swift','dart':'dart','ts':'typescript','groovy':'groovy','htvm':'htvm'};
    const finalMode = `ace/mode/${modeMap[lang] || 'text'}`;

    editor.session.setMode("ace/mode/text");
    editor.session.setMode(finalMode);
}
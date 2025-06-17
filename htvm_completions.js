// htvm_completions.js
'use strict';

(function() {
    // This will hold the parsed HTVM keywords, separate from other languages.
    let htvmKeywordCompletions = [];

    // This function is now specifically for parsing the complex HTVM instruction file.
function parseHtvmInstructions(allKeyWordsIn) {
    if (!Array.isArray(allKeyWordsIn)) allKeyWordsIn = [];
    
    const keywords = new Set();

    allKeyWordsIn.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        if (index === 2) {
            const commandGroups = trimmedLine.split('|');
            commandGroups.forEach(group => {
                const firstCommand = group.split(',')[0].trim();
                if (firstCommand) keywords.add(firstCommand.replace(/^\./, '')); // 🔧 FIXED
            });
            return;
        }

        if (index > 2 && index < 162) {
            if (index === 146 || index >= 149) return;
            if (trimmedLine && !/[[\]]/.test(trimmedLine)) {
                keywords.add(trimmedLine.replace(/^\./, '')); // 🔧 FIXED
            }
        }

if (index >= 162) {
    if (trimmedLine.startsWith("name:")) {
        // Check the description line two lines below, if exists
        const descLine = allKeyWordsIn[index + 2]?.trim() || "";
        const isDescriptionNull = descLine.toLowerCase() === "description: null";

        if (!isDescriptionNull) {
            const funcNamesLine = trimmedLine.substring(5).trim();
            const funcNames = funcNamesLine.split(',').map(f => f.trim()).filter(Boolean);
            funcNames.forEach(name => keywords.add(name.replace(/^\./, '')));
        }
        // else skip adding since description is null
    }
}

    });

    return Array.from(keywords).map(name => ({ caption: name, value: name, meta: "htvm" }));
}


    // This is the main initialization function, renamed for clarity.
    // It prepares ALL completions and sets up the universal completer.
    async function initializeCompleters(id, editorInstance) {
        const langKey = `htvm_lang_${id}`;
        let htvmInstructions = JSON.parse(localStorage.getItem(langKey) || '[]');
        
        // Parse and store HTVM-specific keywords.
        htvmKeywordCompletions = parseHtvmInstructions(htvmInstructions);

        // Define a new, universal completer. It will replace the old HTVMCompleter.
        window.LanguageCompleter = {
            getCompletions: function (editor, session, pos, prefix, callback) {
                const ideId = new URLSearchParams(window.location.search).get('id') ?? '0';
                const lsGet = key => { try { const i = localStorage.getItem(`HT-IDE-id${ideId}-` + key); return i ? JSON.parse(i) : null; } catch { return null; } };

                // Master switch for autocomplete
                if (lsGet('autocomplete-master') === false) {
                    callback(null, []);
                    return;
                }
                
                let completions = [];
                const mode = session.getMode().$id.split('/').pop(); // e.g., 'javascript', 'python', 'htvm'
                
                // === Language-specific keywords ===
                if (lsGet('autocomplete-keywords') !== false) {
                    if (mode === 'htvm') {
                        completions.push(...htvmKeywordCompletions);
                    } else {
                        // For other languages, load a simple keyword list from localStorage
                        // The key is e.g., 'lang_completions_javascript'
                        const langKeywords = lsGet(`lang_completions_${mode}`);
                        if (Array.isArray(langKeywords)) {
                            const langCompletions = langKeywords.map(word => ({
                                caption: word,
                                value: word,
                                meta: mode
                            }));
                            completions.push(...langCompletions);
                        }
                    }
                }
                
                // === Words from the local file ===
                if (lsGet('autocomplete-local') !== false) {
                    const userWords = session.getValue().match(/\.?[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
                    const userCompletions = [...new Set(userWords)].map(word => ({
                        caption: word,
                        value: word,
                        meta: "local"
                    }));
                    completions.push(...userCompletions);
                }
                
                // Filter out duplicates
                const allCompletions = completions.filter((v, i, a) => a.findIndex(t => t.value === v.value) === i);

                // No prefix? Return all. Otherwise, filter.
                if (prefix.length === 0) {
                    callback(null, allCompletions);
                    return;
                }
                const prefixLower = prefix.toLowerCase();
                const filtered = allCompletions.filter(c => c.value.toLowerCase().startsWith(prefixLower));
                callback(null, filtered);
            }
        };

        if (editorInstance) {
            const langTools = ace.require("ace/ext/language_tools");
            // Set our new universal completer as the one to use, along with defaults.
            langTools.setCompleters([window.LanguageCompleter, langTools.snippetCompleter]);
        }
    }
    
    // Make the main initializer available globally.
    window.initializeCompleters = initializeCompleters;
})();
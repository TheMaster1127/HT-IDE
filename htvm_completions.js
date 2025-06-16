// htvm_completions.js
'use strict';

(function() {
    function LoopParseFunc(varString, delimiter1="", delimiter2="") {
        if (!varString) return [];
        let items;
        if (!delimiter1 && !delimiter2) { items = [...varString]; } 
        else { let pattern = new RegExp('[' + delimiter1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + delimiter2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+'); items = varString.split(pattern); }
        return items;
    }

    let HTVM_Syntax_AutoComplete = [];

    async function initializeHtvmAutocomplete(id, editorInstance) {
        const langKey = `htvm_lang_${id}`;
        let allKeyWordsIn = JSON.parse(localStorage.getItem(langKey) || '[]');
        if (!Array.isArray(allKeyWordsIn)) allKeyWordsIn = [];
        
        const keywords = new Set();

        // Process keywords based on the new, specific rules
        allKeyWordsIn.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;

            // Rule: Process Commands from Line 3 (index 2)
            if (index === 2) {
                const commandGroups = trimmedLine.split('|');
                commandGroups.forEach(group => {
                    const firstCommand = group.split(',')[0].trim();
                    if (firstCommand) keywords.add(firstCommand);
                });
                return; // Stop processing this line
            }

            // Rule: General Keyword processing (lines 4-162, excluding specific ones)
            if (index > 2 && index < 162) {
                // Exclude line 147 (index 146) and 150-162 (settings)
                if (index === 146 || index >= 149) return;
                 // Add the keyword if it's not a block definition
                if (trimmedLine && !/[[\]]/.test(trimmedLine)) {
                    keywords.add(trimmedLine);
                }
            }

            // Rule: Process Functions from line 163 (index 162) onwards
            if (index >= 162) {
                if (trimmedLine.startsWith("name:")) {
                    const funcName = trimmedLine.substring(5).trim();
                    if (funcName) keywords.add(funcName);
                }
            }
        });

        HTVM_Syntax_AutoComplete = Array.from(keywords).map(name => ({ caption: name, value: name, meta: "htvm keyword" }));

        // Enhance the completer to include local variables
        window.HTVMCompleter = {
            getCompletions: function (editor, session, pos, prefix, callback) {
                const lsGet = key => { try { const i = localStorage.getItem(`HT-IDE-id${new URLSearchParams(window.location.search).get('id') ?? '0'}-` + key); return i ? JSON.parse(i) : null; } catch { return null; } };
                if(lsGet('autocomplete-master') === false) { callback(null, []); return; }
                
                let completions = [];
                
                if (lsGet('autocomplete-keywords') !== false) {
                    completions.push(...HTVM_Syntax_AutoComplete);
                }
                
                // Get user-defined words from the current session
                if (lsGet('autocomplete-local') !== false) {
                    const userWords = session.getValue().match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [];
                    const userCompletions = [...new Set(userWords)].map(word => ({
                        caption: word,
                        value: word,
                        meta: "variable"
                    }));
                    completions.push(...userCompletions);
                }
                
                const allCompletions = completions.filter((v,i,a)=>a.findIndex(t=>(t.value === v.value))===i);

                if (prefix.length === 0) {
                    callback(null, allCompletions);
                    return;
                }

                const prefixLower = prefix.toLowerCase();
                const filtered = allCompletions.filter(c => c.value.toLowerCase().startsWith(prefixLower));
                callback(null, filtered);
            }
        };

        if(editorInstance) {
            const langTools = ace.require("ace/ext/language_tools");
            langTools.setCompleters([window.HTVMCompleter]);
        }
    }
    window.initializeHtvmAutocomplete = initializeHtvmAutocomplete;
})();
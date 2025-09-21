// js/0_htvm_io.js
'use strict';

// This file must be loaded before HTVM.js

// This global variable will be set by the IDE's runner script (6_htvm.js)
// just before the compiler is invoked. It holds the full path of the file being compiled.
var __HTVM_COMPILER_CONTEXT_FILE__ = '';

/**
 * Reads a file relative to the currently compiling HTVM file.
 * This function is intended to be called by the HTVM compiler for 'import' statements.
 * It relies on the global __HTVM_COMPILER_CONTEXT_FILE__ being set by the IDE.
 * @param {string} pathString - The relative or absolute path to the file to read.
 * @returns {string|null} The content of the file, or null if not found or an error occurs.
 */
function FileRead(pathString) {
    if (!window.electronAPI || typeof window.electronAPI.readFileRelativeSync !== 'function') {
        console.error("HTVM FileRead Error: The 'electronAPI.readFileRelativeSync' function is not available. Ensure this is running in the HT-IDE desktop environment.");
        return null;
    }

    if (!__HTVM_COMPILER_CONTEXT_FILE__) {
        console.error("HTVM FileRead Error: Compiler context (base file path) is not set. Cannot resolve relative paths.");
        return null;
    }

    return window.electronAPI.readFileRelativeSync(__HTVM_COMPILER_CONTEXT_FILE__, pathString);
}


// --- PLUGIN API START: Default Hook Stub Functions ---
// These are empty placeholder functions. The HTVM engine will call these.
// The plugin loader will overwrite these functions with the actual code from an active plugin.
// If no plugin is active, these safe defaults will be called, doing nothing.

let htvm_hook1 = (code) => code;
let htvm_hook2 = (code) => code;
let htvm_hook3 = (code) => code;
let htvm_hook4 = (code) => code;
let htvm_hook5 = (code) => code;
let htvm_hook6 = (code) => code;
let htvm_hook7 = (code) => code;
let htvm_hook8 = (code) => code;
let htvm_hook9 = (code) => code;
let htvm_hook10 = (code) => code;
let htvm_hook11 = (code) => code;
let htvm_hook12 = (code) => code;
let htvm_hook13 = (code) => code;
let htvm_hook14 = (code) => code;
let htvm_hook15 = (code) => code;
let htvm_hook16 = (code) => code;
let htvm_hook17 = (code) => code;
let htvm_hook18 = (code) => code;
let htvm_hook19 = (code) => code;
let htvm_hook20 = (code) => code;
let htvm_hook21 = (code) => code;
let htvm_hook22 = (code) => code;
let htvm_hook23 = (code) => code;
let htvm_hook24 = (code) => code;
let htvm_hook25 = (code) => code;
let htvm_hook26 = (code) => code;
let htvm_hook27 = (code) => code;
let htvm_hook28 = (code) => code;
let htvm_hook29 = (code) => code;
let htvm_hook30 = (code) => code;
// --- PLUGIN API END ---
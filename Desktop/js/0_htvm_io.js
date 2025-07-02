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
    // Check if the electronAPI from preload.js is available
    if (!window.electronAPI || typeof window.electronAPI.readFileRelativeSync !== 'function') {
        console.error("HTVM FileRead Error: The 'electronAPI.readFileRelativeSync' function is not available. Ensure this is running in the HT-IDE desktop environment.");
        return null;
    }

    // Check if the context (the base file) has been set by the runner
    if (!__HTVM_COMPILER_CONTEXT_FILE__) {
        console.error("HTVM FileRead Error: Compiler context (base file path) is not set. Cannot resolve relative paths.");
        return null;
    }

    // Call the synchronous function exposed on the bridge to read the file.
    // This blocks the renderer, which is the expected behavior for a compiler import.
    return window.electronAPI.readFileRelativeSync(__HTVM_COMPILER_CONTEXT_FILE__, pathString);
}
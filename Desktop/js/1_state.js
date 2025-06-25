// Global Application State
let editor, term, fitAddon;
let currentOpenFile = null, currentDirectory = '/', openTabs = [], recentlyClosedTabs = [];
const fileSessions = new Map();
const fileBreakpoints = new Map();

// --- NEW DEBUGGER STATE ---
const debuggerState = {
    isActive: false,
    isPaused: false,
    scope: {},
    resolve: null, // A function to resolve the pause promise
    reject: null,  // A function to reject on stop
};

// Global IDE settings and objects
let IDE_ID, STORAGE_PREFIX, langTools;

// MODIFIED: Added global state for terminal process handling.
// This allows the 'Run' button logic (6_htvm.js) and the terminal input logic (8_main.js)
// to share the same execution state, fixing the stdin bug.
let isExecuting = false; // Is a command currently running in the terminal?
let processInputLine = ""; // Buffer for stdin when a process is running.

// Constants will be defined in config, but this prepares the variables
// that will be initialized in main.js
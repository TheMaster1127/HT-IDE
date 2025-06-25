// Global Application State
let editor, term, fitAddon;
let currentOpenFile = null, lastActiveTab = null, currentDirectory = '/', openTabs = [], recentlyClosedTabs = [];
const fileSessions = new Map();
const fileBreakpoints = new Map();

// --- Terminal State ---
let isExecuting = false;       // Is a command currently running in the terminal?
let processInputLine = "";     // Buffer for stdin when a process is running.
let currentLine = "";          // For building commands at the prompt before execution.
let cursorPos = 0;             // The cursor's position within the currentLine string.
let commandHistory = [];       // History of executed commands.
let historyIndex = -1;         // Current position in the command history.

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

// Constants will be defined in config, but this prepares the variables
// that will be initialized in main.js
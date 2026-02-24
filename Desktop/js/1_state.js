// Global Application State
let editor, term, fitAddon; // 'term' and 'fitAddon' are now legacy, kept for any part not yet converted
let currentOpenFile = null, lastActiveTab = null, currentDirectory = '/', openTabs = [], recentlyClosedTabs = [];
const fileSessions = new Map();
const fileBreakpoints = new Map();

// --- C Language Auto-Formatter State ---
let isCAutoSemicolonEnabled = false; // You can set this to false in the console to disable the feature
let lastEditedRow = null;

// --- Terminal State ---
const terminalSessions = new Map();
let activeTerminalId = null;
const getActiveTerminalSession = () => activeTerminalId ? terminalSessions.get(activeTerminalId) : null;

// --- NEW DEBUGGER STATE ---
const debuggerState = {
    isActive: false,
    isPaused: false,
    scope: {},
    resolve: null, // A function to resolve the pause promise
    reject: null,  // A function to reject on stop
};

// MODIFIED: Added server state
let isServerRunning = false;
let serverPort = null;

// Global IDE settings and objects
let IDE_ID, STORAGE_PREFIX, langTools;

// Constants will be defined in config, but this prepares the variables
// that will be initialized in main.js
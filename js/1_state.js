// Global Application State
let editor, term, fitAddon;
let currentOpenFile = null, currentDirectory = '/', openTabs = [], recentlyClosedTabs = [];
const fileSessions = new Map();

// Global IDE settings and objects
let IDE_ID, STORAGE_PREFIX, langTools;

// Constants will be defined in config, but this prepares the variables
// that will be initialized in main.js
// --- Storage Helpers ---
const getIdeId = () => new URLSearchParams(window.location.search).get('id') ?? '0';
const lsGet = key => { try { const i = localStorage.getItem(STORAGE_PREFIX + key); return i ? JSON.parse(i) : null; } catch { return null; } };
const lsSet = (key, value) => { try { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value)); } catch (e) { console.error(e); } };
const lsRemove = key => localStorage.removeItem(STORAGE_PREFIX + key);

// --- Configuration ---
const instructionSetKeys = {
    list: 'instruction_sets_list',
    contentPrefix: 'instruction_set_content_',
    activeId: 'active_instruction_set_id',
    legacyKey: `htvm_lang_${getIdeId()}`
};

const syntaxColorConfig = {
    'ace-color-command':         { label: 'HTVM Commands',              default: '#569cd6', isText: true, defaultBold: true },
    'ace-color-keyword':         { label: 'Keywords',                   default: '#8080e0', isText: true, defaultBold: true },
    'ace-color-functions':       { label: 'Functions',                  default: '#80dfff', isText: true, defaultBold: false },
    'ace-color-buildin-func':    { label: 'Built-in Variables (A_...)', default: '#ff80df', isText: true, defaultBold: false },
    'ace-color-comment':         { label: 'Comments',                   default: '#40d080', isText: true, defaultBold: false },
    'ace-color-blocks-import':   { label: 'Programming Blocks & Imports', default: '#f51000', isText: true, defaultBold: true },
    'ace-color-static-types':    { label: 'Static Types',               default: '#569cd6', isText: true, defaultBold: true },
    'ace-color-string':          { label: 'Strings',                    default: '#ffa0a0', isText: true, defaultBold: false },
    'ace-color-operators':       { label: 'Operators',                  default: '#40a0e0', isText: true, defaultBold: true },
    'ace-color-true-false-null-etc': { label: 'True, False, null etc...', default: '#00ffff', isText: true, defaultBold: false },
    'ace-color-array-methods':   { label: 'Array Methods',              default: '#fab820', isText: true, defaultBold: false },
    'ace-color-gui-options':     { label: 'GUI Options',                default: '#a6e22e', isText: true, defaultBold: false },
    'ace-gutter-text':           { label: 'Gutter Text Color',          default: '#cbcdc3', isText: true, defaultBold: false },
    'ace-gutter-background':     { label: 'Gutter Background',          default: '#204020', isText: false, defaultBold: false },
    'ace-active-line':           { label: 'Active Line Highlight',      default: '#103010', isText: false, defaultBold: false },
    'ace-background':            { label: 'Editor Background',          default: '#050505', isText: false, defaultBold: false },
};

const uiThemeConfig = {
    // --- General Category ---
    '--app-bg-color': { label: 'Main Background Color', default: '#1a1a1a', type: 'color', category: 'General', description: 'The main background color for empty areas of the IDE.' },
    '--text-color': { label: 'Default Text Color', default: '#e0e0e0', type: 'color', category: 'General', description: 'The default color for most text in the IDE, unless specified otherwise.', hasBoldToggle: true, defaultBold: false },
    '--modal-bg': { label: 'Modal Background Color', default: '#1e1e1e', type: 'color', category: 'General', description: 'Background color for pop-up dialog boxes like Settings or Session Manager.' },
    '--modal-header-text': { label: 'Modal Header Text Color', default: '#ffffff', type: 'color', category: 'General', description: 'Color of the title text inside modals (e.g., "Settings + Help").', hasBoldToggle: true, defaultBold: false },

    // --- Sidebar Buttons ---
    '--btn-secondary-bg': { label: 'New File Button BG', default: '#0e639c', type: 'color', category: 'Sidebar Buttons', description: 'Background color for the "New File" button in the sidebar.' },
    '--btn-secondary-text': { label: 'New File Button Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', description: 'Text color for the "New File" button.', hasBoldToggle: true, defaultBold: false },
    '--btn-secondary-hover-bg': { label: 'New File Button Hover BG', default: '#0b4f7a', type: 'color', category: 'Sidebar Buttons', description: 'Background color when hovering over the "New File" button.' },
    '--btn-primary-bg': { label: 'New Folder Button BG', default: '#fe6619', type: 'color', category: 'Sidebar Buttons', description: 'Background color for the "New Folder" button in the sidebar.' },
    '--btn-primary-text': { label: 'New Folder Button Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', description: 'Text color for the "New Folder" button.', hasBoldToggle: true, defaultBold: false },
    '--btn-primary-hover-bg': { label: 'New Folder Button Hover BG', default: '#e65a00', type: 'color', category: 'Sidebar Buttons', description: 'Background color when hovering over the "New Folder" button.' },
    '--btn-generic-bg': { label: 'Session/Settings Buttons BG', default: '#333', type: 'color', category: 'Sidebar Buttons', description: 'Background color for the "Save Session", "Load Session", and "Settings" buttons.' },
    '--btn-generic-text': { label: 'Session/Settings Buttons Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', description: 'Text color for the "Save Session", "Load Session", and "Settings" buttons.', hasBoldToggle: true, defaultBold: false },
    '--btn-generic-hover-bg': { label: 'Session/Settings Hover BG', default: '#444', type: 'color', category: 'Sidebar Buttons', description: 'Background color when hovering over the Session/Settings buttons.' },
    'manage-instr-btn-bg': { label: 'Manage Instructions Button BG', default: '#2a8f2a', type: 'color', category: 'Sidebar Buttons', cssVar: '#load-instructions-btn', property: 'backgroundColor', description: 'Background color for the "Manage Instructions" button in the sidebar footer.' },
    'manage-instr-btn-text': { label: 'Manage Instructions Button Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', cssVar: '#load-instructions-btn', property: 'color', description: 'Text color for the "Manage Instructions" button.', hasBoldToggle: true, defaultBold: false },
    '--btn-special-bg': { label: 'HTVM>HTVM Button BG', default: '#6a0dad', type: 'color', category: 'Sidebar Buttons', description: 'Background color for the "HTVM to HTVM" converter button.' },
    '--btn-special-text': { label: 'HTVM>HTVM Button Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', description: 'Text color for the "HTVM to HTVM" button.', hasBoldToggle: true, defaultBold: false },
    '--btn-special-hover-bg': { label: 'HTVM>HTVM Button Hover BG', default: '#520a84', type: 'color', category: 'Sidebar Buttons', description: 'Background color when hovering over the "HTVM to HTVM" button.' },
    'open-folder-btn-bg': { label: 'Open New Folder Button BG', default: '#0e639c', type: 'color', category: 'Sidebar Buttons', cssVar: '#open-folder-btn', property: 'backgroundColor', description: 'Background color for the "Open New Folder" button.' },
    'open-folder-btn-text': { label: 'Open New Folder Button Text', default: '#ffffff', type: 'color', category: 'Sidebar Buttons', cssVar: '#open-folder-btn', property: 'color', description: 'Text color for the "Open New Folder" button.', hasBoldToggle: true, defaultBold: false },

    // --- Sidebar Category ---
    '--sidebar-bg': { label: 'Sidebar Background', default: '#121212', type: 'color', category: 'Sidebar', description: 'The main background color of the file explorer sidebar.' },
    '--sidebar-header-text': { label: 'Sidebar "Files" Title', default: '#e0e0e0', type: 'color', category: 'Sidebar', description: 'The color of the "Files" title text at the top of the sidebar.', hasBoldToggle: true, defaultBold: true },
    '--sidebar-path-bg': { label: 'Current Path Background', default: '#1a1a1a', type: 'color', category: 'Sidebar', description: 'Background for the current directory path display (e.g., "/src/files/").' },
    '--sidebar-path-text': { label: 'Current Path Text', default: '#ffffff', type: 'color', category: 'Sidebar', description: 'Text color for the current directory path display.', hasBoldToggle: true, defaultBold: false },
    '--sidebar-file-text': { label: 'File List Text', default: '#e0e0e0', type: 'color', category: 'Sidebar', description: 'The text color for file and folder names in the list.', hasBoldToggle: true, defaultBold: false },
    '--sidebar-file-hover-bg': { label: 'File Item Hover Background', default: '#1f1f1f', type: 'color', category: 'Sidebar', description: 'The background color that appears when you hover your mouse over a file or folder.' },
    '--sidebar-file-active-bg': { label: 'Active File Background', default: '#005f87', type: 'color', category: 'Sidebar', description: 'The background color for the currently selected file in the sidebar list.' },
    '--sidebar-file-active-text': { label: 'Active File Text', default: '#ffffff', type: 'color', category: 'Sidebar', description: 'The text color for the currently selected file in the sidebar list.', hasBoldToggle: true, defaultBold: false },
    '--main-toggle-btn-color': { label: 'Toggle Sidebar Icon (☰)', default: '#e0e0e0', type: 'color', category: 'Sidebar', description: 'The color of the "hamburger" menu icon (☰) used to toggle the sidebar.' },
    '--sidebar-close-btn-color': { label: 'Mobile Close Icon (X)', default: '#e0e0e0', type: 'color', category: 'Sidebar', description: 'The color of the "X" button used to close the sidebar on mobile devices.' },

    // --- Top Bar ---
    '--top-bar-bg': { label: 'Top Bar Background', default: '#1a1a1a', type: 'color', category: 'Top Bar', description: 'The background color of the top bar that contains the tabs and run button.' },
    'run-btn-bg': { label: '▶ Run Button BG', default: '#3d8b40', type: 'color', category: 'Top Bar', cssVar: '#run-btn', property: 'backgroundColor', description: 'Background color for the main "▶ Run" button in the top bar.' },
    'run-btn-text': { label: '▶ Run Button Text', default: '#ffffff', type: 'color', category: 'Top Bar', cssVar: '#run-btn', property: 'color', description: 'Text color for the "▶ Run" button.', hasBoldToggle: true, defaultBold: true },
    '--htvm-controls-text': { label: 'Language Selector Text', default: '#e0e0e0', type: 'color', category: 'Top Bar', description: 'The text color for the language selector dropdown and its associated checkboxes (e.g., "Run JS").', hasBoldToggle: true, defaultBold: false },
    
    // --- File Tabs Category ---
    '--tab-inactive-bg': { label: 'Inactive Tab Background', default: '#252525', type: 'color', category: 'File Tabs', description: 'Background color for tabs that are not currently active.' },
    '--tab-inactive-text': { label: 'Inactive Tab Text', default: '#ffffff', type: 'color', category: 'File Tabs', description: 'Text color for tabs that are not currently active.', hasBoldToggle: true, defaultBold: false },
    '--tab-active-bg': { label: 'Active Tab Background', default: '#000000', type: 'color', category: 'File Tabs', description: 'Background color for the currently active/selected tab.' },
    '--tab-active-text': { label: 'Active Tab Text', default: '#ffffff', type: 'color', category: 'File Tabs', description: 'Text color for the currently active/selected tab.', hasBoldToggle: true, defaultBold: false },
    '--tab-hover-bg': { label: 'Tab Hover Background', default: '#3e3e3e', type: 'color', category: 'File Tabs', description: 'The background color when hovering over any tab. To disable the hover effect, set this to the same color as "Inactive Tab Background".' },
    '--tab-close-icon': { label: 'Tab Close Icon (X)', default: '#ffffff', type: 'color', category: 'File Tabs', description: 'The color of the "X" icon for closing a tab.' },
    
    // --- Output Panel Category ---
    '--output-header-bg': { label: 'HTML Output Header BG', default: '#1a1a1a', type: 'color', category: 'Output Panel', description: 'Background color for the header of the HTML Output panel.' },
    '--output-header-text': { label: 'HTML Output Header Text', default: '#ffffff', type: 'color', category: 'Output Panel', description: 'Text color for the title ("HTML Output") and buttons in the panel header.', hasBoldToggle: true, defaultBold: false },
    'download-html-btn-bg': { label: 'Download Button BG', default: '#3d8b40', type: 'color', category: 'Output Panel', cssVar: '#download-html-btn', property: 'backgroundColor', description: 'Background color for the "Download" button in the HTML Output panel.' },
    'download-html-btn-text': { label: 'Download Button Text', default: '#ffffff', type: 'color', category: 'Output Panel', cssVar: '#download-html-btn', property: 'color', description: 'Text color for the "Download" button.', hasBoldToggle: true, defaultBold: false },

    // --- Resizers & Scrollbars Category ---
    '--resizer-bg': { label: 'Resizer Bar Color', default: '#222', type: 'color', category: 'Resizers & Scrollbars', description: 'The color of the draggable bars used to resize panels.' },
    '--resizer-hover-bg': { label: 'Resizer Bar Hover Color', default: '#222', type: 'color', category: 'Resizers & Scrollbars', description: 'The color of the resizer bar when you hover over it. To disable the color change on hover, set this to the same color as the main Resizer Bar.' },
    '--scrollbar-track-bg': { label: 'Scrollbar Track Color', default: '#2c2c2c', type: 'color', category: 'Resizers & Scrollbars', description: 'The background color of the scrollbar "track" or channel.' },
    '--scrollbar-thumb-bg': { label: 'Scrollbar Thumb Color', default: '#0078d4', type: 'color', category: 'Resizers & Scrollbars', description: 'The color of the draggable part of the scrollbar (the "thumb").' },
    '--scrollbar-thumb-hover-bg': { label: 'Scrollbar Thumb Hover Color', default: '#0098f4', type: 'color', category: 'Resizers & Scrollbars', description: 'The color of the scrollbar thumb when you hover over it.' },
    '--scrollbar-size': { label: 'Scrollbar Thickness', default: '16', type: 'range', min: '4', max: '24', unit: 'px', category: 'Resizers & Scrollbars', description: 'Controls the width/height of the scrollbars.' },
    '--scrollbar-border-radius': { label: 'Scrollbar Roundness', default: '3', type: 'range', min: '0', max: '12', unit: 'px', category: 'Resizers & Scrollbars', description: 'Controls how rounded the corners of the scrollbar thumb are.' },
};

const draftCompletions = {
    javascript: ['const', 'let', 'var', 'function', 'async', 'await', 'return', 'class', 'extends', 'import', 'export', 'default', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'document', 'window', 'console', 'log', 'alert', 'fetch', 'Promise'],
    python: ['def', 'class', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'in', 'while', 'break', 'continue', 'pass', 'try', 'except', 'finally', 'raise', 'with', 'return', 'yield', 'lambda', 'True', 'False', 'None', 'print', 'len', 'range', 'list', 'dict', 'str', 'int', 'float'],
    c_cpp: ['#include', '#define', 'using', 'namespace', 'std', 'int', 'char', 'float', 'double', 'bool', 'void', 'long', 'short', 'unsigned', 'signed', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'const', 'static', 'new', 'delete', 'this', 'cout', 'cin', 'endl', 'printf', 'scanf', 'malloc', 'free', 'calloc', 'realloc', 'FILE', 'fopen', 'fclose', 'fprintf', 'fscanf', 'NULL', 'sizeof'],
    golang: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'range', 'go', 'chan', 'select', 'for', 'if', 'else', 'switch', 'case', 'default', 'break', 'continue', 'fallthrough', 'return', 'defer', 'make', 'new', 'len', 'cap', 'append', 'copy', 'delete', 'panic', 'recover', 'int', 'string', 'bool', 'float64'],
    lua: ['local', 'function', 'end', 'if', 'then', 'elseif', 'else', 'for', 'in', 'do', 'while', 'repeat', 'until', 'return', 'break', 'and', 'or', 'not', 'true', 'false', 'nil', 'pcall', 'ipairs', 'pairs', 'print', 'require', 'tostring', 'tonumber', 'table'],
    csharp: ['using', 'namespace', 'class', 'struct', 'interface', 'enum', 'public', 'private', 'protected', 'internal', 'static', 'void', 'int', 'string', 'bool', 'double', 'float', 'char', 'var', 'const', 'new', 'if', 'else', 'for', 'foreach', 'in', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'get', 'set', 'Console', 'WriteLine'],
    java: ['package', 'import', 'public', 'private', 'protected', 'static', 'class', 'interface', 'enum', 'extends', 'implements', 'final', 'void', 'int', 'String', 'boolean', 'double', 'char', 'new', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'throws', 'super', 'this', 'System', 'out', 'println'],
    kotlin: ['package', 'import', 'fun', 'val', 'var', 'class', 'interface', 'object', 'data', 'enum', 'public', 'private', 'protected', 'internal', 'override', 'open', 'final', 'abstract', 'when', 'if', 'else', 'for', 'in', 'while', 'do', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'Int', 'String', 'Boolean', 'Double', 'println'],
    ruby: ['def', 'end', 'class', 'module', 'require', 'include', 'if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'in', 'do', 'case', 'when', 'break', 'next', 'redo', 'retry', 'return', 'yield', 'true', 'false', 'nil', 'self', 'puts', 'print', 'gets', 'each', 'map', 'collect'],
    nim: ['var', 'let', 'const', 'type', 'proc', 'func', 'method', 'template', 'macro', 'import', 'export', 'from', 'if', 'elif', 'else', 'case', 'of', 'when', 'for', 'in', 'while', 'block', 'return', 'yield', 'discard', 'break', 'continue', 'try', 'except', 'finally', 'raise', 'int', 'string', 'bool', 'float', 'echo'],
    autohotkey: ['MsgBox', 'Send', 'Click', 'Sleep', 'Loop', 'FileRead', 'If', 'Else', 'Gosub', 'Return', 'ExitApp', 'Reload', 'KeyWait', 'GetKeyState', 'SetTimer', 'WinActivate', 'WinWait', 'WinClose', 'ControlSend', 'class', 'extends', 'new', 'static', 'try', 'catch', 'A_Index', 'A_LoopField', 'ErrorLevel', 'true', 'false'],
    swift: ['import', 'let', 'var', 'func', 'class', 'struct', 'enum', 'protocol', 'extension', 'public', 'private', 'fileprivate', 'internal', 'static', 'if', 'else', 'guard', 'for', 'in', 'while', 'repeat', 'switch', 'case', 'default', 'break', 'continue', 'fallthrough', 'return', 'inout', 'throws', 'rethrows', 'try', 'catch', 'do', 'Int', 'String', 'Bool', 'Double', 'print'],
    dart: ['import', 'export', 'part', 'library', 'var', 'final', 'const', 'late', 'void', 'class', 'mixin', 'enum', 'extends', 'implements', 'with', 'if', 'else', 'for', 'in', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'on', 'finally', 'throw', 'async', 'await', 'yield', 'sync', 'Future', 'Stream', 'print'],
    typescript: ['const', 'let', 'var', 'function', 'async', 'await', 'return', 'class', 'extends', 'implements', 'interface', 'type', 'enum', 'public', 'private', 'protected', 'readonly', 'static', 'import', 'export', 'from', 'default', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'string', 'number', 'boolean', 'any', 'void', 'null', 'undefined'],
    groovy: ['def', 'class', 'interface', 'enum', 'trait', 'import', 'package', 'as', 'in', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'super', 'true', 'false', 'null', 'int', 'String', 'boolean', 'println', 'each'],
    html: ['html', 'head', 'body', 'title', 'meta', 'link', 'style', 'script', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'img', 'ul', 'ol', 'li', 'form', 'input', 'button', 'textarea', 'label', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'footer', 'header', 'nav', 'section', 'article', 'aside', 'main', 'iframe', 'class=', 'id=', 'src=', 'href=', 'style=', 'alt=', 'type=', 'placeholder=', 'value=']
};


// --- Utility Functions ---
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function LoopParseFunc(varString, delimiter1="", delimiter2="") {
    let items;
    if (!delimiter1 && !delimiter2) {
        // If no delimiters are provided, return an array of characters
        items = [...varString];
    } else {
        // Construct the regular expression pattern for splitting the string
        let pattern = new RegExp('[' + delimiter1.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + delimiter2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ']+');
        // Split the string using the constructed pattern
        items = varString.split(pattern);
    }
    return items;
}

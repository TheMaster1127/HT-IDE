# HT-IDE Desktop Edition

**A powerful, multi-language desktop IDE with a custom-built transpiler, integrated terminal, debugger, and extensive customization options, all powered by Electron and Node.js.**

---

## Table of Contents

- [Getting Started](#getting-started)
- [Core Features](#core-features)
  - [1. File & Project Management](#1-file--project-management)
    - [File Explorer](#file-explorer)
    - [New Project Creation](#new-project-creation)
    - [Session Management](#session-management)
    - [Workspaces](#workspaces)
    - [Export & Import](#export--import)
  - [2. The Code Editor](#2-the-code-editor)
    - [Multi-Tab Interface](#multi-tab-interface)
    - [Syntax Highlighting](#syntax-highlighting)
    - [File Status Indicators](#file-status-indicators)
    - [Context Menus](#context-menus)
  - [3. The Integrated Terminal](#3-the-integrated-terminal)
    - [Multiple Terminal Tabs](#multiple-terminal-tabs)
    - [Shell Functionality](#shell-functionality)
  - [4. HTVM Transpiler Integration](#4-htvm-transpiler-integration)
    - [On-the-fly Transpilation](#on-the-fly-transpilation)
    - [Language Target Selector](#language-target-selector)
    - [HTVM Code Formatter](#htvm-code-formatter)
    - [Instruction Set Management](#instruction-set-management)
    - [HTVM Line Mapper](#htvm-line-mapper)
  - [5. Code Execution & Debugging](#5-code-execution--debugging)
    - [Running Files & Using Property Files](#running-files--using-property-files)
    - [Built-in JavaScript Debugger](#built-in-javascript-debugger)
    - [HTML Output Panel](#html-output-panel)
  - [6. Built-in Web Server](#6-built-in-web-server)
  - [7. HTVM Plugin API ("The Freedom API")](#7-htvm-plugin-api-the-freedom-api)
  - [8. Extensive Customization](#8-extensive-customization)
    - [General Settings](#general-settings)
    - [UI Theme Editor](#ui-theme-editor)
    - [Syntax Color Editor](#syntax-color-editor)
    - [Hotkey Customization](#hotkey-customization)
- [Discord Integration](#discord-integration)
- [Default Hotkeys](#default-hotkeys)
- [Project Structure](#project-structure)
- [License](#license)

---

## Getting Started

There are two ways to get started with HT-IDE: downloading a pre-built release or running from the source code.

### Method 1: Download a Release (Recommended for Users)

This is the easiest way to use HT-IDE. No setup is required.

1.  Go to the **[GitHub Releases Page](https://github.com/TheMaster1127/HT-IDE/releases)**.
2.  Download the correct file for your operating system:
    *   **Windows:** Download the `.exe` installer or the portable `.exe`.
    *   **Linux:** Download the `.AppImage` (recommended for most distributions) or the `.deb` file (for Ubuntu/Debian).
3.  Run the downloaded file to start the IDE.

### Method 2: Running from Source Code (for Developers)

This method is for those who want to contribute to the project or modify the code.

1.  **Prerequisites:** Ensure you have [Node.js](https://nodejs.org/) installed on your system.
2.  **Clone the repository** or download the source code.
3.  **Open a terminal** in the `/Desktop` directory of the project.
4.  **Install dependencies** by running the command:
    ```bash
    npm install
    ```
5.  **Launch the application** with the command:
    ```bash
    npm start
    ```

---

## Core Features

### 1. File & Project Management

#### File Explorer
The IDE features a robust file explorer in the left-hand sidebar.
-   **Open a Project:** Click the **Open New Folder** button to open a system dialog and select a project directory. The IDE's file system will root itself in that directory.
-   **Navigation:** Click on folders to navigate into them. Click the `📁 ..` entry to go up one level. The current absolute path is always displayed at the top of the sidebar.
-   **Create Files & Folders:** Use the **New File** and **New Folder** buttons to create items in the currently viewed directory.
-   **Delete Items:** Hover over any file or folder to reveal a `🗑️` icon to permanently delete it.
-   **Drag and Drop:** You can drag files and folders from your operating system directly into the file explorer to copy them into your project.

#### New Project Creation
Create entire project structures from predefined templates.

1. Press the **`Ctrl + N`** hotkey.
2. The "Create New Project" modal will appear.
3. Choose from a list of project structures:
   - You can create, edit, and manage these templates via **Settings** > **Projects** > **Manage Project Structures**.
4. New projects are created in the directory defined under **Settings** > **Projects** > **Default Project Directory**.
5. After creation, the IDE will ask if you want to close current tabs and open the new project immediately.

#### Session Management
-   **Save Session:** Click **Save Session** to save the currently open set of tabs under a specific name. This is perfect for quickly restoring your work context.
-   **Load Session:** Click **Load Session** to close all current tabs and open a previously saved session. The IDE will find the files by their absolute paths, regardless of your current working directory.

#### Workspaces
HT-IDE supports multiple workspaces, which are completely isolated environments. Each workspace has its own:
-   Open files and sessions.
-   UI and syntax theme settings.
-   General settings and hotkeys.
-   Instruction Sets.
This allows you to maintain separate configurations for different projects or tasks. You can create, switch, and delete workspaces via the **Manage Workspaces** button in the Export/Import modal.

#### Export & Import
The **Export/Import** modal provides powerful tools for data management:
-   **Export/Import Everything:** Create a full backup of all your workspaces and settings, or restore from one.
-   **Export/Import Theme:** Share your custom UI and syntax color themes with others.
-   **Export/Import Workspace:** Back up a single workspace or import one into a new or existing workspace ID.

### 2. The Code Editor

The editor is powered by the mature and performant **Ace Editor**.

#### Multi-Tab Interface
-   Open multiple files simultaneously in a familiar tabbed interface.
-   **Drag & Drop Reordering:** Click and drag tabs to reorder them.
-   **Drag & Drop Opening:** Drag a file from your OS or the sidebar directly into the editor area to open it.

#### Syntax Highlighting
-   Provides rich syntax highlighting for dozens of common programming languages out of the box.
-   **Dynamic HTVM Highlighting:** When editing `.htvm` files, the editor intelligently switches its syntax highlighting on-the-fly. If your cursor is inside a `js`, `py`, `cpp`, etc., block, it will use that language's highlighter, otherwise defaulting to the HTVM highlighter.

#### File Status Indicators
-   **Active File:** The active tab is visually distinct and the corresponding file in the sidebar is highlighted.
-   **Dirty Indicator:** An asterisk (`*`) appears next to the filename in a tab if the file has unsaved changes. The IDE automatically saves files on close or before running a command.

#### Context Menus
-   **Tab:** Right-click a tab to get options to **Close** it or **Open File Location** in your system's file explorer.
-   **File Explorer:** Right-click a file or folder in the sidebar to **Open File Location**.

### 3. The Integrated Terminal

#### Multiple Terminal Tabs
-   Click the `+` button in the terminal panel to open a new, independent terminal instance.
-   Each terminal maintains its own command history and current working directory.

#### Shell Functionality
-   **Real-time CWD Sync:** When you navigate through folders in the sidebar, the terminal's prompt automatically updates to reflect your new location.
-   **Command History:** Use the `Up` and `Down` arrow keys to cycle through previous commands.
-   **Path Autocompletion:** Press `Tab` to autocomplete file and directory paths, just like a native shell.
-   **Copy & Paste:**
    - `Ctrl+C`: Copies the selected text in the terminal. If no text is selected, it sends an interrupt signal to the running command.
    - `Ctrl+V` or `Right-Click`: Pastes the content of your clipboard into the terminal.
-   **Process Management:** Press `Ctrl+C` (with no text selected) to terminate a running command.

### 4. HTVM Transpiler Integration

HT-IDE is built around its unique **HTVM** engine.

#### On-the-fly Transpilation
-   When you run a `.htvm` file, the IDE uses the core `HTVM.js` engine to transpile it to your selected target language.
-   The resulting file (e.g., `my_script.js`) is automatically saved in the same directory and opened in a new tab.

#### Language Target Selector
-   A dropdown in the top bar allows you to select the output language for HTVM transpilation.
-   **Run JS/Full HTML:** Special options for JavaScript targets allow you to either run the generated JS code directly in the terminal or wrap it in a full HTML document for browser execution.

#### HTVM Code Formatter
-   Click the **Format** button (or use `Ctrl+Shift+F`) to automatically clean up and standardize the indentation and spacing of your `.htvm` file.

#### Instruction Set Management
-   The power of the HTVM transpiler comes from its instruction sets. Manage them via the **Manage Instructions** button.
-   You can add new sets from files, edit existing ones in a dedicated editor, rename them, and switch the active set (requires a reload).
-   The **HTVM to HTVM** converter allows you to translate `.htvm` files written for one instruction set to another.

#### HTVM Line Mapper
-   A powerful utility to pinpoint the exact line in your `.htvm` source that corresponds to a line in the generated target code (and vice versa). It's invaluable for debugging large, complex transpiled files.
-   **Advanced Fuzzy Matching:** Uses a sophisticated token-based algorithm to find matches even when lines aren't identical, accounting for small syntax variations.
-   **Intelligent Workflow:**
    -   Accessed via a hotkey (`Ctrl+Alt+M`) or a dedicated UI button.
    -   The tool **intelligently pre-fills** one of the code boxes based on your currently active file.
    -   It then interactively **prompts you** to provide the other file's code, and can even **paste it directly from your clipboard** for a super-fast workflow.
-   **Helpful Results:** The output provides a high-confidence best guess (e.g., "99% sure its: on line X"), a likely range of lines to check, and a snippet of the original target code so you know what you're looking for.

### 5. Code Execution & Debugging

#### Running Files & Using Property Files
The behavior of the **▶ Run** button (`Ctrl+Enter` or `F5`) is context-aware:
-   **.js:** Executes the file directly using Node.js.
-   **.htvm:** Transpiles the file to the selected target language and executes it if the target is JS.
-   **.html:** Renders the file in a dedicated HTML Output panel within the IDE.
-   **Other Files (C++, Python, etc.):** The IDE will look for a corresponding `.htpr` (run) or `.htpc` (compile) "property file" to execute custom commands.

**How to Use Property Files:**

The power of HT-IDE comes from its ability to run any language using simple text files. The application ships with a default set of property files, but you can create your own or modify the existing ones.

1.  On the first run, HT-IDE creates a personal, editable copy of the default `property files` folder in your user data directory.
2.  You can create new `.htpr` and `.htpc` files in this folder, or edit the existing ones to customize the run/compile behavior for any language. The IDE will always use the files from this user-specific folder.

---

### File Extensions and Corresponding Property Files

For each programming language you use in the **HT-IDE**, the property files should have matching names with the extension `.htpc` for compile commands and `.htpr` for run commands. For example:

| Language        | File Extension     | HTVM Property File Extensions |
|-----------------|--------------------|-------------------------------|
| C++             | .cpp               | `cpp.htpc` (compile), `cpp.htpr` (run)  |
| Python          | .py                | `py.htpc` (compile), `py.htpr` (run)    |
| JavaScript      | .js                | `js.htpc` (compile), `js.htpr` (run)    |
| Go              | .go                | `go.htpc` (compile), `go.htpr` (run)    |
| Lua             | .lua               | `lua.htpc` (compile), `lua.htpr` (run)  |
| C#              | .cs                | `cs.htpc` (compile), `cs.htpr` (run)    |
| Java            | .java              | `java.htpc` (compile), `java.htpr` (run)|
| Kotlin          | .kt                | `kt.htpc` (compile), `kt.htpr` (run)    |
| Ruby            | .rb                | `rb.htpc` (compile), `rb.htpr` (run)    |
| Nim             | .nim               | `nim.htpc` (compile), `nim.htpr` (run)  |
| AutoHotKey      | .ahk               | `ahk.htpc` (compile), `ahk.htpr` (run)  |
| Swift           | .swift             | `swift.htpc` (compile), `swift.htpr` (run)|
| Dart            | .dart              | `dart.htpc` (compile), `dart.htpr` (run)|
| TypeScript      | .ts                | `ts.htpc` (compile), `ts.htpr` (run)    |
| Groovy          | .groovy            | `groovy.htpc` (compile), `groovy.htpr` (run)|

Or any other file extention

In other words, the file extension of the code corresponds to the name of the property file.

---

- **.htpc**: Property file for compiling when pressing `Ctrl+F7`
- **.htpr**: Property file for running your code when pressing `F5`

Here's how the syntax works in these property files:

- **Placeholders**:
  - `%FILENAME%`: Full file path of the file being processed
  - `%ONLYFILENAME%`: The filename without its extension
  - `%DIRFULLPATH%`: The full directory path of the file
 
- **Comments**:
  - Use `;` to write comments.

#### Example Property Files (`cpp.htpr` and `cpp.htpc`)

The following example shows how to set up property files to run code in C++.


#### **cpp.htpr**

```plaintext
; This is the property file for compiling and running C++ files.
; The first command compiles the code.
;g++ "%ONLYFILENAME%.cpp" "-O3" "-o" "%ONLYFILENAME%"
g++ "%ONLYFILENAME%.cpp" "-o" "%ONLYFILENAME%"

; The second command runs the compiled executable.
"%ONLYFILENAME%.exe"
```

#### **cpp.htpc**

```plaintext
; only compile c++ code
g++ "%ONLYFILENAME%.cpp" "-o" "%ONLYFILENAME%"
```

---


#### Built-in JavaScript Debugger
-   **Set Breakpoints:** Simply click in the editor's "gutter" (the area with line numbers) to set or remove a breakpoint on that line.
-   **Debugger Panel:** When a breakpoint is hit during JS execution, a movable debugger panel appears.
-   **Inspect Scope:** The panel shows all variables currently in scope and their values.
-   **Variable Hover:** While paused, you can hover over variable names in the editor to see their current value in a tooltip.
-   **Controls:** You can **Resume** (`F8`) execution or **Stop** it entirely.

#### HTML Output Panel
-   When running an HTML file, it is rendered in a special side panel.
-   This panel allows you to **Download** the generated HTML or close the panel.

### 6. Built-in Web Server
-   Instantly launch a local HTTP server by clicking the **▶ Start Server** button in the sidebar.
-   The server uses the current project directory as its root.
-   All requests (`GET`, `POST`, etc.) are automatically logged to the terminal that was active when the server was started, showing status codes and response times.
-   Click the **⏹ Stop Server** button to terminate it.

### 7. HTVM Plugin API ("The Freedom API")
HT-IDE now features a powerful plugin system that allows developers to extend and redefine the HTVM language itself.
-   **Discover & Install:** Click the **Plugins** button in the sidebar to open the Plugin Manager. From here, you can browse the official **HTVM Marketplace** for community-created plugins.
-   **Activate & Manage:** Install plugins with a single click and activate the one you want to use for your current workspace. Only one plugin can be active at a time, allowing you to completely change the behavior of the transpiler.
-   **Create Your Own:** The plugin system is built on a simple but powerful JavaScript-based "Hook API". Check out the official [htvm-marketplace repository](https://github.com/TheMaster1127/htvm-marketplace) for documentation and examples on how to create and submit your own plugins.

### 8. Extensive Customization

Nearly every aspect of the IDE's appearance and behavior can be changed. Access these options via the **Settings** button.

#### General Settings
-   **Editor:** Change font size, keybinding mode (Vim, Emacs, VSCode, etc.), and other editor behaviors.
-   **Web Server:** Configure the default port and the default file to serve (e.g., `index.html`).
-   **Projects:** Set the default directory for new projects and manage project templates.
-   **Terminal & Autocomplete:** Toggle various helper features.

#### UI Theme Editor
-   A powerful theme editor allows you to change the color, font weight, and size of virtually every UI element, from buttons and sidebars to scrollbars and modal dialogs. Changes are previewed live.

#### Syntax Color Editor
-   Independently customize the colors and font styles for every token in the syntax highlighter (keywords, strings, comments, etc.).

#### Hotkey Customization
-   Remap the default keyboard shortcuts for actions like "Run File", "Save File", "Close Tab", and more to fit your personal workflow.

---

## Discord Integration
HT-IDE features Discord Rich Presence, which automatically shows your current status in your Discord profile. It displays:
-   That you are using HT-IDE.
-   The name of the file you are currently editing.
-   The project folder you are in.
-   The total number of lines in the current file.

---

## Default Hotkeys

| Action | Default Hotkey | Notes |
| :--- | :--- | :--- |
| **New Project** | **`Ctrl + N`** | **Must be pressed while the Settings menu is open.** |
| Run File | `Ctrl + Enter` / `F5` | `F5` is a secondary, non-customizable hotkey. |
| Compile File | `Ctrl + F7` | Requires a `.htpc` property file. |
| Save File | `Ctrl + S` | |
| Format HTVM File | `Ctrl + Shift + F` | Only works on `.htvm` files. |
| HTVM Line Mapper | `Ctrl + Alt + M` | |
| Close Tab | `Ctrl + W` | |
| Re-open Last Closed Tab &nbsp; &nbsp; | `Ctrl + Shift + T` &nbsp; &nbsp; | |
| Toggle Sidebar | `Ctrl + B` | |
| Zoom In | `Ctrl + =` | |
| Zoom Out | `Ctrl + -` | |

---

## Project Structure
<details>
<summary>Click to view the project's directory structure</summary>

```
╔═════════════════════════════════════════════════════════════════════════════╗
║                      HT-IDE Electron Project Structure                      ║
╚═════════════════════════════════════════════════════════════════════════════╝
[HT-IDE_ROOT]/
├── 📦 package.json             // Defines the project, dependencies (Electron), and scripts.
├── 📦 package-lock.json        // Locks dependency versions for consistent installs.
│
├── 🚀 electron_main.js         // The main process entry point for the desktop app (Node.js backend).
├── 🌉 preload.js                // Securely bridges the backend (Node.js) and frontend.
│
├── 🌐 HT-IDE.html               // The main application skeleton (Renderer Process UI).
├── 🎨 style.css                 // All visual styling, colors, and layout.
│
├── 📜 HTVM.js                   // The core compiler engine. (HTVM)
├── 📜 htvm-mode.js              // Ace Editor syntax highlighting rules for .htvm files.
├── 📜 htvm_completions.js       // Autocomplete data for the editor.
│
├── 📝 README.md                 // Project description and instructions.
├── 📝 LICENCE                   // The project's license file.
├── 🖼️ icon.png                   // The application and browser tab icon.
│
├── 📁 node_modules/             // Directory for all project dependencies (managed by npm).
│
├── 📁 property files/           // For custom compile/run commands (.htpc, .htpr).
│
├── 📁 js/                       // All application logic (Renderer), loaded in order.
│   ├── 📜 0_htvm_io.js            // Defines the global `FileRead` function for compiler imports and plugin hooks.
│   ├── 📜 0_storage_init.js       // Intercepts localStorage calls and redirects them to the backend.
│   ├── 📜 1_state.js              // Global variables (the app's central memory).
│   ├── 📜 2_autocomplete_keywords.js   // All autocomplete keywords for non HTVM langs.
│   ├── 📜 2_config_and_utils.js   // Shared "toolbox" and configuration data.
│   ├── 📜 2_config_and_utils_reset_htvm.js   // The function to reset the HTVM vars.
│   ├── 📜 3_ui.js                 // Renders and updates the UI (file list, tabs).
│   ├── 📜 4_filesystem.js         // Manages file system calls via the preload bridge.
│   ├── 📜 5_editor.js             // Controls the Ace Editor and file sessions (the "Brain").
│   ├── 📜 6_htvm.js               // Integrates your HTVM engine with the IDE.
│   ├── 📜 7_modals_1.js           // Logic for Core modals (Session, Settings).
│   ├── 📜 7_modals_2.js           // Logic for Instruction Set modals.
│   ├── 📜 7_modals_3.js           // Logic for the Debugger modal.
│   ├── 📜 7_modals_4_plugins.js   // Logic for the Plugin Manager modal.
│   └── 📜 8_main.js               // App entry point, wires everything together (the "Conductor").
│
└── 📁 images/                   // Icons for the language selector dropdown.
    ├── 🖼️ ahk.png
    ├── 🖼️ cpp.png
    ├── 🖼️ csharp.png
    ├── 🖼️ dart.png
    ├── 🖼️ go.png
    ├── 🖼️ groovy.png
    ├── 🖼️ java.png
    ├── 🖼️ js.png
    ├── 🖼️ kotlin.png
    ├── 🖼️ lua.png
    ├── 🖼️ nim.png
    ├── 🖼️ python.png
    ├── 🖼️ ruby.png
    ├── 🖼️ swift.png
    └── 🖼️ ts.png
```

</details>

---

## License

This project is licensed under the GNU General Public License v3.0. Please see the `LICENSE` file in the root directory of the repository for the full license text.

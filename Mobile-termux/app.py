import os
import sys
import struct
import threading
import subprocess
import http.server
import socketserver
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit

# --- Platform-specific imports ---
IS_WINDOWS = sys.platform.startswith("win")

if not IS_WINDOWS:
    import fcntl
    import termios
    import pty
else:
    # Provide dummy replacements for cross-platform compatibility
    fcntl = termios = pty = None

# --- Configuration ---
# MODIFIED: Tell Flask to use the current directory '.' for templates and static files.
# static_url_path='' ensures that when the browser requests '/style.css', Flask looks for './style.css'
# instead of the default '/static/style.css'.
app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret-key-for-ht-ide!'
socketio = SocketIO(app, async_mode='gevent')

ROOT_DIR = os.getcwd()
print(f"Serving HT-IDE from root directory: {ROOT_DIR}")

# --- Global State ---
terminal_processes = {}
http_server_thread = None
http_server_instance = None

# --- Terminal Helper Functions ---
def set_winsize(fd, row, col, xpix=0, ypix=0):
    if IS_WINDOWS:
        return
    winsize = struct.pack("HHHH", row, col, xpix, ypix)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def read_and_forward_pty_output(fd, sid, terminal_id):
    if IS_WINDOWS:
        return

    while True:
        try:
            data = os.read(fd, 1024)
            if data:
                socketio.emit('terminal_output', {'terminalId': terminal_id, 'data': data.decode(errors='ignore')}, room=sid)
            else:
                break
        except OSError:
            break

    socketio.emit('terminal_close', {'terminalId': terminal_id}, room=sid)
    if terminal_id in terminal_processes:
        del terminal_processes[terminal_id]

# --- Core Routes ---
@app.route('/')
def index():
    return render_template('HT-IDE.html')

# MODIFIED: This route is now handled by the static_folder configuration above.
# It can be kept for clarity or removed.
# @app.route('/<path:filepath>')
# def serve_static(filepath):
#     return send_from_directory(ROOT_DIR, filepath)

# --- Filesystem API ---
def is_safe_path(basedir, path, follow_symlinks=True):
    if follow_symlinks:
        # Normalize both paths to avoid comparison issues
        return os.path.normpath(os.path.realpath(path)).startswith(os.path.normpath(basedir))
    return os.path.normpath(os.path.abspath(path)).startswith(os.path.normpath(basedir))

@app.route('/api/fs/list', methods=['POST'])
def fs_list():
    data = request.json
    dir_path = data.get('path', '/')

    # Sanitize the input path
    dir_path = os.path.normpath(dir_path).lstrip('/')

    if dir_path == '.':
        abs_path = ROOT_DIR
    else:
        abs_path = os.path.join(ROOT_DIR, dir_path)

    if not is_safe_path(ROOT_DIR, abs_path):
        return jsonify({"error": "Access denied"}), 403

    try:
        items = []
        with os.scandir(abs_path) as it:
            for entry in it:
                # Use a relative path from the root for the 'path' key
                rel_path = os.path.relpath(entry.path, ROOT_DIR).replace("\\", "/")
                items.append({
                    "name": entry.name,
                    "path": rel_path if rel_path != '.' else '/',
                    "isFile": entry.is_file()
                })
        return jsonify(items)
    except FileNotFoundError:
        return jsonify([])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/fs/get', methods=['POST'])
def fs_get():
    data = request.json
    file_path = data.get('path')
    abs_path = os.path.join(ROOT_DIR, file_path)

    if not is_safe_path(ROOT_DIR, abs_path):
        return jsonify({"error": "Access denied"}), 403

    try:
        with open(abs_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"content": None, "error": str(e)}), 500

@app.route('/api/fs/save', methods=['POST'])
def fs_save():
    data = request.json
    file_path = data.get('path')
    content = data.get('content', '')
    abs_path = os.path.join(ROOT_DIR, file_path)

    if not is_safe_path(ROOT_DIR, os.path.dirname(abs_path)):
        return jsonify({"error": "Access denied"}), 403

    try:
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/fs/create', methods=['POST'])
def fs_create():
    data = request.json
    item_path = data.get('path')
    is_file = data.get('isFile')
    abs_path = os.path.join(ROOT_DIR, item_path)

    if not is_safe_path(ROOT_DIR, os.path.dirname(abs_path)):
        return jsonify({"error": "Access denied"}), 403

    try:
        if is_file:
            with open(abs_path, 'w') as f:
                f.write('')
        else:
            os.makedirs(abs_path, exist_ok=True)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/fs/delete', methods=['POST'])
def fs_delete():
    data = request.json
    item_path = data.get('path')
    is_file = data.get('isFile')
    abs_path = os.path.join(ROOT_DIR, item_path)

    if not is_safe_path(ROOT_DIR, abs_path):
        return jsonify({"error": "Access denied"}), 403

    try:
        if is_file:
            os.remove(abs_path)
        else:
            import shutil
            shutil.rmtree(abs_path)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# --- HTTP Server API ---
@app.route('/api/http_server/toggle', methods=['POST'])
def toggle_http_server():
    global http_server_thread, http_server_instance

    if http_server_thread and http_server_thread.is_alive():
        http_server_instance.shutdown()
        http_server_thread.join()
        http_server_thread = None
        http_server_instance = None
        return jsonify({"status": "stopped"})
    else:
        data = request.json
        port = data.get('port', 8080)
        root_path_rel = data.get('rootPath', '')
        
        # Ensure the root path for the server is also within the main project directory
        root_path_abs = os.path.join(ROOT_DIR, root_path_rel.lstrip('/'))
        if not is_safe_path(ROOT_DIR, root_path_abs):
            return jsonify({"status": "error", "message": "Invalid server root path."}), 403

        handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(*args, directory=root_path_abs, **kwargs)

        try:
            http_server_instance = socketserver.TCPServer(("", port), handler)
        except OSError as e:
            return jsonify({"status": "error", "message": f"Port {port} is already in use."})

        http_server_thread = threading.Thread(target=http_server_instance.serve_forever, daemon=True)
        http_server_thread.start()
        return jsonify({"status": "started", "port": port})

# --- Terminal Socket.IO ---
@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    for term_id, proc_info in list(terminal_processes.items()):
        if proc_info['sid'] == request.sid:
            try:
                os.kill(proc_info['child_pid'], 15)  # SIGTERM
            except Exception:
                pass
            if term_id in terminal_processes:
                del terminal_processes[term_id]

@socketio.on('terminal_start')
def handle_terminal_start(data):
    terminal_id = data.get('terminalId')

    if IS_WINDOWS:
        socketio.emit('terminal_output', {'terminalId': terminal_id, 'data': "\r\n\x1b[31mError: Interactive terminal is not supported on Windows.\x1b[0m\r\n"})
        socketio.emit('terminal_close', {'terminalId': terminal_id})
        return

    cwd = data.get('cwd', '/')
    abs_cwd = os.path.join(ROOT_DIR, cwd.lstrip('/'))

    if not is_safe_path(ROOT_DIR, abs_cwd):
        emit('terminal_output', {'terminalId': terminal_id, 'data': f'\r\nError: Invalid working directory.\r\n'})
        return

    if terminal_id in terminal_processes:
        return

    (child_pid, fd) = pty.fork()

    if child_pid == 0:
        env = os.environ.copy()
        env['PS1'] = ''
        os.chdir(abs_cwd)
        subprocess.run(os.environ.get("SHELL", "bash"), env=env)
        sys.exit(0)
    else:
        terminal_processes[terminal_id] = {
            'fd': fd,
            'child_pid': child_pid,
            'sid': request.sid
        }
        output_thread = threading.Thread(target=read_and_forward_pty_output, args=(fd, request.sid, terminal_id), daemon=True)
        output_thread.start()

@socketio.on('terminal_input')
def handle_terminal_input(data):
    if IS_WINDOWS: return
    terminal_id = data.get('terminalId')
    input_data = data.get('data')

    if terminal_id in terminal_processes:
        os.write(terminal_processes[terminal_id]['fd'], input_data.encode())

@socketio.on('terminal_kill')
def handle_terminal_kill(data):
    if IS_WINDOWS: return
    terminal_id = data.get('terminalId')
    if terminal_id in terminal_processes:
        try:
            os.kill(terminal_processes[terminal_id]['child_pid'], 15)  # SIGTERM
        except ProcessLookupError:
            pass
        if terminal_id in terminal_processes:
            del terminal_processes[terminal_id]

if __name__ == '__main__':
    print("Starting HT-IDE Flask Server...")
    print("Open http://127.0.0.1:5555 in your browser.")
    socketio.run(app, host='127.0.0.1', port=5555, debug=False)
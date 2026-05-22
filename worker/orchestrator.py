"""
GoldBook MT5 Parallel Orchestrator
====================================
Runs on your 24GB Oracle ARM Ubuntu VPS.
Does NOT use the MetaTrader5 Python package.
Instead: launches the native Linux MT5 terminal as a subprocess
for EACH account in PARALLEL — all accounts sync simultaneously.

With 24GB RAM:
  - Each MT5 instance uses ~175 MB RAM
  - 20 users × 175 MB = 3.5 GB total
  - All 20 run at the same time → full sync in ~25-35 seconds ✅

SETUP:
  pip install requests python-dotenv
  sudo bash setup_ubuntu.sh   (installs Xvfb + MT5 Linux terminal)

ENV (.env file):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  API_BASE                   e.g. https://yourdomain.com/api
  GOLDBOOK_API_URL            e.g. https://yourdomain.com/api/ea-sync
  WORKER_SECRET
  MT5_BINARY                 default: /usr/bin/mt5
  MT5_DATA_ROOT              default: /opt/mt5data
  DISPLAY                    default: :99
  SYNC_INTERVAL_SECONDS      default: 30
  MT5_TIMEOUT_SECONDS        default: 90
  MAX_PARALLEL               default: 50 (cap on simultaneous MT5 processes)
"""

import os
import time
import shutil
import logging
import subprocess
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import requests

# Sequential execution lock to prevent colliding runs in the global directory
global_sync_lock = threading.Lock()

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ["SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
API_BASE       = os.environ["API_BASE"]
WORKER_SECRET  = os.environ["WORKER_SECRET"]
GOLDBOOK_URL   = os.environ.get("GOLDBOOK_API_URL", f"{API_BASE}/ea-sync")
MT5_BINARY     = os.environ.get("MT5_BINARY", "/usr/bin/mt5")
wineprefix     = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
MT5_DATA_ROOT  = wineprefix / "drive_c" / "mt5data"
DISPLAY        = os.environ.get("DISPLAY", ":99")
SYNC_INTERVAL  = int(os.environ.get("SYNC_INTERVAL_SECONDS", "30"))
MT5_TIMEOUT    = int(os.environ.get("MT5_TIMEOUT_SECONDS", "90"))
MAX_PARALLEL   = int(os.environ.get("MAX_PARALLEL", "50"))

# Path to the GoldBookSync.mq5 script (same folder as this file)
SCRIPT_SRC = Path(__file__).parent / "GoldBookSync.mq5"

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("goldbook")

SUPA_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
    "Content-Type": "application/json",
}

def _read_text_with_bom(path: Path) -> tuple[str, str, bytes]:
    data = path.read_bytes()
    if data.startswith(b"\xff\xfe"):
        return data[2:].decode("utf-16le", errors="ignore"), "utf-16le", b"\xff\xfe"
    if data.startswith(b"\xfe\xff"):
        return data[2:].decode("utf-16be", errors="ignore"), "utf-16be", b"\xfe\xff"
    if data.startswith(b"\xef\xbb\xbf"):
        return data.decode("utf-8-sig", errors="ignore"), "utf-8", b"\xef\xbb\xbf"
    try:
        return data.decode("utf-8", errors="strict"), "utf-8", b""
    except UnicodeDecodeError:
        return data.decode("latin-1", errors="ignore"), "latin-1", b""


def _write_text_with_bom(path: Path, text: str, encoding: str, bom: bytes):
    raw = text.encode(encoding, errors="ignore")
    path.write_bytes(bom + raw)

def find_file_case_insensitive(directory: Path, filename: str) -> Path:
    if not directory.exists():
        return directory / filename
    filename_lower = filename.lower()
    try:
        for name in os.listdir(directory):
            if name.lower() == filename_lower:
                return directory / name
    except Exception:
        pass
    return directory / filename


def ensure_common_ini(common_ini: Path, acc: dict):
    """
    Make sure common.ini contains the correct [Common] Login/Password/Server values
    without destroying other sections (notably WebRequest allowlist in [Experts]).
    """
    login = acc["mt5_login"]
    password = acc["investor_password"]
    server = acc["broker_server"]

    if not common_ini.exists():
        content = (
            "[Common]\r\n"
            f"Login={login}\r\n"
            f"Password={password}\r\n"
            f"Server={server}\r\n"
            "AutoConfirm=1\r\n"
        )
        # MT config files are commonly UTF-16LE with BOM ("Unicode" in Windows terms).
        common_ini.write_bytes(b"\xff\xfe" + content.encode("utf-16le"))
        return

    try:
        text, encoding, bom = _read_text_with_bom(common_ini)
    except Exception:
        return

    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines()

    out: list[str] = []
    in_common = False
    seen_login = False
    seen_password = False
    seen_server = False

    def _flush_missing():
        nonlocal seen_login, seen_password, seen_server
        if not seen_login:
            out.append(f"Login={login}")
            seen_login = True
        if not seen_password:
            out.append(f"Password={password}")
            seen_password = True
        if not seen_server:
            out.append(f"Server={server}")
            seen_server = True

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            if in_common:
                _flush_missing()
            in_common = stripped.lower() == "[common]"
            out.append(line)
            continue

        if in_common:
            low = stripped.lower()
            if low.startswith("login="):
                out.append(f"Login={login}")
                seen_login = True
                continue
            if low.startswith("password="):
                out.append(f"Password={password}")
                seen_password = True
                continue
            if low.startswith("server="):
                out.append(f"Server={server}")
                seen_server = True
                continue

        out.append(line)

    if in_common:
        _flush_missing()

    new_text = newline.join(out) + newline
    try:
        _write_text_with_bom(common_ini, new_text, encoding, bom)
    except Exception:
        pass

# ── Supabase helpers ───────────────────────────────────────────────────────────
def fetch_active_accounts() -> list[dict]:
    try:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/mt5_accounts",
            params={"is_active": "eq.true", "select": "*"},
            headers=SUPA_HEADERS,
            timeout=10,
        )
        if res.status_code == 200:
            return res.json()
        log.error(f"Supabase fetch error {res.status_code}: {res.text}")
    except Exception as e:
        log.error(f"fetch_active_accounts failed: {e}")
    return []


def report_error(account_id: str, error_message: str):
    """Tell the API this account's login failed so the UI shows an error."""
    try:
        requests.post(
            f"{API_BASE}/trade-data",
            json={
                "type": "account_error",
                "account_id": account_id,
                "error_message": error_message,
                "worker_secret": WORKER_SECRET,
            },
            timeout=8,
        )
    except Exception:
        pass


def delete_examples_dirs(root_dir: Path):
    """Recursively deletes all directories named 'examples' (case-insensitive) under root_dir."""
    if not root_dir.exists():
        return
    try:
        for root, dirs, files in os.walk(str(root_dir)):
            for d in dirs:
                if d.lower() == "examples":
                    full_path = Path(root) / d
                    try:
                        shutil.rmtree(full_path, ignore_errors=True)
                        log.info(f"Deleted examples directory: {full_path}")
                    except Exception as e:
                        log.warning(f"Failed to delete examples directory {full_path}: {e}")
    except Exception as e:
        log.warning(f"Error walking directory {root_dir} to delete examples: {e}")


# ── Per-account MT5 data directory ────────────────────────────────────────────
def prepare_data_dir(acc: dict, acc_wineprefix: Path) -> Path:
    """
    Create an isolated portable data dir for this MT5 account inside its isolated WINEPREFIX.
    Replicates the main MetaTrader 5 installation into this directory
    so it can be run as a true standalone portable sandbox.
    """
    data_dir = acc_wineprefix / "drive_c" / "mt5data" / str(acc["id"])
    global_wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
    global_install_dir = global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"

    # Replicate the full MT5 install into the data folder if terminal64.exe doesn't exist
    terminal_path = find_file_case_insensitive(data_dir, "terminal64.exe")
    if not terminal_path.exists():
        terminal_path = find_file_case_insensitive(data_dir, "terminal.exe")

    if not terminal_path.exists() and global_install_dir.exists():
        log.info(f"[{acc['mt5_login']}] Replicating MT5 installation to isolated directory: {data_dir}")
        shutil.copytree(global_install_dir, data_dir, dirs_exist_ok=True)

    # Force delete default examples recursively and case-insensitively inside the isolated data directory
    delete_examples_dirs(data_dir)

    # Delete Sounds directory to keep the terminal completely silent
    sounds_dir = data_dir / "Sounds"
    if sounds_dir.exists():
        shutil.rmtree(sounds_dir, ignore_errors=True)

    scripts_dir = data_dir / "MQL5" / "Scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    # Place sync script
    dst_script = scripts_dir / "GoldBookSync.mq5"
    if SCRIPT_SRC.exists():
        shutil.copy2(SCRIPT_SRC, dst_script)

    # Copy global whitelisted terminal.ini and settings.ini to both config and Config folders.
    # In portable mode each account has its own data dir, so we replicate the WebRequest whitelist
    # (and other terminal settings) from the main MT5 install.
    #
    # You can override the detection by setting MT5_GLOBAL_CONFIG_PATH in the worker .env.
    global_config_path = None
    candidates = []
    if os.environ.get("MT5_GLOBAL_CONFIG_PATH"):
        candidates.append(Path(os.environ["MT5_GLOBAL_CONFIG_PATH"]))

    candidates.append(global_install_dir / "Config")
    candidates.append(global_install_dir / "config")
    candidates.append(global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5" / "Config")
    candidates.append(global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5" / "config")
    candidates.append(Path.home() / ".mt5" / "drive_c" / "Program Files" / "MetaTrader 5" / "Config")
    candidates.append(Path.home() / ".mt5" / "drive_c" / "Program Files" / "MetaTrader 5" / "config")

    for p in candidates:
        try:
            if p and p.exists():
                global_config_path = p
                break
        except Exception:
            continue
            
    if global_config_path:
        log.info(f"[{acc['mt5_login']}] Found global config folder at: {global_config_path}")
    else:
        log.warning(f"[{acc['mt5_login']}] ⚠️ Global MT5 config folder not found! Whitelist files will NOT be copied to the portable instance.")
    
    for folder_name in ["config", "Config"]:
        c_dir = data_dir / folder_name
        c_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy terminal settings from the main MT5 install so portable instances inherit:
        # - WebRequest allowlist (often stored in common.ini or experts.ini depending on build)
        # - terminal/window defaults, etc.
        if global_config_path and global_config_path.exists():
            for file_name in ["terminal.ini", "settings.ini", "common.ini", "experts.ini"]:
                src_file = global_config_path / file_name
                if src_file.exists():
                    shutil.copy2(src_file, c_dir / file_name)

        # Ensure the per-account Login/Password/Server are set without losing
        # other settings like the WebRequest allowlist.
        ensure_common_ini(c_dir / "common.ini", acc)

    return data_dir


def harvest_logs(data_dir: Path, login: str) -> str:
    """
    Harvests the last 40 lines of the latest MT5 terminal logs and MQL5 logs
    to diagnose connection, execution, or environment issues.
    """
    harvested = []
    
    # 1. MQL5 Script Logs
    mql_candidates = [
        data_dir / "MQL5" / "Logs",
        data_dir / "MQL5" / "logs",
        data_dir / "mql5" / "Logs",
        data_dir / "mql5" / "logs"
    ]
    mql_logs_dir = None
    for d in mql_candidates:
        if d.exists():
            mql_logs_dir = d
            break
            
    if mql_logs_dir:
        log_files = []
        try:
            for p in mql_logs_dir.iterdir():
                if p.is_file() and p.name.lower().endswith(".log"):
                    log_files.append(p)
        except Exception:
            pass
        log_files = sorted(log_files, key=lambda f: f.stat().st_mtime)
        if log_files:
            latest_file = log_files[-1]
            try:
                text, _, _ = _read_text_with_bom(latest_file)
                lines = text.splitlines()[-40:]
                harvested.append(f"--- MQL5 Script Logs ({latest_file.name}) ---")
                harvested.extend(lines)
            except Exception as e:
                harvested.append(f"Failed to read MQL5 log {latest_file.name}: {e}")
                
    # 2. MT5 Terminal Logs
    term_candidates = [
        data_dir / "Logs",
        data_dir / "logs"
    ]
    term_logs_dir = None
    for d in term_candidates:
        if d.exists():
            term_logs_dir = d
            break
            
    if term_logs_dir:
        log_files = []
        try:
            for p in term_logs_dir.iterdir():
                if p.is_file() and p.name.lower().endswith(".log"):
                    log_files.append(p)
        except Exception:
            pass
        log_files = sorted(log_files, key=lambda f: f.stat().st_mtime)
        if log_files:
            latest_file = log_files[-1]
            try:
                text, _, _ = _read_text_with_bom(latest_file)
                lines = text.splitlines()[-40:]
                harvested.append(f"--- MT5 Terminal Logs ({latest_file.name}) ---")
                harvested.extend(lines)
            except Exception as e:
                harvested.append(f"Failed to read Terminal log {latest_file.name}: {e}")
                
    if not harvested:
        return f"[{login}] No MT5 log files found in isolated sandbox."
        
    return "\n".join(harvested)


# ── Single account sync (runs in its own thread) ──────────────────────────────
def sync_account(acc: dict) -> dict:
    """
    Launches a dedicated MT5 terminal process for this account using Hangover 11.4.
    Uses File Polling: The MT5 script writes to sync_result.json, and this Python
    script reads it and sends it to the API. This bypasses all Wine HTTP bugs!
    """
    import os, signal, json
    
    login      = acc.get("mt5_login", "?")
    password   = acc.get("investor_password", "")
    server     = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping")
        report_error(account_id, "Missing sync token configuration on backend.")
        return {"login": login, "status": "skipped", "reason": "no sync_token"}

    # Resolve global MT5 directories
    global_wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
    global_install_dir = global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"

    acc_wineprefix = Path(os.environ.get("HOME", str(Path.home()))) / ".mt5_sandboxes" / account_id

    # Ensure isolated WINEPREFIX is initialized by copying the master prefix
    if not acc_wineprefix.exists():
        log.info(f"[{login}] Creating fresh isolated WINEPREFIX by replicating master prefix to {acc_wineprefix} ...")
        try:
            acc_wineprefix.parent.mkdir(parents=True, exist_ok=True)
            shutil.copytree(global_wineprefix, acc_wineprefix, symlinks=True)
            # Remove any old account data directories copied from the master prefix
            shutil.rmtree(acc_wineprefix / "drive_c" / "mt5data", ignore_errors=True)
        except Exception as e:
            log.error(f"[{login}] Failed to replicate master WINEPREFIX: {e}")
            report_error(account_id, f"Failed to initialize isolated WINEPREFIX: {e}")
            return {"login": login, "status": "error", "reason": f"prefix_replication_failed: {e}"}

    with global_sync_lock:
        try:
            # 1. Place the GoldBookSync.mq5 script directly into the global Scripts folder
            scripts_dir = global_install_dir / "MQL5" / "Scripts"
            scripts_dir.mkdir(parents=True, exist_ok=True)
            dst_script = scripts_dir / "GoldBookSync.mq5"
            dst_ex5 = scripts_dir / "GoldBookSync.ex5"
            
            should_compile = False
            if SCRIPT_SRC.exists():
                src_content = SCRIPT_SRC.read_bytes()
                if not dst_script.exists() or dst_script.read_bytes() != src_content:
                    shutil.copy2(SCRIPT_SRC, dst_script)
                    should_compile = True
            
            # Pre-compile the script ahead of time using Hangover 11.4 wine64
            metaeditor_path = find_file_case_insensitive(global_install_dir, "metaeditor64.exe")
            if not metaeditor_path.exists():
                metaeditor_path = find_file_case_insensitive(global_install_dir, "metaeditor.exe")

            if not dst_ex5.exists() or should_compile:
                log.info(f"[{login}] Pre-compiling GoldBookSync.mq5 with Hangover native compilation ahead of time...")
                comp_env = os.environ.copy()
                comp_env["DISPLAY"] = DISPLAY
                comp_env["WINEPREFIX"] = str(global_wineprefix)
                comp_env["HOME"] = os.environ.get("HOME", str(Path.home()))
                comp_env["USER"] = os.environ.get("USER", "ubuntu")
                comp_cmd = [
                    "/usr/bin/wine",
                    str(metaeditor_path),
                    "/portable",
                    "/compile:MQL5\\Scripts\\GoldBookSync.mq5",
                    "/log"
                ]
                comp_stdout = ""
                comp_stderr = ""
                comp_rc = "N/A"
                try:
                    res = subprocess.run(
                        comp_cmd, 
                        env=comp_env, 
                        timeout=25, 
                        capture_output=True,
                        text=True,
                        cwd=str(global_install_dir)
                    )
                    comp_stdout = res.stdout or ""
                    comp_stderr = res.stderr or ""
                    comp_rc = res.returncode
                except Exception as e:
                    log.warning(f"[{login}] Ahead-of-time Hangover compilation failed to execute: {e}")
                    comp_stderr = str(e)

            # Verify compilation succeeded
            if not dst_ex5.exists():
                comp_log_path = None
                try:
                    for p in scripts_dir.iterdir():
                        if p.is_file() and p.name.lower() == "goldbooksync.log":
                            comp_log_path = p
                            break
                except Exception:
                    pass
                
                log_content = ""
                if comp_log_path and comp_log_path.exists():
                    try:
                        log_content, _, _ = _read_text_with_bom(comp_log_path)
                    except Exception as le:
                        log_content = f"(Failed to read compiler log: {le})"
                else:
                    files_in_install_dir = []
                    try:
                        import os
                        files_in_install_dir = os.listdir(str(global_install_dir))
                    except Exception as le:
                        files_in_install_dir = [f"Error listing dir: {le}"]
                        
                    log_content = (
                        f"(No compilation log file found next to GoldBookSync.mq5)\n"
                        f"Command run: {comp_cmd if 'comp_cmd' in locals() else 'N/A'}\n"
                        f"Return code: {comp_rc}\n"
                        f"Process stdout: {comp_stdout}\n"
                        f"Process stderr: {comp_stderr}\n"
                        f"Global install dir exists: {global_install_dir.exists()}\n"
                        f"MetaEditor path exists: {metaeditor_path.exists()} ({metaeditor_path})\n"
                        f"Scripts dir exists: {scripts_dir.exists()} ({scripts_dir})\n"
                        f"GoldBookSync.mq5 exists: {dst_script.exists()} ({dst_script})\n"
                        f"Files in install dir: {files_in_install_dir}\n"
                    )
                
                err_msg = f"Failed to compile GoldBookSync.mq5. MetaEditor log:\n{log_content}"
                log.error(f"[{login}] {err_msg}")
                report_error(account_id, err_msg)
                return {"login": login, "status": "error", "reason": f"compilation_failed: {err_msg}"}

        except Exception as e:
            log.error(f"[{login}] Failed preparing global configs: {e}")
            report_error(account_id, f"Configuration prep failed: {e}")
            return {"login": login, "status": "error", "reason": f"config_prep_failed: {e}"}

    # 2. Isolate Account in its own data directory! (Fixes MT5 parallel race conditions)
    data_dir = prepare_data_dir(acc, acc_wineprefix)
    
    # Copy the compiled .ex5 to the isolated directory
    isolated_scripts = data_dir / "MQL5" / "Scripts"
    isolated_scripts.mkdir(parents=True, exist_ok=True)
    if dst_ex5.exists():
        shutil.copy2(dst_ex5, isolated_scripts / "GoldBookSync.ex5")

    # 3. Write sync_config.txt to the isolated directory
    files_dir = data_dir / "MQL5" / "Files"
    files_dir.mkdir(parents=True, exist_ok=True)
    config_file = files_dir / "sync_config.txt"
    config_content = f"SyncToken={sync_token}\r\n"
    config_file.write_text(config_content, encoding="utf-8")
    
    # Ensure any old result file is deleted before we start
    result_file = files_dir / "sync_result.json"
    if result_file.exists():
        result_file.unlink()

    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    env["WINEPREFIX"] = str(acc_wineprefix)
    env["WINEDLLOVERRIDES"] = "mscoree,mshtml="
    env["HOME"] = os.environ.get("HOME", str(Path.home()))
    env["USER"] = os.environ.get("USER", "ubuntu")

    # Execute using the ISOLATED terminal via Hangover 11.4 wine64
    terminal_path = find_file_case_insensitive(data_dir, "terminal64.exe")
    if not terminal_path.exists():
        terminal_path = find_file_case_insensitive(data_dir, "terminal.exe")

    if not terminal_path.exists():
        raise FileNotFoundError(f"MT5 terminal executable not found in isolated directory: {data_dir}")

    # 4. Generate startup.ini inside data_dir containing both login credentials and startup options
    try:
        startup_ini = data_dir / "startup.ini"
        startup_content = (
            "[Common]\r\n"
            f"Login={login}\r\n"
            f"Password={password}\r\n"
            f"Server={server}\r\n"
            "AutoConfirm=1\r\n\r\n"
            "[StartUp]\r\n"
            "Script=GoldBookSync\r\n"
            "Symbol=EURUSD\r\n"
            "Period=M1\r\n"
        )
        startup_ini.write_bytes(b"\xff\xfe" + startup_content.encode("utf-16le"))
    except Exception as e:
        log.warning(f"[{login}] Failed to write startup.ini configuration file: {e}")

    # Use the absolute Windows path for the configuration file under Wine
    cmd = [
        "/usr/bin/wine",
        str(terminal_path),
        "/portable",
        f"/config:C:\\mt5data\\{account_id}\\startup.ini",
        "/skipupdate",
        "/nosplash",
    ]

    t_start = time.time()
    last_err_msg = ""
    try:
        proc = subprocess.Popen(
            cmd, env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True, # Critical to allow killing the entire process tree safely
            cwd=str(data_dir)
        )
        
        synced = False
        while time.time() - t_start < MT5_TIMEOUT:
            if result_file.exists():
                time.sleep(0.5) # Give MQL5 a moment to finish writing the file
                try:
                    # Read the massive JSON array dumped by MQL5
                    data_str = result_file.read_text(encoding="utf-8-sig")
                    payloads = json.loads(data_str)
                    
                    # POST each event to the API, mimicking the old WebRequest behavior
                    for item in payloads:
                        requests.post(
                            GOLDBOOK_URL, 
                            json=item, 
                            headers={"Content-Type": "application/json"},
                            timeout=10
                        )
                    synced = True
                    break
                except Exception as e:
                    last_err_msg = f"Error parsing or sending result JSON: {e}"
                    log.error(f"[{login}] {last_err_msg}")
                    break
            
            # If process died prematurely
            if proc.poll() is not None:
                last_err_msg = "MT5 terminal closed prematurely (possible crash, bad login details, or incorrect broker server)."
                log.warning(f"[{login}] {last_err_msg}")
                break
                
            time.sleep(1.0) # Poll every 1 second
 
        # Forcefully kill the entire process tree (wine64, terminal64.exe, wineserver)
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass

        # Forcefully kill the wineserver associated with this prefix to release all file locks
        try:
            env_ws = os.environ.copy()
            env_ws["WINEPREFIX"] = str(acc_wineprefix)
            subprocess.run(["wineserver", "-k"], env=env_ws, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            log.warning(f"[{login}] Failed to kill wineserver on cleanup: {e}")

        elapsed = round(time.time() - t_start, 1)

        if synced:
            log.info(f"✅ [{login}@{server}] Synced via file polling in {elapsed}s")
            return {"login": login, "status": "ok", "elapsed": elapsed}
        else:
            if not last_err_msg:
                last_err_msg = f"Sync timed out after {MT5_TIMEOUT} seconds (MT5 did not finish scanning or failed to connect)."
            
            # Harvest and output logs to console
            try:
                harvested_info = harvest_logs(data_dir, login)
                log.warning(f"⚠️  [{login}] MT5 Logs harvested:\n{harvested_info}")
                
                # Append a snippet of the latest log line if helpful
                latest_line = ""
                lines = harvested_info.splitlines()
                if lines:
                    for l in reversed(lines):
                        if l.strip() and not l.startswith("--- "):
                            latest_line = l.strip()
                            break
                if latest_line:
                    last_err_msg += f" Latest MT5 log: {latest_line}"
            except Exception as e:
                log.error(f"[{login}] Failed harvesting logs: {e}")

            # Self-healing: Delete the isolated data_dir so that it is cleanly re-replicated
            # from global_install_dir on the next run to avoid any corrupted state.
            if data_dir.exists():
                log.info(f"[{login}] Self-healing: Deleting isolated data directory due to sync failure...")
                shutil.rmtree(data_dir, ignore_errors=True)

            log.warning(f"⚠️  [{login}] Sync failed: {last_err_msg}")
            report_error(account_id, last_err_msg)
            return {"login": login, "status": "timeout", "reason": last_err_msg}

    except FileNotFoundError:
        # Self-healing in case it didn't copy correctly
        if data_dir.exists():
            shutil.rmtree(data_dir, ignore_errors=True)
        err_msg = f"MT5 terminal64.exe not found in isolated directory: {data_dir}"
        log.error(err_msg)
        report_error(account_id, err_msg)
        return {"login": login, "status": "error", "reason": "binary_not_found"}

    except Exception as e:
        # Self-healing in case of other unexpected file errors
        if data_dir.exists():
            shutil.rmtree(data_dir, ignore_errors=True)
        err_msg = f"Unexpected worker execution exception: {e}"
        log.error(f"[{login}] {err_msg}", exc_info=True)
        report_error(account_id, err_msg)
        return {"login": login, "status": "error", "reason": str(e)}


# ── Parallel sync cycle ────────────────────────────────────────────────────────
def run_cycle(accounts: list[dict]):
    """
    Launches sync_account() for ALL accounts simultaneously using a thread pool.
    On your 24GB Oracle VPS with 20 users:
      - 20 × ~175 MB RAM = 3.5 GB (well within 24 GB)
      - All accounts sync in parallel → full cycle in ~25-35 seconds
    """
    if not accounts:
        log.info("No active accounts to sync.")
        return

    # Cap parallelism to avoid overwhelming the system with hundreds of accounts
    workers = min(len(accounts), MAX_PARALLEL)
    log.info(f"▶ Syncing {len(accounts)} account(s) in parallel (workers={workers})")

    t_cycle_start = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(sync_account, acc): acc for acc in accounts}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                log.error(f"Thread exception: {e}")

    elapsed = round(time.time() - t_cycle_start, 1)
    ok    = sum(1 for r in results if r.get("status") == "ok")
    err   = len(results) - ok
    log.info(f"── Cycle done in {elapsed}s | ✅ {ok} ok | ❌ {err} errors ──\n")


# ── Xvfb launcher ─────────────────────────────────────────────────────────────
def ensure_xvfb():
    """Start Xvfb virtual display if not already running."""
    check = subprocess.run(["pgrep", "-x", "Xvfb"], capture_output=True)
    if check.returncode != 0:
        log.info(f"Starting Xvfb on {DISPLAY} ...")
        subprocess.Popen(
            ["Xvfb", DISPLAY, "-screen", "0", "1024x768x24"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(2)
    else:
        log.info(f"Xvfb already running on {DISPLAY}")


# ── Boost Stack Limit helper ──────────────────────────────────────────────────
def boost_stack_limit():
    try:
        import resource
        soft, hard = resource.getrlimit(resource.RLIMIT_STACK)
        
        # CRITICAL: We must set a finite target (e.g. 16MB) because a limit of RLIM_INFINITY (-1)
        # causes Box64 to choke on parsing and allocate a tiny 4KB (one page) stack!
        target = 16 * 1024 * 1024  # 16 MB
        
        if hard != resource.RLIM_INFINITY and hard < target:
            target = hard
            
        resource.setrlimit(resource.RLIMIT_STACK, (target, hard))
        log.info(f"Boosted process stack limit to {target // (1024*1024)}MB (finite limit to avoid Box64 infinity bug)")
    except Exception as e:
        log.warning(f"Could not boost process stack limit: {e}")


# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
    boost_stack_limit()
    ensure_xvfb()

    # Pre-clean the global MT5 install directory examples to prevent compiling them
    global_wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
    global_install_dir = global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"
    if global_install_dir.exists():
        log.info("Cleaning up global MT5 install examples directory ahead of time...")
        delete_examples_dirs(global_install_dir)

    log.info("🚀 GoldBook Parallel Orchestrator started")
    log.info(f"   MT5 binary     : {MT5_BINARY}")
    log.info(f"   API URL        : {GOLDBOOK_URL}")
    log.info(f"   Display        : {DISPLAY}")
    log.info(f"   Sync interval  : {SYNC_INTERVAL}s")
    log.info(f"   MT5 timeout    : {MT5_TIMEOUT}s per account")
    log.info(f"   Max parallel   : {MAX_PARALLEL}")
    log.info("")

    while True:
        try:
            accounts = fetch_active_accounts()
            run_cycle(accounts)
        except KeyboardInterrupt:
            log.info("Shutting down...")
            break
        except Exception as e:
            log.error(f"Cycle error: {e}", exc_info=True)

        time.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    main()

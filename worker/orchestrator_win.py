"""
GoldBook MT5 Windows Parallel Orchestrator
===========================================
Runs natively on your Windows PC.
Launches the native Windows MT5 terminal as a subprocess
for EACH account in PARALLEL — all accounts sync simultaneously.

SETUP:
  pip install requests python-dotenv
  Run directly: python worker/orchestrator_win.py

ENV (.env or .env.local file):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  API_BASE                   default: https://goldbook-roan.vercel.app/api
  GOLDBOOK_API_URL            default: https://goldbook-roan.vercel.app/api/ea-sync
  WORKER_SECRET
  MT5_PATH                   (Optional: Full path to terminal64.exe)
  POLL_INTERVAL              (Optional: interval in seconds, default: 30)
  MT5_TIMEOUT_SECONDS        (Optional: MT5 run timeout, default: 90)
"""

import os
import sys
import time
import shutil
import logging
import subprocess
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import requests

# Load environment configuration (support fallback to .env.local)
if os.path.exists(".env.local"):
    load_dotenv(".env.local")
else:
    load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", os.environ.get("SUPABASE_URL"))
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
API_BASE       = os.environ.get("API_BASE", "https://goldbook-roan.vercel.app/api")
WORKER_SECRET  = os.environ.get("WORKER_SECRET", "xauusd_on_top")
GOLDBOOK_URL   = os.environ.get("GOLDBOOK_API_URL", f"{API_BASE}/ea-sync")
SYNC_INTERVAL  = int(os.environ.get("POLL_INTERVAL", os.environ.get("SYNC_INTERVAL_SECONDS", "30")))
MT5_TIMEOUT    = int(os.environ.get("MT5_TIMEOUT_SECONDS", "90"))
MAX_PARALLEL   = int(os.environ.get("MAX_PARALLEL", "10"))

# Path to the GoldBookSync.mq5 script (same folder as this file)
SCRIPT_SRC = Path(__file__).parent / "GoldBookSync.mq5"

# Sequential execution lock to prevent compiler collision in global directory
global_sync_lock = threading.Lock()

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("goldbook_win")

if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment (.env / .env.local)!")
    sys.exit(1)

SUPA_HEADERS = {
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "apikey": SUPABASE_KEY,
    "Content-Type": "application/json",
}

# Helper to read text files with BOM
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


def delete_examples_dirs(root_dir: Path):
    """Recursively deletes all directories named 'examples' (case-insensitive) under root_dir."""
    if not root_dir.exists():
        return
    try:
        for root, dirs, _ in os.walk(str(root_dir)):
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


def detect_global_mt5() -> Path:
    """Detect MT5 installation directory on Windows."""
    # 1. Check user defined path in env
    if os.environ.get("MT5_PATH"):
        p = Path(os.environ["MT5_PATH"])
        if p.is_file():
            return p.parent
        if p.is_dir():
            return p

    # 2. Check standard paths
    candidates = [
        Path("C:/Program Files/MetaTrader 5"),
        Path("C:/Program Files (x86)/MetaTrader 5"),
    ]
    
    # 3. Check AppData local installations if any
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        candidates.append(Path(local_appdata) / "MetaTrader 5")

    for c in candidates:
        if (c / "terminal64.exe").exists() or (c / "terminal.exe").exists():
            return c
            
    # Hard fallback - ask user or fail
    log.error("❌ Could not auto-detect MetaTrader 5 installation directory!")
    log.error("Please set 'MT5_PATH' in your environment (.env / .env.local) to point to terminal64.exe")
    sys.exit(1)


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
    """Tell the API this account's sync failed so the UI shows an error."""
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


# ── Per-account MT5 isolated directory prep ────────────────────────────────────
def prepare_data_dir(acc: dict, global_install_dir: Path) -> Path:
    """
    Create a clean portable sandbox folder inside the worker subdirectory.
    """
    # Create isolated sandbox folder under worker/sandboxes/{account_id}
    sandboxes_root = Path(__file__).parent / "sandboxes"
    sandboxes_root.mkdir(exist_ok=True)
    
    data_dir = sandboxes_root / str(acc["id"])

    # Replicate the full MT5 install into the isolated sandbox if terminal64.exe doesn't exist
    terminal_path = data_dir / "terminal64.exe"
    if not terminal_path.exists():
        terminal_path = data_dir / "terminal.exe"

    if not terminal_path.exists():
        log.info(f"[{acc['mt5_login']}] Replicating MT5 installation to isolated sandbox: {data_dir}")
        shutil.copytree(global_install_dir, data_dir, dirs_exist_ok=True)

    # Clean default examples to prevent background compiling
    delete_examples_dirs(data_dir)

    # Create MQL5 Scripts directory
    scripts_dir = data_dir / "MQL5" / "Scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    # Place sync script source
    dst_script = scripts_dir / "GoldBookSync.mq5"
    if SCRIPT_SRC.exists():
        shutil.copy2(SCRIPT_SRC, dst_script)

    # Copy master Config folder to isolated directory
    global_config = global_install_dir / "Config"
    if not global_config.exists():
        global_config = global_install_dir / "config"

    for folder in ["config", "Config"]:
        c_dir = data_dir / folder
        c_dir.mkdir(exist_ok=True)
        if global_config.exists():
            for f in ["terminal.ini", "settings.ini", "common.ini", "experts.ini"]:
                src_file = global_config / f
                if src_file.exists():
                    shutil.copy2(src_file, c_dir / f)

    return data_dir


def harvest_logs(data_dir: Path, login: str) -> str:
    harvested = []
    
    # 1. MQL5 Script Logs
    mql_logs_dir = data_dir / "MQL5" / "Logs"
    if not mql_logs_dir.exists():
        mql_logs_dir = data_dir / "MQL5" / "logs"
        
    if mql_logs_dir.exists():
        log_files = sorted(list(mql_logs_dir.glob("*.log")), key=lambda f: f.stat().st_mtime)
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
    term_logs_dir = data_dir / "Logs"
    if not term_logs_dir.exists():
        term_logs_dir = data_dir / "logs"
        
    if term_logs_dir.exists():
        log_files = sorted(list(term_logs_dir.glob("*.log")), key=lambda f: f.stat().st_mtime)
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


# ── Single account sync (runs in thread) ───────────────────────────────────────
def sync_account(acc: dict, global_install_dir: Path) -> dict:
    import json
    
    login      = acc.get("mt5_login", "?")
    password   = acc.get("investor_password", "")
    server     = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping")
        report_error(account_id, "Missing sync token configuration on backend.")
        return {"login": login, "status": "skipped", "reason": "no sync_token"}

    with global_sync_lock:
        try:
            # Prepare script in global directory to compile it natively
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
            
            metaeditor_path = global_install_dir / "metaeditor64.exe"
            if not metaeditor_path.exists():
                metaeditor_path = global_install_dir / "metaeditor.exe"

            # Native pre-compilation
            if not dst_ex5.exists() or should_compile:
                log.info(f"[{login}] Pre-compiling GoldBookSync.mq5 natively using MetaEditor...")
                comp_cmd = [
                    str(metaeditor_path),
                    "/portable",
                    "/compile:MQL5\\Scripts\\GoldBookSync.mq5",
                    "/log"
                ]
                try:
                    subprocess.run(comp_cmd, timeout=20, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=str(global_install_dir))
                except Exception as e:
                    log.warning(f"[{login}] Native compilation execution failed: {e}")

            if not dst_ex5.exists():
                err_msg = "Failed to compile GoldBookSync.mq5 natively in global directory. Check MetaEditor files."
                log.error(f"[{login}] {err_msg}")
                report_error(account_id, err_msg)
                return {"login": login, "status": "error", "reason": "compilation_failed"}

        except Exception as e:
            log.error(f"[{login}] Master script preparation failed: {e}")
            report_error(account_id, f"Configuration prep failed: {e}")
            return {"login": login, "status": "error", "reason": str(e)}

    # Prepare sandbox data directory
    data_dir = prepare_data_dir(acc, global_install_dir)
    
    # Copy native compiled .ex5 to sandbox MQL5 Scripts
    isolated_scripts = data_dir / "MQL5" / "Scripts"
    isolated_scripts.mkdir(parents=True, exist_ok=True)
    if dst_ex5.exists():
        shutil.copy2(dst_ex5, isolated_scripts / "GoldBookSync.ex5")

    # Write config file inside sandbox Files folder
    files_dir = data_dir / "MQL5" / "Files"
    files_dir.mkdir(parents=True, exist_ok=True)
    
    config_file = files_dir / "sync_config.txt"
    config_file.write_text(f"SyncToken={sync_token}\r\n", encoding="utf-8")
    
    result_file = files_dir / "sync_result.json"
    if result_file.exists():
        result_file.unlink()

    # Generate startup.ini configuration file
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
        log.warning(f"[{login}] Failed to generate startup.ini: {e}")

    terminal_path = data_dir / "terminal64.exe"
    if not terminal_path.exists():
        terminal_path = data_dir / "terminal.exe"

    # Command line options to run portable headlessly
    cmd = [
        str(terminal_path),
        "/portable",
        "/config:startup.ini",
        "/skipupdate",
        "/nosplash",
    ]

    t_start = time.time()
    last_err_msg = ""
    proc = None
    try:
        # Launch native Windows terminal minimized
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 6  # SW_MINIMIZE

        proc = subprocess.Popen(
            cmd,
            startupinfo=startupinfo,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=str(data_dir)
        )
        
        synced = False
        while time.time() - t_start < MT5_TIMEOUT:
            if result_file.exists():
                time.sleep(0.5) # Wait for file lock release
                try:
                    data_str = result_file.read_text(encoding="utf-8-sig")
                    payloads = json.loads(data_str)
                    
                    # POST results
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
                    last_err_msg = f"Error reading or sending sync payloads: {e}"
                    log.error(f"[{login}] {last_err_msg}")
                    break
            
            if proc.poll() is not None:
                last_err_msg = "MT5 terminal closed unexpectedly."
                break
                
            time.sleep(1.0)

        # Force kill the terminal process
        try:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(2)
        except Exception:
            pass
            
        try:
            if proc.poll() is None:
                # Force kill via Windows command line taskkill
                subprocess.run(f"taskkill /F /PID {proc.pid}", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

        elapsed = round(time.time() - t_start, 1)
        if synced:
            log.info(f"✅ [{login}@{server}] Natively Synced in {elapsed}s")
            return {"login": login, "status": "ok", "elapsed": elapsed}
        else:
            if not last_err_msg:
                last_err_msg = f"Sync timed out after {MT5_TIMEOUT} seconds (failed to connect or scan)."
            
            # Harvest logs for diagnostics
            log.warning(f"⚠️  [{login}] Sync failed! Harvesting logs for diagnostics...")
            try:
                harvested_info = harvest_logs(data_dir, login)
                log.warning(f"⚠️  [{login}] MT5 Logs harvested:\n{harvested_info}")
            except Exception as e:
                log.error(f"[{login}] Failed harvesting logs: {e}")

            # Self-healing clean sandbox directory
            if data_dir.exists():
                shutil.rmtree(data_dir, ignore_errors=True)

            log.warning(f"⚠️  [{login}] Sync failed: {last_err_msg}")
            report_error(account_id, last_err_msg)
            return {"login": login, "status": "timeout", "reason": last_err_msg}

    except Exception as e:
        if data_dir.exists():
            shutil.rmtree(data_dir, ignore_errors=True)
        err_msg = f"Worker exception: {e}"
        log.error(f"[{login}] {err_msg}", exc_info=True)
        report_error(account_id, err_msg)
        return {"login": login, "status": "error", "reason": str(e)}


# ── Parallel execution cycle ──────────────────────────────────────────────────
def run_cycle(accounts: list[dict], global_install_dir: Path):
    if not accounts:
        log.info("No active accounts found.")
        return

    workers = min(len(accounts), MAX_PARALLEL)
    log.info(f"▶ Syncing {len(accounts)} accounts in parallel (workers={workers})")

    t_start = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(sync_account, acc, global_install_dir): acc for acc in accounts}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as e:
                log.error(f"Pool worker thread error: {e}")

    elapsed = round(time.time() - t_start, 1)
    ok = sum(1 for r in results if r.get("status") == "ok")
    err = len(results) - ok
    log.info(f"── Parallel cycle complete in {elapsed}s | ✅ {ok} ok | ❌ {err} errors ──\n")


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    log.info("🚀 Starting GoldBook Windows Native Parallel Orchestrator")
    global_install_dir = detect_global_mt5()
    log.info(f"   Detected MT5 directory  : {global_install_dir}")
    log.info(f"   API URL                 : {GOLDBOOK_URL}")
    log.info(f"   Sync interval           : {SYNC_INTERVAL}s")
    log.info(f"   MT5 timeout             : {MT5_TIMEOUT}s")
    log.info(f"   Max parallel workers    : {MAX_PARALLEL}")
    log.info("")

    # Clean examples folder in global installation
    if global_install_dir.exists():
        log.info("Wiping examples from global installation to bypass compilation delay...")
        delete_examples_dirs(global_install_dir)

    while True:
        try:
            accounts = fetch_active_accounts()
            run_cycle(accounts, global_install_dir)
        except KeyboardInterrupt:
            log.info("Windows worker shutting down gracefully...")
            break
        except Exception as e:
            log.error(f"Cycle execution error: {e}", exc_info=True)

        time.sleep(SYNC_INTERVAL)


if __name__ == "__main__":
    main()

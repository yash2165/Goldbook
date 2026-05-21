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


# ── Per-account MT5 data directory ────────────────────────────────────────────
def prepare_data_dir(acc: dict) -> Path:
    """
    Create an isolated portable data dir for this MT5 account.
    Replicates the main MetaTrader 5 installation into this directory
    so it can be run as a true standalone portable sandbox.
    """
    data_dir = MT5_DATA_ROOT / str(acc["id"])
    wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
    global_install_dir = wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"

    # Replicate the full MT5 install into the data folder if terminal64.exe doesn't exist
    if not (data_dir / "terminal64.exe").exists() and global_install_dir.exists():
        log.info(f"[{acc['mt5_login']}] Replicating MT5 installation to isolated directory: {data_dir}")
        shutil.copytree(global_install_dir, data_dir, dirs_exist_ok=True)

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
    candidates.append(wineprefix / "drive_c" / "Program Files" / "MetaTrader 5" / "Config")
    candidates.append(wineprefix / "drive_c" / "Program Files" / "MetaTrader 5" / "config")
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


# ── Single account sync (runs in its own thread) ──────────────────────────────
def sync_account(acc: dict) -> dict:
    """
    Launches a dedicated MT5 terminal process for this account using Hangover 11.4.
    Uses File Polling: The MT5 script writes to sync_result.json, and this Python
    script reads it and sends it to the API. This bypasses all Wine HTTP bugs!
    """
    import os, signal, json
    
    login      = acc.get("mt5_login", "?")
    server     = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping")
        report_error(account_id, "Missing sync token configuration on backend.")
        return {"login": login, "status": "skipped", "reason": "no sync_token"}

    # Resolve global MT5 directories
    wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
    global_install_dir = wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"

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
            if not dst_ex5.exists() or should_compile:
                log.info(f"[{login}] Pre-compiling GoldBookSync.mq5 with Hangover native compilation ahead of time...")
                comp_env = os.environ.copy()
                comp_env["DISPLAY"] = DISPLAY
                comp_env["WINEPREFIX"] = str(wineprefix)
                comp_env["HOME"] = "/root"
                comp_env["USER"] = "root"
                comp_cmd = [
                    "/usr/bin/wine64",
                    str(global_install_dir / "metaeditor64.exe"),
                    "/portable",
                    "/compile:C:\\Program Files\\MetaTrader 5\\MQL5\\Scripts\\GoldBookSync.mq5",
                    "/log"
                ]
                try:
                    subprocess.run(comp_cmd, env=comp_env, timeout=25, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except Exception as e:
                    log.warning(f"[{login}] Ahead-of-time Hangover compilation failed: {e}")

        except Exception as e:
            log.error(f"[{login}] Failed preparing global configs: {e}")
            report_error(account_id, f"Configuration prep failed: {e}")
            return {"login": login, "status": "error", "reason": f"config_prep_failed: {e}"}

    # 2. Isolate Account in its own data directory! (Fixes MT5 parallel race conditions)
    data_dir = prepare_data_dir(acc)
    
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
    env["WINEPREFIX"] = str(wineprefix)
    env["WINEDLLOVERRIDES"] = "mscoree,mshtml="
    env["HOME"] = "/root"
    env["USER"] = "root"

    # Execute using the ISOLATED terminal via Hangover 11.4 wine64
    cmd = [
        "/usr/bin/wine64",
        str(data_dir / "terminal64.exe"),
        "/portable",
        f"/login:{login}",
        f"/password:{acc['investor_password']}",
        f"/server:{server}",
        f"/script:GoldBookSync",
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

        elapsed = round(time.time() - t_start, 1)

        if synced:
            log.info(f"✅ [{login}@{server}] Synced via file polling in {elapsed}s")
            return {"login": login, "status": "ok", "elapsed": elapsed}
        else:
            if not last_err_msg:
                last_err_msg = f"Sync timed out after {MT5_TIMEOUT} seconds (MT5 did not finish scanning or failed to connect)."
            log.warning(f"⚠️  [{login}] Sync failed: {last_err_msg}")
            report_error(account_id, last_err_msg)
            return {"login": login, "status": "timeout", "reason": last_err_msg}

    except FileNotFoundError:
        err_msg = f"MT5 terminal64.exe not found in isolated directory: {data_dir}"
        log.error(err_msg)
        report_error(account_id, err_msg)
        return {"login": login, "status": "error", "reason": "binary_not_found"}

    except Exception as e:
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

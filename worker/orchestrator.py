"""
GoldBook MT5 24/7 Persistent Farm Watchdog Orchestrator
======================================================
Runs inside isolated MetaTrader 5 portable sandboxes.
Launches the native Linux MT5 terminal as a persistent background process
for EACH active account in PARALLEL. Keeps them running 24/7.

- Near-real-time updates: the EA triggers a sync on OnTrade() and OnTimer().
- Staggered launch: starts one terminal every 20 seconds to protect IP/CPU.
- Self-healing watchdog: auto-spawns dead terminals and restarts hung ones (no sync > 5m).
- Automatic lifecycle provisioning: shuts down deactivated users automatically.

SETUP:
  pip install requests python-dotenv
  sudo bash setup_ubuntu.sh   (installs Xvfb + MT5 Linux terminal)

ENV (.env file):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  API_BASE                   e.g. https://yourdomain.com/api
  GOLDBOOK_API_URL            e.g. https://yourdomain.com/api/ea-sync
  WORKER_SECRET
  MT5_BINARY                 default: /usr/bin/wine
  DISPLAY                    default: :99
  STAGGER_INTERVAL_SECONDS   default: 20
  HEALTH_TIMEOUT_SECONDS     default: 300
"""

import os
import sys
import time
import shutil
import logging
import subprocess
import threading
import signal
from pathlib import Path
from dotenv import load_dotenv
import requests

# Load environment
load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", os.environ.get("SUPABASE_URL"))
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
API_BASE       = os.environ.get("API_BASE", "https://goldbook-roan.vercel.app/api")
WORKER_SECRET  = os.environ.get("WORKER_SECRET", "xauusd_on_top")
GOLDBOOK_URL   = os.environ.get("GOLDBOOK_API_URL", f"{API_BASE}/ea-sync")
MT5_BINARY     = os.environ.get("MT5_BINARY", "/usr/bin/wine")
global_wineprefix = Path(os.environ.get("WINEPREFIX", str(Path.home() / ".mt5")))
DISPLAY        = os.environ.get("DISPLAY", ":99")
STAGGER_INTERVAL = int(os.environ.get("STAGGER_INTERVAL_SECONDS", "20"))
HEALTH_TIMEOUT = int(os.environ.get("HEALTH_TIMEOUT_SECONDS", "300"))

# Path to the GoldBookSync.mq5 EA (same folder as this file)
SCRIPT_SRC = Path(__file__).parent / "GoldBookSync.mq5"

# Compiler sync lock to prevent multiple threads from colliding on MetaEditor
global_sync_lock = threading.Lock()

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

# ── Active Processes State ─────────────────────────────────────────────────────
# Schema:
# {
#     account_id: {
#         "process": subprocess.Popen object,
#         "last_sync": float (timestamp of last successful sync),
#         "login": str,
#         "server": str,
#         "sandbox_dir": Path,
#         "sync_token": str,
#         "is_booting": bool
#     }
# }
active_processes = {}
last_launch_time = 0.0

# ── Safe file helpers ──────────────────────────────────────────────────────────
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
        common_ini.write_bytes(b"\xff\xfe" + content.encode("utf-16le"))
        return

    try:
        text, encoding, bom = _read_text_with_bom(common_ini)
    except Exception:
        return

    newline = "\r\n" if "\r\n" in text else "\n"
    lines = text.splitlines()

    out = []
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


def delete_examples_dirs(root_dir: Path):
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


# ── Supabase Helpers ───────────────────────────────────────────────────────────
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


# ── Log Harvester ──────────────────────────────────────────────────────────────
def harvest_logs(data_dir: Path, login: str) -> str:
    harvested = []
    
    # 1. MQL5 Script/EA Logs
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
                harvested.append(f"--- MQL5 EA Logs ({latest_file.name}) ---")
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


# ── Sandbox Directory Prep ─────────────────────────────────────────────────────
def prepare_data_dir(acc: dict, acc_wineprefix: Path) -> Path:
    # Instead of config folders, copy/replicate the entire MT5 program folder to isolated directories.
    # This runs MT5 natively inside its own default path mapping context, which FEX-Emu emulates flawlessly!
    data_dir = acc_wineprefix / "drive_c" / "Program Files" / f"MT5_Account_{acc['id']}"
    global_install_dir = acc_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"

    if not data_dir.exists() and global_install_dir.exists():
        log.info(f"[{acc['mt5_login']}] Replicating MT5 installation to isolated emulated directory: {data_dir}")
        shutil.copytree(global_install_dir, data_dir, dirs_exist_ok=True)



    delete_examples_dirs(data_dir)

    sounds_dir = data_dir / "Sounds"
    if sounds_dir.exists():
        shutil.rmtree(sounds_dir, ignore_errors=True)

    # Experts Directory for the Persistent EA (MQL5/Experts)
    experts_dir = data_dir / "MQL5" / "Experts"
    experts_dir.mkdir(parents=True, exist_ok=True)

    # Copy the EA source
    dst_script = experts_dir / "GoldBookSync.mq5"
    if SCRIPT_SRC.exists():
        shutil.copy2(SCRIPT_SRC, dst_script)

    global_config_path = None
    candidates = [
        global_install_dir / "Config",
        global_install_dir / "config"
    ]
    for p in candidates:
        if p.exists():
            global_config_path = p
            break
            
    for folder_name in ["config", "Config"]:
        c_dir = data_dir / folder_name
        c_dir.mkdir(parents=True, exist_ok=True)
        
        if global_config_path and global_config_path.exists():
            for file_name in ["terminal.ini", "settings.ini", "common.ini", "experts.ini"]:
                src_file = global_config_path / file_name
                if src_file.exists():
                    shutil.copy2(src_file, c_dir / file_name)

        ensure_common_ini(c_dir / "common.ini", acc)

    return data_dir


# ── Compilation & Provisioning ─────────────────────────────────────────────────
def provision_terminal(acc: dict) -> subprocess.Popen | None:
    login = acc.get("mt5_login", "?")
    password = acc.get("investor_password", "")
    server = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping startup")
        report_error(account_id, "Missing sync token configuration on backend.")
        return None

    global_install_dir = global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"
    
    # Run all instances inside the working global WINEPREFIX
    acc_wineprefix = global_wineprefix

    # 2. Compile GoldBookSync.mq5 inside global folder if needed, then copy compiled EX5
    with global_sync_lock:
        try:
            experts_dir = global_install_dir / "MQL5" / "Experts"
            experts_dir.mkdir(parents=True, exist_ok=True)
            dst_script = experts_dir / "GoldBookSync.mq5"
            dst_ex5 = experts_dir / "GoldBookSync.ex5"

            should_compile = False
            if SCRIPT_SRC.exists():
                src_content = SCRIPT_SRC.read_bytes()
                if not dst_script.exists() or dst_script.read_bytes() != src_content:
                    shutil.copy2(SCRIPT_SRC, dst_script)
                    should_compile = True

            metaeditor_path = find_file_case_insensitive(global_install_dir, "metaeditor64.exe")
            if not metaeditor_path.exists():
                metaeditor_path = find_file_case_insensitive(global_install_dir, "metaeditor.exe")

            # Check if we have a precompiled EX5 sibling file next to the orchestrator script
            precompiled_ex5 = Path(__file__).parent / "GoldBookSync.ex5"
            if not precompiled_ex5.exists():
                # Fallback to check if it's in the worker folder
                precompiled_ex5 = Path(__file__).parent / "worker" / "GoldBookSync.ex5"

            if not dst_ex5.exists() or should_compile:
                if dst_ex5.exists():
                    dst_ex5.unlink()

                if precompiled_ex5.exists():
                    log.info(f"[{login}] Found precompiled GoldBookSync.ex5 at {precompiled_ex5}. Copying to global Experts folder...")
                    shutil.copy2(precompiled_ex5, dst_ex5)
                elif metaeditor_path.exists():
                    log.info(f"[{login}] Pre-compiling GoldBookSync.mq5 EA ahead of time...")
                    comp_env = os.environ.copy()
                    comp_env["DISPLAY"] = DISPLAY
                    comp_env["WINEPREFIX"] = str(global_wineprefix)
                    comp_env["HOME"] = os.environ.get("HOME", str(Path.home()))
                    comp_env["USER"] = os.environ.get("USER", "ubuntu")
                    comp_cmd = [
                        "/usr/bin/wine",
                        str(metaeditor_path),
                        "/portable",
                        "/compile:MQL5\\Experts\\GoldBookSync.mq5",
                        "/log"
                    ]
                    try:
                        subprocess.run(comp_cmd, env=comp_env, timeout=25, capture_output=True, cwd=str(global_install_dir))
                    except Exception as e:
                        log.warning(f"[{login}] AOT EA Compilation failed to execute: {e}")
                else:
                    log.warning(f"[{login}] Compiler not found and no precompiled EX5 available.")

            if not dst_ex5.exists():
                err_msg = "Failed to compile GoldBookSync.ex5 Expert Advisor natively, and no precompiled EX5 was found."
                log.error(f"[{login}] {err_msg}")
                report_error(account_id, err_msg)
                return None

        except Exception as e:
            log.error(f"[{login}] Failed preparing global configs: {e}")
            report_error(account_id, f"Configuration prep failed: {e}")
            return None

    # 3. Setup sandbox data directory
    data_dir = prepare_data_dir(acc, acc_wineprefix)

    # Copy the compiled EA
    isolated_experts = data_dir / "MQL5" / "Experts"
    isolated_experts.mkdir(parents=True, exist_ok=True)
    if dst_ex5.exists():
        shutil.copy2(dst_ex5, isolated_experts / "GoldBookSync.ex5")

    # Write sync config inside files directory
    files_dir = data_dir / "MQL5" / "Files"
    files_dir.mkdir(parents=True, exist_ok=True)
    config_file = files_dir / "sync_config.txt"
    config_file.write_text(f"SyncToken={sync_token}\r\n", encoding="utf-8")

    # Clean old results
    result_file = files_dir / "sync_result.json"
    if result_file.exists():
        result_file.unlink()

    # Generate startup.ini pointing to the compiled Expert Advisor
    try:
        startup_ini = data_dir / "startup.ini"
        startup_content = (
            "[Common]\r\n"
            f"Login={login}\r\n"
            f"Password={password}\r\n"
            f"Server={server}\r\n"
            "AutoConfirm=1\r\n\r\n"
            "[StartUp]\r\n"
            "Expert=GoldBookSync\r\n"
            "Symbol=EURUSD\r\n"
            "Period=M1\r\n"
        )
        startup_ini.write_bytes(b"\xff\xfe" + startup_content.encode("utf-16le"))
    except Exception as e:
        log.warning(f"[{login}] Failed writing startup.ini: {e}")

    # Launch environment
    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY
    env["WINEPREFIX"] = str(acc_wineprefix)
    env["WINEDLLOVERRIDES"] = "mscoree,mshtml="
    env["HOME"] = os.environ.get("HOME", str(Path.home()))
    env["USER"] = os.environ.get("USER", "ubuntu")

    # Target the isolated program installation folder binary directly
    terminal_path = find_file_case_insensitive(data_dir, "terminal64.exe")
    if not terminal_path.exists():
        terminal_path = find_file_case_insensitive(data_dir, "terminal.exe")

    if not terminal_path.exists():
        log.error(f"[{login}] Isolated MT5 terminal executable not found: {data_dir}")
        return None

    # Use the relative filename of the binary inside the isolated directory
    binary_name = terminal_path.name

    cmd = [
        "/usr/bin/wine",
        binary_name,
        "/portable",
        "/config:startup.ini", # Point startup config directly in directory context, avoiding custom virtual mapping redirection crashes!
        "/skipupdate",
        "/nosplash",
    ]

    log.info(f"▶ [{login}@{server}] Launching MT5 24/7 persistent instance natively inside {data_dir.name}...")
    try:
        proc = subprocess.Popen(
            cmd, env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True, # Allow killing process tree safely
            cwd=str(data_dir)
        )
        return proc
    except Exception as e:
        log.error(f"[{login}] Failed launching terminal process: {e}")
        report_error(account_id, f"Process execution failed: {e}")
        return None


# ── Terminate Account Processes Safely ──────────────────────────────────────────
def shutdown_terminal(account_id: str, item: dict):
    login = item.get("login", "?")
    proc = item.get("process")
    acc_wineprefix = global_wineprefix

    log.info(f"⏹ [{login}] Terminating persistent terminal process...")

    # Force kill process tree
    if proc:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass

    # Terminate wineserver to release all locks on files
    try:
        env_ws = os.environ.copy()
        env_ws["WINEPREFIX"] = str(acc_wineprefix)
        subprocess.run(["wineserver", "-k"], env=env_ws, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


def match_raw_trades_in_python(payload: dict) -> dict | None:
    raw_list = payload.get("raw_trades", [])
    sync_token = payload.get("sync_token")
    if not raw_list:
        return None
        
    by_position = {}
    for deal in raw_list:
        pos_id = deal["position_id"]
        if pos_id not in by_position:
            by_position[pos_id] = []
        by_position[pos_id].append(deal)
        
    matched_trades = []
    for _, deals in by_position.items():
        deals = sorted(deals, key=lambda d: d["time"])
        in_deals = [d for d in deals if d["entry"] == 0]
        out_deals = [d for d in deals if d["entry"] in (1, 2)]
        
        if not out_deals:
            continue
            
        for out_deal in out_deals:
            matching_in = None
            for in_deal in reversed(in_deals):
                if in_deal["time"] <= out_deal["time"]:
                    matching_in = in_deal
                    break
                    
            entry_price = out_deal["price"]
            open_time = out_deal["time"]
            direction = "buy"
            
            if matching_in:
                entry_price = matching_in["price"]
                open_time = matching_in["time"]
                direction = "buy" if matching_in["type"] == 0 else "sell"
            else:
                if deals:
                    direction = "buy" if deals[0]["type"] == 0 else "sell"
                    
            pnl = out_deal["profit"] + out_deal["swap"] + out_deal["commission"]
            matched_trades.append({
                "ticket": out_deal["ticket"],
                "position_id": out_deal["position_id"],
                "symbol": out_deal["symbol"],
                "direction": direction,
                "lot_size": out_deal["volume"],
                "entry_price": entry_price,
                "close_price": out_deal["price"],
                "pnl": pnl,
                "close_time": out_deal["time"],
                "open_time": open_time,
                "swap": out_deal["swap"],
                "commission": out_deal["commission"],
                "status": "closed",
            })
            
    return {
        "type": "raw_trades",
        "sync_token": sync_token,
        "raw_trades": matched_trades
    }


# ── Xvfb Launcher ─────────────────────────────────────────────────────────────
def ensure_xvfb():
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
        target = 16 * 1024 * 1024  # 16 MB
        soft, hard = resource.getrlimit(resource.RLIMIT_STACK)
        if hard != resource.RLIM_INFINITY and hard < target:
            target = hard
        resource.setrlimit(resource.RLIMIT_STACK, (target, hard))
        log.info(f"Boosted process stack limit to {target // (1024*1024)}MB")
    except Exception as e:
        log.warning(f"Could not boost process stack limit: {e}")


# ── Clean Shutdown Handler ─────────────────────────────────────────────────────
def handle_exit(signum, frame):
    log.info("\n🚨 Shutdown signal received! Cleaning up all persistent terminals...")
    for account_id, item in list(active_processes.items()):
        shutdown_terminal(account_id, item)
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)


# ── Main Farm Loop ─────────────────────────────────────────────────────────────
def main():
    boost_stack_limit()
    ensure_xvfb()

    global_install_dir = global_wineprefix / "drive_c" / "Program Files" / "MetaTrader 5"
    if global_install_dir.exists():
        log.info("Cleaning up global MT5 install examples directory...")
        delete_examples_dirs(global_install_dir)

    log.info("🚀 GoldBook 24/7 Farm Watchdog Orchestrator started")
    log.info(f"   API URL                 : {GOLDBOOK_URL}")
    log.info(f"   Display                 : {DISPLAY}")
    log.info(f"   Stagger interval        : {STAGGER_INTERVAL}s")
    log.info(f"   Watchdog health timeout : {HEALTH_TIMEOUT}s")
    log.info("")

    global last_launch_time
    last_db_query_time = 0.0
    active_db_accounts = []

    while True:
        current_time = time.time()

        # 1. Fetch active accounts from Supabase periodically (every 10 seconds)
        if current_time - last_db_query_time > 10.0:
            active_db_accounts = fetch_active_accounts()
            last_db_query_time = current_time

            # Check if any active process needs decommissioning
            active_db_ids = {str(a["id"]) for a in active_db_accounts}
            for pid in list(active_processes.keys()):
                if pid not in active_db_ids:
                    log.info(f"decommissioning account {pid} (marked inactive in database)...")
                    shutdown_terminal(pid, active_processes[pid])
                    del active_processes[pid]

        # 2. Check if we need to launch any missing terminals
        for acc in active_db_accounts:
            acc_id = str(acc["id"])
            login = acc.get("mt5_login", "?")

            # If not in process list, we boot it up
            if acc_id not in active_processes:
                # Stagger launch check
                time_since_last_launch = current_time - last_launch_time
                if time_since_last_launch < STAGGER_INTERVAL:
                    # Defer startup to protect IP and spread CPU load
                    log.info(f"⏳ Staggering boot. Deferring {login} (last launch was {round(time_since_last_launch, 1)}s ago)...")
                    break # Defer all subsequent launches to next cycle iterations

                # Proceed with boot
                log.info(f"⚙️ Booting missing persistent terminal for {login}...")
                data_dir = global_wineprefix / "drive_c" / "Program Files" / f"MT5_Account_{acc_id}"
                
                # Setup structure
                active_processes[acc_id] = {
                    "process": None,
                    "last_sync": current_time,
                    "login": login,
                    "server": acc.get("broker_server", "?"),
                    "sandbox_dir": data_dir,
                    "sync_token": acc.get("sync_token"),
                    "is_booting": True
                }
                
                proc = provision_terminal(acc)
                if proc:
                    active_processes[acc_id]["process"] = proc
                    active_processes[acc_id]["is_booting"] = False
                    last_launch_time = time.time()
                    log.info(f"✅ Boot successful for {login}. Staggering next launch...")
                else:
                    log.error(f"❌ Boot failed for {login}. Cleaning up...")
                    del active_processes[acc_id]
                break # Only launch ONE account per main cycle loop iteration

        # 3. Check for sync results in active sandboxes
        for acc_id, item in list(active_processes.items()):
            if item.get("is_booting"):
                continue

            data_dir = item["sandbox_dir"]
            result_file = data_dir / "MQL5" / "Files" / "sync_result.json"

            if result_file.exists():
                time.sleep(0.1) # Brief rest to ensure file lock release
                try:
                    data_str = result_file.read_text(encoding="utf-8-sig")
                    result_file.unlink() # Delete immediately!

                    payloads = json_loads = []
                    try:
                        import json
                        payloads = json.loads(data_str)
                    except Exception as je:
                        log.error(f"[{item['login']}] Failed parsing JSON: {je}")
                        continue

                    processed_payloads = []
                    for p in payloads:
                        if p.get("type") == "raw_trades":
                            matched = match_raw_trades_in_python(p)
                            if matched:
                                processed_payloads.append(matched)
                        else:
                            processed_payloads.append(p)

                    # POST events to API
                    for p in processed_payloads:
                        requests.post(
                            GOLDBOOK_URL,
                            json=p,
                            headers={"Content-Type": "application/json"},
                            timeout=10
                        )

                    item["last_sync"] = time.time()
                    log.info(f"🔄 [{item['login']}] Persistent Update Received & API Synced!")

                except Exception as e:
                    log.error(f"[{item['login']}] Error processing sync JSON file: {e}")

        # 4. Watchdog Process Health Check & Self-Healing
        for acc_id, item in list(active_processes.items()):
            if item.get("is_booting"):
                continue

            proc = item["process"]
            login = item["login"]

            # Crash check
            if proc and proc.poll() is not None:
                log.warning(f"⚠️ [{login}] Persistent process died unexpectedly. Harvesting logs for recovery...")
                try:
                    harvested = harvest_logs(item["sandbox_dir"], login)
                    log.warning(f"⚠️ [{login}] harvested logs:\n{harvested}")
                except Exception:
                    pass
                
                # Delete sandboxed data_dir on crash to prevent corrupt state loop
                shutil.rmtree(item["sandbox_dir"], ignore_errors=True)
                
                # Delete from active processes memory to trigger a clean staggered reboot
                del active_processes[acc_id]
                continue

            # Silence (Hung Process) Check
            time_since_sync = time.time() - item["last_sync"]
            if time_since_sync > HEALTH_TIMEOUT:
                log.warning(f"⚠️ [{login}] Silent for {round(time_since_sync)}s (no sync files). Process is hung or disconnected. Self-healing...")
                shutdown_terminal(acc_id, item)
                
                # Clean prefix state
                shutil.rmtree(item["sandbox_dir"], ignore_errors=True)
                
                del active_processes[acc_id]

        time.sleep(2.0) # Check every 2 seconds


if __name__ == "__main__":
    main()

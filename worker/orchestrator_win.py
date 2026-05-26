"""
GoldBook MT5 Windows 24/7 Persistent Farm Watchdog Orchestrator
==============================================================
Runs natively on Windows PC inside isolated sandboxes.
Launches the native Windows MT5 terminal as a persistent background process
for EACH active account in PARALLEL. Keeps them running 24/7.

- Near-real-time updates: the EA triggers a sync on OnTrade() and OnTimer().
- Staggered launch: starts one terminal every 20 seconds to protect IP/CPU.
- Self-healing watchdog: auto-spawns dead terminals and restarts hung ones (no sync > 5m).
- Automatic lifecycle provisioning: shuts down deactivated users automatically.

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

# Load environment configuration
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
log = logging.getLogger("goldbook_win")

if not SUPABASE_URL or not SUPABASE_KEY:
    log.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from environment (.env / .env.local)!")
    sys.exit(1)

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


def detect_global_mt5() -> Path:
    if os.environ.get("MT5_PATH"):
        p = Path(os.environ["MT5_PATH"])
        if p.is_file():
            return p.parent
        if p.is_dir():
            return p

    candidates = [
        Path("C:/Program Files/MetaTrader 5"),
        Path("C:/Program Files (x86)/MetaTrader 5"),
    ]
    local_appdata = os.environ.get("LOCALAPPDATA")
    if local_appdata:
        candidates.append(Path(local_appdata) / "MetaTrader 5")

    for c in candidates:
        if (c / "terminal64.exe").exists() or (c / "terminal.exe").exists():
            return c
            
    log.error("❌ Could not auto-detect MetaTrader 5 installation directory!")
    sys.exit(1)


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
                harvested.append(f"--- MQL5 EA Logs ({latest_file.name}) ---")
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


# ── Sandbox Directory Prep ─────────────────────────────────────────────────────
def prepare_data_dir(acc: dict, global_install_dir: Path) -> Path:
    sandboxes_root = Path(__file__).parent / "sandboxes"
    sandboxes_root.mkdir(exist_ok=True)
    data_dir = sandboxes_root / str(acc["id"])

    terminal_path = data_dir / "terminal64.exe"
    if not terminal_path.exists():
        terminal_path = data_dir / "terminal.exe"

    if not terminal_path.exists():
        log.info(f"[{acc['mt5_login']}] Replicating MT5 installation to isolated sandbox: {data_dir}")
        shutil.copytree(global_install_dir, data_dir, dirs_exist_ok=True)

    delete_examples_dirs(data_dir)

    sounds_dir = data_dir / "Sounds"
    if sounds_dir.exists():
        shutil.rmtree(sounds_dir, ignore_errors=True)

    # EA Experts Directory
    experts_dir = data_dir / "MQL5" / "Experts"
    experts_dir.mkdir(parents=True, exist_ok=True)

    dst_script = experts_dir / "GoldBookSync.mq5"
    if SCRIPT_SRC.exists():
        shutil.copy2(SCRIPT_SRC, dst_script)

    global_config = global_install_dir / "Config"
    if not global_config.exists():
        global_config = global_install_dir / "config"

    appdata_servers_dat = None
    try:
        appdata = os.environ.get("APPDATA")
        if appdata:
            metaquotes_root = Path(appdata) / "MetaQuotes" / "Terminal"
            if metaquotes_root.exists():
                candidates = []
                for instance_dir in metaquotes_root.iterdir():
                    if instance_dir.is_dir():
                        s_dat = instance_dir / "config" / "servers.dat"
                        if s_dat.exists():
                            candidates.append(s_dat)
                if candidates:
                    candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
                    appdata_servers_dat = candidates[0]
    except Exception:
        pass

    for folder in ["config", "Config"]:
        c_dir = data_dir / folder
        c_dir.mkdir(exist_ok=True)
        if global_config.exists():
            for f in ["terminal.ini", "settings.ini", "common.ini", "experts.ini", "servers.dat"]:
                src_file = global_config / f
                if f == "servers.dat" and appdata_servers_dat:
                    src_file = appdata_servers_dat
                
                if src_file.exists():
                    shutil.copy2(src_file, c_dir / f)

    return data_dir


# ── Launch Terminal Process ────────────────────────────────────────────────────
def provision_terminal(acc: dict, global_install_dir: Path) -> subprocess.Popen | None:
    login      = acc.get("mt5_login", "?")
    password   = acc.get("investor_password", "")
    server     = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping startup")
        report_error(account_id, "Missing sync token configuration on backend.")
        return None

    # Prepare sandbox data directory
    try:
        data_dir = prepare_data_dir(acc, global_install_dir)
    except Exception as e:
        log.error(f"[{login}] Sandbox preparation failed: {e}")
        report_error(account_id, f"Sandbox prep failed: {e}")
        return None

    isolated_experts = data_dir / "MQL5" / "Experts"
    dst_script = isolated_experts / "GoldBookSync.mq5"
    dst_ex5 = isolated_experts / "GoldBookSync.ex5"

    metaeditor_path = global_install_dir / "metaeditor64.exe"
    if not metaeditor_path.exists():
        metaeditor_path = global_install_dir / "metaeditor.exe"

    # Compile EA
    with global_sync_lock:
        if not dst_ex5.exists():
            log.info(f"[{login}] Compiling GoldBookSync.mq5 natively in sandbox...")
            comp_cmd = [
                str(metaeditor_path),
                "/portable",
                "/compile:MQL5\\Experts\\GoldBookSync.mq5",
                "/log"
            ]
            try:
                subprocess.run(comp_cmd, timeout=30, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=str(data_dir))
            except Exception as e:
                log.warning(f"[{login}] Compilation execution failed: {e}")

    if not dst_ex5.exists():
        err_msg = "Failed to compile GoldBookSync.ex5 Expert Advisor natively."
        log.error(f"[{login}] {err_msg}")
        report_error(account_id, err_msg)
        return None

    # Write config file inside sandbox Files folder
    files_dir = data_dir / "MQL5" / "Files"
    files_dir.mkdir(parents=True, exist_ok=True)
    
    config_file = files_dir / "sync_config.txt"
    config_file.write_text(f"SyncToken={sync_token}\r\n", encoding="utf-8")
    
    result_file = files_dir / "sync_result.json"
    if result_file.exists():
        result_file.unlink()

    # Generate startup.ini pointing to the Expert Advisor
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

    terminal_path = data_dir / "terminal64.exe"
    if not terminal_path.exists():
        terminal_path = data_dir / "terminal.exe"

    cmd = [
        str(terminal_path),
        "/portable",
        "/config:startup.ini",
        "/skipupdate",
        "/nosplash",
    ]

    log.info(f"▶ [{login}@{server}] Launching MT5 Windows persistent instance...")
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
        return proc
    except Exception as e:
        log.error(f"[{login}] Failed launching terminal process: {e}")
        report_error(account_id, f"Process execution failed: {e}")
        return None


# ── Terminate Account Processes Safely ──────────────────────────────────────────
def shutdown_terminal(item: dict):
    login = item.get("login", "?")
    proc = item.get("process")

    log.info(f"⏹ [{login}] Terminating persistent terminal process...")

    if proc:
        try:
            if proc.poll() is None:
                proc.terminate()
                proc.wait(2)
        except Exception:
            pass
            
        try:
            if proc.poll() is None:
                # Force taskkill in Windows
                subprocess.run(f"taskkill /F /PID {proc.pid}", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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


# ── Clean Shutdown Handler ─────────────────────────────────────────────────────
def handle_exit(signum, frame):
    log.info("\n🚨 Shutdown signal received! Cleaning up all persistent terminals...")
    for item in list(active_processes.values()):
        shutdown_terminal(item)
    sys.exit(0)

signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)


# ── Main Farm Loop ─────────────────────────────────────────────────────────────
def main():
    log.info("🚀 GoldBook Windows 24/7 Farm Watchdog Orchestrator started")
    global_install_dir = detect_global_mt5()
    log.info(f"   Detected MT5 directory  : {global_install_dir}")
    log.info(f"   API URL                 : {GOLDBOOK_URL}")
    log.info(f"   Stagger interval        : {STAGGER_INTERVAL}s")
    log.info(f"   Watchdog health timeout : {HEALTH_TIMEOUT}s")
    log.info("")

    if global_install_dir.exists():
        log.info("Cleaning up global MT5 install examples directory...")
        try:
            delete_examples_dirs(global_install_dir)
        except Exception:
            pass

    global last_launch_time
    last_db_query_time = 0.0
    active_db_accounts = []

    while True:
        current_time = time.time()

        # 1. Fetch active accounts from Supabase periodically (every 10 seconds)
        if current_time - last_db_query_time > 10.0:
            active_db_accounts = fetch_active_accounts()
            last_db_query_time = current_time

            # Decommission inactive accounts
            active_db_ids = {str(a["id"]) for a in active_db_accounts}
            for pid in list(active_processes.keys()):
                if pid not in active_db_ids:
                    log.info(f"decommissioning account {pid} (marked inactive in database)...")
                    shutdown_terminal(active_processes[pid])
                    del active_processes[pid]

        # 2. Check if we need to launch any missing terminals
        for acc in active_db_accounts:
            acc_id = str(acc["id"])
            login = acc.get("mt5_login", "?")

            if acc_id not in active_processes:
                # Stagger launch check
                time_since_last_launch = current_time - last_launch_time
                if time_since_last_launch < STAGGER_INTERVAL:
                    log.info(f"⏳ Staggering boot. Deferring {login} (last launch was {round(time_since_last_launch, 1)}s ago)...")
                    break

                log.info(f"⚙️ Booting missing persistent terminal for {login}...")
                sandboxes_root = Path(__file__).parent / "sandboxes"
                data_dir = sandboxes_root / acc_id
                
                active_processes[acc_id] = {
                    "process": None,
                    "last_sync": current_time,
                    "login": login,
                    "server": acc.get("broker_server", "?"),
                    "sandbox_dir": data_dir,
                    "sync_token": acc.get("sync_token"),
                    "is_booting": True
                }
                
                proc = provision_terminal(acc, global_install_dir)
                if proc:
                    active_processes[acc_id]["process"] = proc
                    active_processes[acc_id]["is_booting"] = False
                    last_launch_time = time.time()
                    log.info(f"✅ Boot successful for {login}. Staggering next launch...")
                else:
                    log.error(f"❌ Boot failed for {login}. Cleaning up...")
                    del active_processes[acc_id]
                break

        # 3. Check for sync results in active sandboxes
        for acc_id, item in list(active_processes.items()):
            if item.get("is_booting"):
                continue

            data_dir = item["sandbox_dir"]
            result_file = data_dir / "MQL5" / "Files" / "sync_result.json"

            if result_file.exists():
                time.sleep(0.1)
                try:
                    data_str = result_file.read_text(encoding="utf-8-sig")
                    result_file.unlink()

                    payloads = []
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
                log.warning(f"⚠️ [{login}] Persistent process died unexpectedly. Re-queuing boot...")
                shutil.rmtree(item["sandbox_dir"], ignore_errors=True)
                del active_processes[acc_id]
                continue

            # Silence (Hung Process) Check
            time_since_sync = time.time() - item["last_sync"]
            if time_since_sync > HEALTH_TIMEOUT:
                log.warning(f"⚠️ [{login}] Silent for {round(time_since_sync)}s. Process is hung. Self-healing...")
                shutdown_terminal(item)
                shutil.rmtree(item["sandbox_dir"], ignore_errors=True)
                del active_processes[acc_id]

        time.sleep(2.0)


if __name__ == "__main__":
    main()

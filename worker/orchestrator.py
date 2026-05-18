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
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import requests

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
SUPABASE_URL   = os.environ["SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
API_BASE       = os.environ["API_BASE"]
WORKER_SECRET  = os.environ["WORKER_SECRET"]
GOLDBOOK_URL   = os.environ.get("GOLDBOOK_API_URL", f"{API_BASE}/ea-sync")
MT5_BINARY     = os.environ.get("MT5_BINARY", "/usr/bin/mt5")
MT5_DATA_ROOT  = Path(os.environ.get("MT5_DATA_ROOT", "/opt/mt5data"))
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


def report_error(account_id: str):
    """Tell the API this account's login failed so the UI shows an error."""
    try:
        requests.post(
            f"{API_BASE}/trade-data",
            json={
                "type": "account_error",
                "account_id": account_id,
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
    Copies the GoldBookSync.mq5 script into MQL5/Scripts/.
    Copies the whitelisted terminal.ini and settings.ini.
    Writes the config/common.ini with login credentials.
    """
    data_dir = MT5_DATA_ROOT / str(acc["id"])
    scripts_dir = data_dir / "MQL5" / "Scripts"
    scripts_dir.mkdir(parents=True, exist_ok=True)

    # Place sync script
    dst_script = scripts_dir / "GoldBookSync.mq5"
    if SCRIPT_SRC.exists():
        shutil.copy2(SCRIPT_SRC, dst_script)

    # Copy global whitelisted terminal.ini and settings.ini to both config and Config folders
    global_config_path = Path("/root/.mt5/drive_c/Program Files/MetaTrader 5/Config")
    
    for folder_name in ["config", "Config"]:
        c_dir = data_dir / folder_name
        c_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy the settings if they exist globally
        if global_config_path.exists():
            for file_name in ["terminal.ini", "settings.ini"]:
                src_file = global_config_path / file_name
                if src_file.exists():
                    shutil.copy2(src_file, c_dir / file_name)

        # Write MT5 login config
        (c_dir / "common.ini").write_text(
            "[Common]\n"
            f"Login={acc['mt5_login']}\n"
            f"Password={acc['investor_password']}\n"
            f"Server={acc['broker_server']}\n"
            "AutoConfirm=1\n"
        )

    return data_dir


# ── Single account sync (runs in its own thread) ──────────────────────────────
def sync_account(acc: dict) -> dict:
    """
    Launches a dedicated MT5 terminal process for this account.
    The GoldBookSync MQL5 script runs automatically, pushes data to the API,
    then calls TerminalClose() so the process exits cleanly.

    Returns a result dict for logging.
    """
    login      = acc.get("mt5_login", "?")
    server     = acc.get("broker_server", "?")
    account_id = acc["id"]
    sync_token = acc.get("sync_token")

    if not sync_token:
        log.warning(f"Account {login} missing sync_token — skipping")
        return {"login": login, "status": "skipped", "reason": "no sync_token"}

    try:
        data_dir = prepare_data_dir(acc)
    except Exception as e:
        log.error(f"[{login}] Failed to prepare data dir: {e}")
        return {"login": login, "status": "error", "reason": str(e)}

    env = os.environ.copy()
    env["DISPLAY"] = DISPLAY

    cmd = [
        MT5_BINARY,
        f"/portable:{data_dir}",
        f"/login:{login}",
        f"/password:{acc['investor_password']}",
        f"/server:{server}",
        f"/script:GoldBookSync",
        # Pass sync token and API URL as script params
        f"/scriptin:ApiUrl={GOLDBOOK_URL};SyncToken={sync_token};",
        "/skipupdate",
        "/nosplash",
    ]

    t_start = time.time()
    try:
        proc = subprocess.Popen(
            cmd, env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        proc.wait(timeout=MT5_TIMEOUT)
        elapsed = round(time.time() - t_start, 1)

        if proc.returncode == 0:
            log.info(f"✅ [{login}@{server}] synced in {elapsed}s")
            return {"login": login, "status": "ok", "elapsed": elapsed}
        else:
            log.warning(f"⚠️  [{login}] MT5 exited with code {proc.returncode} ({elapsed}s)")
            report_error(account_id)
            return {"login": login, "status": "mt5_error", "code": proc.returncode}

    except subprocess.TimeoutExpired:
        elapsed = round(time.time() - t_start, 1)
        log.warning(f"⏱  [{login}] Timed out after {elapsed}s — killing")
        proc.kill()
        return {"login": login, "status": "timeout", "elapsed": elapsed}

    except FileNotFoundError:
        log.error(f"MT5 binary not found: {MT5_BINARY}. Run setup_ubuntu.sh first.")
        return {"login": login, "status": "error", "reason": "binary_not_found"}

    except Exception as e:
        log.error(f"[{login}] Unexpected error: {e}", exc_info=True)
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


# ── Main loop ─────────────────────────────────────────────────────────────────
def main():
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

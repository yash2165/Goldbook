#!/bin/bash
# =============================================================================
# GoldBook — Ubuntu VPS Setup Script
# Oracle Free Tier (24 GB ARM) / Any Ubuntu 20.04+ VPS
# Run as root: sudo bash setup_ubuntu.sh
# =============================================================================
# NOTE: We do NOT use set -e because mt5linux.sh has non-fatal errors
# (wine-staging amd64, 404 mirror errors) that must not abort the whole setup.

WORKER_DIR="/opt/goldbook-worker"
DISPLAY_NUM=":99"
export WINEPREFIX="/root/.mt5"
export DISPLAY="$DISPLAY_NUM"

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — VPS Setup"
echo "======================================================"

# ── 1. System packages ─────────────────────────────────────────────────────
echo "[1/7] Installing system packages..."
# Remove incompatible 32-bit x86 architecture if present (safe to ignore error)
dpkg --remove-architecture i386 2>/dev/null || true
apt-get update -qq --fix-missing || true
apt-get install -y xvfb wget python3 python3-pip python3-venv curl unzip xauth

# ── 2. Start Xvfb FIRST so Wine can initialise its prefix ──────────────────
echo "[2/7] Starting Xvfb virtual display on $DISPLAY_NUM..."
pkill -x Xvfb 2>/dev/null || true
sleep 1
Xvfb "$DISPLAY_NUM" -screen 0 1280x800x24 &
XVFB_PID=$!
sleep 3  # Give Xvfb time to start
echo "   Xvfb PID: $XVFB_PID — DISPLAY=$DISPLAY"

# ── 3. Hangover 11.4 ────────────────────────────────────────────────────────
echo "[3/7] Installing Hangover 11.4 (ARM64 native Wine)..."

# Wipe old prefixes to prevent arch conflicts
rm -rf ~/.wine ~/.mt5 /root/.wine /root/.mt5 2>/dev/null || true

# Download and unpack Hangover
HANGOVER_TAR="/tmp/hangover.tar"
echo "   Downloading Hangover 11.4..."
wget -q --show-progress \
  "https://github.com/AndreRH/hangover/releases/download/hangover-11.4/hangover_11.4_ubuntu2404_noble_arm64.tar" \
  -O "$HANGOVER_TAR"

mkdir -p /opt/hangover
echo "   Extracting Hangover..."
# Try with strip-components first, fall back to plain extract
tar -xf "$HANGOVER_TAR" -C /opt/hangover --strip-components=1 2>/dev/null \
  || tar -xf "$HANGOVER_TAR" -C /opt/hangover

# Symlink so everything finds wine naturally
ln -sf /opt/hangover/bin/wine64 /usr/bin/wine64
ln -sf /opt/hangover/bin/wine   /usr/bin/wine
echo "   Hangover installed → $(wine64 --version 2>/dev/null || echo 'check /opt/hangover/bin')"

# Pre-initialise the Wine prefix NOW (with DISPLAY set) so wineboot doesn't time out
echo "   Pre-initialising Wine prefix at $WINEPREFIX ..."
WINEDLLOVERRIDES="mscoree,mshtml=" wine64 wineboot --init 2>/dev/null || true
sleep 5

# ── 4. MetaTrader 5 ─────────────────────────────────────────────────────────
echo "[4/7] Downloading and installing MetaTrader 5..."

MT5_SCRIPT="/tmp/mt5linux.sh"
wget -q "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5linux.sh" -O "$MT5_SCRIPT"
chmod +x "$MT5_SCRIPT"

# Patch out all x86-only Wine install steps — Hangover replaces them all
sed -i 's/dpkg --add-architecture i386/echo "Skipping i386 on ARM64"/g'         "$MT5_SCRIPT"
sed -i 's/apt-get install -y wine-stable/echo "Skipping wine-stable on ARM64"/g' "$MT5_SCRIPT"
sed -i 's/apt-get install -y wine-staging/echo "Skipping wine-staging on ARM64"/g' "$MT5_SCRIPT"
sed -i 's/apt-get install -y winehq-staging/echo "Skipping winehq-staging on ARM64"/g' "$MT5_SCRIPT"
sed -i 's/apt-get install -y wine$/echo "Skipping wine on ARM64"/g'               "$MT5_SCRIPT"
sed -i 's/apt-get install.*wine.*/echo "Skipping wine install on ARM64"/g'        "$MT5_SCRIPT"

# Run installer — errors from wine-staging are expected and safe to ignore
echo "   Running MT5 Linux installer (this takes 3-6 minutes)..."
yes | bash "$MT5_SCRIPT" || true

# ── 5. /usr/bin/mt5 wrapper ─────────────────────────────────────────────────
echo "[5/7] Creating /usr/bin/mt5 launcher..."
cat > /usr/bin/mt5 << 'WRAPPER'
#!/bin/bash
export DISPLAY="${DISPLAY:-:99}"
export WINEPREFIX="${WINEPREFIX:-/root/.mt5}"
export WINEDLLOVERRIDES="mscoree,mshtml="
exec /opt/hangover/bin/wine64 \
  "$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe" "$@"
WRAPPER
chmod +x /usr/bin/mt5

# Verify MT5 is installed
MT5_EXE="$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe"
if [ -f "$MT5_EXE" ]; then
  echo "   ✅ MT5 terminal found: $MT5_EXE"
else
  echo "   ⚠️  MT5 terminal NOT found at expected path."
  echo "      Checking alternative locations..."
  find "$WINEPREFIX" -name "terminal64.exe" 2>/dev/null | head -5
fi

# ── 6. Worker directory & Python env ────────────────────────────────────────
echo "[6/7] Setting up Python environment..."
mkdir -p "$WORKER_DIR"
python3 -m venv "$WORKER_DIR/venv"
"$WORKER_DIR/venv/bin/pip" install -q requests python-dotenv

# Copy worker files
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/orchestrator.py"  "$WORKER_DIR/"
cp "$SCRIPT_DIR/GoldBookSync.mq5" "$WORKER_DIR/"

# ── .env file ────────────────────────────────────────────────────────────────
ENV_FILE="$WORKER_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
cat > "$ENV_FILE" << 'ENVEOF'
# ── Supabase ──────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ── GoldBook API ──────────────────────────────────────────────
API_BASE=https://yourdomain.com/api
GOLDBOOK_API_URL=https://yourdomain.com/api/ea-sync
WORKER_SECRET=your-secret-here

# ── MT5 ───────────────────────────────────────────────────────
MT5_BINARY=/usr/bin/mt5
DISPLAY=:99
WINEPREFIX=/root/.mt5

# ── Tuning ────────────────────────────────────────────────────
# 24GB Oracle VPS: 20 users × 175MB RAM = 3.5 GB — set MAX_PARALLEL=20
SYNC_INTERVAL_SECONDS=30
MT5_TIMEOUT_SECONDS=90
MAX_PARALLEL=20
ENVEOF
  echo "   ⚠️  Edit $ENV_FILE with your credentials before starting!"
else
  echo "   .env already exists — skipping."
fi

# ── 7. Systemd services ──────────────────────────────────────────────────────
echo "[7/7] Creating systemd services..."

cat > /etc/systemd/system/xvfb-goldbook.service << EOF
[Unit]
Description=Xvfb Virtual Display for GoldBook MT5
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb $DISPLAY_NUM -screen 0 1280x800x24
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/goldbook-worker.service << EOF
[Unit]
Description=GoldBook MT5 Parallel Orchestrator
After=network.target xvfb-goldbook.service
Requires=xvfb-goldbook.service

[Service]
WorkingDirectory=$WORKER_DIR
EnvironmentFile=$WORKER_DIR/.env
Environment="DISPLAY=$DISPLAY_NUM"
Environment="WINEPREFIX=/root/.mt5"
ExecStart=$WORKER_DIR/venv/bin/python orchestrator.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable xvfb-goldbook
systemctl enable goldbook-worker
systemctl start xvfb-goldbook

echo ""
echo "======================================================"
echo "  Setup Complete!"
echo "======================================================"
echo ""
echo "  ① Edit credentials:   nano $ENV_FILE"
echo "  ② Start worker:       sudo systemctl start goldbook-worker"
echo "  ③ Live logs:          sudo journalctl -u goldbook-worker -f"
echo ""
echo "  Verification commands:"
echo "    wine64 --version               → Should show Hangover version"
echo "    ls '$WINEPREFIX/drive_c/Program Files/MetaTrader 5/'"
echo "    systemctl status xvfb-goldbook → Should be active (running)"
echo ""

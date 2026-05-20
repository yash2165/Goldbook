#!/bin/bash
# =============================================================================
# GoldBook — Ubuntu VPS Setup Script (Fixed for ARM64 + Hangover 11.4)
# Oracle Free Tier (24 GB ARM) / Any Ubuntu 20.04+ VPS
# Run as: sudo bash setup_ubuntu.sh
# =============================================================================

WORKER_DIR="/opt/goldbook-worker"
WINEPREFIX="/root/.mt5"
DISPLAY_NUM=":99"
export WINEPREFIX DISPLAY="$DISPLAY_NUM"

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — VPS Setup"
echo "======================================================"

# ── 1. System packages ─────────────────────────────────────────────────────
echo "[1/7] Installing system packages..."
dpkg --remove-architecture i386 2>/dev/null || true
apt-get update -qq --fix-missing || true
apt-get install -y xvfb wget python3 python3-pip python3-venv curl unzip xauth cabextract

# ── 2. Start Xvfb FIRST — Wine requires a display to initialise ────────────
echo "[2/7] Starting Xvfb virtual display on $DISPLAY_NUM..."
pkill -x Xvfb 2>/dev/null || true
sleep 1
Xvfb "$DISPLAY_NUM" -screen 0 1280x800x24 -nolisten tcp &
XVFB_PID=$!
sleep 3
echo "   Xvfb started (PID $XVFB_PID)"

# ── 3. Install Hangover 11.4 via .deb packages ─────────────────────────────
echo "[3/7] Installing Hangover 11.4 (ARM64 native Wine)..."

# Clean up any previous broken installations
rm -rf /opt/hangover /tmp/hangover_debs 2>/dev/null || true
rm -rf ~/.wine ~/.mt5 /root/.wine /root/.mt5 2>/dev/null || true

mkdir -p /tmp/hangover_debs
HANGOVER_TAR="/tmp/hangover.tar"

echo "   Downloading Hangover 11.4 tar (~234 MB)..."
wget -q --show-progress \
  "https://github.com/AndreRH/hangover/releases/download/hangover-11.4/hangover_11.4_ubuntu2404_noble_arm64.tar" \
  -O "$HANGOVER_TAR"

echo "   Extracting .deb packages from tar..."
tar -xf "$HANGOVER_TAR" -C /tmp/hangover_debs/

echo "   Installing Hangover .deb packages..."
# Install all .deb files found inside the tar
dpkg -i /tmp/hangover_debs/*.deb 2>&1 || apt-get install -f -y 2>&1 || true

# Verify wine64 is now installed and working
echo "   Verifying Hangover wine64..."
WINE64_PATH=$(which wine64 2>/dev/null || echo "NOT FOUND")
echo "   wine64 path: $WINE64_PATH"
wine64 --version 2>&1 || echo "   ⚠ wine64 --version failed (may still work)"

# ── 4. Pre-initialise the Wine prefix WITH the display running ─────────────
echo "[4/7] Initialising Wine prefix at $WINEPREFIX..."
mkdir -p "$WINEPREFIX"

# Run wineboot with display — this is REQUIRED before MT5 can be installed
WINEDLLOVERRIDES="mscoree,mshtml=" wine64 wineboot --init 2>&1
WINEBOOT_EXIT=$?
echo "   wineboot exit code: $WINEBOOT_EXIT"

# Give wineserver time to fully settle
sleep 5
wineserver --wait 2>/dev/null || true
echo "   Wine prefix initialised."

# ── 5. Install MetaTrader 5 using the WINDOWS installer (bypasses mt5linux.sh)
echo "[5/7] Installing MetaTrader 5..."

MT5_INSTALLER="/tmp/mt5setup.exe"
echo "   Downloading MT5 Windows installer..."
wget -q --show-progress \
  "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe" \
  -O "$MT5_INSTALLER"

echo "   Running MT5 silent install via Hangover wine64..."
echo "   (This takes 2-5 minutes — do not interrupt)"

WINEDLLOVERRIDES="mscoree,mshtml=" \
wine64 "$MT5_INSTALLER" /silent 2>&1 &
MT5_INSTALL_PID=$!

# Wait up to 5 minutes for MT5 to install
SECONDS_WAITED=0
while kill -0 $MT5_INSTALL_PID 2>/dev/null; do
  sleep 5
  SECONDS_WAITED=$((SECONDS_WAITED + 5))
  echo "   Waiting for MT5 installer... ${SECONDS_WAITED}s"
  if [ $SECONDS_WAITED -ge 300 ]; then
    echo "   ⚠ MT5 install taking >5 min, checking if already installed..."
    break
  fi
done

# Check if MT5 installed successfully
MT5_EXE="$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe"
if [ -f "$MT5_EXE" ]; then
  echo "   ✅ MT5 installed at: $MT5_EXE"
else
  echo "   ❌ terminal64.exe not found. Searching for it..."
  find "$WINEPREFIX" -name "terminal64.exe" 2>/dev/null | head -5
  echo ""
  echo "   MT5 may have installed to a different path."
  echo "   Check: ls '$WINEPREFIX/drive_c/Program Files/'"
fi

# ── 6. Create /usr/bin/mt5 wrapper ─────────────────────────────────────────
echo "[6/7] Creating /usr/bin/mt5 launcher..."
cat > /usr/bin/mt5 << 'WRAPPER'
#!/bin/bash
export DISPLAY="${DISPLAY:-:99}"
export WINEPREFIX="${WINEPREFIX:-/root/.mt5}"
export WINEDLLOVERRIDES="mscoree,mshtml="
exec wine64 "$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe" "$@"
WRAPPER
chmod +x /usr/bin/mt5

# ── 7. Python worker environment ────────────────────────────────────────────
echo "[7/7] Setting up Python worker environment..."
mkdir -p "$WORKER_DIR"
python3 -m venv "$WORKER_DIR/venv"
"$WORKER_DIR/venv/bin/pip" install -q requests python-dotenv

# Copy worker files
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/orchestrator.py"  "$WORKER_DIR/"
cp "$SCRIPT_DIR/GoldBookSync.mq5" "$WORKER_DIR/"

# .env template
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

# ── MT5 / Wine ────────────────────────────────────────────────
MT5_BINARY=/usr/bin/mt5
DISPLAY=:99
WINEPREFIX=/root/.mt5

# ── Tuning (24GB Oracle VPS → 20 users) ──────────────────────
SYNC_INTERVAL_SECONDS=30
MT5_TIMEOUT_SECONDS=90
MAX_PARALLEL=20
ENVEOF
  echo "   ⚠️  Edit $ENV_FILE with your credentials before starting!"
else
  echo "   .env already exists — skipping."
fi

# ── Systemd services ────────────────────────────────────────────────────────
cat > /etc/systemd/system/xvfb-goldbook.service << EOF
[Unit]
Description=Xvfb Virtual Display for GoldBook MT5
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb $DISPLAY_NUM -screen 0 1280x800x24 -nolisten tcp
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
systemctl enable xvfb-goldbook goldbook-worker
systemctl start xvfb-goldbook

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  Setup Complete!"
echo "======================================================"
echo ""
echo "  Verify MT5 installed:"
echo "    ls '$WINEPREFIX/drive_c/Program Files/MetaTrader 5/'"
echo ""
echo "  ① Edit credentials:   nano $ENV_FILE"
echo "  ② Start worker:       sudo systemctl start goldbook-worker"
echo "  ③ Live logs:          sudo journalctl -u goldbook-worker -f"
echo ""

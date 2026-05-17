#!/bin/bash
# =============================================================================
# GoldBook — Ubuntu VPS Setup Script
# Oracle Free Tier (24 GB ARM) / Any Ubuntu 20.04+ VPS
# Run as root: sudo bash setup_ubuntu.sh
# =============================================================================
set -e

WORKER_DIR="/opt/goldbook-worker"
MT5_DATA_ROOT="/opt/mt5data"
DISPLAY_NUM=":99"

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — VPS Setup"
echo "======================================================"

# ── 1. System packages ─────────────────────────────────────────────────────
echo "[1/6] Installing system packages..."
# Preemptively clean up the incompatible 32-bit x86 architecture if present
dpkg --remove-architecture i386 || true
apt-get update -qq
apt-get install -y xvfb wget python3 python3-pip python3-venv curl unzip xauth

# ── 2. MT5 Linux terminal ──────────────────────────────────────────────────
echo "[2/6] Installing MetaTrader 5 Linux terminal..."
MT5_SCRIPT="/tmp/mt5linux.sh"
wget -q "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5linux.sh" -O "$MT5_SCRIPT"
chmod +x "$MT5_SCRIPT"

# Patch mt5linux.sh to skip adding the incompatible i386 architecture on ARM64 systems
sed -i 's/dpkg --add-architecture i386/echo "Skipping i386 on ARM64"/g' "$MT5_SCRIPT"

# Run the official MetaQuotes installer script automatically
yes | "$MT5_SCRIPT" || true

# Create the /usr/bin/mt5 wrapper script to bridge Box64, Wine x86_64, and the Orchestrator
echo "Creating /usr/bin/mt5 launcher wrapper..."
cat << 'EOF' > /usr/bin/mt5
#!/bin/bash
USER_HOME="${HOME:-/root}"
export WINEPREFIX="$USER_HOME/.mt5"
export WINEDLLOVERRIDES="mscoree,mshtml="
export BOX64_LOG=1
box64 /opt/wine-x86_64/bin/wine64 "$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe" "$@"
EOF
chmod +x /usr/bin/mt5

MT5_BIN=$(which mt5 || echo "/usr/bin/mt5")
echo "   MT5 binary: $MT5_BIN"

# ── 3. Worker directory & Python env ──────────────────────────────────────
echo "[3/6] Setting up Python environment..."
mkdir -p "$WORKER_DIR" "$MT5_DATA_ROOT"
python3 -m venv "$WORKER_DIR/venv"
"$WORKER_DIR/venv/bin/pip" install -q requests python-dotenv

# Copy worker files from wherever this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$SCRIPT_DIR/orchestrator.py"  "$WORKER_DIR/"
cp "$SCRIPT_DIR/GoldBookSync.mq5" "$WORKER_DIR/"

# ── 4. .env file ───────────────────────────────────────────────────────────
echo "[4/6] Creating .env template..."
ENV_FILE="$WORKER_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
cat > "$ENV_FILE" << 'EOF'
# ── Supabase ──────────────────────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# ── GoldBook API ──────────────────────────────────────────────
API_BASE=https://yourdomain.com/api
GOLDBOOK_API_URL=https://yourdomain.com/api/ea-sync
WORKER_SECRET=your-secret-here

# ── MT5 ───────────────────────────────────────────────────────
MT5_BINARY=/usr/bin/mt5
MT5_DATA_ROOT=/opt/mt5data
DISPLAY=:99

# ── Tuning ────────────────────────────────────────────────────
# 24GB Oracle VPS: 20 users × 175MB RAM = 3.5 GB — set MAX_PARALLEL=20
SYNC_INTERVAL_SECONDS=30
MT5_TIMEOUT_SECONDS=90
MAX_PARALLEL=20
EOF
  echo "   ⚠️  Edit $ENV_FILE with your credentials before starting!"
else
  echo "   .env already exists — skipping."
fi

# ── 5. Systemd services ────────────────────────────────────────────────────
echo "[5/6] Creating systemd services..."

# Xvfb virtual display
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

# Orchestrator
cat > /etc/systemd/system/goldbook-worker.service << EOF
[Unit]
Description=GoldBook MT5 Parallel Orchestrator
After=network.target xvfb-goldbook.service
Requires=xvfb-goldbook.service

[Service]
WorkingDirectory=$WORKER_DIR
EnvironmentFile=$WORKER_DIR/.env
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

echo "[6/6] Done!"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  Setup Complete!"
echo "======================================================"
echo ""
echo "  ① Edit credentials:   nano $ENV_FILE"
echo "  ② Start worker:       sudo systemctl start goldbook-worker"
echo "  ③ Live logs:          sudo journalctl -u goldbook-worker -f"
echo "  ④ Check MT5:          ls $MT5_DATA_ROOT"
echo ""
echo "  Performance estimate for 24GB Oracle VPS (20 users):"
echo "    • All 20 MT5 instances launch simultaneously"
echo "    • RAM used: 20 × 175 MB = 3.5 GB of 24 GB"
echo "    • Sync cycle time: ~25-35 seconds"
echo "    • SYNC_INTERVAL_SECONDS=30 → near real-time for every user ✅"
echo ""

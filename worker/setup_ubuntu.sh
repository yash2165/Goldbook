#!/bin/bash
# GoldBook MT5 Parallel Orchestrator — Linux Server Setup
# Optimised for ARM64 server architectures
# CONFIRMED: hangover-wine provides /usr/bin/wine (NOT wine64) on ARM64

set -e

WORKER_DIR="/home/ubuntu/goldbook-worker"
WINEPREFIX="/home/ubuntu/.mt5"
DISPLAY_NUM=":99"
WINE="/usr/bin/wine"   # Confirmed path from dpkg -L hangover-wine
export WINEPREFIX DISPLAY="$DISPLAY_NUM"

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — Server Setup"
echo "  Method: Hangover 11.4 (ARM64, wine binary confirmed)"
echo "======================================================"

echo "[1/7] Cleaning up previous attempts..."
rm -rf /opt/amd64-chroot /usr/bin/amd64-chroot 2>/dev/null || true
apt-get remove --purge -y qemu-user-static binfmt-support debootstrap 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true
pkill -9 -x Xvfb 2>/dev/null || true
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

echo "[2/7] Installing Host Dependencies..."
apt-get update -qq
apt-get install -y xvfb wget curl unzip python3 python3-pip python3-venv \
    xauth cabextract libsdl2-2.0-0 libosmesa6 libxss1 \
    ca-certificates libgnutls30 gnutls-bin

echo "[3/7] Starting Xvfb virtual display on $DISPLAY_NUM..."
if [ -f /tmp/.X99-lock ] && ! pgrep -x Xvfb > /dev/null; then
  rm -f /tmp/.X99-lock
fi
if ! pgrep -x Xvfb > /dev/null; then
  Xvfb "$DISPLAY_NUM" -screen 0 1280x800x24 -nolisten tcp &
  sleep 3
  echo "   Xvfb started"
else
  echo "   Xvfb already running — OK"
fi

echo "[4/7] Installing Hangover 11.4..."
# Purge old install completely so postinstall runs fresh
apt-get purge -y hangover-wine hangover-libarm64ecfex hangover-libwow64fex hangover-wowbox64 2>/dev/null || true
# Remove any stale wine symlinks
rm -f /usr/bin/wine /usr/bin/wine64 2>/dev/null || true
rm -rf /tmp/hangover_debs
mkdir -p /tmp/hangover_debs

echo "   Downloading Hangover 11.4 (~234 MB)..."
rm -f /tmp/hangover.tar
wget -q --show-progress -O /tmp/hangover.tar \
  "https://github.com/AndreRH/hangover/releases/download/hangover-11.4/hangover_11.4_ubuntu2404_noble_arm64.tar"

echo "   Installing Hangover packages..."
tar -xf /tmp/hangover.tar -C /tmp/hangover_debs
dpkg -i /tmp/hangover_debs/*.deb || apt-get install -f -y

# Verify using confirmed binary path
if [ ! -f "$WINE" ]; then
    echo "   ❌ $WINE not found! Listing installed wine files:"
    dpkg -L hangover-wine 2>/dev/null | grep bin
    exit 1
fi
echo "   ✅ Wine confirmed at: $WINE ($($WINE --version 2>/dev/null || echo 'version check skipped'))"

echo "[5/7] Initialising Wine prefix at $WINEPREFIX..."
rm -rf "$WINEPREFIX"
mkdir -p "$WINEPREFIX"

# Initialize wine prefix — on ARM64 Hangover, wineboot is called via wine
DISPLAY="$DISPLAY_NUM" WINEDLLOVERRIDES="mscoree,mshtml=" "$WINE" wineboot 2>&1 || true
sleep 5

# Force X11 graphics driver (prevents nodrv_CreateWindow crashes)
DISPLAY="$DISPLAY_NUM" "$WINE" reg add "HKCU\Software\Wine\Drivers" \
    /v Graphics /d "x11" /f 2>/dev/null || true
sleep 2

echo "[6/7] Installing MetaTrader 5..."
MT5_INSTALLER="/tmp/mt5setup.exe"
if [ ! -f "$MT5_INSTALLER" ]; then
    wget -q --show-progress -O "$MT5_INSTALLER" \
      "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
fi

echo "   Running install with /auto flag (correct flag for Hangover)..."
DISPLAY="$DISPLAY_NUM" WINEDLLOVERRIDES="mscoree,mshtml=" \
    "$WINE" "$MT5_INSTALLER" /auto 2>&1 &
MT5_PID=$!

# Wait up to 5 minutes
TIMEOUT=300
ELAPSED=0
while kill -0 $MT5_PID 2>/dev/null; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo "   ...waiting ${ELAPSED}s"
    if [ $ELAPSED -ge $TIMEOUT ]; then
        kill -9 $MT5_PID 2>/dev/null || true
        break
    fi
done
sleep 10

MT5_EXE="$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe"
if [ -f "$MT5_EXE" ]; then
    echo "   ✅ MT5 Installed at: $MT5_EXE"
    # Cleanly stop any automatically spawned MT5 processes in the prefix to release file locks
    wineserver -k 2>/dev/null || true
    sleep 2
else
    echo "   ❌ terminal64.exe not found. Searching..."
    find "$WINEPREFIX" -name "terminal64.exe" 2>/dev/null || true
    echo "   Contents of Program Files:"
    ls "$WINEPREFIX/drive_c/Program Files/" 2>/dev/null || echo "   (empty or missing)"
    exit 1
fi

echo "[7/7] Setting up Python Worker..."
mkdir -p "$WORKER_DIR"
# Copy orchestrator and sync script from the worker folder or current folder
cp -f worker/orchestrator.py worker/GoldBookSync.mq5 "$WORKER_DIR/" 2>/dev/null || \
cp -f orchestrator.py GoldBookSync.mq5 "$WORKER_DIR/" 2>/dev/null || true

if [ ! -d "$WORKER_DIR/venv" ]; then
    python3 -m venv "$WORKER_DIR/venv"
    "$WORKER_DIR/venv/bin/pip" install -q -r "$WORKER_DIR/requirements.txt" 2>/dev/null || \
    "$WORKER_DIR/venv/bin/pip" install -q requests python-dotenv
fi

if [ ! -f "$WORKER_DIR/.env" ]; then
cat << 'EOF' > "$WORKER_DIR/.env"
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
API_BASE=https://goldbook-roan.vercel.app/api
WORKER_SECRET=your_secure_worker_secret
DISPLAY=:99
WINEPREFIX=/home/ubuntu/.mt5
SYNC_INTERVAL_SECONDS=30
EOF
fi

# Ensure all worker files, main WINEPREFIX, and sandboxes are owned by the ubuntu user
chown -R ubuntu:ubuntu "$WORKER_DIR" "$WINEPREFIX" /home/ubuntu/.mt5_sandboxes 2>/dev/null || true

cat << 'EOF' > /etc/systemd/system/goldbook-worker.service
[Unit]
Description=GoldBook MT5 Parallel Orchestrator
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/goldbook-worker
EnvironmentFile=/home/ubuntu/goldbook-worker/.env
Environment="DISPLAY=:99"
Environment="WINEPREFIX=/home/ubuntu/.mt5"
Environment="HOME=/home/ubuntu"
Environment="USER=ubuntu"
ExecStart=/home/ubuntu/goldbook-worker/venv/bin/python orchestrator.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable goldbook-worker 2>/dev/null || true

echo ""
echo "======================================================"
echo "  [8/7] Setup Complete!"
echo "======================================================"
echo "  Edit credentials:  nano $WORKER_DIR/.env"
echo "  Start worker:      systemctl start goldbook-worker"
echo "  Live logs:         journalctl -u goldbook-worker -f"

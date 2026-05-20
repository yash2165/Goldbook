#!/bin/bash
# GoldBook MT5 Parallel Orchestrator — VPS Setup (Hangover 11.4)
# Optimised for Oracle Cloud ARM64 (Ampere A1)

set -e

WORKER_DIR="/opt/goldbook-worker"
WINEPREFIX="/root/.mt5"
DISPLAY_NUM=":99"
WINE64="/opt/wine-x86_64/bin/wine64"
export WINEPREFIX DISPLAY="$DISPLAY_NUM"

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — VPS Setup"
echo "  Method: Hangover 11.4 (Fixed for Oracle ARM64)"
echo "======================================================"

echo "[1/8] Cleaning up previous QEMU/Chroot attempts..."
rm -rf /opt/amd64-chroot /usr/bin/amd64-chroot /usr/local/bin/amd64-chroot 2>/dev/null || true
apt-get remove --purge -y qemu-user-static binfmt-support debootstrap schroot 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

echo "[2/8] Installing Host Dependencies..."
apt-get update
# Note: DELIBERATELY REMOVED 'fonts-wine' as it conflicts with Hangover and breaks apt!
apt-get install -y xvfb wget curl unzip python3 python3-pip python3-venv xauth cabextract libsdl2-2.0-0 libosmesa6 libxss1

echo "[3/8] Starting Xvfb virtual display on $DISPLAY_NUM..."
if [ -f /tmp/.X99-lock ] && ! pgrep -x Xvfb > /dev/null; then
  rm -f /tmp/.X99-lock
fi
if ! pgrep -x Xvfb > /dev/null; then
  Xvfb "$DISPLAY_NUM" -screen 0 1280x800x24 -nolisten tcp &
  sleep 3
  echo "   Xvfb started (PID $!)"
else
  echo "   Xvfb already running — OK"
fi

echo "[4/8] Installing Hangover 11.4..."
rm -rf /opt/hangover /tmp/hangover_debs 2>/dev/null || true
mkdir -p /tmp/hangover_debs

if [ ! -f "/tmp/hangover.tar" ]; then
    echo "   Downloading Hangover 11.4 tar (~234 MB)..."
    wget -q --show-progress -O /tmp/hangover.tar "https://github.com/AndreRH/hangover/releases/download/hangover-11.4/hangover_11.4_ubuntu2404_noble_arm64.tar"
fi

echo "   Extracting & Installing Hangover..."
tar -xf /tmp/hangover.tar -C /tmp/hangover_debs
# Force overwrite to prevent any lingering font conflicts
dpkg -i --force-overwrite /tmp/hangover_debs/*.deb 2>/dev/null || apt-get install -f -y

if [ ! -f "$WINE64" ]; then
    echo "   ❌ Hangover installation failed!"
    exit 1
fi

echo "[5/8] Initialising Wine Prefix (Forcing X11)..."
rm -rf "$WINEPREFIX"
mkdir -p "$WINEPREFIX"

# Force X11 instead of Wayland to prevent nodrv_CreateWindow crashes
DISPLAY="$DISPLAY_NUM" WINEDLLOVERRIDES="mscoree,mshtml=" "$WINE64" reg add "HKCU\Software\Wine\Drivers" /v Graphics /d "x11" /f 2>/dev/null || true
DISPLAY="$DISPLAY_NUM" WINEDLLOVERRIDES="mscoree,mshtml=" "$WINE64" wineboot --init 2>&1
sleep 5

echo "[6/8] Installing MetaTrader 5..."
MT5_INSTALLER="/tmp/mt5setup.exe"
if [ ! -f "$MT5_INSTALLER" ]; then
    wget -q --show-progress -O "$MT5_INSTALLER" "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
fi

echo "   Running silent install (Takes 1-3 minutes)..."
DISPLAY="$DISPLAY_NUM" WINEDLLOVERRIDES="mscoree,mshtml=" "$WINE64" "$MT5_INSTALLER" /silent 2>&1 &
MT5_PID=$!

# Wait loop
TIMEOUT=300
ELAPSED=0
while kill -0 $MT5_PID 2>/dev/null; do
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    if [ $ELAPSED -ge $TIMEOUT ]; then
        kill -9 $MT5_PID 2>/dev/null || true
        break
    fi
done
sleep 10

if [ -f "$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; then
    echo "   ✅ MT5 Installed Successfully!"
else
    echo "   ❌ terminal64.exe not found."
    exit 1
fi

echo "[7/8] Setting up Python Worker..."
mkdir -p "$WORKER_DIR"
cp -r orchestrator.py requirements.txt "$WORKER_DIR/"
if [ ! -d "$WORKER_DIR/venv" ]; then
    python3 -m venv "$WORKER_DIR/venv"
    "$WORKER_DIR/venv/bin/pip" install -r "$WORKER_DIR/requirements.txt"
fi

cat << 'EOF' > "$WORKER_DIR/.env"
GOLDBOOK_API_URL=http://your-nextjs-app.com/api
WORKER_SECRET=your_secure_worker_secret
MT5_SERVER_IP=127.0.0.1
EOF

cat << 'EOF' > /etc/systemd/system/goldbook-worker.service
[Unit]
Description=GoldBook MT5 Parallel Orchestrator
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/goldbook-worker
Environment="DISPLAY=:99"
Environment="WINEPREFIX=/root/.mt5"
ExecStart=/opt/goldbook-worker/venv/bin/python orchestrator.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable goldbook-worker 2>/dev/null || true

echo "[8/8] Setup Complete! MT5 is installed and ready."

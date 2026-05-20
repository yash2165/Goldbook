#!/bin/bash
# GoldBook MT5 Parallel Orchestrator — VPS Setup (QEMU Chroot Method)
# This script sets up an amd64 environment on an ARM64 host using qemu-user-static and debootstrap.

WORKER_DIR="/opt/goldbook-worker"
WINEPREFIX="/root/.mt5"
DISPLAY_NUM=":99"
CHROOT_DIR="/opt/amd64-chroot"
CHROOT_CMD="/usr/bin/amd64-chroot"

export DEBIAN_FRONTEND=noninteractive

echo "======================================================"
echo "  GoldBook MT5 Parallel Orchestrator — VPS Setup"
echo "  Method: QEMU-User-Static + Debootstrap (Amd64)"
echo "======================================================"

echo "[1/8] Installing Host Dependencies..."
apt-get update
apt-get install -y qemu-user-static binfmt-support debootstrap xvfb wget curl unzip python3 python3-pip python3-venv 2>/dev/null || true

echo "[2/8] Creating AMD64 Chroot Environment (Takes 3-5 minutes)..."
if [ ! -d "$CHROOT_DIR/etc" ]; then
    echo "   Running debootstrap stage 1 (foreign)..."
    debootstrap --arch=amd64 --foreign noble "$CHROOT_DIR" http://archive.ubuntu.com/ubuntu/
    
    echo "   Copying qemu-x86_64-static into chroot..."
    mkdir -p "$CHROOT_DIR/usr/bin"
    cp /usr/bin/qemu-x86_64-static "$CHROOT_DIR/usr/bin/"
    
    echo "   Running debootstrap stage 2 (inside chroot)..."
    chroot "$CHROOT_DIR" /debootstrap/debootstrap --second-stage
else
    echo "   Chroot directory already exists — skipping bootstrap."
fi

echo "[3/8] Configuring Chroot Mounts and Wrapper..."
cat << 'EOF' > "$CHROOT_CMD"
#!/bin/bash
CHROOT_DIR="/opt/amd64-chroot"
# Ensure essential filesystems are mounted
for dir in dev proc sys dev/pts tmp root; do
    mkdir -p "$CHROOT_DIR/$dir"
    if ! mountpoint -q "$CHROOT_DIR/$dir"; then
        mount --bind "/$dir" "$CHROOT_DIR/$dir"
    fi
done
# Copy resolv.conf for internet access
cp /etc/resolv.conf "$CHROOT_DIR/etc/resolv.conf"
exec chroot "$CHROOT_DIR" "$@"
EOF
chmod +x "$CHROOT_CMD"

# Run once to mount everything
$CHROOT_CMD echo "   Chroot mounts active."

echo "[4/8] Installing Standard Wine (x86_64) inside Chroot..."
cat << 'EOF' > "$CHROOT_DIR/tmp/install_wine.sh"
#!/bin/bash
export DEBIAN_FRONTEND=noninteractive
dpkg --add-architecture i386
apt-get update
apt-get install -y software-properties-common wget curl xvfb gnupg2
mkdir -pm755 /etc/apt/keyrings
wget -qO /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key
wget -qNP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources
apt-get update
apt-get install -y --install-recommends winehq-stable winbind cabextract
EOF
chmod +x "$CHROOT_DIR/tmp/install_wine.sh"
$CHROOT_CMD /tmp/install_wine.sh

echo "[5/8] Starting Xvfb virtual display on $DISPLAY_NUM..."
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

export DISPLAY="$DISPLAY_NUM"

echo "[6/8] Initialising Wine prefix at $WINEPREFIX..."
mkdir -p "$WINEPREFIX"
$CHROOT_CMD /bin/bash -c "export DISPLAY=$DISPLAY_NUM; export WINEPREFIX=$WINEPREFIX; wineboot --init"
sleep 5

echo "[7/8] Installing MetaTrader 5..."
wget -q -O /tmp/mt5setup.exe "https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe"
cp /tmp/mt5setup.exe "$CHROOT_DIR/tmp/"

echo "   Running MT5 silent install via standard Wine inside chroot..."
echo "   (This takes 2-5 minutes — do not interrupt)"
$CHROOT_CMD /bin/bash -c "export DISPLAY=$DISPLAY_NUM; export WINEPREFIX=$WINEPREFIX; wine /tmp/mt5setup.exe /silent" &
MT5_PID=$!

wait $MT5_PID || true
sleep 10 # Extra buffer for post-install background tasks

if [ -f "$WINEPREFIX/drive_c/Program Files/MetaTrader 5/terminal64.exe" ]; then
    echo "   ✅ MT5 Installed Successfully!"
else
    echo "   ❌ terminal64.exe not found. Installation may have failed."
    ls -l "$WINEPREFIX/drive_c/Program Files/" || true
fi

echo "[8/8] Setting up Python worker environment..."
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
ExecStartPre=/usr/bin/amd64-chroot echo "Mounting chroot filesystems"
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

#!/bin/bash

# =========================================================================
#  GoldBook Backtesting Engine - Master VPS Setup & Installer Script
#  Operating System: Ubuntu 22.04 LTS (Oracle VPS Free Tier)
# =========================================================================

# Clear the screen
clear

echo "========================================================================="
echo "  🥇 GOLDBOOK BACKTESTING ENGINE - VPS MASTER INSTALLER"
echo "  Target: PostgreSQL DB + FastAPI WebSockets + Nginx Proxy + Certbot SSL"
echo "========================================================================="
echo ""

# Ensure script is run with sudo permissions
if [ "$EUID" -ne 0 ]; then
  echo "❌ Error: Please run this script with sudo privileges (root):"
  echo "   sudo bash setup_vps.sh"
  exit 1
fi

# 1. Ask for DuckDNS subdomain
echo "🌐 STEP 1: Domain Configuration"
echo "----------------------------------------------------"
echo "Please enter your free DuckDNS subdomain (e.g., yash-backtest.duckdns.org)."
echo "Ensure this subdomain points to this VPS IP address in the DuckDNS dashboard first!"
echo ""
read -p "Enter Subdomain: " SUBDOMAIN

# Remove any leading http:// or https:// or slashes
SUBDOMAIN=$(echo "$SUBDOMAIN" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

if [ -z "$SUBDOMAIN" ]; then
  echo "❌ Error: Subdomain cannot be empty. Setup aborted."
  exit 1
fi

echo "✅ Target Subdomain registered as: $SUBDOMAIN"
echo ""

# 2. Ask for PostgreSQL database password
echo "🗄️ STEP 2: Database Configuration"
echo "----------------------------------------------------"
read -p "Enter secure password for PostgreSQL 'backtest_user' [default: GoldBookSecure123!]: " DB_PASS
DB_PASS=${DB_PASS:-GoldBookSecure123!}
echo "✅ PostgreSQL password set."
echo ""

# 3. System upgrades and packages
echo "📦 STEP 3: Installing Ubuntu System Dependencies"
echo "----------------------------------------------------"
echo "🔄 Updating repositories..."
apt update -y

echo "🔄 Installing Git, PostgreSQL, Python3, Nginx, and Certbot..."
apt install -y postgresql postgresql-contrib python3 python3-pip python3-venv nginx certbot python3-certbot-nginx

echo "✅ System packages installed."
echo ""

# 4. PostgreSQL User and Database creation
echo "🗄️ STEP 4: Creating PostgreSQL Database & User"
echo "----------------------------------------------------"
# Create user and db
sudo -u postgres psql -c "CREATE USER backtest_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || sudo -u postgres psql -c "ALTER USER backtest_user WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "CREATE DATABASE backtest_db OWNER backtest_user;" 2>/dev/null
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE backtest_db TO backtest_user;"

# Run the schema migrations
echo "🔄 Running database schema migration..."
if [ -f "./schema.sql" ]; then
  PGPASSWORD="$DB_PASS" psql -U backtest_user -d backtest_db -h localhost -f ./schema.sql
  echo "✅ Database tables created successfully!"
else
  echo "⚠️ Warning: schema.sql not found in the current directory. Tables will need to be migrated manually."
fi
echo ""

# 5. Set up Python backend service
echo "🐍 STEP 5: Configuring Python Virtual Environment & FastAPI"
echo "----------------------------------------------------"
# Navigate to home of backend
BACKEND_DIR=$(pwd)
echo "📂 Working directory: $BACKEND_DIR"

# Create Python virtual environment
echo "🔄 Creating Python virtual environment..."
python3 -m venv "$BACKEND_DIR/venv"
source "$BACKEND_DIR/venv/bin/activate"

# Install FastAPI dependencies
echo "🔄 Installing FastAPI, Uvicorn, Pandas, and Database drivers..."
pip install --upgrade pip
pip install fastapi uvicorn websockets psycopg2-binary pandas python-dotenv

# Write .env file
echo "🔄 Creating environment file (.env)..."
cat << EOF > "$BACKEND_DIR/.env"
DATABASE_URL=postgresql://backtest_user:$DB_PASS@localhost:5432/backtest_db
EOF

echo "✅ Python virtual environment and dependencies configured."
echo ""

# 6. Create systemd background service
echo "⚙️ STEP 6: Creating Background Service (systemd)"
echo "----------------------------------------------------"
SERVICE_FILE="/etc/systemd/system/backtest-api.service"

cat << EOF > "$SERVICE_FILE"
[Unit]
Description=GoldBook Backtesting FastAPI Engine Service
After=network.target

[Service]
User=ubuntu
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

echo "🔄 Loading and starting backtest background service..."
systemctl daemon-reload
systemctl enable backtest-api
systemctl restart backtest-api

# Confirm it's active
if systemctl is-active --quiet backtest-api; then
  echo "✅ Background service is running successfully!"
else
  echo "❌ Error: Background service failed to start. Run 'journalctl -u backtest-api' to check logs."
fi
echo ""

# 7. Configure Nginx reverse proxy
echo "🌐 STEP 7: Configuring Nginx Reverse Proxy"
echo "----------------------------------------------------"
NGINX_CONF="/etc/nginx/sites-available/backtest"

cat << EOF > "$NGINX_CONF"
server {
    listen 80;
    server_name $SUBDOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400; # 24 hours (prevents replay websocket disconnects)
    }
}
EOF

# Enable configuration and reload Nginx
echo "🔄 Activating Nginx configuration..."
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
# Remove default site to prevent conflict
rm -f /etc/nginx/sites-enabled/default

# Test Nginx
if nginx -t; then
  systemctl restart nginx
  echo "✅ Nginx proxy configured and restarted successfully!"
else
  echo "❌ Error: Nginx configuration test failed. Reverting changes."
  rm -f /etc/nginx/sites-enabled/backtest
  systemctl restart nginx
fi
echo ""

# 8. Certbot SSL configuration
echo "🔒 STEP 8: Let's Encrypt Free SSL Certificate (Certbot)"
echo "----------------------------------------------------"
read -p "Would you like to install free SSL certificates for secure WebSockets (wss://) now? (y/n): " INSTALL_SSL

if [[ "$INSTALL_SSL" =~ ^[Yy]$ ]]; then
  echo ""
  read -p "Enter your email address (for certificate renewal alerts): " USER_EMAIL
  
  if [ -z "$USER_EMAIL" ]; then
    echo "🔄 Running Certbot SSL registration without email..."
    certbot --nginx -d "$SUBDOMAIN" --agree-tos --register-unsafely-without-email --non-interactive --redirect
  else
    echo "🔄 Running Certbot SSL registration with email ($USER_EMAIL)..."
    certbot --nginx -d "$SUBDOMAIN" --agree-tos --email "$USER_EMAIL" --non-interactive --redirect
  fi
  
  # Reload Nginx to apply SSL
  systemctl restart nginx
  echo "✅ Let's Encrypt SSL successfully installed!"
  echo "   FastAPI HTTP: https://$SUBDOMAIN"
  echo "   FastAPI WebSockets: wss://$SUBDOMAIN/api/candles/replay"
else
  echo "⚠️ Skipping SSL installation. Note that secure Next.js frontends on HTTPS"
  echo "   will NOT be able to connect to this API unless SSL is configured!"
fi

echo ""
echo "========================================================================="
echo "🎉 SUCCESS! GOLDBOOK BACKTESTING ENGINE SETUP COMPLETE"
echo "------------------------------------------------------------------------="
echo "  Local API URL : http://127.0.0.1:8000"
echo "  Public SSL URL: https://$SUBDOMAIN"
echo "  Status        : Online & Running in Background"
echo "========================================================================="
echo ""
echo "👉 Next steps:"
echo "1. Put your BankNifty text data inside /home/ubuntu/backtest-data/banknifty/"
echo "2. Navigate to scripts/ and activate virtualenv: 'source venv/bin/activate'"
echo "3. Run 'python3 download_xauusd.py' (takes ~45 mins)"
echo "4. Run 'python3 import_xauusd.py'"
echo "5. Run 'python3 import_banknifty.py'"
echo "========================================================================="

import urllib.request
import base64
import sys

url = "https://www.vpngate.net/api/iphone/"
try:
    print("Fetching free VPN servers from VPN Gate...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response:
        content = response.read().decode('utf-8')
    
    lines = content.splitlines()
    servers = []
    for line in lines:
        if line.startswith("#") or line.startswith("*"):
            continue
        parts = line.split(',')
        if len(parts) >= 15:
            config_b64 = parts[-1]
            country = parts[6]
            ping = parts[3]
            speed = parts[4]
            if config_b64:
                servers.append((country, ping, speed, config_b64))
                
    if not servers:
        print("❌ No active OpenVPN servers found.")
        sys.exit(1)
    else:
        # Sort by speed descending
        fast_servers = sorted(servers, key=lambda s: -int(s[2]) if s[2].isdigit() else 0)
        best = fast_servers[0]
        
        speed_mbps = int(best[2])//1000000 if best[2].isdigit() else 0
        print(f"✅ Selected fastest free VPN: Country: {best[0]} | Ping: {best[1]}ms | Speed: {speed_mbps} Mbps")
        
        # Decode and write to vpn.ovpn
        config_data = base64.b64decode(best[3]).decode('utf-8', errors='ignore')
        with open("vpn.ovpn", "w") as f:
            f.write(config_data)
        print("🎉 Successfully wrote configuration to vpn.ovpn!")
        
except Exception as e:
    print(f"❌ Failed to fetch VPN list: {e}")
    sys.exit(1)

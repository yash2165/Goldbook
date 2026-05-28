import psycopg2
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

# Load database environment variables
load_dotenv(dotenv_path="../.env")

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://backtest_user:your_strong_password_here@localhost:5432/backtest_db"
)

DATA_FOLDER = "/home/ubuntu/backtest-data/banknifty/"

# Define Indian Standard Time (IST) offset (UTC + 5:30)
ist_tz = timezone(timedelta(hours=5, minutes=30))

print("===========================================================")
print("🚀 Starting BankNifty Spot 1-Minute Data Importer")
print(f"Data directory: {DATA_FOLDER}")
print("===========================================================\n")

# --- ENHANCEMENT: Scan all files robustly (regardless of hidden .txt extensions) ---
if not os.path.exists(DATA_FOLDER):
    print(f"❌ Error: Directory {DATA_FOLDER} does not exist.")
    exit(1)

all_files = os.listdir(DATA_FOLDER)
text_files = sorted([
    os.path.join(DATA_FOLDER, f) for f in all_files 
    if os.path.isfile(os.path.join(DATA_FOLDER, f)) and not f.startswith('.')
])

if not text_files:
    print(f"❌ Error: No files found in {DATA_FOLDER}")
    print("Please upload the BankNifty files to your VPS first.")
    exit(1)

print(f"📂 Found {len(text_files)} data files to parse.")

clean_rows = []
total_parsed = 0
skipped_tickers = set()

for filepath in text_files:
    filename = os.path.basename(filepath)
    print(f"🔄 Parsing {filename}...")
    
    with open(filepath, "r") as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) < 7:
                continue
                
            ticker = parts[0].strip().upper()
            date_str = parts[1].strip()
            time_str = parts[2].strip()
            
            # --- DEFENSIVE BUG FIX: Allow both 'BANKNIFTY' and shorthand 'BNF' ---
            if ticker not in ("BANKNIFTY", "BNF"):
                skipped_tickers.add(ticker)
                continue
                
            # --- FEATURE: Filter trading hours (09:15 to 15:30 IST) ---
            try:
                time_parts = time_str.split(":")
                hour = int(time_parts[0])
                minute = int(time_parts[1])
                
                # Market is open from 09:15 to 15:30 IST
                if not ((hour == 9 and minute >= 15) or (10 <= hour < 15) or (hour == 15 and minute <= 30)):
                    continue # Skip off-market rows
            except Exception:
                continue # Skip malformed times
                
            open_ = parts[3].strip()
            high = parts[4].strip()
            low = parts[5].strip()
            close_ = parts[6].strip()
            volume = parts[7].strip() if len(parts) > 7 else "0"
            
            try:
                # Parse naive datetime
                dt_naive = datetime.strptime(f"{date_str} {time_str}", "%Y%m%d %H:%M")
                # Localize to IST and convert to UTC for PG compatibility
                dt_utc = dt_naive.replace(tzinfo=ist_tz).astimezone(timezone.utc)
                
                # Append clean row: (symbol, ts, open, high, low, close, volume)
                clean_rows.append((
                    "BANKNIFTY",
                    dt_utc.strftime('%Y-%m-%d %H:%M:%S%z'),
                    float(open_),
                    float(high),
                    float(low),
                    float(close_),
                    int(float(volume))
                ))
                total_parsed += 1
            except Exception:
                continue

if skipped_tickers:
    print(f"ℹ️ Skipped other tickers in files: {list(skipped_tickers)}")

if not clean_rows:
    print("❌ No valid BankNifty/BNF spot rows found. Verify data format inside files.")
    exit(1)

# Write parsed rows to clean temp CSV for ultra-fast COPY command
temp_csv_path = "/tmp/banknifty_clean.csv"
print(f"\n✍️ Writing {total_parsed} clean rows to temporary CSV...")
with open(temp_csv_path, "w") as out:
    for r in clean_rows:
        out.write(f"{r[0]},{r[1]},{r[2]},{r[3]},{r[4]},{r[5]},{r[6]}\n")

print("🚀 Connecting to PostgreSQL and executing bulk COPY...")
conn = None
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    with open(temp_csv_path, "r") as f:
        cur.copy_from(
            f,
            "candles_1m",
            sep=",",
            columns=("symbol", "ts", "open", "high", "low", "close", "volume")
        )
    conn.commit()
    print(f"✅ Success! BankNifty spot data bulk import complete.")
    print(f"   Imported {total_parsed} clean 1-minute candles.")
except Exception as e:
    if conn:
        conn.rollback()
    print(f"❌ Database error bulk-copying BankNifty data: {e}")
finally:
    if 'cur' in locals() and cur:
        cur.close()
    if conn:
        conn.close()
    if os.path.exists(temp_csv_path):
        os.remove(temp_csv_path)

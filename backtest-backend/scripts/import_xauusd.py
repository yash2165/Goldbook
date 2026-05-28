import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

# Load database environment variables
load_dotenv(dotenv_path="../.env")

DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://backtest_user:your_strong_password_here@localhost:5432/backtest_db"
)

CSV_PATH = "/home/ubuntu/backtest-data/xauusd/xauusd_1min_5years.csv"

if not os.path.exists(CSV_PATH):
    print(f"❌ Error: Downloader CSV file not found at {CSV_PATH}")
    print("Please run 'python3 download_xauusd.py' first to download the data.")
    exit(1)

try:
    print("🔄 Step 1: Loading Gold CSV file into memory...")
    df = pd.read_csv(CSV_PATH)
    
    print("🧹 Step 2: Cleaning and structuring dataset...")
    # Rename 'datetime' to 'ts' to match the database column
    df = df.rename(columns={"datetime": "ts"})
    
    # --- DEFENSIVE BUG FIX: Handle missing volume column for Forex/Gold CFD ---
    if "volume" not in df.columns:
        df["volume"] = 0
    else:
        df["volume"] = df["volume"].fillna(0).astype(int)
        
    df["symbol"] = "XAUUSD"
    
    # Ensure correct column order matching table columns
    df = df[["symbol", "ts", "open", "high", "low", "close", "volume"]]
    
    # Drop any duplicate times to prevent primary key conflicts
    df = df.drop_duplicates(subset=["ts"])
    
    # Export clean dataframe to a temporary csv file for fast database copying
    temp_csv_path = "/tmp/xauusd_clean.csv"
    df.to_csv(temp_csv_path, index=False, header=False)
    
    print("🚀 Step 3: Connecting to PostgreSQL and executing COPY command...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Use postgres COPY FROM which runs at native C speeds
    with open(temp_csv_path, "r") as f:
        cur.copy_from(
            f, 
            "candles_1m", 
            sep=",", 
            columns=("symbol", "ts", "open", "high", "low", "close", "volume")
        )
    conn.commit()
    print(f"✅ Success! Gold (XAUUSD) data bulk import complete.")
    print(f"   Imported {len(df)} 1-minute candles.")
    
except Exception as e:
    if 'conn' in locals() and conn:
        conn.rollback()
    print(f"❌ Critical Error importing Gold data: {e}")
finally:
    if 'cur' in locals() and cur:
        cur.close()
    if 'conn' in locals() and conn:
        conn.close()
    if 'temp_csv_path' in locals() and os.path.exists(temp_csv_path):
        os.remove(temp_csv_path)

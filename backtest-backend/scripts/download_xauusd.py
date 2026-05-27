import requests
import pandas as pd
import time
import os
from datetime import datetime, timedelta

API_KEY = "632abe39534d4c80853ff0e6a9321d13"
SYMBOL = "XAU/USD"
INTERVAL = "1min"
OUTPUT_SIZE = 5000  # Max per request on Twelve Data free plan
OUTPUT_DIR = "/home/ubuntu/backtest-data/xauusd"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "xauusd_1min_5years.csv")

# Create output folder
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 5 years back from today
end_date = datetime.now()
start_date = end_date - timedelta(days=5*365)

all_candles = []
current_end = end_date

print(f"===========================================================")
print(f"🚀 Starting Gold (XAUUSD) 1-Minute Data Downloader")
print(f"Target Period: {start_date.date()} to {end_date.date()}")
print(f"This requires ~360 API calls. Twelve Data free tier allows 8 requests/min.")
print(f"To prevent being blocked, we sleep 8 seconds between requests.")
print(f"Estimated time to completion: ~45 minutes. You can run this in the background!")
print(f"===========================================================\n")

while current_end > start_date:
    url = (
        f"https://api.twelvedata.com/time_series"
        f"?symbol={SYMBOL}"
        f"&interval={INTERVAL}"
        f"&outputsize={OUTPUT_SIZE}"
        f"&end_date={current_end.strftime('%Y-%m-%d %H:%M:%S')}"
        f"&apikey={API_KEY}"
        f"&format=JSON"
    )
    
    try:
        response = requests.get(url)
        data = response.json()
        
        if "values" not in data:
            message = data.get("message", "unknown error")
            print(f"⚠️ Error from Twelve Data: {message}")
            if "api key" in message.lower():
                print("❌ Please check your Twelve Data API key.")
                break
            # If hit hourly/minly limit, wait longer and retry
            print("⏳ Rate limit or server error. Waiting 60 seconds before retrying...")
            time.sleep(60)
            continue
            
        values = data["values"]
        if not values:
            print("ℹ️ No more candles returned by API. Download complete.")
            break
            
        all_candles.extend(values)
        
        # Move end date to before the oldest candle in this batch
        oldest = values[-1]["datetime"]
        current_end = datetime.strptime(oldest, "%Y-%m-%d %H:%M:%S") - timedelta(minutes=1)
        
        print(f"📈 Fetched {len(values)} candles. Oldest: {oldest}. Total downloaded: {len(all_candles)}")
        
        # Save incremental backup every 5 requests so we don't lose progress if interrupted!
        if len(all_candles) % 25000 == 0:
            df_temp = pd.DataFrame(all_candles)
            df_temp.to_csv(OUTPUT_FILE, index=False)
            print(f"💾 Saved temporary backup of {len(all_candles)} candles to CSV.")
            
    except Exception as e:
        print(f"⚠️ Network error: {e}. Retrying in 10 seconds...")
        time.sleep(10)
        continue
        
    # Respect Twelve Data Free limit: 8 requests/minute (1 req / 7.5s)
    time.sleep(8.0)

# Save final complete CSV
if all_candles:
    df = pd.DataFrame(all_candles)
    # Clean and order columns
    df.columns = [c.lower() for c in df.columns]
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values("datetime")
    df["symbol"] = "XAUUSD"
    
    # Drop any duplicate rows
    df = df.drop_duplicates(subset=["datetime"])
    
    df.to_csv(OUTPUT_FILE, index=False)
    print(f"\n===========================================================")
    print(f"✅ Success! Gold data download complete.")
    print(f"Total Candles Saved: {len(df)}")
    print(f"Saved to: {OUTPUT_FILE}")
    print(f"===========================================================")
else:
    print("❌ No candles downloaded. Verify Twelve Data API key and connection.")

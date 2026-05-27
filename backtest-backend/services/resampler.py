from datetime import datetime, timezone
import math

class StreamResampler:
    def __init__(self, timeframe: str):
        """
        timeframe: '1m', '5m', '15m', '30m', '1h', '2h', '4h', '1d'
        """
        self.timeframe = timeframe.lower()
        self.current_candle = None
        self.boundary_timestamp = None
        
        # Map timeframes to seconds interval
        if self.timeframe == "1m":
            self.seconds_interval = 60
        elif self.timeframe == "5m":
            self.seconds_interval = 300
        elif self.timeframe == "15m":
            self.seconds_interval = 900
        elif self.timeframe == "30m":
            self.seconds_interval = 1800
        elif self.timeframe == "1h":
            self.seconds_interval = 3600
        elif self.timeframe == "2h":
            self.seconds_interval = 7200
        elif self.timeframe == "4h":
            self.seconds_interval = 14400
        elif self.timeframe == "1d":
            self.seconds_interval = 86400
        else:
            self.seconds_interval = 60 # Fallback to 1-minute

    def get_bucket_time(self, dt: datetime) -> int:
        """
        Calculates the start epoch timestamp of the timeframe bucket for a given datetime.
        """
        epoch = int(dt.timestamp())
        return (epoch // self.seconds_interval) * self.seconds_interval

    def process_candle(self, min_candle: dict) -> dict:
        """
        Processes a single 1-minute candle.
        Returns a completed resampled candle if a boundary was crossed, otherwise returns None.
        
        min_candle format: {
            'ts': datetime object,
            'open': float,
            'high': float,
            'low': float,
            'close': float,
            'volume': int
        }
        """
        ts = min_candle['ts']
        bucket_time = self.get_bucket_time(ts)
        
        closed_candle = None
        
        # If we have an active candle and the incoming 1-minute candle crosses into a new time bucket
        if self.boundary_timestamp is not None and bucket_time != self.boundary_timestamp:
            closed_candle = self.current_candle.copy()
            self.current_candle = None
            self.boundary_timestamp = None
            
        if self.current_candle is None:
            self.boundary_timestamp = bucket_time
            self.current_candle = {
                "time": bucket_time, # Epoch timestamp in seconds for TradingView Lightweight charts
                "open": float(min_candle['open']),
                "high": float(min_candle['high']),
                "low": float(min_candle['low']),
                "close": float(min_candle['close']),
                "volume": int(min_candle.get('volume', 0) or 0)
            }
        else:
            # Aggregate High, Low, Close and Volume values into the active bucket
            self.current_candle["high"] = max(self.current_candle["high"], float(min_candle['high']))
            self.current_candle["low"] = min(self.current_candle["low"], float(min_candle['low']))
            self.current_candle["close"] = float(min_candle['close'])
            self.current_candle["volume"] += int(min_candle.get('volume', 0) or 0)
            
        return closed_candle

    def flush(self) -> dict:
        """
        Flushes and returns the currently accumulating candle, if any.
        Call this at the end of the streaming pipeline.
        """
        if self.current_candle is not None:
            flushed = self.current_candle.copy()
            self.current_candle = None
            self.boundary_timestamp = None
            return flushed
        return None

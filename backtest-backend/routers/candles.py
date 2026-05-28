from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
import asyncio
from datetime import datetime, timezone
import json
from db import get_db_connection, get_db_cursor
from services.resampler import StreamResampler
from typing import Optional

router = APIRouter()

TF_INTERVALS = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "2h": 7200, "4h": 14400, "1d": 86400
}

@router.get("/available-dates")
def get_available_dates(symbol: str):
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT MIN(ts)::date as min_date, MAX(ts)::date as max_date FROM candles_1m WHERE symbol = %s",
                (symbol.upper(),)
            )
            row = cur.fetchone()
            if not row or row["min_date"] is None:
                return {"symbol": symbol.upper(), "from": None, "to": None}
            return {
                "symbol": symbol.upper(),
                "from": str(row["min_date"]),
                "to": str(row["max_date"])
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/history")
def get_history(symbol: str, start_date: str, timeframe: str = "1m", limit: int = 500, session_id: Optional[int] = None):
    tf = timeframe.lower()
    if tf not in TF_INTERVALS:
        raise HTTPException(status_code=400, detail="Invalid timeframe")
        
    try:
        boundary_time = start_date
        
        # --- PERSISTENCE: If resuming session, load history relative to current position ---
        if session_id:
            with get_db_cursor() as cur:
                cur.execute("SELECT current_timestamp FROM backtest_sessions WHERE id = %s", (session_id,))
                sess = cur.fetchone()
                if sess and sess["current_timestamp"]:
                    boundary_time = str(sess["current_timestamp"])
                    
        interval_secs = TF_INTERVALS[tf]
        candles_needed = int(limit * (interval_secs // 60) * 1.5)
        
        with get_db_cursor() as cur:
            # Query 1-minute candles before the boundary date/time
            cur.execute(
                """SELECT ts, open, high, low, close, volume
                   FROM candles_1m
                   WHERE symbol = %s AND ts < %s
                   ORDER BY ts DESC
                   LIMIT %s""",
                (symbol.upper(), boundary_time, candles_needed)
            )
            rows = cur.fetchall()
            
            if not rows:
                return []
                
            # Reverse to chronological order for resampling
            rows.reverse()
            
            resampler = StreamResampler(tf)
            resampled_list = []
            
            for row in rows:
                bar = resampler.process_candle(row)
                if bar:
                    resampled_list.append(bar)
                    
            final_bar = resampler.flush()
            if final_bar:
                resampled_list.append(final_bar)
                
            # Slice the last 'limit' candles to match user request
            return resampled_list[-limit:]
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


# Helper: Get active trades for a session from the DB
def get_open_trades(cur, session_id: int):
    cur.execute(
        """SELECT id, symbol, direction, entry_price, stop_loss, take_profit, lot_size, entry_time 
           FROM trades 
           WHERE session_id = %s AND status = 'open'""", 
        (session_id,)
    )
    return cur.fetchall()

# Helper: Auto-close a trade in the database on SL/TP hit
def close_trade_on_target(cur, trade_id: int, session_id: int, exit_price: float, exit_time: datetime, pnl: float, reason: str):
    # Get balance first to calculate % return
    cur.execute("SELECT current_balance FROM backtest_sessions WHERE id = %s", (session_id,))
    session_row = cur.fetchone()
    balance = float(session_row["current_balance"]) if session_row else 10000.0
    pnl_pct = (pnl / balance) * 100.0 if balance > 0 else 0.0
    
    # Calculate R:R achieved (stop loss risk vs final profit)
    cur.execute("SELECT entry_price, stop_loss, direction FROM trades WHERE id = %s", (trade_id,))
    t_row = cur.fetchone()
    rr = None
    if t_row and t_row["stop_loss"] is not None:
        risk = abs(float(t_row["entry_price"]) - float(t_row["stop_loss"]))
        if risk > 0:
            pnl_points = abs(exit_price - float(t_row["entry_price"]))
            rr = pnl_points / risk
            
    duration_mins = int((exit_time - t_row["entry_time"]).total_seconds() / 60) if t_row else 0

    # Update trade status
    cur.execute(
        """UPDATE trades SET exit_price=%s, exit_time=%s, pnl=%s, pnl_pct=%s,
           rr_ratio=%s, duration_mins=%s, status=%s WHERE id=%s""",
        (exit_price, exit_time, pnl, pnl_pct, rr, duration_mins, reason, trade_id)
    )
    
    # Update session balance
    cur.execute(
        "UPDATE backtest_sessions SET current_balance = current_balance + %s WHERE id = %s",
        (pnl, session_id)
    )


@router.websocket("/replay")
async def replay_websocket(
    websocket: WebSocket,
    symbol: str,
    start_date: str,
    timeframe: str = "1m",
    session_id: int = 0,
    speed: float = 1.0
):
    await websocket.accept()
    
    tf = timeframe.lower()
    if tf not in TF_INTERVALS:
        await websocket.send_json({"error": "Invalid timeframe"})
        await websocket.close()
        return
        
    state = {
        "playing": False,
        "step": False,
        "speed": float(speed),
        "active": True
    }
    
    # Async background task to listen to play/pause controls from client
    async def receive_controls():
        try:
            while state["active"]:
                data = await websocket.receive_text()
                msg = json.loads(data)
                action = msg.get("action")
                
                if action == "play":
                    state["playing"] = True
                elif action == "pause":
                    state["playing"] = False
                elif action == "step":
                    state["step"] = True
                elif action == "speed":
                    state["speed"] = float(msg.get("value", 1.0))
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            state["active"] = False

    # Start the async reader in the background
    asyncio.create_task(receive_controls())
    
    conn = None
    try:
        conn = get_db_connection()
        # Create dedicated cursor
        init_cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # --- PERSISTENCE: Check if session has a saved current_timestamp ---
        init_cur.execute(
            "SELECT current_timestamp, start_date FROM backtest_sessions WHERE id = %s", 
            (session_id,)
        )
        sess_row = init_cur.fetchone()
        
        start_point = start_date
        if sess_row and sess_row["current_timestamp"]:
            start_point = str(sess_row["current_timestamp"])
            print(f"🔄 Resuming session {session_id} from timestamp: {start_point}")
        else:
            print(f"🎬 Starting session {session_id} from date: {start_point}")
            
        init_cur.close()
        
        # Use a server-side cursor to stream candles chunk-by-chunk without overloading RAM!
        cursor_name = f"replay_cur_{session_id}_{int(datetime.now().timestamp())}"
        cur = conn.cursor(name=cursor_name, cursor_factory=RealDictCursor)
        
        cur.execute(
            """SELECT ts, open, high, low, close, volume
               FROM candles_1m
               WHERE symbol = %s AND ts >= %s
               ORDER BY ts ASC""",
            (symbol.upper(), start_point)
        )
        
        resampler = StreamResampler(tf)
        
        # Load the first chunk of 5000 candles
        chunk_size = 5000
        rows = cur.fetchmany(chunk_size)
        row_idx = 0
        
        while state["active"]:
            # If paused and no step requested, sleep and wait
            if not state["playing"] and not state["step"]:
                await asyncio.sleep(0.1)
                continue
                
            # If we reached the end of the current rows chunk, fetch next
            if row_idx >= len(rows):
                rows = cur.fetchmany(chunk_size)
                row_idx = 0
                if not rows:
                    # End of dataset reached
                    await websocket.send_json({"type": "end"})
                    break
                    
            min_candle = rows[row_idx]
            row_idx += 1
            
            # --- 1. Server-side SL/TP checking on the 1-minute sub-candle level! ---
            write_cur = conn.cursor(cursor_factory=RealDictCursor)
            try:
                # Track current playback timestamp in session (PERSISTENCE)
                write_cur.execute(
                    """UPDATE backtest_sessions 
                       SET current_timestamp = %s, last_accessed_at = NOW() 
                       WHERE id = %s""",
                    (min_candle["ts"], session_id)
                )
                
                open_trades = get_open_trades(write_cur, session_id)
                for trade in open_trades:
                    direction = trade["direction"].lower()
                    entry_price = float(trade["entry_price"])
                    sl = float(trade["stop_loss"]) if trade["stop_loss"] is not None else None
                    tp = float(trade["take_profit"]) if trade["take_profit"] is not None else None
                    lot_size = float(trade["lot_size"])
                    
                    high = float(min_candle["high"])
                    low = float(min_candle["low"])
                    
                    # Pip multiplier
                    multiplier = 100.0 if symbol.upper() == "XAUUSD" else 15.0
                    
                    is_hit = False
                    exit_price = 0.0
                    reason = ""
                    pnl = 0.0
                    
                    if direction == "buy":
                        if sl is not None and low <= sl:
                            is_hit = True
                            exit_price = sl
                            reason = "sl_hit"
                            pnl = (sl - entry_price) * lot_size * multiplier
                        elif tp is not None and high >= tp:
                            is_hit = True
                            exit_price = tp
                            reason = "tp_hit"
                            pnl = (tp - entry_price) * lot_size * multiplier
                    else: # Sell position
                        if sl is not None and high >= sl:
                            is_hit = True
                            exit_price = sl
                            reason = "sl_hit"
                            pnl = (entry_price - sl) * lot_size * multiplier
                        elif tp is not None and low <= tp:
                            is_hit = True
                            exit_price = tp
                            reason = "tp_hit"
                            pnl = (entry_price - tp) * lot_size * multiplier
                            
                    if is_hit:
                        # Update DB
                        close_trade_on_target(write_cur, trade["id"], session_id, exit_price, min_candle["ts"], pnl, reason)
                        
                        # Send alert to Next.js
                        await websocket.send_json({
                            "type": "trade_closed",
                            "trade_id": trade["id"],
                            "exit_price": exit_price,
                            "reason": reason,
                            "pnl": round(pnl, 2),
                            "time": int(min_candle["ts"].timestamp())
                        })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"Error checking SL/TP hit: {e}")
            finally:
                write_cur.close()
                
            # --- 2. Process candle aggregation ---
            resampled_bar = resampler.process_candle(min_candle)
            if resampled_bar is not None:
                # Send the aggregated candle bar to the TradingView chart
                await websocket.send_json({
                    "type": "candle",
                    "candle": resampled_bar
                })
                
                # If we were in single step mode, turn off step trigger now that we sent 1 candle
                if state["step"]:
                    state["step"] = False
                    
                # Respect playback speed delay
                delay = max(0.01, 1.0 / state["speed"])
                await asyncio.sleep(delay)
                
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"error": f"Internal server error: {str(e)}"})
        except Exception:
            pass
    finally:
        state["active"] = False
        if conn:
            cur.close()
            pool.putconn(conn)

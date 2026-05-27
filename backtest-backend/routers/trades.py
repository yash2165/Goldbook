from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from db import get_db_cursor

router = APIRouter()

class OpenTradeRequest(BaseModel):
    session_id: int
    symbol: str
    direction: str          # 'buy' or 'sell'
    entry_price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    lot_size: float
    entry_time: str         # ISO format timestamp from replay
    timeframe: str

class CloseTradeRequest(BaseModel):
    trade_id: int
    exit_price: float
    exit_time: str
    reason: str             # 'manual', 'sl_hit', 'tp_hit'

@router.post("/open")
def open_trade(req: OpenTradeRequest):
    # Ensure direction is lowercase 'buy' or 'sell' to match schema
    direction = req.direction.lower()
    if direction not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="Direction must be 'buy' or 'sell'")
        
    try:
        with get_db_cursor(commit=True) as cur:
            # 1. Verify session exists
            cur.execute("SELECT id FROM backtest_sessions WHERE id = %s", (req.session_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Backtest session not found")
                
            # 2. Insert the open trade
            cur.execute(
                """INSERT INTO trades (session_id, symbol, direction, entry_price, stop_loss,
                   take_profit, lot_size, entry_time, timeframe, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'open') RETURNING id""",
                (req.session_id, req.symbol.upper(), direction, req.entry_price,
                 req.stop_loss, req.take_profit, req.lot_size, req.entry_time, req.timeframe)
            )
            row = cur.fetchone()
            trade_id = row["id"]
            return {"trade_id": trade_id, "status": "open"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open trade: {str(e)}")

@router.post("/close")
def close_trade(req: CloseTradeRequest):
    try:
        with get_db_cursor(commit=True) as cur:
            # 1. Fetch the open trade using RealDictCursor (fixed brittle indexing bug!)
            cur.execute("SELECT * FROM trades WHERE id = %s", (req.trade_id,))
            trade = cur.fetchone()
            if not trade:
                raise HTTPException(status_code=404, detail="Trade not found")
                
            if trade["status"] != "open":
                raise HTTPException(status_code=400, detail="Trade is already closed")
                
            symbol = trade["symbol"]
            direction = trade["direction"]
            entry_price = float(trade["entry_price"])
            lot_size = float(trade["lot_size"])
            stop_loss = float(trade["stop_loss"]) if trade["stop_loss"] is not None else None
            entry_time = trade["entry_time"]
            session_id = trade["session_id"]
            
            # 2. Calculate PnL (Gold: 1 lot = 100 contracts, BankNifty: 1 lot = 15 contracts)
            pip_multiplier = 100.0 if symbol == "XAUUSD" else 15.0
            price_diff = (req.exit_price - entry_price) if direction == "buy" else (entry_price - req.exit_price)
            pnl = price_diff * lot_size * pip_multiplier
            
            # Calculate PnL percentage based on session's current balance
            cur.execute("SELECT current_balance FROM backtest_sessions WHERE id = %s", (session_id,))
            session = cur.fetchone()
            balance = float(session["current_balance"]) if session else 10000.0
            pnl_pct = (pnl / balance) * 100.0 if balance > 0 else 0.0
            
            # 3. Calculate Risk-to-Reward (R:R) achieved
            rr = None
            if stop_loss is not None:
                risk = abs(entry_price - stop_loss)
                if risk > 0:
                    rr = abs(price_diff) / risk
                    
            # 4. Calculate duration in minutes
            exit_time_dt = datetime.fromisoformat(req.exit_time.replace("Z", "+00:00"))
            duration = int((exit_time_dt - entry_time).total_seconds() / 60)
            
            # 5. Update the trade row
            cur.execute(
                """UPDATE trades SET exit_price=%s, exit_time=%s, pnl=%s, pnl_pct=%s,
                   rr_ratio=%s, duration_mins=%s, status=%s WHERE id=%s""",
                (req.exit_price, exit_time_dt, pnl, pnl_pct, rr, duration, req.reason, req.trade_id)
            )
            
            # 6. Update virtual account balance in the session
            cur.execute(
                "UPDATE backtest_sessions SET current_balance = current_balance + %s WHERE id = %s",
                (pnl, session_id)
            )
            
            return {
                "trade_id": req.trade_id, 
                "pnl": round(pnl, 2), 
                "rr_ratio": round(rr, 2) if rr is not None else None, 
                "status": req.reason
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close trade: {str(e)}")

@router.get("/journal/{session_id}")
def get_journal(session_id: int):
    try:
        with get_db_cursor() as cur:
            # Get list of trades
            cur.execute(
                """SELECT id, direction, entry_price, exit_price, stop_loss, take_profit,
                          lot_size, entry_time, exit_time, pnl, pnl_pct, rr_ratio, duration_mins, status, timeframe
                   FROM trades WHERE session_id = %s ORDER BY entry_time DESC""",
                (session_id,)
            )
            rows = cur.fetchall()
            
            trades_list = []
            for r in rows:
                trades_list.append({
                    "id": r["id"],
                    "direction": r["direction"],
                    "entry_price": float(r["entry_price"]),
                    "exit_price": float(r["exit_price"]) if r["exit_price"] is not None else None,
                    "stop_loss": float(r["stop_loss"]) if r["stop_loss"] is not None else None,
                    "take_profit": float(r["take_profit"]) if r["take_profit"] is not None else None,
                    "lot_size": float(r["lot_size"]),
                    "entry_time": str(r["entry_time"]),
                    "exit_time": str(r["exit_time"]) if r["exit_time"] is not None else None,
                    "pnl": float(r["pnl"]) if r["pnl"] is not None else 0.0,
                    "pnl_pct": float(r["pnl_pct"]) if r["pnl_pct"] is not None else 0.0,
                    "rr_ratio": float(r["rr_ratio"]) if r["rr_ratio"] is not None else None,
                    "duration_mins": r["duration_mins"],
                    "status": r["status"],
                    "timeframe": r["timeframe"]
                })
                
            # Compile key metrics
            closed_trades = [t for t in trades_list if t["status"] != "open"]
            wins = [t for t in closed_trades if t["pnl"] > 0]
            losses = [t for t in closed_trades if t["pnl"] < 0]
            total_pnl = sum(t["pnl"] for t in closed_trades)
            
            win_rate = round(len(wins) / len(closed_trades) * 100, 1) if closed_trades else 0.0
            
            rr_vals = [t["rr_ratio"] for t in closed_trades if t["rr_ratio"] is not None]
            avg_rr = round(sum(rr_vals) / len(rr_vals), 2) if rr_vals else 0.0
            
            return {
                "trades": trades_list,
                "stats": {
                    "total_trades": len(closed_trades),
                    "wins": len(wins),
                    "losses": len(losses),
                    "win_rate": win_rate,
                    "total_pnl": round(total_pnl, 2),
                    "avg_rr": avg_rr
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal: {str(e)}")

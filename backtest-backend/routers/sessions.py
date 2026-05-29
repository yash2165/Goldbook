from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_cursor
from typing import Optional, List, Dict, Any
import json

router = APIRouter()

class StartSessionRequest(BaseModel):
    symbol: str
    start_date: str
    timeframe: str = "1m"
    initial_balance: float = 10000.00

class CloseSessionRequest(BaseModel):
    final_balance: Optional[float] = None

class SaveDrawingsRequest(BaseModel):
    drawings_state: List[Any]
    indicator_settings: Optional[Dict[str, Any]] = None

class ReCutSessionRequest(BaseModel):
    cut_timestamp: str

@router.post("/start")
def start_session(req: StartSessionRequest):
    # Validate timeframe input
    allowed_timeframes = {"1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"}
    tf = req.timeframe.lower()
    if tf not in allowed_timeframes:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid timeframe. Allowed: {list(allowed_timeframes)}"
        )
        
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute(
                """INSERT INTO backtest_sessions (symbol, start_date, initial_balance, current_balance, timeframe, status, last_accessed_at)
                   VALUES (%s, %s, %s, %s, %s, 'active', NOW()) RETURNING id""",
                (req.symbol.upper(), req.start_date, req.initial_balance, req.initial_balance, tf)
            )
            row = cur.fetchone()
            session_id = row["id"]
            return {
                "session_id": session_id, 
                "symbol": req.symbol.upper(),
                "timeframe": tf,
                "status": "active", 
                "balance": req.initial_balance
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.get("/active")
def get_active_sessions():
    """
    Returns all active sessions (last accessed first).
    If a session has been inactive for more than 30 days, we could filter it out.
    """
    try:
        with get_db_cursor() as cur:
            cur.execute(
                """SELECT * FROM backtest_sessions 
                   WHERE status = 'active' AND last_accessed_at >= NOW() - INTERVAL '30 days'
                   ORDER BY last_accessed_at DESC"""
            )
            rows = cur.fetchall()
            
            sessions_list = []
            for s in rows:
                sessions_list.append({
                    "id": s["id"],
                    "symbol": s["symbol"],
                    "start_date": str(s["start_date"]),
                    "initial_balance": float(s["initial_balance"]),
                    "current_balance": float(s["current_balance"]),
                    "timeframe": s["timeframe"],
                    "status": s["status"],
                    "current_timestamp": str(s["current_timestamp"]) if s["current_timestamp"] else None,
                    "last_accessed_at": str(s["last_accessed_at"])
                })
            return sessions_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active sessions: {str(e)}")

@router.post("/close/{session_id}")
def close_session(session_id: int, req: CloseSessionRequest):
    """
    Completes/terminates a backtest session.
    """
    try:
        with get_db_cursor(commit=True) as cur:
            # Check if exists
            cur.execute("SELECT * FROM backtest_sessions WHERE id = %s", (session_id,))
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
                
            final_bal = req.final_balance if req.final_balance is not None else float(session["current_balance"])
            
            cur.execute(
                """UPDATE backtest_sessions 
                   SET status = 'completed', current_balance = %s, last_accessed_at = NOW() 
                   WHERE id = %s""",
                (final_bal, session_id)
            )
            return {"status": "completed", "session_id": session_id, "final_balance": final_bal}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close session: {str(e)}")

@router.get("/{session_id}")
def get_session(session_id: int):
    try:
        with get_db_cursor(commit=True) as cur:
            # Update last accessed time whenever they open it
            cur.execute(
                "UPDATE backtest_sessions SET last_accessed_at = NOW() WHERE id = %s RETURNING *", 
                (session_id,)
            )
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            return {
                "id": session["id"],
                "symbol": session["symbol"],
                "start_date": str(session["start_date"]),
                "initial_balance": float(session["initial_balance"]),
                "current_balance": float(session["current_balance"]),
                "timeframe": session["timeframe"],
                "status": session["status"],
                "current_timestamp": str(session["current_timestamp"]) if session["current_timestamp"] else None,
                "last_accessed_at": str(session["last_accessed_at"]),
                "drawings_state": session["drawings_state"] if session.get("drawings_state") is not None else [],
                "indicator_settings": session["indicator_settings"] if session.get("indicator_settings") is not None else {}
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.delete("/{session_id}")
def delete_session(session_id: int):
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute("DELETE FROM backtest_sessions WHERE id = %s RETURNING id", (session_id,))
            deleted = cur.fetchone()
            if not deleted:
                raise HTTPException(status_code=404, detail="Session not found")
            return {"status": "deleted", "session_id": session_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")

@router.put("/{session_id}/drawings")
def save_session_drawings(session_id: int, req: SaveDrawingsRequest):
    try:
        with get_db_cursor(commit=True) as cur:
            # Check if session exists
            cur.execute("SELECT id FROM backtest_sessions WHERE id = %s", (session_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Session not found")
            
            # Save drawings (native psycopg2 handles python list/dict -> postgres jsonb mapping directly!)
            if req.indicator_settings is not None:
                cur.execute(
                    """UPDATE backtest_sessions 
                       SET drawings_state = %s, indicator_settings = %s, last_accessed_at = NOW() 
                       WHERE id = %s""",
                    (json.dumps(req.drawings_state), json.dumps(req.indicator_settings), session_id)
                )
            else:
                cur.execute(
                    """UPDATE backtest_sessions 
                       SET drawings_state = %s, last_accessed_at = NOW() 
                       WHERE id = %s""",
                    (json.dumps(req.drawings_state), session_id)
                )
            return {"status": "success", "session_id": session_id}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save drawings: {str(e)}")

@router.post("/{session_id}/re-cut")
def re_cut_session(session_id: int, req: ReCutSessionRequest):
    try:
        with get_db_cursor(commit=True) as cur:
            # 1. Fetch the session
            cur.execute("SELECT * FROM backtest_sessions WHERE id = %s", (session_id,))
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
                
            cut_time = req.cut_timestamp
            initial_bal = float(session["initial_balance"])
            
            # 2. Delete trades opened strictly AFTER the cut timestamp
            cur.execute(
                "DELETE FROM trades WHERE session_id = %s AND entry_time > %s",
                (session_id, cut_time)
            )
            
            # 3. Restore trades that were opened BEFORE but closed AFTER the cut timestamp back to open
            cur.execute(
                """UPDATE trades 
                   SET exit_price = NULL, exit_time = NULL, pnl = NULL, pnl_pct = NULL, status = 'open'
                   WHERE session_id = %s AND entry_time <= %s AND (exit_time > %s OR (exit_time IS NULL AND status != 'open'))""",
                (session_id, cut_time, cut_time)
            )
            
            # 4. Calculate the new current balance based on remaining completed trades
            cur.execute(
                """SELECT COALESCE(SUM(pnl), 0) as total_pnl 
                   FROM trades 
                   WHERE session_id = %s AND status IN ('manual', 'sl_hit', 'tp_hit') AND exit_time <= %s""",
                (session_id, cut_time)
            )
            res = cur.fetchone()
            total_pnl = float(res["total_pnl"]) if res and res["total_pnl"] is not None else 0.0
            new_balance = initial_bal + total_pnl
            
            # 5. Update session record
            cur.execute(
                """UPDATE backtest_sessions 
                   SET current_timestamp = %s, current_balance = %s, last_accessed_at = NOW() 
                   WHERE id = %s""",
                (cut_time, new_balance, session_id)
            )
            
            return {
                "status": "success",
                "session_id": session_id,
                "current_timestamp": cut_time,
                "current_balance": new_balance
            }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to re-cut session timeline: {str(e)}")

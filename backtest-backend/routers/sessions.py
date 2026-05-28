from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_cursor
from typing import Optional

router = APIRouter()

class StartSessionRequest(BaseModel):
    symbol: str
    start_date: str
    timeframe: str = "1m"
    initial_balance: float = 10000.00

class CloseSessionRequest(BaseModel):
    final_balance: Optional[float] = None

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
                "last_accessed_at": str(session["last_accessed_at"])
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

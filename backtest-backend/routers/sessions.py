from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_db_cursor

router = APIRouter()

class StartSessionRequest(BaseModel):
    symbol: str
    start_date: str
    timeframe: str = "1m"
    initial_balance: float = 10000.00

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
                """INSERT INTO backtest_sessions (symbol, start_date, initial_balance, current_balance, timeframe, status)
                   VALUES (%s, %s, %s, %s, %s, 'active') RETURNING id""",
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

@router.get("/{session_id}")
def get_session(session_id: int):
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM backtest_sessions WHERE id = %s", (session_id,))
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="Session not found")
            
            # Format numeric types to standard floats
            session["initial_balance"] = float(session["initial_balance"])
            session["current_balance"] = float(session["current_balance"])
            session["start_date"] = str(session["start_date"])
            return session
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

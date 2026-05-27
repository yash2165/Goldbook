from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import candles, sessions, trades

app = FastAPI(
    title="GoldBook Backtesting API Engine",
    description="High-performance bi-directional WebSocket and REST trading simulation engine for Gold (XAUUSD) and BankNifty.",
    version="1.0.0"
)

# Enable CORS (Cross-Origin Resource Sharing)
# This allows your Vercel hosted frontend to securely connect to this backend on the VPS!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your Vercel URL and localhost during testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire up routers
app.include_router(candles.router, prefix="/api/candles", tags=["Candles"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["Sessions"])
app.include_router(trades.router, prefix="/api/trades", tags=["Trades"])

@app.get("/")
def health_check():
    """
    Simple index route to confirm the API is online.
    """
    return {
        "status": "online",
        "service": "GoldBook Backtesting API",
        "version": "1.0.0"
    }

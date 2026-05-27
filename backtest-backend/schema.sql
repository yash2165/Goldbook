-- GoldBook VPS Backtesting PostgreSQL Schema

-- 1. Base 1-minute candlestick table
CREATE TABLE IF NOT EXISTS candles_1m (
    id          BIGSERIAL PRIMARY KEY,
    symbol      VARCHAR(20) NOT NULL,       -- 'XAUUSD' or 'BANKNIFTY'
    ts          TIMESTAMPTZ NOT NULL,       -- open time in UTC
    open        NUMERIC(12,4) NOT NULL,
    high        NUMERIC(12,4) NOT NULL,
    low         NUMERIC(12,4) NOT NULL,
    close       NUMERIC(12,4) NOT NULL,
    volume      BIGINT DEFAULT 0
);

-- Index for fast candle selection & uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_symbol_ts ON candles_1m (symbol, ts);
CREATE INDEX IF NOT EXISTS idx_candles_ts ON candles_1m (ts ASC);

-- 2. Sessions table (tracks live virtual playbacks)
CREATE TABLE IF NOT EXISTS backtest_sessions (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(20) NOT NULL,
    start_date      DATE NOT NULL,
    initial_balance NUMERIC(15,2) NOT NULL DEFAULT 10000.00,
    current_balance NUMERIC(15,2) NOT NULL DEFAULT 10000.00,
    timeframe       VARCHAR(10) NOT NULL DEFAULT '1m',
    status          VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' or 'completed'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trades table inside each session
CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    session_id      BIGINT NOT NULL REFERENCES backtest_sessions(id) ON DELETE CASCADE,
    symbol          VARCHAR(20) NOT NULL,
    direction       VARCHAR(10) NOT NULL, -- 'buy' (long) or 'sell' (short)
    entry_price     NUMERIC(12,4) NOT NULL,
    exit_price      NUMERIC(12,4),
    stop_loss       NUMERIC(12,4),
    take_profit     NUMERIC(12,4),
    lot_size        NUMERIC(10,4) NOT NULL DEFAULT 0.1,
    entry_time      TIMESTAMPTZ NOT NULL,
    exit_time       TIMESTAMPTZ,
    pnl             NUMERIC(15,2),
    pnl_pct         NUMERIC(8,4),
    duration_mins   INTEGER,
    status          VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'manual', 'sl_hit', 'tp_hit'
    timeframe       VARCHAR(10) NOT NULL
);

-- Index for fast session query lookups
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades (session_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);

-- ============================================================
-- MIGRATION: Fix duplicate trade bug
-- Problem: Open positions use position_id as their mt5_ticket,
--          but closed deals have a *different* deal ticket (OUT).
--          Upserting on mt5_ticket creates duplicates.
-- Solution: Add a stable `position_id` column and upsert on that.
-- ============================================================

-- 1. Add position_id column (BigInt, nullable to allow manual trades)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS position_id BIGINT;

-- 2. Backfill existing rows: for MT5 trades, position_id = mt5_ticket
--    (open positions already have the correct position_id as their ticket)
UPDATE public.trades
  SET position_id = mt5_ticket
  WHERE source = 'mt5' AND position_id IS NULL;

-- 3. For manual trades, set position_id = a synthetic negative id so
--    it won't conflict with real MT5 position IDs (which are positive bigints)
--    We use the row's UUID cast to bigint hash — just use rowid trick:
UPDATE public.trades
  SET position_id = -(ROW_NUMBER() OVER (ORDER BY created_at))::BIGINT
  WHERE source = 'manual' AND position_id IS NULL;

-- 4. Drop the old unique constraint that was blocking upserts
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_account_id_mt5_ticket_key;

-- 5. Add new unique constraint on (account_id, position_id)
--    This is what the upsert will use going forward
ALTER TABLE public.trades
  ADD CONSTRAINT trades_account_id_position_id_key
  UNIQUE (account_id, position_id);

-- 6. Make mt5_ticket nullable so manual trades don't need it
ALTER TABLE public.trades
  ALTER COLUMN mt5_ticket DROP NOT NULL;

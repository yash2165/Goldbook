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

-- 2. Backfill existing MT5 trades: position_id = mt5_ticket (stable)
UPDATE public.trades
  SET position_id = mt5_ticket
  WHERE source = 'mt5' AND position_id IS NULL;

-- 3. For manual trades: use a CTE to assign synthetic negative IDs
--    (window functions cannot be used directly in UPDATE)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.trades
  WHERE (source = 'manual' OR source IS NULL) AND position_id IS NULL
)
UPDATE public.trades t
  SET position_id = -ranked.rn
  FROM ranked
  WHERE t.id = ranked.id;

-- 4. Drop the old unique constraint (was on mt5_ticket)
ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_account_id_mt5_ticket_key;

-- 5. Add new unique constraint on (account_id, position_id)
ALTER TABLE public.trades
  ADD CONSTRAINT trades_account_id_position_id_key
  UNIQUE (account_id, position_id);

-- 6. Make mt5_ticket nullable so manual trades don't need it
ALTER TABLE public.trades
  ALTER COLUMN mt5_ticket DROP NOT NULL;

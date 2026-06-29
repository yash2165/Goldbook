-- ============================================================
-- MIGRATION: Indian Markets & CSV Import Schema Additions
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add market_mode column to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS market_mode TEXT DEFAULT 'forex' CHECK (market_mode IN ('forex', 'indian'));

-- 2. Add Indian market tracking columns to trades table
ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS instrument_type TEXT DEFAULT 'spot' CHECK (instrument_type IN ('spot', 'equity', 'options', 'futures'));

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS option_type TEXT CHECK (option_type IN ('CE', 'PE'));

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS strike_price NUMERIC;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS spot_price_entry NUMERIC;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS spot_price_exit NUMERIC;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS india_vix NUMERIC;

-- 3. Add charges columns (brokerage, STT, other charges)
ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS brokerage NUMERIC DEFAULT 0;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS stt NUMERIC DEFAULT 0;

ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS other_charges NUMERIC DEFAULT 0;

-- 4. Add currency column to trades to support INR and USD
ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'INR'));

-- 5. Drop check constraints on emotions to allow free-form custom emotions
ALTER TABLE public.trades 
  DROP CONSTRAINT IF EXISTS trades_emotion_before_check;

ALTER TABLE public.trades 
  DROP CONSTRAINT IF EXISTS trades_emotion_after_check;

-- 6. Add index for performance on symbol & type searches
CREATE INDEX IF NOT EXISTS trades_symbol_idx ON public.trades (symbol);
CREATE INDEX IF NOT EXISTS trades_instrument_type_idx ON public.trades (instrument_type);

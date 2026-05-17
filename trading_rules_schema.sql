-- =============================================================================
-- Trading Rules System
-- Run in Supabase SQL Editor
-- =============================================================================

-- Trading rules table
-- Each user can have multiple rules. They toggle each one active/inactive.
CREATE TABLE IF NOT EXISTS public.trading_rules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rule_type     TEXT NOT NULL,          -- 'daily_loss_limit' | 'max_trades_per_day' | 'no_trade_after_loss' | 'max_lot_size' | 'only_trade_session' | 'no_revenge_trade' | 'min_rr_ratio' | 'custom'
  label         TEXT NOT NULL,          -- user-facing title
  description   TEXT,                  -- what this rule checks
  is_active     BOOLEAN DEFAULT true,  -- user can toggle on/off
  value         NUMERIC,               -- numeric threshold (e.g. 100 for $100 loss limit)
  value_str     TEXT,                  -- string value (e.g. 'London' for session rule)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own their rules" ON public.trading_rules;
CREATE POLICY "Users own their rules" ON public.trading_rules
  FOR ALL USING (auth.uid() = user_id);

-- Rule violations log — AI writes here when it detects a breach
CREATE TABLE IF NOT EXISTS public.rule_violations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rule_id       UUID REFERENCES public.trading_rules(id) ON DELETE CASCADE,
  trade_id      UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  rule_type     TEXT NOT NULL,
  description   TEXT NOT NULL,          -- human-readable violation message
  severity      TEXT DEFAULT 'warning'  -- 'warning' | 'critical'
               CHECK (severity IN ('warning', 'critical')),
  detected_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own violations" ON public.rule_violations;
CREATE POLICY "Users view own violations" ON public.rule_violations
  FOR ALL USING (auth.uid() = user_id);

-- Add rules_followed column to AI reports
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS rules_analysis JSONB;
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS rules_violations_count INTEGER DEFAULT 0;
ALTER TABLE public.ai_reports ADD COLUMN IF NOT EXISTS rules_compliance_score NUMERIC;

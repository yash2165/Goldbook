-- =============================================================================
-- Migration: Trading Rules & Automated Violation Detection Trigger
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- =============================================================================

-- 1. Ensure trading_rules table exists and has proper structure
CREATE TABLE IF NOT EXISTS public.trading_rules (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rule_type     TEXT NOT NULL,          -- 'max_risk_per_trade' | 'daily_loss_limit' | 'max_trades_per_day'
  label         TEXT NOT NULL,          -- user-facing title
  description   TEXT,                   -- what this rule checks
  is_active     BOOLEAN DEFAULT true,   -- user can toggle on/off
  value         NUMERIC,                -- numeric threshold (e.g. 5 for 5% loss limit)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Add Unique constraint to prevent duplicate rule entries per user
ALTER TABLE public.trading_rules DROP CONSTRAINT IF EXISTS unique_user_rule_type;
ALTER TABLE public.trading_rules ADD CONSTRAINT unique_user_rule_type UNIQUE (user_id, rule_type);

-- 3. Ensure rule_violations table exists for broken rules report
CREATE TABLE IF NOT EXISTS public.rule_violations (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  rule_id       UUID REFERENCES public.trading_rules(id) ON DELETE CASCADE,
  trade_id      UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  rule_type     TEXT NOT NULL,
  description   TEXT NOT NULL,          -- human-readable violation message
  severity      TEXT DEFAULT 'warning' CHECK (severity IN ('warning', 'critical')),
  detected_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Enable RLS on rules and violations
ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own their rules" ON public.trading_rules;
CREATE POLICY "Users own their rules" ON public.trading_rules
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own violations" ON public.rule_violations;
CREATE POLICY "Users view own violations" ON public.rule_violations
  FOR ALL USING (auth.uid() = user_id);

-- 5. Enable Supabase Realtime for the rule_violations table
-- This allows the frontend to listen to live warnings!
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rule_violations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Create automated trigger function to validate rules on every trade insert/update
CREATE OR REPLACE FUNCTION check_trading_rules_violation()
RETURNS TRIGGER AS $$
DECLARE
    v_rule RECORD;
    v_total_loss NUMERIC := 0;
    v_today_trades_count INTEGER := 0;
    v_account RECORD;
    v_balance NUMERIC := 10000.0; -- default fallback balance
    v_daily_loss_limit_usd NUMERIC := 0.0;
    v_violation_desc TEXT;
BEGIN
    -- Get user account details to compute balance percentages
    SELECT * INTO v_account FROM public.mt5_accounts WHERE id = NEW.account_id;
    IF v_account.id IS NOT NULL THEN
        v_balance := COALESCE(v_account.current_balance, v_account.initial_balance, 10000.0);
    END IF;

    -- Iterate over active rules for this user
    FOR v_rule IN 
        SELECT * FROM public.trading_rules 
        WHERE user_id = NEW.user_id AND is_active = true
    LOOP
        v_violation_desc := NULL;

        -- A. Check Max Risk Per Trade (max_risk_per_trade)
        IF v_rule.rule_type = 'max_risk_per_trade' THEN
            -- Check if actual loss on closed trade exceeds allowed percentage of balance
            IF NEW.status = 'closed' AND NEW.net_profit < 0 AND (-NEW.net_profit) > (v_balance * (v_rule.value / 100.0)) THEN
                v_violation_desc := 'Actual trade loss (' || fmt_currency(-NEW.net_profit) || ') exceeded maximum trade risk limit of ' || v_rule.value::text || '% (' || fmt_currency(v_balance * (v_rule.value / 100.0)) || ')';
            END IF;
        END IF;

        -- B. Check Daily Loss Limit (daily_loss_limit)
        IF v_rule.rule_type = 'daily_loss_limit' THEN
            -- Sum up all closed trades' net_profit for today (excluding the new trade to prevent double-counting if already in table)
            SELECT COALESCE(SUM(net_profit), 0) INTO v_total_loss 
            FROM public.trades 
            WHERE user_id = NEW.user_id 
              AND status = 'closed'
              AND net_profit < 0
              AND id != NEW.id
              AND DATE(close_time AT TIME ZONE 'UTC') = DATE(COALESCE(NEW.close_time, NOW()) AT TIME ZONE 'UTC');
              
            -- Include current trade if it's closed and negative
            IF NEW.status = 'closed' AND NEW.net_profit < 0 THEN
                v_total_loss := v_total_loss + (-NEW.net_profit);
            END IF;
            
            v_daily_loss_limit_usd := v_balance * (v_rule.value / 100.0);
            IF v_total_loss > v_daily_loss_limit_usd THEN
                v_violation_desc := 'Daily loss total (' || fmt_currency(v_total_loss) || ') exceeded daily loss limit of ' || v_rule.value::text || '% (' || fmt_currency(v_daily_loss_limit_usd) || ')';
            END IF;
        END IF;

        -- C. Check Max Trades Per Day (max_trades_per_day)
        IF v_rule.rule_type = 'max_trades_per_day' THEN
            SELECT COUNT(*) INTO v_today_trades_count 
            FROM public.trades 
            WHERE user_id = NEW.user_id 
              AND id != NEW.id
              AND DATE(open_time AT TIME ZONE 'UTC') = DATE(COALESCE(NEW.open_time, NOW()) AT TIME ZONE 'UTC');
              
            -- Add 1 for the new/updated trade
            IF (v_today_trades_count + 1) > v_rule.value THEN
                v_violation_desc := 'Opened trade #' || (v_today_trades_count + 1)::text || ', which exceeded the maximum limit of ' || v_rule.value::text || ' trades per day.';
            END IF;
        END IF;

        -- If violation was detected, log it in the rule_violations table
        IF v_violation_desc IS NOT NULL THEN
            -- Ensure no duplicate log for the same trade and rule type within the last 10 seconds
            IF NOT EXISTS (
                SELECT 1 FROM public.rule_violations 
                WHERE user_id = NEW.user_id 
                  AND trade_id = NEW.id 
                  AND rule_type = v_rule.rule_type
                  AND detected_at > NOW() - INTERVAL '10 seconds'
            ) THEN
                INSERT INTO public.rule_violations (user_id, rule_id, trade_id, rule_type, description, severity)
                VALUES (NEW.user_id, v_rule.id, NEW.id, v_rule.rule_type, v_violation_desc, 'warning');
            END IF;
        END IF;

    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper to format currency numbers in trigger messages
CREATE OR REPLACE FUNCTION fmt_currency(val NUMERIC)
RETURNS TEXT AS $$
BEGIN
  RETURN '$' || TO_CHAR(val, 'FM999,999,999.00');
END;
$$ LANGUAGE plpgsql;

-- 7. Bind the trigger to public.trades table
DROP TRIGGER IF EXISTS trg_check_trading_rules ON public.trades;
CREATE TRIGGER trg_check_trading_rules
AFTER INSERT OR UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION check_trading_rules_violation();

-- RLS: trades/accounts visible only to owner
-- ai_reports: visible only to owner
-- messages: readable by all authenticated users
-- Enable Realtime on: trades, equity_snapshots, messages

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  display_name TEXT,
  trading_style TEXT CHECK (trading_style IN ('scalper','swing','intraday','position')),
  primary_instrument TEXT DEFAULT 'XAUUSD',
  country TEXT,
  bio TEXT,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.mt5_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  mt5_login BIGINT NOT NULL,
  investor_password TEXT NOT NULL,
  broker_server TEXT NOT NULL,
  broker_name TEXT,
  account_currency TEXT DEFAULT 'USD',
  initial_balance NUMERIC,
  current_balance NUMERIC,
  current_equity NUMERIC,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, mt5_login)
);

CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.mt5_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  mt5_ticket BIGINT NOT NULL,
  symbol TEXT NOT NULL,
  direction TEXT CHECK (direction IN ('buy','sell')),
  lot_size NUMERIC,
  entry_price NUMERIC,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  open_time TIMESTAMPTZ,
  close_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  gross_profit NUMERIC,
  commission NUMERIC DEFAULT 0,
  swap NUMERIC DEFAULT 0,
  net_profit NUMERIC,
  pips NUMERIC,
  rr_ratio NUMERIC,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  -- Journal fields (filled by trader)
  setup_tag TEXT,
  notes TEXT,
  screenshot_url TEXT,
  emotion_before TEXT CHECK (emotion_before IN ('confident','nervous','neutral','excited','fearful','greedy')),
  emotion_after TEXT CHECK (emotion_after IN ('satisfied','regret','neutral','relieved','frustrated','proud')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  mistakes TEXT[],
  followed_plan BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, mt5_ticket)
);

CREATE TABLE public.equity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.mt5_accounts(id) ON DELETE CASCADE,
  equity NUMERIC NOT NULL,
  balance NUMERIC NOT NULL,
  floating_pnl NUMERIC DEFAULT 0,
  snapshot_time TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ai_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  account_id UUID REFERENCES public.mt5_accounts(id),
  report_period TEXT CHECK (report_period IN ('weekly','monthly','alltime')),
  grade TEXT,
  grade_reason TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  blind_spots TEXT[],
  revenge_trading_detected BOOLEAN DEFAULT false,
  best_session TEXT,
  worst_session TEXT,
  best_day TEXT,
  worst_day TEXT,
  risk_score INTEGER,
  consistency_score INTEGER,
  discipline_score INTEGER,
  action_plan TEXT[],
  summary TEXT,
  trades_analyzed INTEGER,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.backtest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  session_name TEXT,
  symbol TEXT DEFAULT 'XAUUSD',
  timeframe TEXT DEFAULT '1H',
  start_date DATE,
  end_date DATE,
  starting_balance NUMERIC DEFAULT 10000,
  final_balance NUMERIC,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.backtest_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.backtest_sessions(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('buy','sell')),
  entry_price NUMERIC,
  exit_price NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  lot_size NUMERIC DEFAULT 0.1,
  profit NUMERIC,
  entry_candle_index INTEGER,
  exit_candle_index INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ohlcv_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  open_time TIMESTAMPTZ NOT NULL,
  open_price NUMERIC,
  high_price NUMERIC,
  low_price NUMERIC,
  close_price NUMERIC,
  volume NUMERIC,
  UNIQUE(symbol, timeframe, open_time)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  channel TEXT DEFAULT 'general',
  content TEXT,
  trade_card JSONB,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','trade_card','system')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mt5_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ohlcv_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Profiles: readable by all, insert/update by owner
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- MT5 Accounts: only visible to owner
CREATE POLICY "Users can view own accounts" ON public.mt5_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.mt5_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.mt5_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.mt5_accounts FOR DELETE USING (auth.uid() = user_id);

-- Trades: only visible to owner
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- Equity Snapshots
CREATE POLICY "Users can view own equity snapshots" ON public.equity_snapshots FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.mt5_accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
);
CREATE POLICY "Users can insert own equity snapshots" ON public.equity_snapshots FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.mt5_accounts a WHERE a.id = account_id AND a.user_id = auth.uid())
);

-- AI Reports
CREATE POLICY "Users can view own AI reports" ON public.ai_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI reports" ON public.ai_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own AI reports" ON public.ai_reports FOR DELETE USING (auth.uid() = user_id);

-- Backtest Sessions
CREATE POLICY "Users can view own backtest sessions" ON public.backtest_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backtest sessions" ON public.backtest_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own backtest sessions" ON public.backtest_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own backtest sessions" ON public.backtest_sessions FOR DELETE USING (auth.uid() = user_id);

-- Backtest Trades
CREATE POLICY "Users can view own backtest trades" ON public.backtest_trades FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.backtest_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can insert own backtest trades" ON public.backtest_trades FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.backtest_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);
CREATE POLICY "Users can update own backtest trades" ON public.backtest_trades FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.backtest_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
);

-- OHLCV Cache (public read)
CREATE POLICY "OHLCV cache is viewable by everyone" ON public.ohlcv_cache FOR SELECT USING (true);
CREATE POLICY "Service role can insert OHLCV" ON public.ohlcv_cache FOR ALL USING (true) WITH CHECK (true);

-- Messages
CREATE POLICY "Messages are viewable by everyone" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Trader')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Realtime
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.trades, public.equity_snapshots, public.messages;
COMMIT;

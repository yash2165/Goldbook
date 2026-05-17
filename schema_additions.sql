-- ============================================================
-- GoldBook Schema Additions - Run in Supabase SQL Editor
-- ============================================================

-- 1. Add source field to trades (manual vs mt5)
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'mt5';

-- 1b. Add sync_token to mt5_accounts
ALTER TABLE public.mt5_accounts ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- 2. Add pre-trade checklist JSONB
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS pre_trade_checklist JSONB;

-- 3. Add setup notes
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS setup_notes TEXT;

-- 4. Add duration_seconds
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- 5. Add emotion columns for journaling
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS emotion_before TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS emotion_after TEXT;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS rating INTEGER;

-- 6. Add profile enhancements
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trading_style TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pre_trade_checklist JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trading_setups JSONB;

-- 7. Community messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for messages (drop first to avoid duplicate error)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages viewable by all authenticated" ON public.messages;
CREATE POLICY "Messages viewable by all authenticated" ON public.messages
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
CREATE POLICY "Users can insert own messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 8. AI Reports table
CREATE TABLE IF NOT EXISTS public.ai_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id UUID,
  report_period TEXT DEFAULT 'alltime',
  grade TEXT,
  grade_reason TEXT,
  strengths TEXT[],
  weaknesses TEXT[],
  blind_spots TEXT[],
  revenge_trading_detected BOOLEAN DEFAULT FALSE,
  best_session TEXT,
  worst_session TEXT,
  best_day TEXT,
  worst_day TEXT,
  risk_score NUMERIC,
  consistency_score NUMERIC,
  discipline_score NUMERIC,
  action_plan TEXT[],
  summary TEXT,
  trades_analyzed INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own their AI reports" ON public.ai_reports;
CREATE POLICY "Users own their AI reports" ON public.ai_reports
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- ENABLE REALTIME (makes dashboard auto-update instantly)
-- ============================================================

-- Safely add tables to the publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'trades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'ai_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_reports;
  END IF;
END $$;

-- 9. Add is_deleted for soft-delete functionality
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 10. Add onboarding fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS experience_level TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS forex_pairs TEXT[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- 11. Friendships table
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their friendships" ON public.friendships;
CREATE POLICY "Users can view their friendships" ON public.friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
CREATE POLICY "Users can create friendships" ON public.friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
CREATE POLICY "Users can update their friendships" ON public.friendships FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friendships;
CREATE POLICY "Users can delete their friendships" ON public.friendships FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 12. Trade sharing in chat
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 13. Create storage bucket for chat images (run in SQL Editor)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat_images', 'chat_images', true) ON CONFLICT (id) DO NOTHING;
-- CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'chat_images');
-- CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat_images' AND auth.role() = 'authenticated');

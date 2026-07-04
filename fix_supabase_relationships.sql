-- SECTION 1: Fix postgREST relation schema cache
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE post_comments DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;
ALTER TABLE post_comments ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_following_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_user_id_fkey;
ALTER TABLE conversation_members ADD CONSTRAINT conversation_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE trade_screenshots DROP CONSTRAINT IF EXISTS trade_screenshots_user_id_fkey;
ALTER TABLE trade_screenshots ADD CONSTRAINT trade_screenshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


-- SECTION 2: Ensure storage buckets are public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_images', 'chat_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- SECTION 3: Storage Access Policies (use owner_id UUID column)
DROP POLICY IF EXISTS "Allow public select on storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts on avatars bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts on screenshots bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated inserts on chat_images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner updates on avatars bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner updates on screenshots bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner updates on chat_images bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner deletes on avatars bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner deletes on screenshots bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow owner deletes on chat_images bucket" ON storage.objects;

CREATE POLICY "Allow public select on storage objects" ON storage.objects FOR SELECT USING (true);

CREATE POLICY "Allow authenticated inserts on avatars bucket" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.role() = 'authenticated'
);
CREATE POLICY "Allow authenticated inserts on screenshots bucket" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'screenshots' AND auth.role() = 'authenticated'
);
CREATE POLICY "Allow authenticated inserts on chat_images bucket" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat_images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow owner updates on avatars bucket" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid() = owner_id
);
CREATE POLICY "Allow owner updates on screenshots bucket" ON storage.objects FOR UPDATE USING (
  bucket_id = 'screenshots' AND auth.uid() = owner_id
);
CREATE POLICY "Allow owner updates on chat_images bucket" ON storage.objects FOR UPDATE USING (
  bucket_id = 'chat_images' AND auth.uid() = owner_id
);

CREATE POLICY "Allow owner deletes on avatars bucket" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid() = owner_id
);
CREATE POLICY "Allow owner deletes on screenshots bucket" ON storage.objects FOR DELETE USING (
  bucket_id = 'screenshots' AND auth.uid() = owner_id
);
CREATE POLICY "Allow owner deletes on chat_images bucket" ON storage.objects FOR DELETE USING (
  bucket_id = 'chat_images' AND auth.uid() = owner_id
);


-- SECTION 4: Profiles Table Add Missing Columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free';


-- SECTION 5: Private Voice Rooms system
CREATE TABLE IF NOT EXISTS voice_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'public' CHECK (type IN ('public', 'private')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_room_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES voice_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE voice_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_room_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_rooms' AND policyname = 'Anyone can read voice rooms') THEN
    CREATE POLICY "Anyone can read voice rooms" ON voice_rooms FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_rooms' AND policyname = 'Anyone can manage own voice rooms') THEN
    CREATE POLICY "Anyone can manage own voice rooms" ON voice_rooms FOR ALL USING (auth.uid() = created_by);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_room_requests' AND policyname = 'Anyone can read requests') THEN
    CREATE POLICY "Anyone can read requests" ON voice_room_requests FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_room_requests' AND policyname = 'Users can request to join') THEN
    CREATE POLICY "Users can request to join" ON voice_room_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_room_requests' AND policyname = 'Admins manage request status') THEN
    CREATE POLICY "Admins manage request status" ON voice_room_requests FOR UPDATE USING (
      auth.uid() IN (SELECT created_by FROM voice_rooms WHERE id = room_id)
    );
  END IF;
END $$;


-- SECTION 6: Global Chat Messages Table
CREATE TABLE IF NOT EXISTS global_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('english', 'hindi')),
  content TEXT NOT NULL,
  trade_id UUID,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE global_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'global_messages' AND policyname = 'Anyone can read global messages') THEN
    CREATE POLICY "Anyone can read global messages" ON global_messages FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'global_messages' AND policyname = 'Users can send global messages') THEN
    CREATE POLICY "Users can send global messages" ON global_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- SECTION 7: Real-time Publications Setup
DO $$
DECLARE
  pub_exists BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF pub_exists THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE global_messages;
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'global_messages already in publication'; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_room_requests;
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'voice_room_requests already in publication'; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE voice_rooms;
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'voice_rooms already in publication'; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
    EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'direct_messages already in publication'; END;
  END IF;
END $$;


-- SECTION 8: Angel One & Indian Tax P&L Database System
CREATE TABLE IF NOT EXISTS tax_pnl_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  broker TEXT NOT NULL DEFAULT 'angel_one',
  client_name TEXT,
  client_id TEXT,
  pan TEXT,
  financial_year TEXT,
  from_date DATE,
  to_date DATE,
  ledger_opening_balance NUMERIC(15,2) DEFAULT 0,
  ledger_closing_balance NUMERIC(15,2) DEFAULT 0,
  total_taxable_pnl NUMERIC(15,2) DEFAULT 0,
  delivery_ltcg_pnl NUMERIC(15,2) DEFAULT 0,
  delivery_stcg_pnl NUMERIC(15,2) DEFAULT 0,
  intraday_speculative_pnl NUMERIC(15,2) DEFAULT 0,
  futures_pnl NUMERIC(15,2) DEFAULT 0,
  options_pnl NUMERIC(15,2) DEFAULT 0,
  futures_turnover NUMERIC(15,2) DEFAULT 0,
  options_turnover NUMERIC(15,2) DEFAULT 0,
  total_charges NUMERIC(15,2) DEFAULT 0,
  total_stt NUMERIC(15,2) DEFAULT 0,
  additional_brokerage NUMERIC(15,2) DEFAULT 0,
  non_trade_dp_charges NUMERIC(15,2) DEFAULT 0,
  non_trade_amc_charges NUMERIC(15,2) DEFAULT 0,
  non_trade_interest_charges NUMERIC(15,2) DEFAULT 0,
  raw_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tax_pnl_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_pnl_reports' AND policyname = 'Users can view own tax reports') THEN
    CREATE POLICY "Users can view own tax reports" ON tax_pnl_reports FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_pnl_reports' AND policyname = 'Users can manage own tax reports') THEN
    CREATE POLICY "Users can manage own tax reports" ON tax_pnl_reports FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS stt NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS statutory_charges NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS segment TEXT DEFAULT 'intraday';
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS isin TEXT;


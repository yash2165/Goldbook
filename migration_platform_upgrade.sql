-- ============================================================================
-- GOLDBOOK PLATFORM UPGRADE — MASTER MIGRATION SCRIPT
-- Run this ONCE in Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================================
-- This script is SAFE to run multiple times (uses IF NOT EXISTS everywhere).
-- It covers: multiple screenshots, social feed, DMs, notifications, support,
-- enhanced profiles, and privacy controls.
-- ============================================================================

-- ============================================================================
-- SECTION 1: MULTIPLE SCREENSHOTS PER TRADE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade ON trade_screenshots(trade_id);

ALTER TABLE trade_screenshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trade_screenshots' AND policyname = 'Users manage own screenshots') THEN
    CREATE POLICY "Users manage own screenshots" ON trade_screenshots FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Enable realtime for screenshot updates
ALTER PUBLICATION supabase_realtime ADD TABLE trade_screenshots;


-- ============================================================================
-- SECTION 2: ENHANCED PROFILE COLUMNS (Social Media Features)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_pnl_amounts BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_friend_requests TEXT DEFAULT 'everyone';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_messages TEXT DEFAULT 'friends';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_trade_visibility TEXT DEFAULT 'friends';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allow_trade_copying BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_likes_received INT DEFAULT 0;


-- ============================================================================
-- SECTION 3: FOLLOWS SYSTEM (separate from friendships)
-- ============================================================================

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Users manage own follows') THEN
    CREATE POLICY "Users manage own follows" ON follows FOR ALL USING (auth.uid() = follower_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'follows' AND policyname = 'Users see followers') THEN
    CREATE POLICY "Users see followers" ON follows FOR SELECT USING (auth.uid() = following_id);
  END IF;
END $$;


-- ============================================================================
-- SECTION 4: SOCIAL FEED — Posts, Likes, Comments
-- ============================================================================

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text','trade_idea','analysis','milestone')),
  media_urls TEXT[] DEFAULT '{}',
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  symbol TEXT,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_symbol ON posts(symbol) WHERE symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_trending ON posts(likes_count DESC, created_at DESC);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Anyone can read posts') THEN
    CREATE POLICY "Anyone can read posts" ON posts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Users manage own posts') THEN
    CREATE POLICY "Users manage own posts" ON posts FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Post Likes
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Anyone can read likes') THEN
    CREATE POLICY "Anyone can read likes" ON post_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Users manage own likes') THEN
    CREATE POLICY "Users manage own likes" ON post_likes FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Post Comments
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Anyone can read comments') THEN
    CREATE POLICY "Anyone can read comments" ON post_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users manage own comments') THEN
    CREATE POLICY "Users manage own comments" ON post_comments FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;


-- ============================================================================
-- SECTION 5: DIRECT MESSAGES & GROUP CHATS
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  name TEXT,
  description TEXT,
  avatar_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS conversation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin','moderator','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  is_muted BOOLEAN DEFAULT false,
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_members_conv ON conversation_members(conversation_id);

ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text','image','trade_card','system')),
  media_url TEXT,
  trade_id UUID REFERENCES trades(id) ON DELETE SET NULL,
  is_edited BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_conversation ON direct_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_sender ON direct_messages(sender_id);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations (users only see what they belong to)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Members see conversations') THEN
    CREATE POLICY "Members see conversations" ON conversations
      FOR SELECT USING (id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Users create conversations') THEN
    CREATE POLICY "Users create conversations" ON conversations
      FOR INSERT WITH CHECK (created_by = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversations' AND policyname = 'Admins update conversations') THEN
    CREATE POLICY "Admins update conversations" ON conversations
      FOR UPDATE USING (id IN (
        SELECT conversation_id FROM conversation_members
        WHERE user_id = auth.uid() AND role IN ('admin','moderator')
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_members' AND policyname = 'Members see memberships') THEN
    CREATE POLICY "Members see memberships" ON conversation_members
      FOR SELECT USING (
        conversation_id IN (SELECT conversation_id FROM conversation_members cm WHERE cm.user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_members' AND policyname = 'Users manage own membership') THEN
    CREATE POLICY "Users manage own membership" ON conversation_members
      FOR ALL USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conversation_members' AND policyname = 'Admins manage members') THEN
    CREATE POLICY "Admins manage members" ON conversation_members
      FOR ALL USING (
        conversation_id IN (SELECT conversation_id FROM conversation_members cm WHERE cm.user_id = auth.uid() AND cm.role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Members see messages') THEN
    CREATE POLICY "Members see messages" ON direct_messages
      FOR SELECT USING (
        conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
        AND deleted_at IS NULL
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Members send messages') THEN
    CREATE POLICY "Members send messages" ON direct_messages
      FOR INSERT WITH CHECK (
        sender_id = auth.uid()
        AND conversation_id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'direct_messages' AND policyname = 'Senders edit own messages') THEN
    CREATE POLICY "Senders edit own messages" ON direct_messages
      FOR UPDATE USING (sender_id = auth.uid());
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_members;


-- ============================================================================
-- SECTION 6: NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'like','comment','follow','friend_request','mention','message','system'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users see own notifications') THEN
    CREATE POLICY "Users see own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'Users update own notifications') THEN
    CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'notifications' AND policyname = 'System inserts notifications') THEN
    CREATE POLICY "System inserts notifications" ON notifications FOR INSERT WITH CHECK (true);
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ============================================================================
-- SECTION 7: SUPPORT TICKETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT DEFAULT 'other' CHECK (category IN ('bug','feature','account','billing','other')),
  message TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users see own tickets') THEN
    CREATE POLICY "Users see own tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users create tickets') THEN
    CREATE POLICY "Users create tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- ============================================================================
-- SECTION 8: FRIENDSHIPS TABLE ENHANCEMENT
-- ============================================================================

ALTER TABLE friendships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Prevent duplicate friendships in both directions
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair
  ON friendships(LEAST(user_id, friend_id), GREATEST(user_id, friend_id));


-- ============================================================================
-- SECTION 9: HELPER FUNCTIONS
-- ============================================================================

-- Auto-update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_follow_counts ON follows;
CREATE TRIGGER trg_update_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Auto-update post likes_count
CREATE OR REPLACE FUNCTION update_post_likes_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_post_likes ON post_likes;
CREATE TRIGGER trg_update_post_likes
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_likes_count();

-- Auto-update post comments_count
CREATE OR REPLACE FUNCTION update_post_comments_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_post_comments ON post_comments;
CREATE TRIGGER trg_update_post_comments
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comments_count();

-- Auto-update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message() RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_conv_last_msg ON direct_messages;
CREATE TRIGGER trg_update_conv_last_msg
  AFTER INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();


-- ============================================================================
-- DONE! All tables, indexes, RLS policies, and triggers are now set up.
-- You can verify by going to Table Editor and checking for the new tables:
--   trade_screenshots, follows, posts, post_likes, post_comments,
--   conversations, conversation_members, direct_messages,
--   notifications, support_tickets
-- ============================================================================

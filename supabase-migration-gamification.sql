-- ============================================
-- 3D Global Dashboard - Gamification Features Migration
-- ============================================
-- Created: 2025-10-22
-- Description: Adds new tables for discoveries, achievements, and leaderboards
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute all statements
-- ============================================

-- ============================================
-- NEW TABLES
-- ============================================

-- Country Discoveries Table - Track which countries users have explored
CREATE TABLE IF NOT EXISTS public.country_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  discovery_method TEXT NOT NULL CHECK (discovery_method IN ('click', 'hover', 'search', 'comparison', 'migration', 'quiz')),
  first_discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_interacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  interaction_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, country_code)
);

-- Enable Row Level Security
ALTER TABLE public.country_discoveries ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_country_discoveries_user_id ON public.country_discoveries(user_id);
CREATE INDEX IF NOT EXISTS idx_country_discoveries_country_code ON public.country_discoveries(country_code);
CREATE INDEX IF NOT EXISTS idx_country_discoveries_discovered_at ON public.country_discoveries(first_discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_country_discoveries_method ON public.country_discoveries(discovery_method);

-- User Achievements Table - Track earned achievements and badges
CREATE TABLE IF NOT EXISTS public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  achievement_name TEXT NOT NULL,
  achievement_description TEXT NOT NULL,
  achievement_category TEXT NOT NULL CHECK (achievement_category IN ('quiz', 'discovery', 'exploration', 'social', 'milestone')),
  achievement_tier TEXT NOT NULL CHECK (achievement_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  progress INTEGER NOT NULL DEFAULT 0,
  progress_max INTEGER NOT NULL DEFAULT 100,
  is_unlocked BOOLEAN NOT NULL DEFAULT false,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON public.user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON public.user_achievements(is_unlocked);
CREATE INDEX IF NOT EXISTS idx_user_achievements_category ON public.user_achievements(achievement_category);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked_at ON public.user_achievements(unlocked_at DESC);

-- Leaderboard Entries Table - Track user rankings and scores
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('global', 'weekly', 'monthly', 'mode-specific')),
  game_mode TEXT CHECK (game_mode IN ('find-country', 'capital-match', 'flag-id', 'facts-guess', 'explore-learn', 'all')),
  total_score INTEGER NOT NULL DEFAULT 0,
  total_games INTEGER NOT NULL DEFAULT 0,
  average_score DECIMAL(10,2) NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  countries_discovered INTEGER NOT NULL DEFAULT 0,
  achievements_unlocked INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  percentile DECIMAL(5,2),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, leaderboard_type, game_mode, period_start)
);

-- Enable Row Level Security
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON public.leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_type ON public.leaderboard_entries(leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_mode ON public.leaderboard_entries(game_mode);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_rank ON public.leaderboard_entries(rank ASC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_score ON public.leaderboard_entries(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_updated ON public.leaderboard_entries(last_updated DESC);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Country Discoveries Policies
-- Users can view their own discoveries
DROP POLICY IF EXISTS "Users can view own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can view own discoveries"
  ON public.country_discoveries
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own discoveries
DROP POLICY IF EXISTS "Users can insert own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can insert own discoveries"
  ON public.country_discoveries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own discoveries
DROP POLICY IF EXISTS "Users can update own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can update own discoveries"
  ON public.country_discoveries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own discoveries
DROP POLICY IF EXISTS "Users can delete own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can delete own discoveries"
  ON public.country_discoveries
  FOR DELETE
  USING (auth.uid() = user_id);

-- User Achievements Policies
-- Users can view their own achievements
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own achievements
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own achievements
DROP POLICY IF EXISTS "Users can update own achievements" ON public.user_achievements;
CREATE POLICY "Users can update own achievements"
  ON public.user_achievements
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own achievements
DROP POLICY IF EXISTS "Users can delete own achievements" ON public.user_achievements;
CREATE POLICY "Users can delete own achievements"
  ON public.user_achievements
  FOR DELETE
  USING (auth.uid() = user_id);

-- Leaderboard Entries Policies
-- Users can view all leaderboard entries (public leaderboard)
DROP POLICY IF EXISTS "Everyone can view leaderboards" ON public.leaderboard_entries;
CREATE POLICY "Everyone can view leaderboards"
  ON public.leaderboard_entries
  FOR SELECT
  USING (true);

-- Users can insert their own leaderboard entries
DROP POLICY IF EXISTS "Users can insert own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can insert own leaderboard entries"
  ON public.leaderboard_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own leaderboard entries
DROP POLICY IF EXISTS "Users can update own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can update own leaderboard entries"
  ON public.leaderboard_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own leaderboard entries
DROP POLICY IF EXISTS "Users can delete own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can delete own leaderboard entries"
  ON public.leaderboard_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger for user_achievements table
DROP TRIGGER IF EXISTS update_user_achievements_updated_at ON public.user_achievements;
CREATE TRIGGER update_user_achievements_updated_at
  BEFORE UPDATE ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANTS
-- ============================================

-- Grant access to new tables
GRANT ALL ON public.country_discoveries TO authenticated;
GRANT ALL ON public.user_achievements TO authenticated;
GRANT ALL ON public.leaderboard_entries TO authenticated;
GRANT SELECT ON public.leaderboard_entries TO anon; -- Allow anonymous users to view leaderboards

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Run these queries to verify the migration was successful:

-- Check new tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('country_discoveries', 'user_achievements', 'leaderboard_entries');

-- Check RLS is enabled on new tables
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('country_discoveries', 'user_achievements', 'leaderboard_entries');

-- Check policies for new tables
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('country_discoveries', 'user_achievements', 'leaderboard_entries');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Gamification features migration completed successfully!';
  RAISE NOTICE '📊 Added 3 new tables: country_discoveries, user_achievements, leaderboard_entries';
  RAISE NOTICE '🔒 RLS policies configured for all tables';
  RAISE NOTICE '📈 Indexes created for optimal performance';
END $$;

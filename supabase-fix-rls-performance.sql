-- =====================================================
-- Fix RLS Performance Issues
-- =====================================================
-- This migration optimizes RLS policies to cache auth.uid()
-- instead of re-evaluating it for every row
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Create a cached helper function for auth.uid()
-- This function is marked as STABLE so PostgreSQL can cache the result
-- Using public schema since we don't have permission to create in auth schema
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

-- =====================================================
-- Step 2: Update all RLS policies to use public.current_user_id()
-- =====================================================

-- Profiles table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (public.current_user_id() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (public.current_user_id() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (public.current_user_id() = id);

-- Quiz sessions table policies
DROP POLICY IF EXISTS "Users can view own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can view own quiz sessions"
  ON public.quiz_sessions
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can insert own quiz sessions"
  ON public.quiz_sessions
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can update own quiz sessions"
  ON public.quiz_sessions
  FOR UPDATE
  USING (public.current_user_id() = user_id)
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own quiz sessions" ON public.quiz_sessions;
CREATE POLICY "Users can delete own quiz sessions"
  ON public.quiz_sessions
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- User stats table policies
DROP POLICY IF EXISTS "Users can view own stats" ON public.user_stats;
CREATE POLICY "Users can view own stats"
  ON public.user_stats
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON public.user_stats;
CREATE POLICY "Users can insert own stats"
  ON public.user_stats
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Users can update own stats"
  ON public.user_stats
  FOR UPDATE
  USING (public.current_user_id() = user_id)
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own stats" ON public.user_stats;
CREATE POLICY "Users can delete own stats"
  ON public.user_stats
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- User achievements table policies
DROP POLICY IF EXISTS "Users can view own achievements" ON public.user_achievements;
CREATE POLICY "Users can view own achievements"
  ON public.user_achievements
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;
CREATE POLICY "Users can insert own achievements"
  ON public.user_achievements
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own achievements" ON public.user_achievements;
CREATE POLICY "Users can update own achievements"
  ON public.user_achievements
  FOR UPDATE
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own achievements" ON public.user_achievements;
CREATE POLICY "Users can delete own achievements"
  ON public.user_achievements
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- Leaderboard entries table policies
DROP POLICY IF EXISTS "Everyone can view leaderboards" ON public.leaderboard_entries;
CREATE POLICY "Everyone can view leaderboards"
  ON public.leaderboard_entries
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can insert own leaderboard entries"
  ON public.leaderboard_entries
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can update own leaderboard entries"
  ON public.leaderboard_entries
  FOR UPDATE
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own leaderboard entries" ON public.leaderboard_entries;
CREATE POLICY "Users can delete own leaderboard entries"
  ON public.leaderboard_entries
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- Country discoveries table policies (if they exist)
DROP POLICY IF EXISTS "Users can view own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can view own discoveries"
  ON public.country_discoveries
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can insert own discoveries"
  ON public.country_discoveries
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can update own discoveries"
  ON public.country_discoveries
  FOR UPDATE
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own discoveries" ON public.country_discoveries;
CREATE POLICY "Users can delete own discoveries"
  ON public.country_discoveries
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- Country comparisons table policies
DROP POLICY IF EXISTS "Users can view own country comparisons" ON public.country_comparisons;
CREATE POLICY "Users can view own country comparisons"
  ON public.country_comparisons
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own country comparisons" ON public.country_comparisons;
CREATE POLICY "Users can insert own country comparisons"
  ON public.country_comparisons
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own country comparisons" ON public.country_comparisons;
CREATE POLICY "Users can delete own country comparisons"
  ON public.country_comparisons
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- Migration views table policies
DROP POLICY IF EXISTS "Users can view own migration views" ON public.migration_views;
CREATE POLICY "Users can view own migration views"
  ON public.migration_views
  FOR SELECT
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can insert own migration views" ON public.migration_views;
CREATE POLICY "Users can insert own migration views"
  ON public.migration_views
  FOR INSERT
  WITH CHECK (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own migration views" ON public.migration_views;
CREATE POLICY "Users can update own migration views"
  ON public.migration_views
  FOR UPDATE
  USING (public.current_user_id() = user_id);

DROP POLICY IF EXISTS "Users can delete own migration views" ON public.migration_views;
CREATE POLICY "Users can delete own migration views"
  ON public.migration_views
  FOR DELETE
  USING (public.current_user_id() = user_id);

-- =====================================================
-- Step 3: Verify the changes
-- =====================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'quiz_sessions',
    'user_stats',
    'user_achievements',
    'leaderboard_entries',
    'country_discoveries',
    'migration_views'
  )
ORDER BY tablename, cmd;

-- =====================================================
-- EXPECTED RESULT:
-- All policies should now use public.current_user_id() instead of auth.uid()
-- Performance warnings should disappear within a few minutes
-- =====================================================

-- Verification: Check that the helper function exists
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS return_type,
  p.provolatile AS volatility,
  p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'current_user_id';

-- Note: provolatile = 's' means STABLE (cacheable within a query)
-- search_path_config should show {search_path=} for security

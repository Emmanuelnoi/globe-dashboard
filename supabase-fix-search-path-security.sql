-- =====================================================
-- Fix Search Path Security Warnings
-- =====================================================
-- This migration adds SET search_path = '' to all functions
-- to prevent search path manipulation attacks
-- Run this in Supabase SQL Editor
-- =====================================================

-- Fix 1: update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers for update_updated_at_column
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quiz_sessions_updated_at
  BEFORE UPDATE ON public.quiz_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_country_discoveries_updated_at
  BEFORE UPDATE ON public.country_discoveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Fix 2: handle_new_user function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger for handle_new_user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Fix 3: increment_user_game_count function
-- Based on the visible function definition that inserts/updates user_stats
DROP FUNCTION IF EXISTS public.increment_user_game_count(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.increment_user_game_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, total_games, created_at)
  VALUES (p_user_id, 1, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_games = public.user_stats.total_games + 1,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION public.increment_user_game_count(uuid) IS
  'Increments the total_games count for a user, creating a record if it does not exist';

-- Verify the fixes
SELECT
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('update_updated_at_column', 'handle_new_user', 'increment_user_game_count')
ORDER BY p.proname;

-- =====================================================
-- EXPECTED OUTPUT:
-- You should see search_path_config showing {search_path=}
-- for all three functions
-- =====================================================

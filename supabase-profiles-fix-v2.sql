-- ============================================
-- Profiles Table Enhancement & Foreign Key Fix (v2)
-- ============================================
-- Created: 2025-10-23
-- Description: Ensures profiles table works correctly with leaderboard_entries
--              FIXED: Handles existing leaderboard_entries gracefully
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute all statements
-- ============================================

-- Step 1: Ensure profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable Row Level Security on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies for profiles
-- Users can view all profiles (public data for leaderboards)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Step 4: Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger for automatic profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 6: Backfill profiles for ALL existing users (including those in leaderboard_entries)
-- First, get all unique user_ids from both auth.users and leaderboard_entries
DO $$
DECLARE
  missing_user_id UUID;
BEGIN
  -- Create profiles for all auth.users
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)) as display_name,
    raw_user_meta_data->>'avatar_url' as avatar_url
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.profiles)
  ON CONFLICT (id) DO NOTHING;

  -- Create profiles for any user_ids in leaderboard_entries that don't have profiles
  -- (This handles orphaned entries from deleted users or data inconsistencies)
  FOR missing_user_id IN
    SELECT DISTINCT user_id
    FROM public.leaderboard_entries
    WHERE user_id NOT IN (SELECT id FROM public.profiles)
  LOOP
    -- Try to get user data from auth.users
    INSERT INTO public.profiles (id, email, display_name)
    SELECT
      id,
      email,
      COALESCE(SPLIT_PART(email, '@', 1), 'User') as display_name
    FROM auth.users
    WHERE id = missing_user_id
    ON CONFLICT (id) DO NOTHING;

    -- If user doesn't exist in auth.users (orphaned entry), create placeholder profile
    IF NOT FOUND THEN
      INSERT INTO public.profiles (id, email, display_name)
      VALUES (missing_user_id, NULL, 'Deleted User')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  RAISE NOTICE 'Profiles backfill complete';
END $$;

-- Step 7: Now safely update leaderboard_entries foreign key
DO $$
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leaderboard_entries_user_id_fkey'
    AND table_name = 'leaderboard_entries'
  ) THEN
    ALTER TABLE public.leaderboard_entries
    DROP CONSTRAINT leaderboard_entries_user_id_fkey;
  END IF;

  -- Add correct constraint referencing profiles
  ALTER TABLE public.leaderboard_entries
  ADD CONSTRAINT leaderboard_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  RAISE NOTICE 'Foreign key constraint updated successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating foreign key: %', SQLERRM;
END $$;

-- Step 8: Create indexes on profiles for better join performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- 1. Check if all profiles exist
SELECT
  'Total profiles' as metric,
  COUNT(*) as count
FROM public.profiles

UNION ALL

SELECT
  'Total auth users' as metric,
  COUNT(*) as count
FROM auth.users

UNION ALL

SELECT
  'Unique leaderboard users' as metric,
  COUNT(DISTINCT user_id) as count
FROM public.leaderboard_entries

UNION ALL

SELECT
  'Leaderboard entries without profiles' as metric,
  COUNT(*) as count
FROM public.leaderboard_entries le
LEFT JOIN public.profiles p ON p.id = le.user_id
WHERE p.id IS NULL;

-- 2. Check foreign key relationship
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'leaderboard_entries'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- 3. Test join query (should work now!)
SELECT
  le.rank,
  le.total_score,
  p.display_name,
  p.email
FROM public.leaderboard_entries le
JOIN public.profiles p ON p.id = le.user_id
WHERE le.leaderboard_type = 'global'
  AND le.game_mode = 'all'
ORDER BY le.rank ASC
LIMIT 10;

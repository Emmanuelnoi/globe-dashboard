-- ============================================
-- Profiles Table Enhancement & Foreign Key Fix (v3)
-- ============================================
-- Created: 2025-10-23
-- Description: Ensures profiles table works correctly with leaderboard_entries
--              FIXED: Cleans up orphaned leaderboard entries before adding FK
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

-- Step 6: CLEAN UP orphaned leaderboard entries (users that don't exist in auth.users)
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete leaderboard entries for users that don't exist in auth.users
  WITH deleted AS (
    DELETE FROM public.leaderboard_entries
    WHERE user_id NOT IN (SELECT id FROM auth.users)
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RAISE NOTICE '🗑️  Cleaned up % orphaned leaderboard entries', deleted_count;
END $$;

-- Step 7: Backfill profiles for all existing auth.users
INSERT INTO public.profiles (id, email, display_name, avatar_url)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'display_name', raw_user_meta_data->>'full_name', SPLIT_PART(email, '@', 1)) as display_name,
  raw_user_meta_data->>'avatar_url' as avatar_url
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Step 8: Verify all leaderboard_entries now have corresponding auth.users
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT user_id)
  INTO orphaned_count
  FROM public.leaderboard_entries
  WHERE user_id NOT IN (SELECT id FROM auth.users);

  IF orphaned_count > 0 THEN
    RAISE EXCEPTION '❌ Still have % orphaned entries after cleanup!', orphaned_count;
  ELSE
    RAISE NOTICE '✅ All leaderboard entries have valid users';
  END IF;
END $$;

-- Step 9: Now safely update leaderboard_entries foreign key
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
    RAISE NOTICE '🔧 Dropped old foreign key constraint';
  END IF;

  -- Add correct constraint referencing profiles
  ALTER TABLE public.leaderboard_entries
  ADD CONSTRAINT leaderboard_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

  RAISE NOTICE '✅ Foreign key constraint added successfully: leaderboard_entries.user_id → profiles.id';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '❌ Error updating foreign key: %', SQLERRM;
END $$;

-- Step 10: Create indexes on profiles for better join performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON public.profiles(display_name);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Summary statistics
SELECT
  '📊 Total profiles' as metric,
  COUNT(*) as count
FROM public.profiles

UNION ALL

SELECT
  '👥 Total auth users' as metric,
  COUNT(*) as count
FROM auth.users

UNION ALL

SELECT
  '🏆 Unique leaderboard users' as metric,
  COUNT(DISTINCT user_id) as count
FROM public.leaderboard_entries

UNION ALL

SELECT
  '❌ Orphaned leaderboard entries' as metric,
  COUNT(*) as count
FROM public.leaderboard_entries le
LEFT JOIN public.profiles p ON p.id = le.user_id
WHERE p.id IS NULL

UNION ALL

SELECT
  '❌ Profiles without auth.users' as metric,
  COUNT(*) as count
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;

-- Show foreign key relationship
SELECT
  '🔗 Foreign Key: ' || tc.table_name || '.' || kcu.column_name || ' → ' || ccu.table_name || '.' || ccu.column_name as relationship
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'leaderboard_entries'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'user_id';

-- Test join query (should work now!)
SELECT
  '🎯 Top 10 Leaderboard with Profiles' as result;

SELECT
  le.rank,
  le.total_score,
  COALESCE(p.display_name, p.email, 'Unknown') as player_name,
  p.email
FROM public.leaderboard_entries le
JOIN public.profiles p ON p.id = le.user_id
WHERE le.leaderboard_type = 'global'
  AND le.game_mode = 'all'
ORDER BY le.rank ASC
LIMIT 10;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '🎉 Setup complete! Leaderboard will now show real usernames.';
  RAISE NOTICE '📝 Next: Restart your app with "pnpm start" to see the changes.';
END $$;

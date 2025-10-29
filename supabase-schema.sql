-- ============================================
-- 3D Global Dashboard - Supabase Database Schema
-- COMPLETE REBUILD SCRIPT
-- ============================================
-- Created: 2025-10-21
-- Updated: 2025-10-23 (Complete Rebuild)
-- Description: Database schema for user authentication and quiz progress tracking
--
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard → SQL Editor
-- 2. Copy and paste this entire file
-- 3. Click "Run" to execute all statements
-- ============================================

-- Step 1: Drop all existing tables
DROP TABLE IF EXISTS public.country_discoveries CASCADE;
DROP TABLE IF EXISTS public.country_comparisons CASCADE;
DROP TABLE IF EXISTS public.migration_views CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.quiz_sessions CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 2: Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create quiz_sessions table
CREATE TABLE public.quiz_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  incorrect_answers INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  time_taken INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  results JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Create user_stats table
CREATE TABLE public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_correct_answers INTEGER NOT NULL DEFAULT 0,
  total_incorrect_answers INTEGER NOT NULL DEFAULT 0,
  total_time_played INTEGER NOT NULL DEFAULT 0,
  average_score NUMERIC(5,2) DEFAULT 0,
  best_score INTEGER DEFAULT 0,
  stats_by_mode JSONB DEFAULT '{}'::jsonb,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Step 5: Create migration_views table
CREATE TABLE public.migration_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_code TEXT NOT NULL,
  species_name TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 6: Create country_comparisons table
CREATE TABLE public.country_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_codes TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Create country_discoveries table
CREATE TABLE public.country_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  discovery_method TEXT NOT NULL,
  first_discovered_at TIMESTAMPTZ NOT NULL,
  last_interacted_at TIMESTAMPTZ NOT NULL,
  interaction_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, country_code)
);

-- Step 8: Create indexes for performance
CREATE INDEX idx_quiz_sessions_user_id ON public.quiz_sessions(user_id);
CREATE INDEX idx_quiz_sessions_created_at ON public.quiz_sessions(created_at DESC);
CREATE INDEX idx_quiz_sessions_mode ON public.quiz_sessions(mode);
CREATE INDEX idx_user_stats_user_id ON public.user_stats(user_id);
CREATE INDEX idx_migration_views_user_id ON public.migration_views(user_id);
CREATE INDEX idx_migration_views_species ON public.migration_views(species_code);
CREATE INDEX idx_country_comparisons_user_id ON public.country_comparisons(user_id);
CREATE INDEX idx_country_discoveries_user_id ON public.country_discoveries(user_id);
CREATE INDEX idx_country_discoveries_country ON public.country_discoveries(country_code);

-- Step 9: Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_discoveries ENABLE ROW LEVEL SECURITY;

-- Step 10: Create RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Step 11: Create RLS Policies for quiz_sessions
CREATE POLICY "Users can view own quiz sessions" ON public.quiz_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz sessions" ON public.quiz_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quiz sessions" ON public.quiz_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own quiz sessions" ON public.quiz_sessions FOR DELETE USING (auth.uid() = user_id);

-- Step 12: Create RLS Policies for user_stats
CREATE POLICY "Users can view own stats" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own stats" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stats" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own stats" ON public.user_stats FOR DELETE USING (auth.uid() = user_id);

-- Step 13: Create RLS Policies for migration_views
CREATE POLICY "Users can view own migration views" ON public.migration_views FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own migration views" ON public.migration_views FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own migration views" ON public.migration_views FOR DELETE USING (auth.uid() = user_id);

-- Step 14: Create RLS Policies for country_comparisons
CREATE POLICY "Users can view own country comparisons" ON public.country_comparisons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own country comparisons" ON public.country_comparisons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own country comparisons" ON public.country_comparisons FOR DELETE USING (auth.uid() = user_id);

-- Step 15: Create RLS Policies for country_discoveries
CREATE POLICY "Users can view own country discoveries" ON public.country_discoveries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own country discoveries" ON public.country_discoveries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own country discoveries" ON public.country_discoveries FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own country discoveries" ON public.country_discoveries FOR DELETE USING (auth.uid() = user_id);

-- Step 16: Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quiz_sessions_updated_at BEFORE UPDATE ON public.quiz_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON public.user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_country_discoveries_updated_at BEFORE UPDATE ON public.country_discoveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 17: Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 18: Verify everything is created correctly
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;

import { Injectable, inject, signal } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
  AuthError,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import {
  GameSession,
  UserStatsV1,
} from '../../features/quiz/models/quiz.models';

/**
 * Supabase Service
 *
 * Handles:
 * - User authentication (email/password, OAuth)
 * - Cloud data synchronization
 * - Real-time subscriptions (future)
 */
@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly logger = inject(LoggerService);
  private supabase: SupabaseClient;

  // Auth state signals
  readonly currentUser = signal<User | null>(null);
  readonly currentSession = signal<Session | null>(null);
  readonly isAuthenticated = signal<boolean>(false);
  readonly authLoading = signal<boolean>(true);

  constructor() {
    // Initialize Supabase client
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      },
    );

    // Initialize auth state
    this.initializeAuth();
  }

  /**
   * Initialize authentication state and listen for changes
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Get initial session
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      if (error) {
        this.logger.error('Failed to get session:', error);
      } else {
        this.updateAuthState(session);
      }

      // Listen for auth changes
      this.supabase.auth.onAuthStateChange((_event, session) => {
        this.logger.debug(`Auth state changed: ${_event}`, 'Supabase');
        this.updateAuthState(session);
      });
    } catch (error) {
      this.logger.error('Auth initialization failed:', error);
    } finally {
      this.authLoading.set(false);
    }
  }

  /**
   * Update auth state signals
   */
  private updateAuthState(session: Session | null): void {
    this.currentSession.set(session);
    this.currentUser.set(session?.user ?? null);
    this.isAuthenticated.set(!!session);
  }

  // =====================
  // Authentication Methods
  // =====================

  /**
   * Sign up with email and password
   */
  async signUp(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        this.logger.error('Sign up failed:', error);
        return { user: null, error };
      }

      this.logger.success('Sign up successful!', 'Supabase');
      return { user: data.user, error: null };
    } catch (error) {
      this.logger.error('Sign up error:', error);
      return { user: null, error: error as AuthError };
    }
  }

  /**
   * Sign in with email and password
   */
  async signIn(
    email: string,
    password: string,
  ): Promise<{ user: User | null; error: AuthError | null }> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        this.logger.error('Sign in failed:', error);
        return { user: null, error };
      }

      this.logger.success('Sign in successful!', 'Supabase');
      return { user: data.user, error: null };
    } catch (error) {
      this.logger.error('Sign in error:', error);
      return { user: null, error: error as AuthError };
    }
  }

  /**
   * Sign in with Google OAuth
   */
  async signInWithGoogle(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        this.logger.error('Google sign in failed:', error);
        return { error };
      }

      return { error: null };
    } catch (error) {
      this.logger.error('Google sign in error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        this.logger.error('Sign out failed:', error);
        return { error };
      }

      this.logger.success('Signed out successfully', 'Supabase');
      return { error: null };
    } catch (error) {
      this.logger.error('Sign out error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Reset password (send recovery email)
   */
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        this.logger.error('Password reset failed:', error);
        return { error };
      }

      this.logger.success('Password reset email sent!', 'Supabase');
      return { error: null };
    } catch (error) {
      this.logger.error('Password reset error:', error);
      return { error: error as AuthError };
    }
  }

  /**
   * Update password (after reset)
   */
  async updatePassword(
    newPassword: string,
  ): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        this.logger.error('Password update failed:', error);
        return { error };
      }

      this.logger.success('Password updated successfully!', 'Supabase');
      return { error: null };
    } catch (error) {
      this.logger.error('Password update error:', error);
      return { error: error as AuthError };
    }
  }

  // =====================
  // Database Methods - Quiz Sessions
  // =====================

  /**
   * Upload quiz sessions to cloud
   */
  async uploadQuizSessions(
    sessions: GameSession[],
  ): Promise<{ error: Error | null }> {
    try {
      const userId = this.currentUser()?.id;
      if (!userId) {
        return { error: new Error('User not authenticated') };
      }

      // Prepare data for upload
      const sessionsData = sessions.map((session) => {
        // Calculate stats from results array
        const correctAnswers = session.results.filter(
          (r) => r.isCorrect,
        ).length;
        const incorrectAnswers = session.results.filter(
          (r) => !r.isCorrect,
        ).length;
        const timeTaken = session.results.reduce(
          (sum, r) => sum + r.timeSpent,
          0,
        );

        return {
          id: session.id,
          user_id: userId,
          mode: session.configuration.mode,
          score: session.finalScore,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          best_streak: session.bestStreak,
          time_taken: timeTaken,
          questions: session.questions,
          completed: session.completed,
          start_time: session.startTime,
          end_time: session.endTime,
          created_at: new Date().toISOString(),
        };
      });

      const { error } = await this.supabase
        .from('quiz_sessions')
        .upsert(sessionsData, { onConflict: 'id' });

      if (error) {
        this.logger.error('Failed to upload quiz sessions:', error);
        return { error: new Error(error.message) };
      }

      this.logger.success(
        `Uploaded ${sessions.length} quiz sessions`,
        'Supabase',
      );
      return { error: null };
    } catch (error) {
      this.logger.error('Upload quiz sessions error:', error);
      return { error: error as Error };
    }
  }

  /**
   * Download quiz sessions from cloud
   */
  async getQuizSessions(
    userId: string,
    limit: number = 100,
  ): Promise<{ data: GameSession[] | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('quiz_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.error('Failed to get quiz sessions:', error);
        return { data: null, error: new Error(error.message) };
      }

      // Map database format to GameSession format
      const sessions: GameSession[] = (data || []).map((row) => ({
        id: row.id,
        configuration: {
          mode: row.mode,
          difficulty: 'medium' as const, // Default value, not stored in DB
          questionCount: row.questions?.length || 0,
        },
        results: [], // Results array not stored in cloud (too large), would need to be reconstructed from questions
        finalScore: row.score,
        bestStreak: row.best_streak,
        questions: row.questions || [],
        completed: row.completed,
        startTime: new Date(row.start_time),
        endTime: row.end_time ? new Date(row.end_time) : undefined,
      }));

      return { data: sessions, error: null };
    } catch (error) {
      this.logger.error('Get quiz sessions error:', error);
      return { data: null, error: error as Error };
    }
  }

  // =====================
  // Database Methods - User Stats
  // =====================

  /**
   * Upload user stats to cloud
   */
  async uploadUserStats(stats: UserStatsV1): Promise<{ error: Error | null }> {
    try {
      const userId = this.currentUser()?.id;
      if (!userId) {
        return { error: new Error('User not authenticated') };
      }

      const { error } = await this.supabase.from('user_stats').upsert(
        {
          user_id: userId,
          version: stats.version,
          total_games: stats.totalGames,
          total_score: stats.totalScore,
          average_score: stats.averageScore,
          best_score: stats.bestScore,
          best_streak: stats.bestStreak,
          games_by_mode: stats.gamesByMode,
          last_updated: stats.lastUpdated.toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        this.logger.error('Failed to upload user stats:', error);
        return { error: new Error(error.message) };
      }

      this.logger.success('Uploaded user stats', 'Supabase');
      return { error: null };
    } catch (error) {
      this.logger.error('Upload user stats error:', error);
      return { error: error as Error };
    }
  }

  /**
   * Download user stats from cloud
   */
  async getUserStats(
    userId: string,
  ): Promise<{ data: UserStatsV1 | null; error: Error | null }> {
    try {
      const { data, error } = await this.supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No stats found (404) - this is okay for new users
          return { data: null, error: null };
        }
        this.logger.error('Failed to get user stats:', error);
        return { data: null, error: new Error(error.message) };
      }

      const stats: UserStatsV1 = {
        version: data.version,
        totalGames: data.total_games,
        totalScore: data.total_score,
        averageScore: data.average_score,
        bestScore: data.best_score,
        bestStreak: data.best_streak,
        gamesByMode: data.games_by_mode,
        lastUpdated: new Date(data.last_updated),
      };

      return { data: stats, error: null };
    } catch (error) {
      this.logger.error('Get user stats error:', error);
      return { data: null, error: error as Error };
    }
  }

  // =====================
  // Helper Methods
  // =====================

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUser()?.id ?? null;
  }

  /**
   * Check if user is authenticated
   */
  isUserAuthenticated(): boolean {
    return this.isAuthenticated();
  }
}

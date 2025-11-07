import { Injectable, inject, signal } from '@angular/core';
import {
  createClient,
  SupabaseClient,
  User,
  Session,
  AuthError,
  AuthChangeEvent,
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import {
  GameSession,
  UserStatsV1,
} from '../../features/quiz/models/quiz.models';

/**
 * Password strength score
 */
export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  feedback: string[];
  isValid: boolean;
};

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
  readonly passwordRecoveryEvent = signal<boolean>(false);

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
      this.supabase.auth.onAuthStateChange((event, session) => {
        // this.logger.info(`🔐 Auth event: ${event}`, 'Supabase');

        // Handle password recovery
        if (event === 'PASSWORD_RECOVERY') {
          // this.logger.success('✅ PASSWORD_RECOVERY event detected!', 'Supabase');
          this.passwordRecoveryEvent.set(true);
          sessionStorage.setItem('password-recovery-pending', 'true');
        }

        // Also check for recovery in session metadata
        if (session?.user?.aud === 'authenticated' && event === 'SIGNED_IN') {
          // Check if this is from a recovery flow
          const urlHash = window.location.hash;
          if (urlHash.includes('type=recovery')) {
            this.logger.success(
              '✅ Recovery type detected in URL!',
              'Supabase',
            );
            this.passwordRecoveryEvent.set(true);
            sessionStorage.setItem('password-recovery-pending', 'true');
          }
        }

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

      // Debug: Check if session exists
      // this.logger.debug(
      //   `Sign-up response - User: ${data.user?.id}, Session: ${data.session ? 'EXISTS' : 'NULL'}`,
      //   'Supabase',
      // );

      // Manually set the session if it exists
      if (data.session) {
        this.currentUser.set(data.session.user);
        this.currentSession.set(data.session);
        this.isAuthenticated.set(true);
        // this.logger.debug('Session established after sign-up', 'Supabase');
      } else {
        this.logger.warn(
          'No session returned from sign-up - email confirmation may be required',
          'Supabase',
        );
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
   * Enterprise-grade with rate limiting feedback
   */
  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) {
        // Enhanced error handling for rate limiting
        if (error.message.includes('email_rate_limit_exceeded')) {
          this.logger.error(
            'Too many reset requests. Please wait 60 seconds before trying again.',
            error,
          );
        } else if (error.message.includes('not found')) {
          this.logger.error('No account found with this email address.', error);
        } else {
          this.logger.error('Password reset failed:', error);
        }
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
   * Enterprise-grade with retry logic and token validation
   */
  async updatePassword(
    newPassword: string,
    maxRetries = 3,
  ): Promise<{ error: AuthError | null }> {
    // Validate password strength before attempting update
    const validation = this.validatePassword(newPassword);
    if (!validation.isValid) {
      const error = new Error(
        validation.feedback.join('. '),
      ) as unknown as AuthError;
      this.logger.error('Password does not meet requirements:', error);
      return { error };
    }

    // Check if we have a valid session
    const {
      data: { session },
      error: sessionError,
    } = await this.supabase.auth.getSession();

    if (sessionError || !session) {
      // Try to verify token from URL if session is missing
      this.logger.warn(
        'No active session, attempting to verify recovery token...',
      );

      const urlHash = window.location.hash;
      const params = new URLSearchParams(urlHash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        // Set session manually
        const { error: setSessionError } = await this.supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (setSessionError) {
          this.logger.error(
            'Failed to set session from token:',
            setSessionError,
          );
          return { error: setSessionError };
        }

        this.logger.success('✅ Session restored from recovery token');
      } else {
        const error = new Error(
          'No recovery token found in URL',
        ) as unknown as AuthError;
        this.logger.error('Auth session missing and no token in URL:', error);
        return { error };
      }
    }

    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error } = await this.supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          // Check for token-specific errors
          if (
            error.message.includes('invalid') ||
            error.message.includes('expired')
          ) {
            this.logger.error(
              'Recovery link expired or already used. Please request a new one.',
              error,
            );
            sessionStorage.removeItem('password-recovery-pending');
            return { error };
          }

          this.logger.error('Password update failed:', error);
          return { error };
        }

        // Success - clear recovery state
        this.logger.success('Password updated successfully!', 'Supabase');
        sessionStorage.removeItem('password-recovery-pending');
        this.passwordRecoveryEvent.set(false);
        return { error: null };
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error('Password update failed after retries:', error);
          return { error: error as AuthError };
        }

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        this.logger.warn(
          `Password update attempt ${attempt} failed, retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return { error: new Error('Max retries exceeded') as unknown as AuthError };
  }

  // =====================
  // Password Validation Utilities
  // =====================

  /**
   * Validate password against enterprise requirements
   * Requirements:
   * - Minimum 8 characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - At least 1 special character
   * - Maximum 72 characters (bcrypt limit)
   */
  validatePassword(password: string): PasswordStrength {
    const feedback: string[] = [];
    let score = 0;

    // Length checks
    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters');
      return { score: 0, label: 'Very Weak', feedback, isValid: false };
    }
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    else feedback.push('Use 12+ characters for better security');

    if (password.length > 72) {
      feedback.push('Password must not exceed 72 characters');
      return { score: 0, label: 'Very Weak', feedback, isValid: false };
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);

    if (!hasLowercase) {
      feedback.push('Add lowercase letters');
    }
    if (!hasUppercase) {
      feedback.push('Add uppercase letters');
    }
    if (!hasNumber) {
      feedback.push('Add numbers');
    }
    if (!hasSpecial) {
      feedback.push('Add special characters (!@#$%^&*)');
    }

    // Score based on character variety
    if (hasLowercase && hasUppercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    // Common patterns penalty
    const commonPatterns = [
      /^password/i,
      /^12345/,
      /^qwerty/i,
      /^admin/i,
      /^letmein/i,
      /^welcome/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password)) {
        score = Math.max(0, score - 2);
        feedback.push(
          'Avoid common patterns like "password", "12345", "qwerty"',
        );
        break;
      }
    }

    // Sequential characters penalty
    if (/(.)\1{2,}/.test(password)) {
      score = Math.max(0, score - 1);
      feedback.push('Avoid repeating characters');
    }

    // Determine label and validity
    const labels: PasswordStrength['label'][] = [
      'Very Weak',
      'Weak',
      'Fair',
      'Good',
      'Strong',
    ];
    const label = labels[Math.min(score, 4)] as PasswordStrength['label'];

    // Password is valid if it meets minimum requirements
    const isValid =
      password.length >= 8 &&
      password.length <= 72 &&
      hasLowercase &&
      hasUppercase &&
      hasNumber &&
      hasSpecial;

    return {
      score: Math.min(score, 4) as PasswordStrength['score'],
      label,
      feedback,
      isValid,
    };
  }

  /**
   * Calculate password strength (exposed for UI components)
   */
  calculatePasswordStrength(password: string): PasswordStrength {
    return this.validatePassword(password);
  }

  /**
   * Clear password recovery state
   */
  clearPasswordRecoveryState(): void {
    this.passwordRecoveryEvent.set(false);
    sessionStorage.removeItem('password-recovery-pending');
  }

  /**
   * Check if password recovery is pending
   */
  isPasswordRecoveryPending(): boolean {
    return sessionStorage.getItem('password-recovery-pending') === 'true';
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
          total_questions: session.questions?.length || 0,
          correct_answers: correctAnswers,
          incorrect_answers: incorrectAnswers,
          best_streak: session.bestStreak,
          time_taken: timeTaken,
          completed: session.completed,
          start_time: session.startTime,
          end_time: session.endTime,
          results: session.results,
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
          questionCount: row.total_questions || 0,
        },
        results: row.results || [],
        finalScore: row.score,
        bestStreak: row.best_streak,
        questions: [], // Questions not stored separately, reconstructed from results if needed
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

      // Calculate aggregated stats from quiz sessions
      const { data: sessions } = await this.supabase
        .from('quiz_sessions')
        .select('correct_answers, incorrect_answers, time_taken')
        .eq('user_id', userId);

      const totalCorrect =
        sessions?.reduce((sum, s) => sum + (s.correct_answers || 0), 0) || 0;
      const totalIncorrect =
        sessions?.reduce((sum, s) => sum + (s.incorrect_answers || 0), 0) || 0;
      const totalTime =
        sessions?.reduce((sum, s) => sum + (s.time_taken || 0), 0) || 0;

      const { error } = await this.supabase.from('user_stats').upsert(
        {
          user_id: userId,
          total_games_played: stats.totalGames,
          total_correct_answers: totalCorrect,
          total_incorrect_answers: totalIncorrect,
          total_time_played: totalTime,
          average_score: stats.averageScore,
          best_score: stats.bestScore,
          stats_by_mode: stats.gamesByMode,
          last_played_at: stats.lastUpdated.toISOString(),
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
        .maybeSingle();

      if (error) {
        this.logger.error('Failed to get user stats:', error);
        return { data: null, error: new Error(error.message) };
      }

      // No stats found - this is okay for new users
      if (!data) {
        return { data: null, error: null };
      }

      const stats: UserStatsV1 = {
        version: 1,
        totalGames: data.total_games_played || 0,
        totalScore: 0, // Not stored in schema, recalculate from sessions if needed
        averageScore: parseFloat(data.average_score) || 0,
        bestScore: data.best_score || 0,
        bestStreak: 0, // Not stored in schema, recalculate from sessions if needed
        gamesByMode: data.stats_by_mode || {},
        lastUpdated: new Date(data.last_played_at || data.updated_at),
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

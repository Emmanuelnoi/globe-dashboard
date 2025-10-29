import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';
import { GameMode } from '../../features/quiz/models/quiz.models';

/**
 * Leaderboard Type
 */
export type LeaderboardType = 'global' | 'weekly' | 'monthly' | 'mode-specific';

/**
 * Leaderboard Entry
 */
export interface LeaderboardEntry {
  id?: string;
  userId: string;
  username?: string;
  avatarUrl?: string;
  leaderboardType: LeaderboardType;
  gameMode?: GameMode | 'all';
  totalScore: number;
  totalGames: number;
  averageScore: number;
  bestScore: number;
  bestStreak: number;
  countriesDiscovered: number;
  achievementsUnlocked: number;
  rank?: number;
  percentile?: number;
  lastUpdated: Date;
  periodStart?: Date;
  periodEnd?: Date;
}

/**
 * Leaderboard Service
 *
 * Social competition feature with real-time rankings:
 * - Global all-time leaderboard
 * - Weekly competition (resets every Monday)
 * - Monthly competition (resets on 1st of month)
 * - Mode-specific leaderboards (per quiz mode)
 *
 * Features:
 * - Real-time rank calculation
 * - Percentile rankings
 * - Friend comparisons (future feature)
 * - Public view for anonymous users
 * - Auto-sync for authenticated users
 */
@Injectable({
  providedIn: 'root',
})
export class LeaderboardService {
  private readonly supabase = inject(SupabaseService);
  private readonly userStatsService = inject(UserStatsService);
  private readonly discoveryService = inject(CountryDiscoveryService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly logger = inject(LoggerService);

  // Reactive state signals
  private readonly _globalLeaderboard = signal<LeaderboardEntry[]>([]);
  private readonly _weeklyLeaderboard = signal<LeaderboardEntry[]>([]);
  private readonly _monthlyLeaderboard = signal<LeaderboardEntry[]>([]);
  private readonly _modeLeaderboards = signal<
    Map<GameMode, LeaderboardEntry[]>
  >(new Map());
  private readonly _myRank = signal<LeaderboardEntry | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly globalLeaderboard = this._globalLeaderboard.asReadonly();
  readonly weeklyLeaderboard = this._weeklyLeaderboard.asReadonly();
  readonly monthlyLeaderboard = this._monthlyLeaderboard.asReadonly();
  readonly modeLeaderboards = this._modeLeaderboards.asReadonly();
  readonly myRank = this._myRank.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  // Computed stats
  readonly globalRank = computed(() => this._myRank()?.rank || null);
  readonly globalPercentile = computed(
    () => this._myRank()?.percentile || null,
  );

  constructor() {
    // Auto-load leaderboards when authenticated
    effect(() => {
      const isAuth = this.supabase.isAuthenticated();
      if (isAuth) {
        this.refreshAllLeaderboards();
      }
    });
  }

  /**
   * Refresh all leaderboards
   */
  async refreshAllLeaderboards(): Promise<void> {
    this._isLoading.set(true);
    this._lastError.set(null);

    try {
      await Promise.all([
        this.loadLeaderboard('global'),
        this.loadLeaderboard('weekly'),
        this.loadLeaderboard('monthly'),
      ]);

      // Load my rank if authenticated
      if (this.supabase.isUserAuthenticated()) {
        await this.loadMyRank();
      }
    } catch (error) {
      this.logger.error('❌ Failed to refresh leaderboards:', error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : 'Failed to refresh leaderboards',
      );
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load specific leaderboard
   */
  async loadLeaderboard(
    type: LeaderboardType,
    gameMode?: GameMode,
    limit: number = 100,
  ): Promise<void> {
    try {
      // Join with profiles table to get username and avatar
      let query = this.supabase['supabase']
        .from('leaderboard_entries')
        .select('*, profiles(display_name, avatar_url, email)')
        .eq('leaderboard_type', type)
        .order('rank', { ascending: true })
        .limit(limit);

      // Filter by game mode if specified
      if (gameMode) {
        query = query.eq('game_mode', gameMode);
      } else {
        query = query.eq('game_mode', 'all');
      }

      // Filter by time period for weekly/monthly
      if (type === 'weekly' || type === 'monthly') {
        const periodStart = this.getPeriodStart(type);
        query = query.gte('period_start', periodStart.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      // Map data to LeaderboardEntry
      const entries: LeaderboardEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        username:
          row.profiles?.display_name ||
          row.profiles?.email?.split('@')[0] ||
          'Anonymous',
        avatarUrl: row.profiles?.avatar_url,
        leaderboardType: row.leaderboard_type,
        gameMode: row.game_mode,
        totalScore: row.total_score,
        totalGames: row.total_games,
        averageScore: parseFloat(row.average_score),
        bestScore: row.best_score,
        bestStreak: row.best_streak,
        countriesDiscovered: row.countries_discovered,
        achievementsUnlocked: row.achievements_unlocked,
        rank: row.rank,
        percentile: row.percentile ? parseFloat(row.percentile) : undefined,
        lastUpdated: new Date(row.last_updated),
        periodStart: row.period_start ? new Date(row.period_start) : undefined,
        periodEnd: row.period_end ? new Date(row.period_end) : undefined,
      }));

      // Update appropriate signal
      switch (type) {
        case 'global':
          this._globalLeaderboard.set(entries);
          break;
        case 'weekly':
          this._weeklyLeaderboard.set(entries);
          break;
        case 'monthly':
          this._monthlyLeaderboard.set(entries);
          break;
        case 'mode-specific':
          if (gameMode) {
            this._modeLeaderboards.update((boards) => {
              const updated = new Map(boards);
              updated.set(gameMode, entries);
              return updated;
            });
          }
          break;
      }

      // this.logger.debug(
      //   `✅ Loaded ${type} leaderboard (${entries.length} entries)`,
      // );
    } catch (error) {
      this.logger.error(`❌ Failed to load ${type} leaderboard:`, error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : `Failed to load ${type} leaderboard`,
      );
    }
  }

  /**
   * Load my rank on leaderboard
   */
  async loadMyRank(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      // Query for global leaderboard with epoch period_start
      const { data, error } = await this.supabase['supabase']
        .from('leaderboard_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('leaderboard_type', 'global')
        .eq('game_mode', 'all')
        .eq('period_start', new Date(0).toISOString())
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      // No entry found is okay for new users
      if (!data) {
        this._myRank.set(null);
        return;
      }

      const myRank: LeaderboardEntry = {
        id: data.id,
        userId: data.user_id,
        leaderboardType: data.leaderboard_type,
        gameMode: data.game_mode,
        totalScore: data.total_score,
        totalGames: data.total_games,
        averageScore: parseFloat(data.average_score),
        bestScore: data.best_score,
        bestStreak: data.best_streak,
        countriesDiscovered: data.countries_discovered,
        achievementsUnlocked: data.achievements_unlocked,
        rank: data.rank,
        percentile: data.percentile ? parseFloat(data.percentile) : undefined,
        lastUpdated: new Date(data.last_updated),
      };

      this._myRank.set(myRank);
    } catch (error) {
      this.logger.error('❌ Failed to load my rank:', error);
    }
  }

  /**
   * Update my leaderboard entry (authenticated users only)
   */
  async updateMyEntry(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      // this.logger.debug('User not authenticated, skipping leaderboard update');
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      // Gather current stats
      const stats = this.userStatsService.stats();
      const totalDiscovered = this.discoveryService.totalDiscovered();
      const unlockedCount = this.achievementsService.unlockedCount();

      if (!stats) {
        // this.logger.debug('No stats available yet');
        return;
      }

      // Update global leaderboard
      // Use epoch (1970-01-01) as period_start for global to ensure unique constraint works
      await this.upsertEntry({
        userId,
        leaderboardType: 'global',
        gameMode: 'all',
        totalScore: stats.totalScore,
        totalGames: stats.totalGames,
        averageScore: stats.averageScore,
        bestScore: stats.bestScore,
        bestStreak: stats.bestStreak,
        countriesDiscovered: totalDiscovered,
        achievementsUnlocked: unlockedCount,
        lastUpdated: new Date(),
        periodStart: new Date(0), // Epoch as fixed value for global entries
      });

      // Update weekly leaderboard
      const weekStart = this.getPeriodStart('weekly');
      const weekEnd = this.getPeriodEnd('weekly');
      await this.upsertEntry({
        userId,
        leaderboardType: 'weekly',
        gameMode: 'all',
        totalScore: stats.totalScore, // TODO: Filter by week
        totalGames: stats.totalGames,
        averageScore: stats.averageScore,
        bestScore: stats.bestScore,
        bestStreak: stats.bestStreak,
        countriesDiscovered: totalDiscovered,
        achievementsUnlocked: unlockedCount,
        lastUpdated: new Date(),
        periodStart: weekStart,
        periodEnd: weekEnd,
      });

      // Update monthly leaderboard
      const monthStart = this.getPeriodStart('monthly');
      const monthEnd = this.getPeriodEnd('monthly');
      await this.upsertEntry({
        userId,
        leaderboardType: 'monthly',
        gameMode: 'all',
        totalScore: stats.totalScore, // TODO: Filter by month
        totalGames: stats.totalGames,
        averageScore: stats.averageScore,
        bestScore: stats.bestScore,
        bestStreak: stats.bestStreak,
        countriesDiscovered: totalDiscovered,
        achievementsUnlocked: unlockedCount,
        lastUpdated: new Date(),
        periodStart: monthStart,
        periodEnd: monthEnd,
      });

      this.logger.success('✅ Updated leaderboard entries', 'Leaderboard');

      // Recalculate ranks
      await this.recalculateRanks('global');
      await this.recalculateRanks('weekly');
      await this.recalculateRanks('monthly');

      // Refresh my rank
      await this.loadMyRank();
    } catch (error) {
      this.logger.error('❌ Failed to update leaderboard entry:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to update leaderboard',
      );
    }
  }

  /**
   * Upsert leaderboard entry
   */
  private async upsertEntry(entry: LeaderboardEntry): Promise<void> {
    const entryData = {
      user_id: entry.userId,
      leaderboard_type: entry.leaderboardType,
      game_mode: entry.gameMode,
      total_score: entry.totalScore,
      total_games: entry.totalGames,
      average_score: entry.averageScore,
      best_score: entry.bestScore,
      best_streak: entry.bestStreak,
      countries_discovered: entry.countriesDiscovered,
      achievements_unlocked: entry.achievementsUnlocked,
      last_updated: entry.lastUpdated.toISOString(),
      period_start: entry.periodStart?.toISOString(),
      period_end: entry.periodEnd?.toISOString() || null,
    };

    // Always use the full unique constraint (user_id, leaderboard_type, game_mode, period_start)
    // Global entries now use epoch (1970-01-01) as period_start to ensure uniqueness
    const { error } = await this.supabase['supabase']
      .from('leaderboard_entries')
      .upsert(entryData, {
        onConflict: 'user_id,leaderboard_type,game_mode,period_start',
      });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Recalculate ranks for a leaderboard
   * This would typically be done server-side with a database function,
   * but for now we'll update locally
   */
  private async recalculateRanks(type: LeaderboardType): Promise<void> {
    try {
      // This is a simplified version - in production, you'd use a Postgres function
      // to calculate ranks efficiently on the server
      const { data, error } = await this.supabase['supabase']
        .from('leaderboard_entries')
        .select('id, total_score')
        .eq('leaderboard_type', type)
        .eq('game_mode', 'all')
        .order('total_score', { ascending: false });

      if (error) throw new Error(error.message);

      // Calculate ranks and percentiles
      const totalEntries = data?.length || 0;
      const updates = (data || []).map((entry: any, index: number) => ({
        id: entry.id,
        rank: index + 1,
        percentile: ((totalEntries - index) / totalEntries) * 100,
      }));

      // Batch update ranks (in chunks to avoid timeout)
      const chunkSize = 100;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        for (const update of chunk) {
          await this.supabase['supabase']
            .from('leaderboard_entries')
            .update({ rank: update.rank, percentile: update.percentile })
            .eq('id', update.id);
        }
      }

      // this.logger.debug(`✅ Recalculated ranks for ${type} leaderboard`);
    } catch (error) {
      this.logger.error(`❌ Failed to recalculate ranks for ${type}:`, error);
    }
  }

  /**
   * Get period start date
   */
  private getPeriodStart(type: LeaderboardType): Date {
    const now = new Date();

    switch (type) {
      case 'weekly':
        // Start of current week (Monday)
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(now.setDate(diff));

      case 'monthly':
        // Start of current month
        return new Date(now.getFullYear(), now.getMonth(), 1);

      default:
        return new Date(0); // Beginning of time for global
    }
  }

  /**
   * Get period end date
   */
  private getPeriodEnd(type: LeaderboardType): Date {
    const now = new Date();

    switch (type) {
      case 'weekly':
        // End of current week (Sunday)
        const start = this.getPeriodStart(type);
        return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

      case 'monthly':
        // End of current month
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);

      default:
        return new Date(8640000000000000); // Max date for global
    }
  }

  /**
   * Get top N entries from leaderboard
   */
  getTopEntries(type: LeaderboardType, limit: number = 10): LeaderboardEntry[] {
    let entries: LeaderboardEntry[] = [];

    switch (type) {
      case 'global':
        entries = this._globalLeaderboard();
        break;
      case 'weekly':
        entries = this._weeklyLeaderboard();
        break;
      case 'monthly':
        entries = this._monthlyLeaderboard();
        break;
    }

    return entries.slice(0, limit);
  }
}

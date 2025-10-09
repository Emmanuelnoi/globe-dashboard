import {
  Injectable,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { openDB, IDBPDatabase, IDBPObjectStore } from 'idb';
import {
  GameSession,
  UserStatsV1,
  GameMode,
} from '../../features/quiz/models/quiz.models';
import { LoggerService } from './logger.service';

/**
 * User Statistics Service with IndexedDB Persistence
 *
 * Features:
 * - Persistent storage of game sessions and aggregated stats
 * - Signal-based reactive state management
 * - Atomic transactions for data consistency
 * - Automatic stats aggregation and caching
 * - Error handling for storage quota and offline scenarios
 * - Migration support for schema changes
 */
@Injectable({
  providedIn: 'root',
})
export class UserStatsService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly logger = inject(LoggerService);
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'quiz-stats-db';
  private readonly DB_VERSION = 1;
  private isInitializing = false;

  // Private signals for internal state management
  private readonly _stats = signal<UserStatsV1 | null>(null);
  private readonly _recentSessions = signal<GameSession[]>([]);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly stats = this._stats.asReadonly();
  readonly recentSessions = this._recentSessions.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  // Computed stats for convenience
  readonly totalGames = computed(() => this._stats()?.totalGames || 0);
  readonly averageScore = computed(() => this._stats()?.averageScore || 0);
  readonly bestScore = computed(() => this._stats()?.bestScore || 0);
  readonly bestStreak = computed(() => this._stats()?.bestStreak || 0);
  readonly hasPlayedAnyGames = computed(() => this.totalGames() > 0);

  constructor() {
    this.initializeDatabase();

    // Cleanup on destroy
    this.destroyRef.onDestroy(() => {
      this.closeDatabase();
    });
  }

  /**
   * Initialize IndexedDB connection and load initial data
   */
  private async initializeDatabase(): Promise<void> {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      this._isLoading.set(true);
      this._lastError.set(null);

      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create sessions object store
          const sessionStore = db.createObjectStore('sessions', {
            keyPath: 'id',
          });

          // Add indexes for efficient querying
          sessionStore.createIndex('by-mode', 'configuration.mode');
          sessionStore.createIndex('by-date', 'endTime');
          sessionStore.createIndex('by-completed', 'completed');

          // Create meta object store for aggregated stats
          db.createObjectStore('meta', {
            keyPath: 'id',
          });
        },
      });

      this.logger.debug('📊 IndexedDB initialized successfully');

      // Load initial data
      await this.loadStats();
      await this.loadRecentSessions();

      this._isLoading.set(false);
    } catch (error) {
      this.logger.error('❌ Failed to initialize IndexedDB:', error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : 'Database initialization failed',
      );
      this._isLoading.set(false);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Save a completed game session and update aggregate stats
   */
  async saveSession(session: GameSession): Promise<void> {
    if (!this.db) {
      this.logger.warn('Database not initialized, cannot save session');
      return;
    }

    try {
      this._lastError.set(null);

      // Start a transaction for atomic updates
      const tx = this.db.transaction(['sessions', 'meta'], 'readwrite');
      const sessionStore = tx.objectStore('sessions');
      const metaStore = tx.objectStore('meta');

      // Save the session
      await sessionStore.put(session);

      // Update aggregated stats
      const currentStats = await this.getStatsFromDatabase(metaStore);
      const updatedStats = this.calculateUpdatedStats(currentStats, session);
      await metaStore.put({
        id: 'user_stats_v1',
        data: updatedStats,
      });

      // Complete transaction
      await tx.done;

      this.logger.debug('💾 Session saved successfully:', session.id);

      // Update reactive signals
      this._stats.set(updatedStats);
      await this.loadRecentSessions();
    } catch (error) {
      this.logger.error('❌ Failed to save session:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to save session',
      );

      // Check if it's a quota exceeded error
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        this._lastError.set(
          'Storage quota exceeded. Please free up space or clear old data.',
        );
      }
    }
  }

  /**
   * Get current aggregated statistics
   */
  async getStats(): Promise<UserStatsV1 | null> {
    if (!this.db) {
      this.logger.warn('Database not initialized');
      return null;
    }

    try {
      const metaStore = this.db
        .transaction('meta', 'readonly')
        .objectStore('meta');
      return await this.getStatsFromDatabase(metaStore);
    } catch (error) {
      this.logger.error('❌ Failed to get stats:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to load stats',
      );
      return null;
    }
  }

  /**
   * Get recent game sessions with optional limit
   */
  async getRecentSessions(limit: number = 20): Promise<GameSession[]> {
    if (!this.db) {
      this.logger.warn('Database not initialized');
      return [];
    }

    try {
      const tx = this.db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const index = store.index('by-date');

      // Get sessions ordered by date (newest first)
      const sessions = await index.getAll();

      return sessions
        .filter((session) => session.completed && session.endTime)
        .sort(
          (a, b) =>
            new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime(),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error('❌ Failed to get recent sessions:', error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : 'Failed to load recent sessions',
      );
      return [];
    }
  }

  /**
   * Get sessions by specific game mode
   */
  async getSessionsByMode(mode: GameMode): Promise<GameSession[]> {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('sessions', 'readonly');
      const store = tx.objectStore('sessions');
      const index = store.index('by-mode');

      return await index.getAll(mode);
    } catch (error) {
      this.logger.error(`❌ Failed to get sessions for mode ${mode}:`, error);
      return [];
    }
  }

  /**
   * Clear all stored data (for testing or user request)
   */
  async clearAllData(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(['sessions', 'meta'], 'readwrite');
      await tx.objectStore('sessions').clear();
      await tx.objectStore('meta').clear();
      await tx.done;

      this.logger.debug('🗑️ All data cleared successfully');

      // Reset signals
      this._stats.set(null);
      this._recentSessions.set([]);
      this._lastError.set(null);
    } catch (error) {
      this.logger.error('❌ Failed to clear data:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to clear data',
      );
    }
  }

  /**
   * Export all data as JSON for backup/migration
   */
  async exportData(): Promise<{
    sessions: GameSession[];
    stats: UserStatsV1 | null;
  } | null> {
    if (!this.db) return null;

    try {
      const tx = this.db.transaction(['sessions', 'meta'], 'readonly');
      const sessions = await tx.objectStore('sessions').getAll();
      const stats = await this.getStatsFromDatabase(tx.objectStore('meta'));

      return { sessions, stats };
    } catch (error) {
      this.logger.error('❌ Failed to export data:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to export data',
      );
      return null;
    }
  }

  /**
   * Import data from JSON backup
   */
  async importData(data: {
    sessions: GameSession[];
    stats: UserStatsV1 | null;
  }): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(['sessions', 'meta'], 'readwrite');
      const sessionStore = tx.objectStore('sessions');
      const metaStore = tx.objectStore('meta');

      // Clear existing data
      await sessionStore.clear();
      await metaStore.clear();

      // Import sessions
      for (const session of data.sessions) {
        await sessionStore.put(session);
      }

      // Import stats
      if (data.stats) {
        await metaStore.put({
          id: 'user_stats_v1',
          data: data.stats,
        });
      }

      await tx.done;

      this.logger.debug('📥 Data imported successfully');

      // Refresh reactive signals
      await this.loadStats();
      await this.loadRecentSessions();
    } catch (error) {
      this.logger.error('❌ Failed to import data:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to import data',
      );
    }
  }

  // ========== PRIVATE METHODS ==========

  private async loadStats(): Promise<void> {
    const stats = await this.getStats();
    this._stats.set(stats);
  }

  private async loadRecentSessions(): Promise<void> {
    const sessions = await this.getRecentSessions();
    this._recentSessions.set(sessions);
  }

  private async getStatsFromDatabase(
    metaStore: IDBPObjectStore<
      unknown,
      string[],
      'meta',
      'readonly' | 'readwrite'
    >,
  ): Promise<UserStatsV1 | null> {
    const result = await metaStore.get('user_stats_v1');
    return (result as { data?: UserStatsV1 })?.data || null;
  }

  private calculateUpdatedStats(
    currentStats: UserStatsV1 | null,
    newSession: GameSession,
  ): UserStatsV1 {
    if (!currentStats) {
      // Initialize stats for first session
      return this.createInitialStats(newSession);
    }

    // Calculate updated aggregate stats
    const totalGames = currentStats.totalGames + 1;
    const totalScore = currentStats.totalScore + newSession.finalScore;
    const averageScore = totalScore / totalGames;
    const bestScore = Math.max(currentStats.bestScore, newSession.finalScore);
    const bestStreak = Math.max(currentStats.bestStreak, newSession.bestStreak);

    // Update per-mode stats
    const modeKey = newSession.configuration.mode;
    const currentModeStats = currentStats.gamesByMode[modeKey];
    const modeGamesPlayed = currentModeStats.gamesPlayed + 1;
    const modeTotalScore = currentModeStats.totalScore + newSession.finalScore;
    const modeAverageScore = modeTotalScore / modeGamesPlayed;
    const modeBestScore = Math.max(
      currentModeStats.bestScore,
      newSession.finalScore,
    );
    const modeBestStreak = Math.max(
      currentModeStats.bestStreak,
      newSession.bestStreak,
    );

    return {
      version: 1,
      totalGames,
      totalScore,
      averageScore,
      bestScore,
      bestStreak,
      gamesByMode: {
        ...currentStats.gamesByMode,
        [modeKey]: {
          gamesPlayed: modeGamesPlayed,
          totalScore: modeTotalScore,
          averageScore: modeAverageScore,
          bestScore: modeBestScore,
          bestStreak: modeBestStreak,
        },
      },
      lastUpdated: new Date(),
    };
  }

  private createInitialStats(firstSession: GameSession): UserStatsV1 {
    const modeKey = firstSession.configuration.mode;

    return {
      version: 1,
      totalGames: 1,
      totalScore: firstSession.finalScore,
      averageScore: firstSession.finalScore,
      bestScore: firstSession.finalScore,
      bestStreak: firstSession.bestStreak,
      gamesByMode: {
        'find-country': this.createEmptyModeStats(),
        'capital-match': this.createEmptyModeStats(),
        'flag-id': this.createEmptyModeStats(),
        'facts-guess': this.createEmptyModeStats(),
        'explore-learn': this.createEmptyModeStats(),
        [modeKey]: {
          gamesPlayed: 1,
          totalScore: firstSession.finalScore,
          averageScore: firstSession.finalScore,
          bestScore: firstSession.finalScore,
          bestStreak: firstSession.bestStreak,
        },
      },
      lastUpdated: new Date(),
    };
  }

  private createEmptyModeStats() {
    return {
      gamesPlayed: 0,
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      bestStreak: 0,
    };
  }

  private closeDatabase(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.logger.debug('🔌 IndexedDB connection closed');
    }
  }
}

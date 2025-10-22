import { Injectable, inject, signal, effect } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { LoggerService } from './logger.service';

/**
 * Cloud Sync Service
 *
 * Orchestrates synchronization between local IndexedDB and Supabase cloud storage.
 *
 * Features:
 * - Automatic background sync with debouncing
 * - Conflict resolution (newest wins)
 * - Anonymous user migration to authenticated account
 * - Sync status tracking
 * - Error handling and retry logic
 */
@Injectable({
  providedIn: 'root',
})
export class CloudSyncService {
  private readonly supabase = inject(SupabaseService);
  private readonly userStatsService = inject(UserStatsService);
  private readonly logger = inject(LoggerService);

  // Sync state signals
  readonly syncStatus = signal<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  readonly lastSyncTime = signal<Date | null>(null);
  readonly syncError = signal<string | null>(null);
  readonly pendingSyncCount = signal<number>(0);

  // Debounce timer for batching sync requests
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private syncInProgress = false;

  constructor() {
    // Automatically sync when user logs in/out
    effect(() => {
      const isAuthenticated = this.supabase.isAuthenticated();

      if (isAuthenticated) {
        this.logger.debug(
          'User authenticated, syncing from cloud...',
          'CloudSync',
        );
        this.syncFromCloud();
      }
    });
  }

  // =====================
  // Public Sync Methods
  // =====================

  /**
   * Trigger a sync to cloud (debounced)
   */
  queueSync(): void {
    if (!this.supabase.isUserAuthenticated()) {
      this.logger.debug(
        'User not authenticated, skipping cloud sync',
        'CloudSync',
      );
      return;
    }

    // Clear existing timer
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    // Wait 5 seconds of inactivity before syncing
    this.syncDebounceTimer = setTimeout(() => {
      this.syncToCloud();
    }, 5000);
  }

  /**
   * Immediately sync to cloud (force)
   */
  async syncToCloud(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      this.logger.warn(
        'Cannot sync to cloud: User not authenticated',
        'CloudSync',
      );
      return;
    }

    if (this.syncInProgress) {
      this.logger.debug('Sync already in progress, skipping', 'CloudSync');
      return;
    }

    try {
      this.syncInProgress = true;
      this.syncStatus.set('syncing');
      this.syncError.set(null);

      // Get all local data
      const localSessions = await this.userStatsService.getRecentSessions(1000); // Get last 1000 sessions
      const localStats = await this.userStatsService.getStats();

      this.pendingSyncCount.set(localSessions.length + (localStats ? 1 : 0));

      // Upload sessions
      if (localSessions.length > 0) {
        const { error: sessionsError } =
          await this.supabase.uploadQuizSessions(localSessions);
        if (sessionsError) {
          throw new Error(
            `Failed to upload sessions: ${sessionsError.message}`,
          );
        }
      }

      // Upload stats
      if (localStats) {
        const { error: statsError } =
          await this.supabase.uploadUserStats(localStats);
        if (statsError) {
          throw new Error(`Failed to upload stats: ${statsError.message}`);
        }
      }

      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.pendingSyncCount.set(0);
      this.logger.success(
        `Synced ${localSessions.length} sessions and stats to cloud`,
        'CloudSync',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      this.syncError.set(errorMessage);
      this.syncStatus.set('error');
      this.logger.error('Sync to cloud failed:', error, 'CloudSync');
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Download data from cloud and merge with local
   */
  async syncFromCloud(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      this.logger.warn(
        'Cannot sync from cloud: User not authenticated',
        'CloudSync',
      );
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      this.syncStatus.set('syncing');
      this.syncError.set(null);

      // Download cloud data
      const { data: cloudSessions, error: sessionsError } =
        await this.supabase.getQuizSessions(userId);
      const { data: cloudStats, error: statsError } =
        await this.supabase.getUserStats(userId);

      if (sessionsError) {
        throw new Error(
          `Failed to download sessions: ${sessionsError.message}`,
        );
      }
      if (statsError) {
        throw new Error(`Failed to download stats: ${statsError.message}`);
      }

      // Merge cloud data with local
      await this.mergeCloudData(cloudSessions, cloudStats);

      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.logger.success('Synced data from cloud', 'CloudSync');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown sync error';
      this.syncError.set(errorMessage);
      this.syncStatus.set('error');
      this.logger.error('Sync from cloud failed:', error, 'CloudSync');
    }
  }

  // =====================
  // Migration Methods
  // =====================

  /**
   * Migrate anonymous user data to authenticated account
   */
  async migrateAnonymousDataToUser(newUserId: string): Promise<void> {
    try {
      this.logger.debug(
        'Starting migration of anonymous data to user account...',
        'CloudSync',
      );

      // Get all local data
      const localSessions =
        await this.userStatsService.getRecentSessions(10000); // Get all sessions
      const localStats = await this.userStatsService.getStats();

      this.logger.debug(
        `Found ${localSessions.length} sessions to migrate`,
        'CloudSync',
      );

      // Upload all data to cloud (will be associated with new user ID via Supabase)
      if (localSessions.length > 0) {
        const { error: sessionsError } =
          await this.supabase.uploadQuizSessions(localSessions);
        if (sessionsError) {
          throw new Error(
            `Failed to migrate sessions: ${sessionsError.message}`,
          );
        }
      }

      if (localStats) {
        const { error: statsError } =
          await this.supabase.uploadUserStats(localStats);
        if (statsError) {
          throw new Error(`Failed to migrate stats: ${statsError.message}`);
        }
      }

      this.logger.success(
        `✅ Successfully migrated ${localSessions.length} sessions and stats to cloud!`,
        'CloudSync',
      );

      // Sync to ensure everything is up to date
      await this.syncToCloud();
    } catch (error) {
      this.logger.error('Migration failed:', error, 'CloudSync');
      throw error;
    }
  }

  // =====================
  // Private Helper Methods
  // =====================

  /**
   * Merge cloud data with local data (conflict resolution: newest wins)
   */
  private async mergeCloudData(
    cloudSessions: any[] | null,
    cloudStats: any | null,
  ): Promise<void> {
    try {
      // Get local data for comparison
      const localSessions =
        await this.userStatsService.getRecentSessions(10000);
      const localStats = await this.userStatsService.getStats();

      // Create a map of local session IDs for quick lookup
      const localSessionIds = new Set(localSessions.map((s) => s.id));

      // Import cloud sessions that don't exist locally
      if (cloudSessions && cloudSessions.length > 0) {
        const newSessions = cloudSessions.filter(
          (cs) => !localSessionIds.has(cs.id),
        );

        for (const session of newSessions) {
          await this.userStatsService.saveSession(session);
        }

        if (newSessions.length > 0) {
          this.logger.debug(
            `Imported ${newSessions.length} new sessions from cloud`,
            'CloudSync',
          );
        }
      }

      // Merge stats (cloud is source of truth for authenticated users)
      if (cloudStats) {
        if (
          !localStats ||
          new Date(cloudStats.lastUpdated) > new Date(localStats.lastUpdated)
        ) {
          // Cloud stats are newer - use them
          await this.userStatsService.importData({
            sessions: cloudSessions || [],
            stats: cloudStats,
          });
          this.logger.debug(
            'Updated local stats from cloud (cloud was newer)',
            'CloudSync',
          );
        } else {
          // Local stats are newer - upload them
          this.logger.debug(
            'Local stats are newer, will sync to cloud',
            'CloudSync',
          );
          await this.syncToCloud();
        }
      } else if (localStats) {
        // No cloud stats exist - upload local
        this.logger.debug(
          'No cloud stats found, uploading local stats',
          'CloudSync',
        );
        await this.syncToCloud();
      }
    } catch (error) {
      this.logger.error('Failed to merge cloud data:', error, 'CloudSync');
      throw error;
    }
  }

  /**
   * Retry failed sync
   */
  async retrySync(): Promise<void> {
    if (this.syncError()) {
      this.logger.debug('Retrying failed sync...', 'CloudSync');
      await this.syncToCloud();
    }
  }

  /**
   * Get sync status info for UI
   */
  getSyncStatus() {
    return {
      status: this.syncStatus(),
      lastSyncTime: this.lastSyncTime(),
      error: this.syncError(),
      pendingCount: this.pendingSyncCount(),
      isAuthenticated: this.supabase.isUserAuthenticated(),
    };
  }
}

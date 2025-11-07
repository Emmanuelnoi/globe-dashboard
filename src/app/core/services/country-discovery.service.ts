import { Injectable, inject, signal, computed } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';

/**
 * Country Discovery Method
 */
export type DiscoveryMethod =
  | 'click'
  | 'hover'
  | 'search'
  | 'comparison'
  | 'migration'
  | 'quiz';

/**
 * Country Discovery Record
 */
export interface CountryDiscovery {
  id?: string;
  countryCode: string;
  countryName: string;
  discoveryMethod: DiscoveryMethod;
  firstDiscoveredAt: Date;
  lastInteractedAt: Date;
  interactionCount: number;
}

/**
 * Discovery Statistics
 */
export interface DiscoveryStats {
  totalDiscovered: number;
  totalInteractions: number;
  countriesByMethod: Record<DiscoveryMethod, number>;
  percentageExplored: number;
  recentDiscoveries: CountryDiscovery[];
}

/**
 * Country Discovery Tracking Service
 *
 * Tracks which countries users have explored beyond quizzes:
 * - Click/double-click on globe
 * - Hover interactions
 * - Country search usage
 * - Comparison table additions
 * - Bird migration endpoints
 * - Quiz game interactions
 *
 * Features:
 * - Local IndexedDB storage for offline tracking
 * - Cloud sync with Supabase for authenticated users
 * - Gamification stats (percentage explored, milestones)
 * - Achievement trigger integration
 */
@Injectable({
  providedIn: 'root',
})
export class CountryDiscoveryService {
  private readonly supabase = inject(SupabaseService);
  private readonly logger = inject(LoggerService);
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'country-discoveries-db';
  private readonly DB_VERSION = 1;
  private readonly TOTAL_COUNTRIES = 241;

  // Reactive state signals
  private readonly _discoveries = signal<CountryDiscovery[]>([]);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _lastError = signal<string | null>(null);

  // Public readonly signals
  readonly discoveries = this._discoveries.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly lastError = this._lastError.asReadonly();

  // Computed stats
  readonly totalDiscovered = computed(() => this._discoveries().length);
  readonly percentageExplored = computed(
    () => (this.totalDiscovered() / this.TOTAL_COUNTRIES) * 100,
  );
  readonly recentDiscoveries = computed(() =>
    this._discoveries()
      .sort(
        (a, b) => b.lastInteractedAt.getTime() - a.lastInteractedAt.getTime(),
      )
      .slice(0, 10),
  );

  constructor() {
    this.initializeDatabase();
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this._isLoading.set(true);
      this._lastError.set(null);

      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create discoveries object store
          const discoveryStore = db.createObjectStore('discoveries', {
            keyPath: 'countryCode',
          });

          // Add indexes
          discoveryStore.createIndex('by-method', 'discoveryMethod');
          discoveryStore.createIndex(
            'by-first-discovered',
            'firstDiscoveredAt',
          );
          discoveryStore.createIndex('by-last-interacted', 'lastInteractedAt');
        },
      });

      // this.logger.debug('🗺️ Country Discovery DB initialized');

      // Load initial data
      await this.loadDiscoveries();

      this._isLoading.set(false);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Country Discovery DB:', error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : 'Database initialization failed',
      );
      this._isLoading.set(false);
    }
  }

  /**
   * Track a country discovery
   */
  async trackDiscovery(
    countryCode: string,
    countryName: string,
    method: DiscoveryMethod,
  ): Promise<void> {
    if (!this.db) {
      this.logger.warn('Database not initialized');
      return;
    }

    try {
      const tx = this.db.transaction('discoveries', 'readwrite');
      const store = tx.objectStore('discoveries');

      // Check if country already discovered
      const existing = await store.get(countryCode);

      if (existing) {
        // Update existing discovery
        const updated: CountryDiscovery = {
          ...existing,
          lastInteractedAt: new Date(),
          interactionCount: existing.interactionCount + 1,
          // Keep first discovery method, update if new method
          discoveryMethod:
            existing.discoveryMethod === method
              ? method
              : existing.discoveryMethod,
        };
        await store.put(updated);
      } else {
        // Create new discovery
        const newDiscovery: CountryDiscovery = {
          countryCode,
          countryName,
          discoveryMethod: method,
          firstDiscoveredAt: new Date(),
          lastInteractedAt: new Date(),
          interactionCount: 1,
        };
        await store.put(newDiscovery);
        // this.logger.debug(`🌍 New country discovered: ${countryName} (${method})`);
      }

      await tx.done;

      // Reload discoveries
      await this.loadDiscoveries();

      // Sync to cloud if authenticated
      if (this.supabase.isUserAuthenticated()) {
        await this.syncToCloud();
      }
    } catch (error) {
      this.logger.error('❌ Failed to track discovery:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to track discovery',
      );
    }
  }

  /**
   * Get discovery stats
   */
  async getStats(): Promise<DiscoveryStats> {
    const discoveries = this._discoveries();
    const totalDiscovered = discoveries.length;
    const totalInteractions = discoveries.reduce(
      (sum, d) => sum + d.interactionCount,
      0,
    );

    // Count by method
    const countriesByMethod: Record<DiscoveryMethod, number> = {
      click: 0,
      hover: 0,
      search: 0,
      comparison: 0,
      migration: 0,
      quiz: 0,
    };
    discoveries.forEach((d) => {
      countriesByMethod[d.discoveryMethod]++;
    });

    const percentageExplored = (totalDiscovered / this.TOTAL_COUNTRIES) * 100;

    const recentDiscoveries = discoveries
      .sort(
        (a, b) => b.lastInteractedAt.getTime() - a.lastInteractedAt.getTime(),
      )
      .slice(0, 10);

    return {
      totalDiscovered,
      totalInteractions,
      countriesByMethod,
      percentageExplored,
      recentDiscoveries,
    };
  }

  /**
   * Check if country has been discovered
   */
  async isDiscovered(countryCode: string): Promise<boolean> {
    if (!this.db) return false;

    try {
      const discovery = await this.db.get('discoveries', countryCode);
      return !!discovery;
    } catch (error) {
      this.logger.error('❌ Failed to check discovery:', error);
      return false;
    }
  }

  /**
   * Get specific country discovery
   */
  async getDiscovery(countryCode: string): Promise<CountryDiscovery | null> {
    if (!this.db) return null;

    try {
      const discovery = await this.db.get('discoveries', countryCode);
      return discovery || null;
    } catch (error) {
      this.logger.error('❌ Failed to get discovery:', error);
      return null;
    }
  }

  /**
   * Sync discoveries to cloud (authenticated users only)
   */
  async syncToCloud(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      // this.logger.debug('User not authenticated, skipping cloud sync');
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      const discoveries = this._discoveries();

      // Prepare data for upload
      const discoveryData = discoveries.map((d) => ({
        user_id: userId,
        country_code: d.countryCode,
        country_name: d.countryName,
        discovery_method: d.discoveryMethod,
        first_discovered_at: d.firstDiscoveredAt.toISOString(),
        last_interacted_at: d.lastInteractedAt.toISOString(),
        interaction_count: d.interactionCount,
      }));

      // Upload to Supabase (using raw client for now)
      const { error } = await this.supabase['supabase']
        .from('country_discoveries')
        .upsert(discoveryData, { onConflict: 'user_id,country_code' });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.success(
        `✅ Synced ${discoveries.length} discoveries to cloud`,
        'CountryDiscovery',
      );
    } catch (error) {
      this.logger.error('❌ Failed to sync discoveries to cloud:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to sync to cloud',
      );
    }
  }

  /**
   * Sync discoveries from cloud
   */
  async syncFromCloud(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      // Download from Supabase
      const { data, error } = await this.supabase['supabase']
        .from('country_discoveries')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        // this.logger.debug('No cloud discoveries found');
        return;
      }

      // Merge with local data
      if (!this.db) return;

      const tx = this.db.transaction('discoveries', 'readwrite');
      const store = tx.objectStore('discoveries');

      for (const cloudDiscovery of data) {
        const local = await store.get(cloudDiscovery.country_code);

        // Use cloud data if local doesn't exist or cloud is newer
        if (
          !local ||
          new Date(cloudDiscovery.last_interacted_at) >
            new Date(local.lastInteractedAt)
        ) {
          const discovery: CountryDiscovery = {
            countryCode: cloudDiscovery.country_code,
            countryName: cloudDiscovery.country_name,
            discoveryMethod: cloudDiscovery.discovery_method,
            firstDiscoveredAt: new Date(cloudDiscovery.first_discovered_at),
            lastInteractedAt: new Date(cloudDiscovery.last_interacted_at),
            interactionCount: cloudDiscovery.interaction_count,
          };
          await store.put(discovery);
        }
      }

      await tx.done;

      // this.logger.success(
      //   `✅ Synced ${data.length} discoveries from cloud`,
      //   'CountryDiscovery',
      // );

      // Reload discoveries
      await this.loadDiscoveries();
    } catch (error) {
      this.logger.error('❌ Failed to sync discoveries from cloud:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to sync from cloud',
      );
    }
  }

  /**
   * Clear all discoveries (for testing)
   */
  async clearAllDiscoveries(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('discoveries', 'readwrite');
      await tx.objectStore('discoveries').clear();
      await tx.done;

      // this.logger.debug('🗑️ All discoveries cleared');

      this._discoveries.set([]);
      this._lastError.set(null);
    } catch (error) {
      this.logger.error('❌ Failed to clear discoveries:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to clear discoveries',
      );
    }
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Load all discoveries from IndexedDB
   */
  private async loadDiscoveries(): Promise<void> {
    if (!this.db) return;

    try {
      const discoveries = await this.db.getAll('discoveries');
      this._discoveries.set(discoveries);
    } catch (error) {
      this.logger.error('❌ Failed to load discoveries:', error);
      this._lastError.set(
        error instanceof Error ? error.message : 'Failed to load discoveries',
      );
    }
  }
}

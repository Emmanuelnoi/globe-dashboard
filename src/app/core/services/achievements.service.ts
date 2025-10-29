import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { CountryDiscoveryService } from './country-discovery.service';
import { LoggerService } from './logger.service';

/**
 * Achievement Category
 */
export type AchievementCategory =
  | 'quiz'
  | 'discovery'
  | 'exploration'
  | 'social'
  | 'milestone';

/**
 * Achievement Tier
 */
export type AchievementTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond';

/**
 * Achievement Definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  progress: number;
  progressMax: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  icon?: string;
  reward?: string;
}

/**
 * Achievement Progress Update
 */
export interface AchievementProgress {
  achievementId: string;
  progress: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
}

/**
 * Achievements System Service
 *
 * Gamification system that rewards users for various activities:
 * - Quiz performance (first game, 10 games, 100 games, perfect score)
 * - Country discoveries (10 countries, 50 countries, all continents)
 * - Exploration (bird migrations, comparisons, hover interactions)
 * - Social (compete on leaderboards, share achievements)
 * - Milestones (weekly streaks, total time spent)
 *
 * Features:
 * - Local IndexedDB storage for offline progress
 * - Cloud sync with Supabase for authenticated users
 * - Real-time progress tracking
 * - Achievement notifications
 * - Tiered achievement system (bronze → diamond)
 */
@Injectable({
  providedIn: 'root',
})
export class AchievementsService {
  private readonly supabase = inject(SupabaseService);
  private readonly userStatsService = inject(UserStatsService);
  private readonly discoveryService = inject(CountryDiscoveryService);
  private readonly logger = inject(LoggerService);
  private db: IDBPDatabase | null = null;
  private readonly DB_NAME = 'achievements-db';
  private readonly DB_VERSION = 1;

  // Reactive state signals
  private readonly _achievements = signal<Achievement[]>([]);
  private readonly _isLoading = signal<boolean>(true);
  private readonly _lastError = signal<string | null>(null);
  private readonly _recentUnlocks = signal<Achievement[]>([]);

  // Public readonly signals
  readonly achievements = this._achievements.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly lastError = this._lastError.asReadonly();
  readonly recentUnlocks = this._recentUnlocks.asReadonly();

  // Computed stats
  readonly totalAchievements = computed(() => this._achievements().length);
  readonly unlockedCount = computed(
    () => this._achievements().filter((a) => a.isUnlocked).length,
  );
  readonly percentageComplete = computed(() =>
    this.totalAchievements() > 0
      ? (this.unlockedCount() / this.totalAchievements()) * 100
      : 0,
  );

  constructor() {
    this.initializeDatabase();
    this.setupProgressTracking();
  }

  /**
   * Initialize IndexedDB and load predefined achievements
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this._isLoading.set(true);
      this._lastError.set(null);

      this.db = await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create achievements object store
          const achievementStore = db.createObjectStore('achievements', {
            keyPath: 'id',
          });

          // Add indexes
          achievementStore.createIndex('by-category', 'category');
          achievementStore.createIndex('by-tier', 'tier');
          achievementStore.createIndex('by-unlocked', 'isUnlocked');
          achievementStore.createIndex('by-unlocked-date', 'unlockedAt');
        },
      });

      // this.logger.debug('🏆 Achievements DB initialized');

      // Initialize predefined achievements if not already loaded
      await this.initializeAchievements();

      // Load achievements
      await this.loadAchievements();

      this._isLoading.set(false);
    } catch (error) {
      this.logger.error('❌ Failed to initialize Achievements DB:', error);
      this._lastError.set(
        error instanceof Error
          ? error.message
          : 'Database initialization failed',
      );
      this._isLoading.set(false);
    }
  }

  /**
   * Initialize predefined achievements
   */
  private async initializeAchievements(): Promise<void> {
    if (!this.db) return;

    try {
      const existingCount = await this.db.count('achievements');

      // Only initialize if no achievements exist
      if (existingCount === 0) {
        const predefinedAchievements: Achievement[] = [
          // Quiz Achievements
          {
            id: 'first-quiz',
            name: 'First Steps',
            description: 'Complete your first quiz',
            category: 'quiz',
            tier: 'bronze',
            progress: 0,
            progressMax: 1,
            isUnlocked: false,
            icon: '🎯',
          },
          {
            id: 'quiz-enthusiast',
            name: 'Quiz Enthusiast',
            description: 'Complete 10 quiz games',
            category: 'quiz',
            tier: 'silver',
            progress: 0,
            progressMax: 10,
            isUnlocked: false,
            icon: '📚',
          },
          {
            id: 'quiz-master',
            name: 'Quiz Master',
            description: 'Complete 50 quiz games',
            category: 'quiz',
            tier: 'gold',
            progress: 0,
            progressMax: 50,
            isUnlocked: false,
            icon: '🎓',
          },
          {
            id: 'perfect-score',
            name: 'Perfectionist',
            description: 'Achieve a perfect score in any quiz mode',
            category: 'quiz',
            tier: 'gold',
            progress: 0,
            progressMax: 1,
            isUnlocked: false,
            icon: '💯',
          },
          {
            id: 'streak-master',
            name: 'Streak Master',
            description: 'Achieve a 10-answer streak',
            category: 'quiz',
            tier: 'silver',
            progress: 0,
            progressMax: 10,
            isUnlocked: false,
            icon: '🔥',
          },

          // Discovery Achievements
          {
            id: 'first-discovery',
            name: 'Explorer',
            description: 'Discover your first country',
            category: 'discovery',
            tier: 'bronze',
            progress: 0,
            progressMax: 1,
            isUnlocked: false,
            icon: '🌍',
          },
          {
            id: 'country-collector-10',
            name: 'Country Collector',
            description: 'Discover 10 countries',
            category: 'discovery',
            tier: 'bronze',
            progress: 0,
            progressMax: 10,
            isUnlocked: false,
            icon: '🗺️',
          },
          {
            id: 'country-collector-50',
            name: 'World Traveler',
            description: 'Discover 50 countries',
            category: 'discovery',
            tier: 'silver',
            progress: 0,
            progressMax: 50,
            isUnlocked: false,
            icon: '✈️',
          },
          {
            id: 'country-collector-100',
            name: 'Globe Trotter',
            description: 'Discover 100 countries',
            category: 'discovery',
            tier: 'gold',
            progress: 0,
            progressMax: 100,
            isUnlocked: false,
            icon: '🌐',
          },
          {
            id: 'country-collector-all',
            name: 'Ultimate Explorer',
            description: 'Discover all 241 countries',
            category: 'discovery',
            tier: 'diamond',
            progress: 0,
            progressMax: 241,
            isUnlocked: false,
            icon: '👑',
          },

          // Exploration Achievements
          {
            id: 'bird-watcher',
            name: 'Bird Watcher',
            description: 'View 5 bird migration paths',
            category: 'exploration',
            tier: 'bronze',
            progress: 0,
            progressMax: 5,
            isUnlocked: false,
            icon: '🦅',
          },
          {
            id: 'comparison-expert',
            name: 'Comparison Expert',
            description: 'Compare 20 different countries',
            category: 'exploration',
            tier: 'silver',
            progress: 0,
            progressMax: 20,
            isUnlocked: false,
            icon: '⚖️',
          },

          // Milestone Achievements
          {
            id: 'dedicated-learner',
            name: 'Dedicated Learner',
            description: 'Use the app for 7 consecutive days',
            category: 'milestone',
            tier: 'silver',
            progress: 0,
            progressMax: 7,
            isUnlocked: false,
            icon: '📅',
          },
          {
            id: 'geography-genius',
            name: 'Geography Genius',
            description: 'Reach 10,000 total quiz points',
            category: 'milestone',
            tier: 'platinum',
            progress: 0,
            progressMax: 10000,
            isUnlocked: false,
            icon: '🌟',
          },
        ];

        const tx = this.db.transaction('achievements', 'readwrite');
        const store = tx.objectStore('achievements');

        for (const achievement of predefinedAchievements) {
          await store.put(achievement);
        }

        await tx.done;

        this.logger.success(
          `✅ Initialized ${predefinedAchievements.length} achievements`,
          'Achievements',
        );
      }
    } catch (error) {
      this.logger.error('❌ Failed to initialize achievements:', error);
    }
  }

  /**
   * Setup automatic progress tracking
   */
  private setupProgressTracking(): void {
    // Track quiz achievements
    effect(() => {
      const totalGames = this.userStatsService.totalGames();
      const bestStreak = this.userStatsService.bestStreak();
      const totalScore = this.userStatsService.stats()?.totalScore || 0;

      if (totalGames > 0) {
        this.updateProgress('first-quiz', Math.min(totalGames, 1));
        this.updateProgress('quiz-enthusiast', Math.min(totalGames, 10));
        this.updateProgress('quiz-master', Math.min(totalGames, 50));
      }

      if (bestStreak > 0) {
        this.updateProgress('streak-master', Math.min(bestStreak, 10));
      }

      if (totalScore > 0) {
        this.updateProgress('geography-genius', Math.min(totalScore, 10000));
      }
    });

    // Track discovery achievements
    effect(() => {
      const totalDiscovered = this.discoveryService.totalDiscovered();

      if (totalDiscovered > 0) {
        this.updateProgress('first-discovery', Math.min(totalDiscovered, 1));
        this.updateProgress(
          'country-collector-10',
          Math.min(totalDiscovered, 10),
        );
        this.updateProgress(
          'country-collector-50',
          Math.min(totalDiscovered, 50),
        );
        this.updateProgress(
          'country-collector-100',
          Math.min(totalDiscovered, 100),
        );
        this.updateProgress(
          'country-collector-all',
          Math.min(totalDiscovered, 241),
        );
      }
    });
  }

  /**
   * Update achievement progress
   */
  async updateProgress(achievementId: string, progress: number): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('achievements', 'readwrite');
      const store = tx.objectStore('achievements');

      const achievement = await store.get(achievementId);
      if (!achievement) {
        this.logger.warn(`Achievement not found: ${achievementId}`);
        return;
      }

      // Update progress
      const wasUnlocked = achievement.isUnlocked;
      achievement.progress = progress;

      // Check if achievement should be unlocked
      if (!achievement.isUnlocked && progress >= achievement.progressMax) {
        achievement.isUnlocked = true;
        achievement.unlockedAt = new Date();

        this.logger.success(
          `🎉 Achievement unlocked: ${achievement.name}`,
          'Achievements',
        );

        // Add to recent unlocks
        this._recentUnlocks.update((unlocks) =>
          [achievement, ...unlocks].slice(0, 5),
        );
      }

      await store.put(achievement);
      await tx.done;

      // Reload achievements
      await this.loadAchievements();

      // Sync to cloud if authenticated
      if (
        !wasUnlocked &&
        achievement.isUnlocked &&
        this.supabase.isUserAuthenticated()
      ) {
        await this.syncToCloud();
      }
    } catch (error) {
      this.logger.error('❌ Failed to update achievement progress:', error);
    }
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return this._achievements();
  }

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(category: AchievementCategory): Achievement[] {
    return this._achievements().filter((a) => a.category === category);
  }

  /**
   * Get unlocked achievements
   */
  getUnlockedAchievements(): Achievement[] {
    return this._achievements().filter((a) => a.isUnlocked);
  }

  /**
   * Sync achievements to cloud
   */
  async syncToCloud(): Promise<void> {
    if (!this.supabase.isUserAuthenticated()) {
      return;
    }

    const userId = this.supabase.getCurrentUserId();
    if (!userId) return;

    try {
      const achievements = this._achievements();

      // Prepare data for upload
      const achievementData = achievements.map((a) => ({
        user_id: userId,
        achievement_id: a.id,
        achievement_name: a.name,
        achievement_description: a.description,
        achievement_category: a.category,
        achievement_tier: a.tier,
        progress: a.progress,
        progress_max: a.progressMax,
        is_unlocked: a.isUnlocked,
        unlocked_at: a.unlockedAt?.toISOString() || null,
      }));

      // Upload to Supabase
      const { error } = await this.supabase['supabase']
        .from('user_achievements')
        .upsert(achievementData, { onConflict: 'user_id,achievement_id' });

      if (error) {
        throw new Error(error.message);
      }

      this.logger.success(
        `✅ Synced ${achievements.length} achievements to cloud`,
        'Achievements',
      );
    } catch (error) {
      this.logger.error('❌ Failed to sync achievements to cloud:', error);
    }
  }

  /**
   * Sync achievements from cloud
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
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(error.message);
      }

      if (!data || data.length === 0) {
        return;
      }

      // Merge with local data
      if (!this.db) return;

      const tx = this.db.transaction('achievements', 'readwrite');
      const store = tx.objectStore('achievements');

      for (const cloudAchievement of data) {
        const local = await store.get(cloudAchievement.achievement_id);

        // Use cloud data if it has more progress
        if (!local || cloudAchievement.progress > local.progress) {
          const achievement: Achievement = {
            id: cloudAchievement.achievement_id,
            name: cloudAchievement.achievement_name,
            description: cloudAchievement.achievement_description,
            category: cloudAchievement.achievement_category,
            tier: cloudAchievement.achievement_tier,
            progress: cloudAchievement.progress,
            progressMax: cloudAchievement.progress_max,
            isUnlocked: cloudAchievement.is_unlocked,
            unlockedAt: cloudAchievement.unlocked_at
              ? new Date(cloudAchievement.unlocked_at)
              : undefined,
          };
          await store.put(achievement);
        }
      }

      await tx.done;

      // this.logger.success(
      //   `✅ Synced ${data.length} achievements from cloud`,
      //   'Achievements',
      // );

      // Reload achievements
      await this.loadAchievements();
    } catch (error) {
      this.logger.error('❌ Failed to sync achievements from cloud:', error);
    }
  }

  /**
   * Clear all achievements (for testing)
   */
  async resetAchievements(): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('achievements', 'readwrite');
      await tx.objectStore('achievements').clear();
      await tx.done;

      this.logger.debug('🗑️ All achievements cleared');

      // Reinitialize achievements
      await this.initializeAchievements();
      await this.loadAchievements();
    } catch (error) {
      this.logger.error('❌ Failed to reset achievements:', error);
    }
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Load all achievements from IndexedDB
   */
  private async loadAchievements(): Promise<void> {
    if (!this.db) return;

    try {
      const achievements = await this.db.getAll('achievements');
      this._achievements.set(achievements);
    } catch (error) {
      this.logger.error('❌ Failed to load achievements:', error);
    }
  }
}

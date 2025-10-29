import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  computed,
  signal,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { UserStatsService } from '../../core/services/user-stats.service';
import { CountryDiscoveryService } from '../../core/services/country-discovery.service';
import { AchievementsService } from '../../core/services/achievements.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { LoggerService } from '../../core/services/logger.service';

/**
 * User Profile Component
 *
 * Displays comprehensive user profile with:
 * - Profile information (name, email, avatar)
 * - Statistics overview (games, score, streak)
 * - Country discoveries progress
 * - Achievements summary
 * - Global rank and percentile
 * - Recent quiz sessions
 * - Edit profile functionality
 */
@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss',
})
export class UserProfileComponent implements OnInit, OnDestroy {
  private readonly supabase = inject(SupabaseService);
  private readonly userStatsService = inject(UserStatsService);
  private readonly discoveryService = inject(CountryDiscoveryService);
  private readonly achievementsService = inject(AchievementsService);
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly logger = inject(LoggerService);

  // Outputs
  @Output() closeRequest = new EventEmitter<void>();

  // State signals
  readonly showDropdown = signal(false);
  readonly isEditing = signal(false);
  readonly editDisplayName = signal('');
  readonly editAvatarUrl = signal('');
  readonly isSaving = signal(false);

  // Service signals
  readonly currentUser = this.supabase.currentUser;
  readonly stats = this.userStatsService.stats;
  readonly recentSessions = signal<any[]>([]);
  readonly totalDiscoveredSignal = this.discoveryService.totalDiscovered;
  readonly achievements = this.achievementsService.getAllAchievements();
  readonly myRank = this.leaderboardService.myRank;

  // Computed signals
  readonly displayName = computed(() => {
    const user = this.currentUser();
    return (
      user?.user_metadata?.['display_name'] ||
      user?.email?.split('@')[0] ||
      'User'
    );
  });

  readonly avatarUrl = computed(() => {
    const user = this.currentUser();
    return user?.user_metadata?.['avatar_url'] || this.getDefaultAvatar();
  });

  readonly unlockedAchievements = computed(() => {
    return this.achievements.filter((a: any) => a.isUnlocked);
  });

  readonly achievementProgress = computed(() => {
    const all = this.achievements;
    const unlocked = this.unlockedAchievements();
    return all.length > 0
      ? Math.round((unlocked.length / all.length) * 100)
      : 0;
  });

  readonly totalScore = computed(() => this.stats()?.totalScore || 0);
  readonly totalGames = computed(() => this.stats()?.totalGames || 0);
  readonly averageScore = computed(() => this.stats()?.averageScore || 0);
  readonly bestScore = computed(() => this.stats()?.bestScore || 0);
  readonly bestStreak = computed(() => this.stats()?.bestStreak || 0);
  readonly totalDiscovered = computed(() => this.totalDiscoveredSignal());
  readonly percentageExplored = computed(() => {
    const discovered = this.totalDiscovered();
    return Math.round((discovered / 241) * 100); // 241 total countries
  });

  constructor() {
    // Load recent sessions when stats change
    effect(() => {
      const statsData = this.stats();
      if (statsData) {
        this.loadRecentSessions();
      }
    });
  }

  ngOnInit(): void {
    this.loadRecentSessions();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Load recent quiz sessions
   */
  async loadRecentSessions(): Promise<void> {
    const sessions = await this.userStatsService.getRecentSessions(5);
    this.recentSessions.set(sessions);
  }

  /**
   * Toggle dropdown visibility
   */
  toggleDropdown(): void {
    this.showDropdown.update((show) => !show);
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    this.showDropdown.set(false);
    await this.supabase.signOut();
    this.logger.success('Signed out successfully', 'UserProfile');
  }

  /**
   * Close profile card
   */
  closeProfile(): void {
    this.closeRequest.emit();
  }

  /**
   * Start editing profile
   */
  startEdit(): void {
    const user = this.currentUser();
    this.editDisplayName.set(user?.user_metadata?.['display_name'] || '');
    this.editAvatarUrl.set(user?.user_metadata?.['avatar_url'] || '');
    this.isEditing.set(true);
  }

  /**
   * Cancel editing
   */
  cancelEdit(): void {
    this.isEditing.set(false);
    this.editDisplayName.set('');
    this.editAvatarUrl.set('');
  }

  /**
   * Save profile changes
   */
  async saveProfile(): Promise<void> {
    this.isSaving.set(true);

    try {
      const displayName = this.editDisplayName().trim();
      const avatarUrl = this.editAvatarUrl().trim();

      // Update user metadata in Supabase
      const { error } = await this.supabase['supabase'].auth.updateUser({
        data: {
          display_name: displayName || undefined,
          avatar_url: avatarUrl || undefined,
        },
      });

      if (error) {
        throw error;
      }

      // Update profiles table
      const userId = this.currentUser()?.id;
      if (userId) {
        const { error: profileError } = await this.supabase['supabase']
          .from('profiles')
          .update({
            display_name: displayName || null,
            avatar_url: avatarUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profileError) {
          this.logger.warn('Failed to update profiles table:', profileError);
        }
      }

      this.logger.success('Profile updated successfully!', 'Profile');
      this.isEditing.set(false);
    } catch (error) {
      this.logger.error('Failed to update profile:', error);
    } finally {
      this.isSaving.set(false);
    }
  }

  /**
   * Get default avatar based on email
   */
  private getDefaultAvatar(): string {
    const email = this.currentUser()?.email || '';
    const initial = email.charAt(0).toUpperCase();
    // Return data URI with colored circle and initial
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <circle cx="50" cy="50" r="50" fill="#10b981"/>
        <text x="50" y="50" font-size="48" fill="white" text-anchor="middle" dy=".3em" font-family="Arial, sans-serif" font-weight="bold">${initial}</text>
      </svg>
    `)}`;
  }

  /**
   * Format date for display
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Format time duration
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get mode display name
   */
  getModeDisplayName(mode: string): string {
    const modeNames: Record<string, string> = {
      'find-country': 'Find Country',
      'capital-match': 'Capital Match',
      'flag-id': 'Flag ID',
      'facts-guess': 'Facts Guess',
      'explore-learn': 'Explore & Learn',
    };
    return modeNames[mode] || mode;
  }

  /**
   * Get tier color
   */
  getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      bronze: '#cd7f32',
      silver: '#c0c0c0',
      gold: '#ffd700',
      platinum: '#e5e4e2',
      diamond: '#b9f2ff',
    };
    return colors[tier] || '#ffffff';
  }
}

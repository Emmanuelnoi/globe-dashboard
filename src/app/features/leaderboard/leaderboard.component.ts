import {
  Component,
  OnInit,
  OnDestroy,
  computed,
  effect,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { SidebarStateService } from '../../core/services/sidebar-state.service';
import {
  LeaderboardType,
  LeaderboardEntry,
} from '../../core/types/leaderboard.types';

/**
 * Leaderboard Component
 *
 * Displays global, weekly, and monthly leaderboards with:
 * - Tab navigation between leaderboard types
 * - Top 100 players ranked by score
 * - User's rank highlighted
 * - Real-time updates
 * - Glass morphism design matching app aesthetic
 */
@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html',
  styleUrl: './leaderboard.component.scss',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly supabase = inject(SupabaseService);
  private readonly sidebarStateService = inject(SidebarStateService);

  // State signals
  readonly selectedTab = signal<LeaderboardType>('global');
  readonly sidebarCollapsed = this.sidebarStateService.isCollapsed;

  // Computed signals from service
  readonly isLoading = this.leaderboardService.isLoading;
  readonly globalEntries = this.leaderboardService.globalLeaderboard;
  readonly weeklyEntries = this.leaderboardService.weeklyLeaderboard;
  readonly monthlyEntries = this.leaderboardService.monthlyLeaderboard;
  readonly myRank = this.leaderboardService.myRank;
  readonly lastError = this.leaderboardService.lastError;
  readonly isAuthenticated = this.supabase.isAuthenticated;

  // Computed current entries based on selected tab
  readonly currentEntries = computed(() => {
    const tab = this.selectedTab();
    switch (tab) {
      case 'global':
        return this.globalEntries();
      case 'weekly':
        return this.weeklyEntries();
      case 'monthly':
        return this.monthlyEntries();
      default:
        return [];
    }
  });

  // Computed to check if user is in current leaderboard
  readonly myRankInCurrent = computed(() => {
    const rank = this.myRank();
    const tab = this.selectedTab();
    return rank && rank.leaderboardType === tab ? rank : null;
  });

  // Effect to refresh leaderboards when tab changes
  constructor() {
    effect(() => {
      const tab = this.selectedTab();
      // Refresh leaderboard when tab changes
      this.leaderboardService.refreshAllLeaderboards();
    });
  }

  ngOnInit(): void {
    // Initial load
    this.leaderboardService.refreshAllLeaderboards();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Switch to a different leaderboard tab
   */
  selectTab(tab: LeaderboardType): void {
    this.selectedTab.set(tab);
  }

  /**
   * Refresh current leaderboard
   */
  async refresh(): Promise<void> {
    await this.leaderboardService.refreshAllLeaderboards();
  }

  /**
   * Check if an entry is the current user
   */
  isCurrentUser(entry: LeaderboardEntry): boolean {
    const userId = this.supabase.getCurrentUserId();
    return !!userId && entry.userId === userId;
  }

  /**
   * Get rank badge color based on position
   */
  getRankBadgeClass(rank: number): string {
    if (rank === 1) return 'rank-badge-gold';
    if (rank === 2) return 'rank-badge-silver';
    if (rank === 3) return 'rank-badge-bronze';
    return 'rank-badge-default';
  }

  /**
   * Get percentile display text
   */
  getPercentileText(percentile: number | undefined): string {
    if (!percentile) return '';
    return `Top ${percentile.toFixed(1)}%`;
  }

  /**
   * TrackBy function for ngFor optimization
   */
  trackByUserId(index: number, entry: LeaderboardEntry): string {
    return entry.userId;
  }
}

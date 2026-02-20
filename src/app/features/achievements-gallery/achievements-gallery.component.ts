import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AchievementsService } from '../../core/services/achievements.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { SidebarStateService } from '../../core/services/sidebar-state.service';

/**
 * Achievements Gallery Component
 *
 * Displays all 14 achievements in a beautiful grid layout with:
 * - Unlocked/locked states
 * - Progress bars for incomplete achievements
 * - Filter by category (All, Quiz, Discovery, Exploration, Social, Milestone)
 * - Tier badges (Bronze, Silver, Gold, Platinum, Diamond)
 * - Achievement details on hover
 * - Glass morphism design
 */
@Component({
  selector: 'app-achievements-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achievements-gallery.component.html',
  styleUrl: './achievements-gallery.component.scss',
})
export class AchievementsGalleryComponent implements OnInit {
  private readonly achievementsService = inject(AchievementsService);
  private readonly supabase = inject(SupabaseService);
  private readonly sidebarStateService = inject(SidebarStateService);

  // State signals
  readonly selectedCategory = signal<string>('all');
  readonly sidebarCollapsed = this.sidebarStateService.isCollapsed;

  // Service signals
  readonly allAchievements = this.achievementsService.getAllAchievements();
  readonly isAuthenticated = this.supabase.isAuthenticated();
  readonly tierColors: Record<string, string> = {
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    gold: '#ffd700',
    platinum: '#e5e4e2',
    diamond: '#b9f2ff',
  };
  readonly categoryIcons: Record<string, string> = {
    quiz: '🎯',
    discovery: '🗺️',
    exploration: '🔍',
    social: '👥',
    milestone: '⭐',
  };
  readonly defaultTierColor = '#10b981';
  readonly defaultCategoryIcon = '🏆';

  // Computed signals
  readonly filteredAchievements = computed(() => {
    const category = this.selectedCategory();
    const all = this.allAchievements;

    if (category === 'all') {
      return all;
    }

    return all.filter((a: any) => a.category === category);
  });

  readonly unlockedCount = computed(() => {
    return this.allAchievements.filter((a: any) => a.isUnlocked).length;
  });

  readonly totalCount = computed(() => {
    return this.allAchievements.length;
  });

  readonly completionPercentage = computed(() => {
    const total = this.totalCount();
    const unlocked = this.unlockedCount();
    return total > 0 ? Math.round((unlocked / total) * 100) : 0;
  });

  // Available categories
  readonly categories = [
    { id: 'all', name: 'All', icon: '🏆' },
    { id: 'quiz', name: 'Quiz', icon: '🎯' },
    { id: 'discovery', name: 'Discovery', icon: '🗺️' },
    { id: 'exploration', name: 'Exploration', icon: '🔍' },
    { id: 'social', name: 'Social', icon: '👥' },
    { id: 'milestone', name: 'Milestone', icon: '⭐' },
  ];

  ngOnInit(): void {
    // Load achievements if authenticated
    if (this.isAuthenticated) {
      this.achievementsService.syncFromCloud();
    }
  }

  /**
   * Select category filter
   */
  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }
}

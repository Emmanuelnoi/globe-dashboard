import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsPanelComponent } from './stats-panel';
import { UserStatsService } from '../../../../core/services/user-stats.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { MockProvider } from 'ng-mocks';

describe('StatsPanelComponent', () => {
  let component: StatsPanelComponent;
  let fixture: ComponentFixture<StatsPanelComponent>;
  let mockUserStatsService: any;

  beforeEach(async () => {
    // Mock URL API for environment
    Object.assign(global, {
      URL: {
        createObjectURL: vi.fn().mockReturnValue('mock-url'),
        revokeObjectURL: vi.fn(),
      },
    });

    // Mock UserStatsService
    mockUserStatsService = {
      stats: signal(null),
      recentSessions: signal([]),
      isLoading: signal(false),
      lastError: signal(null),
      totalGames: signal(0),
      averageScore: signal(0),
      bestScore: signal(0),
      bestStreak: signal(0),
      hasPlayedAnyGames: signal(false),
      exportData: vi.fn(),
      importData: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [StatsPanelComponent],
      providers: [MockProvider(UserStatsService, mockUserStatsService)],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display loading state', () => {
    mockUserStatsService.isLoading.set(true);
    fixture.detectChanges();

    const loadingElement =
      fixture.nativeElement.querySelector('.loading-spinner');
    expect(loadingElement).toBeTruthy();
    expect(loadingElement.textContent).toContain('Loading');
  });

  it('should display empty state when no games played', () => {
    mockUserStatsService.isLoading.set(false);
    mockUserStatsService.hasPlayedAnyGames.set(false);
    fixture.detectChanges();

    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('No Games Played Yet');
  });

  it('should display error state when error exists', () => {
    mockUserStatsService.isLoading.set(false);
    mockUserStatsService.lastError.set('Database error');
    fixture.detectChanges();

    const errorState = fixture.nativeElement.querySelector('.error-state');
    expect(errorState).toBeTruthy();
    expect(errorState.textContent).toContain('Database error');
  });

  it('should display stats when games have been played', () => {
    mockUserStatsService.isLoading.set(false);
    mockUserStatsService.hasPlayedAnyGames.set(true);
    mockUserStatsService.totalGames.set(5);
    mockUserStatsService.averageScore.set(85.5);
    mockUserStatsService.bestScore.set(120);
    mockUserStatsService.bestStreak.set(3);
    fixture.detectChanges();

    const statCards = fixture.nativeElement.querySelectorAll('.stat-card');
    expect(statCards.length).toBeGreaterThan(0);

    const values = Array.from(statCards).map((card: any) =>
      card.querySelector('.stat-value').textContent.trim(),
    );

    expect(values).toContain('5');
    expect(values).toContain('86');
    expect(values).toContain('120');
    expect(values[3]).toContain('3');
  });

  it('should format dates correctly', () => {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000);

    expect(component.formatDate(today)).toBe('Today');
    expect(component.formatDate(yesterday)).toBe('Yesterday');
    expect(component.formatDate(threeDaysAgo)).toBe('3 days ago');
    expect(component.formatDate(oneWeekAgo)).toBe(
      oneWeekAgo.toLocaleDateString(),
    );
  });

  it('should get correct mode display name', () => {
    expect(component.getModeDisplayName('find-country')).toBe('Find Country');
    expect(component.getModeDisplayName('capital-match')).toBe('Capital Match');
    expect(component.getModeDisplayName('flag-id')).toBe('Flag ID');
    expect(component.getModeDisplayName('facts-guess')).toBe('Facts Guess');
    expect(component.getModeDisplayName('unknown-mode')).toBe('unknown-mode');
  });

  it('should return empty mode stats when no stats available', () => {
    const modeStats = component.getModeStats('find-country');
    expect(modeStats).toEqual({
      gamesPlayed: 0,
      totalScore: 0,
      averageScore: 0,
      bestScore: 0,
      bestStreak: 0,
    });
  });

  // Export/Import button tests removed - buttons were removed from UI per CLAUDE.md

  // All export/import functionality tests removed - feature was simplified
});

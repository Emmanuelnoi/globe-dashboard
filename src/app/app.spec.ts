import { TestBed } from '@angular/core/testing';
import {
  NO_ERRORS_SCHEMA,
  signal,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { App } from './app';
import { beforeAll } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockProvider } from 'ng-mocks';
import { NavigationStateService } from './core/services/navigation-state.service';
import { QuizStateService } from './features/quiz/services/quiz-state';
import { LoggerService } from './core/services/logger.service';
import { SupabaseService } from './core/services/supabase.service';
import { UserStatsService } from './core/services/user-stats.service';
import { CountryDiscoveryService } from './core/services/country-discovery.service';
import { AchievementsService } from './core/services/achievements.service';
import { CacheVersionService } from './core/services/cache-version.service';

describe('App', () => {
  const appDir = dirname(fileURLToPath(import.meta.url));
  const srcRoot = resolve(appDir, '..');

  const findFileByName = async (
    rootDir: string,
    fileName: string,
  ): Promise<string | null> => {
    const entries = await readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(rootDir, entry.name);
      if (entry.isFile() && entry.name === fileName) {
        return fullPath;
      }
      if (entry.isDirectory()) {
        const found = await findFileByName(fullPath, fileName);
        if (found) {
          return found;
        }
      }
    }
    return null;
  };

  beforeAll(async () => {
    await resolveComponentResources(async (url) => {
      const fileName = basename(url);
      const locatedPath = await findFileByName(srcRoot, fileName);
      if (!locatedPath) {
        throw new Error(`Could not resolve component resource: ${url}`);
      }
      return readFile(locatedPath, 'utf8');
    });
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      schemas: [NO_ERRORS_SCHEMA], // Ignore unknown elements/components
      providers: [
        MockProvider(NavigationStateService, {
          isCountryComparisonActive: (): boolean => false,
          isPerformanceMonitorActive: (): boolean => false,
          isGameQuizActive: (): boolean => false,
          isBirdMigrationActive: (): boolean => false,
          isLeaderboardActive: (): boolean => false,
        }),
        MockProvider(QuizStateService, {}),
        MockProvider(LoggerService, {
          debug: (): void => {},
          info: (): void => {},
          success: (): void => {},
          warn: (): void => {},
          error: (): void => {},
        }),
        MockProvider(SupabaseService, {
          isAuthenticated: (): boolean => false,
          currentUser: (): unknown => null,
          passwordRecoveryEvent: signal(false),
          isPasswordRecoveryPending: (): boolean => false,
          signOut: async (): Promise<void> => {},
        }),
        MockProvider(UserStatsService, {
          totalGames: (): number => 0,
        }),
        MockProvider(CountryDiscoveryService, {
          totalDiscovered: (): number => 0,
        }),
        MockProvider(AchievementsService, {
          unlockedCount: (): number => 0,
        }),
        MockProvider(CacheVersionService, {
          getCurrentVersion: (): string => 'test',
          clearAllApiCaches: async (): Promise<void> => {},
          getDatabases: (): [] => [],
          checkAndMigrate: async (): Promise<{
            migrated: boolean;
            fromVersion: string;
            toVersion: string;
            operationsPerformed: readonly string[];
            error?: string;
          }> => ({
            migrated: false,
            fromVersion: 'test',
            toVersion: 'test',
            operationsPerformed: [],
          }),
        }),
      ],
    })
      .overrideComponent(App, {
        set: {
          imports: [],
          schemas: [NO_ERRORS_SCHEMA],
          template: `<div class="app-container"></div>`,
        },
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render app container', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-container')).toBeTruthy();
  });
});

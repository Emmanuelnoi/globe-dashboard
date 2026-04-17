import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  signal,
  ɵresolveComponentResources as resolveComponentResources,
} from '@angular/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MockProvider } from 'ng-mocks';
import { GameHub } from './game-hub';
import { QuizStateService } from '../../services/quiz-state';
import { LoggerService } from '@/core/services/logger.service';
import { UserStatsService } from '@/core/services/user-stats.service';
import { Question } from '../../models/quiz.models';

describe('GameHub', () => {
  let component: GameHub;
  let fixture: ComponentFixture<GameHub>;
  const specDir = dirname(fileURLToPath(import.meta.url));

  const currentQuestion = signal<Question | null>(null);
  const gameState = signal<
    'idle' | 'playing' | 'question' | 'evaluating' | 'results' | 'ended'
  >('idle');
  const configuration = signal<any>(null);
  const selectedCandidate = signal<string | null>(null);
  const currentSession = signal<any>(null);
  const results = signal<any[]>([]);
  const questions = signal<Question[]>([]);
  const currentQuestionIndex = signal(0);
  const progress = signal(0);
  const timeLeft = signal(30000);
  const timeProgress = signal(1);
  const score = signal(0);
  const streak = signal(0);
  const canConfirm = signal(false);
  const isConfirmLocked = signal(false);

  const mockQuizStateService = {
    gameState,
    score,
    streak,
    timeLeft,
    currentQuestion,
    selectedCandidate,
    currentSession,
    results,
    questions,
    currentQuestionIndex,
    progress,
    timeProgress,
    configuration,
    canConfirm,
    isConfirmLocked,
    startGame: vi.fn(),
    resetToIdle: vi.fn(),
    selectCandidate: vi.fn(),
    confirmCandidate: vi.fn(),
    clearCandidate: vi.fn(),
    skipQuestion: vi.fn(),
  };

  const mockLoggerService = {
    warn: vi.fn(),
    error: vi.fn(),
  };

  const mockUserStatsService = {
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

  beforeAll(async () => {
    await resolveComponentResources(async (url) =>
      readFile(resolve(specDir, url), 'utf8'),
    );
  });

  beforeEach(async () => {
    currentQuestion.set(null);
    gameState.set('idle');
    configuration.set(null);
    selectedCandidate.set(null);
    currentSession.set(null);
    results.set([]);
    questions.set([]);
    currentQuestionIndex.set(0);
    progress.set(0);
    timeLeft.set(30000);
    timeProgress.set(1);
    score.set(0);
    streak.set(0);
    canConfirm.set(false);
    isConfirmLocked.set(false);

    await TestBed.configureTestingModule({
      imports: [GameHub],
      providers: [
        MockProvider(QuizStateService, mockQuizStateService),
        MockProvider(LoggerService, mockLoggerService),
        MockProvider(UserStatsService, mockUserStatsService),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GameHub);
    component = fixture.componentInstance;
  });

  it('renders the generated SVG flag asset for flag-id questions', () => {
    gameState.set('question');
    configuration.set({ mode: 'flag-id' });
    const question: Question = {
      id: 'flag_1',
      type: 'flag-id',
      prompt: 'Which country does this flag belong to?',
      correctAnswer: 'United States',
      choices: ['United States', 'Canada', 'Mexico', 'Brazil'],
      metadata: {
        flagAssetPath: '/flags/us.svg',
        flagEmoji: '🇺🇸',
      },
    };
    currentQuestion.set(question);
    questions.set([question]);

    fixture.detectChanges();

    const flagImage = fixture.nativeElement.querySelector(
      '.question-flag',
    ) as HTMLImageElement | null;
    const fallbackEmoji = fixture.nativeElement.querySelector(
      '.question-flag-emoji',
    );

    expect(flagImage).toBeTruthy();
    expect(flagImage?.getAttribute('src')).toBe('/flags/us.svg');
    expect(fallbackEmoji).toBeNull();
  });

  it('falls back to emoji when the SVG flag asset fails to load', () => {
    gameState.set('question');
    configuration.set({ mode: 'flag-id' });
    const question: Question = {
      id: 'flag_2',
      type: 'flag-id',
      prompt: 'Which country does this flag belong to?',
      correctAnswer: 'Canada',
      choices: ['Canada', 'United States', 'France', 'Australia'],
      metadata: {
        flagAssetPath: '/flags/ca.svg',
        flagEmoji: '🇨🇦',
      },
    };
    currentQuestion.set(question);
    questions.set([question]);

    fixture.detectChanges();

    const flagImage = fixture.nativeElement.querySelector(
      '.question-flag',
    ) as HTMLImageElement;
    flagImage.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    const fallbackEmoji = fixture.nativeElement.querySelector(
      '.question-flag-emoji',
    ) as HTMLElement | null;
    const missingImage = fixture.nativeElement.querySelector('.question-flag');

    expect(missingImage).toBeNull();
    expect(fallbackEmoji).toBeTruthy();
    expect(fallbackEmoji?.textContent?.trim()).toBe('🇨🇦');
  });
});

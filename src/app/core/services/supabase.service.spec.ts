import { TestBed } from '@angular/core/testing';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';

describe('SupabaseService', () => {
  let service: SupabaseService;
  let loggerService: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseService, LoggerService],
    });
    service = TestBed.inject(SupabaseService);
    loggerService = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with default auth state', () => {
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(service.authLoading()).toBeDefined();
    });

    it('should have readonly signals', () => {
      // Signals should be readable
      expect(() => service.currentUser()).not.toThrow();
      expect(() => service.isAuthenticated()).not.toThrow();
      expect(() => service.authLoading()).not.toThrow();
    });
  });

  describe('helper methods', () => {
    it('should return null user ID when not authenticated', () => {
      expect(service.getCurrentUserId()).toBeNull();
    });

    it('should return false for isUserAuthenticated when not authenticated', () => {
      expect(service.isUserAuthenticated()).toBe(false);
    });
  });

  describe('authentication methods', () => {
    it('should have signUp method', () => {
      expect(typeof service.signUp).toBe('function');
    });

    it('should have signIn method', () => {
      expect(typeof service.signIn).toBe('function');
    });

    it('should have signOut method', () => {
      expect(typeof service.signOut).toBe('function');
    });

    it('should have signInWithGoogle method', () => {
      expect(typeof service.signInWithGoogle).toBe('function');
    });

    it('should have resetPassword method', () => {
      expect(typeof service.resetPassword).toBe('function');
    });

    it('should have updatePassword method', () => {
      expect(typeof service.updatePassword).toBe('function');
    });
  });

  describe('database methods', () => {
    it('should have uploadQuizSessions method', () => {
      expect(typeof service.uploadQuizSessions).toBe('function');
    });

    it('should have getQuizSessions method', () => {
      expect(typeof service.getQuizSessions).toBe('function');
    });

    it('should have uploadUserStats method', () => {
      expect(typeof service.uploadUserStats).toBe('function');
    });

    it('should have getUserStats method', () => {
      expect(typeof service.getUserStats).toBe('function');
    });

    it('should return error when uploading sessions while not authenticated', async () => {
      const result = await service.uploadQuizSessions([]);
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('not authenticated');
    });

    it('should return error when uploading stats while not authenticated', async () => {
      const mockStats = {
        version: 1 as const,
        totalGames: 0,
        totalScore: 0,
        averageScore: 0,
        bestScore: 0,
        bestStreak: 0,
        gamesByMode: {
          'find-country': {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
            bestStreak: 0,
          },
          'capital-match': {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
            bestStreak: 0,
          },
          'flag-id': {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
            bestStreak: 0,
          },
          'facts-guess': {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
            bestStreak: 0,
          },
          'explore-learn': {
            gamesPlayed: 0,
            totalScore: 0,
            averageScore: 0,
            bestScore: 0,
            bestStreak: 0,
          },
        },
        lastUpdated: new Date(),
      };

      const result = await service.uploadUserStats(mockStats);
      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('not authenticated');
    });
  });
});

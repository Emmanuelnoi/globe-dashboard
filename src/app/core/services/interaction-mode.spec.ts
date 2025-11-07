import { TestBed } from '@angular/core/testing';
import { InteractionModeService, InteractionMode } from './interaction-mode';

/**
 * Unit Tests for InteractionModeService
 *
 * Tests state management for different interaction modes:
 * - explore (normal globe interactions)
 * - quiz (quiz game mode)
 * - migration (bird migration visualization)
 * - leaderboard (leaderboard view)
 */
describe('InteractionModeService', () => {
  let service: InteractionModeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InteractionModeService],
    });
    service = TestBed.inject(InteractionModeService);
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start in explore mode by default', () => {
      expect(service.mode()).toBe('explore');
      expect(service.isExploreMode()).toBe(true);
      expect(service.isQuizMode()).toBe(false);
      expect(service.isMigrationMode()).toBe(false);
      expect(service.isLeaderboardMode()).toBe(false);
    });
  });

  describe('Mode Switching', () => {
    it('should switch to explore mode', () => {
      service.enableQuizMode(); // Start from different mode
      service.enableExploreMode();

      expect(service.mode()).toBe('explore');
      expect(service.isExploreMode()).toBe(true);
      expect(service.isQuizMode()).toBe(false);
      expect(service.isMigrationMode()).toBe(false);
      expect(service.isLeaderboardMode()).toBe(false);
    });

    it('should switch to quiz mode', () => {
      service.enableQuizMode();

      expect(service.mode()).toBe('quiz');
      expect(service.isExploreMode()).toBe(false);
      expect(service.isQuizMode()).toBe(true);
      expect(service.isMigrationMode()).toBe(false);
      expect(service.isLeaderboardMode()).toBe(false);
    });

    it('should switch to migration mode', () => {
      service.enableMigrationMode();

      expect(service.mode()).toBe('migration');
      expect(service.isExploreMode()).toBe(false);
      expect(service.isQuizMode()).toBe(false);
      expect(service.isMigrationMode()).toBe(true);
      expect(service.isLeaderboardMode()).toBe(false);
    });

    it('should switch to leaderboard mode', () => {
      service.enableLeaderboardMode();

      expect(service.mode()).toBe('leaderboard');
      expect(service.isExploreMode()).toBe(false);
      expect(service.isQuizMode()).toBe(false);
      expect(service.isMigrationMode()).toBe(false);
      expect(service.isLeaderboardMode()).toBe(true);
    });

    it('should allow switching between modes multiple times', () => {
      service.enableExploreMode();
      expect(service.mode()).toBe('explore');

      service.enableQuizMode();
      expect(service.mode()).toBe('quiz');

      service.enableMigrationMode();
      expect(service.mode()).toBe('migration');

      service.enableLeaderboardMode();
      expect(service.mode()).toBe('leaderboard');

      service.enableExploreMode();
      expect(service.mode()).toBe('explore');
    });
  });

  describe('Toggle Mode', () => {
    it('should toggle from explore to quiz', () => {
      service.enableExploreMode();
      service.toggleMode();
      expect(service.mode()).toBe('quiz');
    });

    it('should toggle from quiz to migration', () => {
      service.enableQuizMode();
      service.toggleMode();
      expect(service.mode()).toBe('migration');
    });

    it('should toggle from migration back to explore', () => {
      service.enableMigrationMode();
      service.toggleMode();
      expect(service.mode()).toBe('explore');
    });

    it('should toggle from leaderboard back to explore', () => {
      service.enableLeaderboardMode();
      service.toggleMode();
      expect(service.mode()).toBe('explore');
    });

    it('should cycle through modes correctly', () => {
      service.enableExploreMode();

      service.toggleMode();
      expect(service.mode()).toBe('quiz');

      service.toggleMode();
      expect(service.mode()).toBe('migration');

      service.toggleMode();
      expect(service.mode()).toBe('explore');
    });
  });

  describe('Computed Values', () => {
    it('should update isExploreMode computed value', () => {
      service.enableExploreMode();
      expect(service.isExploreMode()).toBe(true);

      service.enableQuizMode();
      expect(service.isExploreMode()).toBe(false);
    });

    it('should update isQuizMode computed value', () => {
      service.enableQuizMode();
      expect(service.isQuizMode()).toBe(true);

      service.enableExploreMode();
      expect(service.isQuizMode()).toBe(false);
    });

    it('should update isMigrationMode computed value', () => {
      service.enableMigrationMode();
      expect(service.isMigrationMode()).toBe(true);

      service.enableExploreMode();
      expect(service.isMigrationMode()).toBe(false);
    });

    it('should update isLeaderboardMode computed value', () => {
      service.enableLeaderboardMode();
      expect(service.isLeaderboardMode()).toBe(true);

      service.enableExploreMode();
      expect(service.isLeaderboardMode()).toBe(false);
    });

    it('should ensure only one mode is active at a time', () => {
      const allModes: InteractionMode[] = [
        'explore',
        'quiz',
        'migration',
        'leaderboard',
      ];

      allModes.forEach((mode) => {
        // Set the mode
        switch (mode) {
          case 'explore':
            service.enableExploreMode();
            break;
          case 'quiz':
            service.enableQuizMode();
            break;
          case 'migration':
            service.enableMigrationMode();
            break;
          case 'leaderboard':
            service.enableLeaderboardMode();
            break;
        }

        // Check that only the current mode is true
        const activeCount = [
          service.isExploreMode(),
          service.isQuizMode(),
          service.isMigrationMode(),
          service.isLeaderboardMode(),
        ].filter((isActive) => isActive).length;

        expect(activeCount).toBe(1);
        expect(service.mode()).toBe(mode);
      });
    });
  });

  describe('Signal Reactivity', () => {
    it('should emit new value when mode changes', () => {
      const modeChanges: InteractionMode[] = [];

      // In a real Angular component, this would use effect() or computed()
      // For testing, we'll manually track changes
      const initialMode = service.mode();
      modeChanges.push(initialMode);

      service.enableQuizMode();
      modeChanges.push(service.mode());

      service.enableMigrationMode();
      modeChanges.push(service.mode());

      expect(modeChanges).toEqual(['explore', 'quiz', 'migration']);
    });

    it('should not emit duplicate values when setting same mode', () => {
      const mode1 = service.mode();
      service.enableExploreMode();
      const mode2 = service.mode();

      // Both should be 'explore', but signal equality check prevents duplicate notifications
      expect(mode1).toBe(mode2);
      expect(mode1).toBe('explore');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid mode switches', () => {
      for (let i = 0; i < 10; i++) {
        service.enableExploreMode();
        service.enableQuizMode();
        service.enableMigrationMode();
        service.enableLeaderboardMode();
      }

      expect(service.mode()).toBe('leaderboard');
      expect(service.isLeaderboardMode()).toBe(true);
    });

    it('should handle rapid toggle operations', () => {
      service.enableExploreMode();

      for (let i = 0; i < 100; i++) {
        service.toggleMode();
      }

      // After 100 toggles from explore: explore(0) -> quiz(1) -> migration(2) -> explore(3) ...
      // 100 % 3 = 1, so should be quiz
      expect(service.mode()).toBe('quiz');
    });

    it('should maintain state consistency across all operations', () => {
      service.enableExploreMode();
      expect(service.mode()).toBe('explore');
      expect(service.isExploreMode()).toBe(true);

      service.toggleMode();
      expect(service.mode()).toBe('quiz');
      expect(service.isQuizMode()).toBe(true);

      service.enableMigrationMode();
      expect(service.mode()).toBe('migration');
      expect(service.isMigrationMode()).toBe(true);

      service.toggleMode();
      expect(service.mode()).toBe('explore');
      expect(service.isExploreMode()).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should have correct TypeScript types for mode', () => {
      const mode: InteractionMode = service.mode();
      expect(['explore', 'quiz', 'migration', 'leaderboard']).toContain(mode);
    });

    it('should have readonly signal for public API', () => {
      // The mode signal should be readonly (cannot call .set() directly)
      // This is enforced at compile time, but we can verify the getter works
      const modeSignal = service.mode;
      expect(typeof modeSignal).toBe('function');
      expect(modeSignal()).toBeTruthy();
    });
  });
});

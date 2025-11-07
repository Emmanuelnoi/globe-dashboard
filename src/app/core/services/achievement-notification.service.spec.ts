import { TestBed } from '@angular/core/testing';
import {
  AchievementNotificationService,
  AchievementNotification,
} from './achievement-notification.service';
import { AchievementsService } from './achievements.service';
import { LoggerService } from './logger.service';
import { signal } from '@angular/core';
import { vi } from 'vitest';

/**
 * Unit Tests for AchievementNotificationService
 *
 * Tests notification management for achievement unlocks:
 * - Notification creation and display
 * - Queue management
 * - Auto-dismiss functionality
 * - Tier colors and category icons
 */
describe('AchievementNotificationService', () => {
  let service: AchievementNotificationService;
  let mockAchievementsService: any;
  let mockLoggerService: {
    success: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Mock recent unlocks signal
  let recentUnlocksSignal: any;

  beforeEach(() => {
    // Setup mock recent unlocks
    recentUnlocksSignal = signal([]);

    // Mock achievements service
    mockAchievementsService = {
      recentUnlocks: recentUnlocksSignal,
    };

    // Mock logger service
    mockLoggerService = {
      success: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AchievementNotificationService,
        { provide: AchievementsService, useValue: mockAchievementsService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    // Mock timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should be created', () => {
      service = TestBed.inject(AchievementNotificationService);
      expect(service).toBeTruthy();
    });

    it('should start with no notifications', () => {
      service = TestBed.inject(AchievementNotificationService);
      expect(service.notifications()).toEqual([]);
      expect(service.hasNotifications()).toBe(false);
    });
  });

  describe('Tier Colors', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should return correct color for bronze tier', () => {
      expect(service.getTierColor('bronze')).toBe('#cd7f32');
    });

    it('should return correct color for silver tier', () => {
      expect(service.getTierColor('silver')).toBe('#c0c0c0');
    });

    it('should return correct color for gold tier', () => {
      expect(service.getTierColor('gold')).toBe('#ffd700');
    });

    it('should return correct color for platinum tier', () => {
      expect(service.getTierColor('platinum')).toBe('#e5e4e2');
    });

    it('should return correct color for diamond tier', () => {
      expect(service.getTierColor('diamond')).toBe('#b9f2ff');
    });

    it('should return default color for unknown tier', () => {
      expect(service.getTierColor('unknown')).toBe('#10b981');
    });

    it('should handle empty tier string', () => {
      expect(service.getTierColor('')).toBe('#10b981');
    });
  });

  describe('Category Icons', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should return correct icon for quiz category', () => {
      expect(service.getCategoryIcon('quiz')).toBe('🎯');
    });

    it('should return correct icon for discovery category', () => {
      expect(service.getCategoryIcon('discovery')).toBe('🗺️');
    });

    it('should return correct icon for exploration category', () => {
      expect(service.getCategoryIcon('exploration')).toBe('🔍');
    });

    it('should return correct icon for social category', () => {
      expect(service.getCategoryIcon('social')).toBe('👥');
    });

    it('should return correct icon for milestone category', () => {
      expect(service.getCategoryIcon('milestone')).toBe('⭐');
    });

    it('should return default icon for unknown category', () => {
      expect(service.getCategoryIcon('unknown')).toBe('🏆');
    });

    it('should handle empty category string', () => {
      expect(service.getCategoryIcon('')).toBe('🏆');
    });
  });

  describe('Notification Dismissal', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should dismiss notification by id', () => {
      const mockNotification: AchievementNotification = {
        id: 'test-1',
        achievementId: 'ach-1',
        name: 'Test Achievement',
        description: 'Test Description',
        category: 'quiz',
        tier: 'bronze',
        timestamp: new Date(),
        isVisible: true,
      };

      // Manually add notification for testing
      service['_notifications'].set([mockNotification]);
      expect(service.notifications().length).toBe(1);

      service.dismissNotification('test-1');
      expect(service.notifications().length).toBe(0);
    });

    it('should not error when dismissing non-existent notification', () => {
      service.dismissNotification('non-existent');
      expect(service.notifications().length).toBe(0);
    });

    it('should only dismiss matching notification', () => {
      const notification1: AchievementNotification = {
        id: 'test-1',
        achievementId: 'ach-1',
        name: 'Achievement 1',
        description: 'Description 1',
        category: 'quiz',
        tier: 'bronze',
        timestamp: new Date(),
        isVisible: true,
      };

      const notification2: AchievementNotification = {
        id: 'test-2',
        achievementId: 'ach-2',
        name: 'Achievement 2',
        description: 'Description 2',
        category: 'discovery',
        tier: 'silver',
        timestamp: new Date(),
        isVisible: true,
      };

      service['_notifications'].set([notification1, notification2]);
      service.dismissNotification('test-1');

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].id).toBe('test-2');
    });

    it('should dismiss all notifications', () => {
      const notifications: AchievementNotification[] = [
        {
          id: 'test-1',
          achievementId: 'ach-1',
          name: 'Achievement 1',
          description: 'Description 1',
          category: 'quiz',
          tier: 'bronze',
          timestamp: new Date(),
          isVisible: true,
        },
        {
          id: 'test-2',
          achievementId: 'ach-2',
          name: 'Achievement 2',
          description: 'Description 2',
          category: 'discovery',
          tier: 'silver',
          timestamp: new Date(),
          isVisible: true,
        },
      ];

      service['_notifications'].set(notifications);
      service['_queue'].set([notifications[0]]);

      service.dismissAll();

      expect(service.notifications().length).toBe(0);
      expect(service['_queue']().length).toBe(0);
    });

    it('should clear timeout when dismissing all', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      service['notificationTimeout'] = setTimeout(() => {}, 1000);
      service.dismissAll();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Notification Display', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should create notification with correct structure', () => {
      const achievement = {
        id: 'first-quiz',
        name: 'Quiz Master',
        description: 'Complete your first quiz',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);

      expect(service['_queue']().length).toBe(1);
      const notification = service['_queue']()[0];
      expect(notification.achievementId).toBe('first-quiz');
      expect(notification.name).toBe('Quiz Master');
      expect(notification.category).toBe('quiz');
      expect(notification.tier).toBe('bronze');
      expect(notification.isVisible).toBe(false);
    });

    it('should log success message when showing notification', () => {
      const achievement = {
        id: 'test-ach',
        name: 'Test Achievement',
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);

      expect(mockLoggerService.success).toHaveBeenCalledWith(
        '🏆 Achievement Unlocked: Test Achievement',
        'Achievements',
      );
    });

    it('should add notifications to queue', () => {
      const achievements = [
        {
          id: '1',
          name: 'Achievement 1',
          description: '',
          category: 'quiz',
          tier: 'bronze',
        },
        {
          id: '2',
          name: 'Achievement 2',
          description: '',
          category: 'quiz',
          tier: 'silver',
        },
        {
          id: '3',
          name: 'Achievement 3',
          description: '',
          category: 'quiz',
          tier: 'gold',
        },
      ];

      achievements.forEach((ach) => service['showNotification'](ach));

      expect(service['_queue']().length).toBe(3);
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should process queue sequentially', async () => {
      const achievement = {
        id: 'test-ach',
        name: 'Test Achievement',
        description: 'Test Description',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);
      expect(service['_queue']().length).toBe(1);
      expect(service.notifications().length).toBe(0);

      // Advance timer to process queue
      vi.advanceTimersByTime(500);

      // Should move from queue to notifications
      expect(service['_queue']().length).toBe(0);
      expect(service.notifications().length).toBe(1);
    });

    it('should auto-dismiss notification after timeout', async () => {
      const achievement = {
        id: 'test-ach',
        name: 'Test Achievement',
        description: 'Test Description',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);

      // Process queue
      vi.advanceTimersByTime(500);
      expect(service.notifications().length).toBe(1);

      // Advance to auto-dismiss time (4 seconds)
      vi.advanceTimersByTime(4000);
      expect(service.notifications().length).toBe(0);
    });

    it('should only show one notification at a time', async () => {
      const achievements = [
        {
          id: '1',
          name: 'Achievement 1',
          description: '',
          category: 'quiz',
          tier: 'bronze',
        },
        {
          id: '2',
          name: 'Achievement 2',
          description: '',
          category: 'quiz',
          tier: 'silver',
        },
      ];

      achievements.forEach((ach) => service['showNotification'](ach));
      expect(service['_queue']().length).toBe(2);

      // Process queue
      vi.advanceTimersByTime(500);

      // Should only show one notification
      expect(service.notifications().length).toBe(1);
      expect(service['_queue']().length).toBe(1);
    });
  });

  describe('Sound Playback', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should handle sound playback gracefully when Web Audio API unavailable', () => {
      // Remove AudioContext to simulate unavailable API
      const originalAudioContext = (window as any).AudioContext;
      (window as any).AudioContext = undefined;
      (window as any).webkitAudioContext = undefined;

      // Should not throw error
      expect(() => service['playSound']()).not.toThrow();

      // Restore
      (window as any).AudioContext = originalAudioContext;
    });

    it('should catch and log errors during sound playback', () => {
      // Mock AudioContext to throw error
      const originalAudioContext = (window as any).AudioContext;
      (window as any).AudioContext = class {
        constructor() {
          throw new Error('AudioContext error');
        }
      };

      service['playSound']();

      expect(mockLoggerService.debug).toHaveBeenCalled();

      // Restore
      (window as any).AudioContext = originalAudioContext;
    });
  });

  describe('Achievement Detection', () => {
    it('should detect new achievement unlocks', async () => {
      service = TestBed.inject(AchievementNotificationService);

      const achievement = {
        id: 'new-unlock',
        name: 'New Achievement',
        description: 'Newly unlocked',
        category: 'quiz',
        tier: 'bronze',
      };

      // Update recent unlocks signal
      recentUnlocksSignal.set([achievement]);

      // Allow effect to run
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLoggerService.success).toHaveBeenCalled();
    });

    it('should only process new unlocks', async () => {
      service = TestBed.inject(AchievementNotificationService);

      const achievement1 = {
        id: 'unlock-1',
        name: 'Achievement 1',
        description: 'First unlock',
        category: 'quiz',
        tier: 'bronze',
      };

      const achievement2 = {
        id: 'unlock-2',
        name: 'Achievement 2',
        description: 'Second unlock',
        category: 'quiz',
        tier: 'silver',
      };

      // Set initial unlock
      recentUnlocksSignal.set([achievement1]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const callCount1 = mockLoggerService.success.calls.count();

      // Add second unlock
      recentUnlocksSignal.set([achievement1, achievement2]);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const callCount2 = mockLoggerService.success.calls.count();

      // Should only have processed the new achievement
      expect(callCount2).toBe(callCount1 + 1);
    });
  });

  describe('Notification Structure', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should create unique notification IDs', () => {
      const achievement = {
        id: 'same-ach',
        name: 'Same Achievement',
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);
      const id1 = service['_queue']()[0].id;

      // Wait a bit to ensure different timestamp
      vi.advanceTimersByTime(1);

      service['showNotification'](achievement);
      const id2 = service['_queue']()[1].id;

      expect(id1).not.toBe(id2);
    });

    it('should set isVisible to false initially', () => {
      const achievement = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);
      const notification = service['_queue']()[0];

      expect(notification.isVisible).toBe(false);
    });

    it('should set isVisible to true when displayed', async () => {
      const achievement = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);

      // Process queue
      vi.advanceTimersByTime(500);

      const notification = service.notifications()[0];
      expect(notification.isVisible).toBe(true);
    });

    it('should set correct timestamp', () => {
      const beforeTime = Date.now();
      const achievement = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      };

      service['showNotification'](achievement);
      const afterTime = Date.now();

      const notification = service['_queue']()[0];
      const notificationTime = notification.timestamp.getTime();

      expect(notificationTime).toBeGreaterThanOrEqual(beforeTime);
      expect(notificationTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = TestBed.inject(AchievementNotificationService);
    });

    it('should handle rapid multiple achievements', () => {
      const achievements = Array.from({ length: 10 }, (_, i) => ({
        id: `ach-${i}`,
        name: `Achievement ${i}`,
        description: 'Test',
        category: 'quiz',
        tier: 'bronze',
      }));

      achievements.forEach((ach) => service['showNotification'](ach));
      expect(service['_queue']().length).toBe(10);
    });

    it('should handle achievement with missing fields', () => {
      const invalidAchievement = {
        id: 'invalid',
        name: 'Invalid',
      } as any;

      expect(() =>
        service['showNotification'](invalidAchievement),
      ).not.toThrow();
    });

    it('should handle empty achievement object', () => {
      const emptyAchievement = {} as any;
      expect(() => service['showNotification'](emptyAchievement)).not.toThrow();
    });
  });
});

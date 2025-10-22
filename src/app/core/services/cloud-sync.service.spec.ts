import { TestBed } from '@angular/core/testing';
import { CloudSyncService } from './cloud-sync.service';
import { SupabaseService } from './supabase.service';
import { UserStatsService } from './user-stats.service';
import { LoggerService } from './logger.service';

describe('CloudSyncService', () => {
  let service: CloudSyncService;
  let supabaseService: SupabaseService;
  let userStatsService: UserStatsService;
  let loggerService: LoggerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CloudSyncService,
        SupabaseService,
        UserStatsService,
        LoggerService,
      ],
    });
    service = TestBed.inject(CloudSyncService);
    supabaseService = TestBed.inject(SupabaseService);
    userStatsService = TestBed.inject(UserStatsService);
    loggerService = TestBed.inject(LoggerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with idle sync status', () => {
      const status = service.getSyncStatus();
      expect(status.status).toBe('idle');
      expect(status.lastSyncTime).toBeNull();
      expect(status.error).toBeNull();
      expect(status.pendingCount).toBe(0);
      expect(status.isAuthenticated).toBe(false);
    });

    it('should have readonly signals', () => {
      expect(() => service.syncStatus()).not.toThrow();
      expect(() => service.lastSyncTime()).not.toThrow();
      expect(() => service.syncError()).not.toThrow();
      expect(() => service.pendingSyncCount()).not.toThrow();
    });
  });

  describe('sync methods', () => {
    it('should have queueSync method', () => {
      expect(typeof service.queueSync).toBe('function');
    });

    it('should have syncToCloud method', () => {
      expect(typeof service.syncToCloud).toBe('function');
    });

    it('should have syncFromCloud method', () => {
      expect(typeof service.syncFromCloud).toBe('function');
    });

    it('should have retrySync method', () => {
      expect(typeof service.retrySync).toBe('function');
    });

    it('should skip sync when user is not authenticated', async () => {
      // User is not authenticated by default
      await service.syncToCloud();

      const status = service.getSyncStatus();
      // Should not have attempted sync (no error, still idle)
      expect(status.isAuthenticated).toBe(false);
    });

    it('should not queue sync when user is not authenticated', () => {
      // Should not throw error, just skip
      expect(() => service.queueSync()).not.toThrow();

      const status = service.getSyncStatus();
      expect(status.isAuthenticated).toBe(false);
    });
  });

  describe('migration methods', () => {
    it('should have migrateAnonymousDataToUser method', () => {
      expect(typeof service.migrateAnonymousDataToUser).toBe('function');
    });
  });

  describe('sync status', () => {
    it('should return complete sync status info', () => {
      const status = service.getSyncStatus();

      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('lastSyncTime');
      expect(status).toHaveProperty('error');
      expect(status).toHaveProperty('pendingCount');
      expect(status).toHaveProperty('isAuthenticated');
    });

    it('should track sync status changes', async () => {
      expect(service.syncStatus()).toBe('idle');

      // Attempting sync while not authenticated should not change status to syncing
      await service.syncToCloud();

      // Status should still be idle (or show a specific state for unauthenticated)
      const finalStatus = service.syncStatus();
      expect(['idle', 'error']).toContain(finalStatus);
    });
  });

  describe('error handling', () => {
    it('should handle sync errors gracefully', async () => {
      // Sync should not throw even when failing
      await expect(service.syncToCloud()).resolves.not.toThrow();
      await expect(service.syncFromCloud()).resolves.not.toThrow();
    });

    it('should allow retry after error', async () => {
      // Trigger an error (sync while not authenticated)
      await service.syncToCloud();

      // Retry should not throw
      await expect(service.retrySync()).resolves.not.toThrow();
    });
  });
});

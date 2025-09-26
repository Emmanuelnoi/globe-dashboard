import { TestBed } from '@angular/core/testing';
import { UserStatsService } from './user-stats.service';

describe('UserStatsService', () => {
  let service: UserStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    // Test creation in an environment where IndexedDB might not be available
    expect(() => {
      service = TestBed.inject(UserStatsService);
    }).not.toThrow();
  });
});

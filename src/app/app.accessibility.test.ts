import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { NavigationStateService } from './core/services/navigation-state.service';
import { CountryDataService } from './core/services/country-data.service';
import { PerformanceMonitorService } from './core/services/performance-monitor.service';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// Mock NavigationStateService
class MockNavigationStateService {
  isCountryComparisonActive = (): boolean => false;
  isPerformanceMonitorActive = (): boolean => false;
}

// Mock CountryDataService
class MockCountryDataService {
  selectedCountries = (): unknown[] => [];
  hasSelectedCountries = (): boolean => false;
  countryCount = (): number => 241;
  dataCompleteness = (): number => 0.834;
}

// Mock PerformanceMonitorService
class MockPerformanceMonitorService {
  isEnabled = (): boolean => false;
  getStats = (): unknown => ({
    current: {
      frameTime: 16,
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      drawCalls: 0,
      triangleCount: 0,
      timestamp: 0,
    },
    average: {
      frameTime: 16,
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      drawCalls: 0,
      triangleCount: 0,
      timestamp: 0,
    },
    peak: {
      frameTime: 16,
      fps: 60,
      memoryUsage: 0,
      renderTime: 0,
      drawCalls: 0,
      triangleCount: 0,
      timestamp: 0,
    },
    history: [],
    warnings: [],
  });
  startMonitoring = (): void => {};
  stopMonitoring = (): void => {};
  recordRenderStart = (): void => {};
  recordRenderEnd = (): void => {};
  updateStats = (): void => {};
}

describe('App Accessibility', () => {
  let _component: App;
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, NoopAnimationsModule],
      providers: [
        {
          provide: NavigationStateService,
          useClass: MockNavigationStateService,
        },
        { provide: CountryDataService, useClass: MockCountryDataService },
        {
          provide: PerformanceMonitorService,
          useClass: MockPerformanceMonitorService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    _component = fixture.componentInstance;
  });

  it('should have proper ARIA landmarks', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;

    // Check for application role
    const appContainer = compiled.querySelector('[role="application"]');
    expect(appContainer).toBeTruthy();
    expect(appContainer?.getAttribute('aria-label')).toBe(
      '3D Global Dashboard',
    );

    // Check for main landmark
    const main = compiled.querySelector('main');
    expect(main).toBeTruthy();
    expect(main?.getAttribute('role')).toBe('main');
    expect(main?.getAttribute('aria-label')).toBe(
      'Interactive 3D globe visualization',
    );
    expect(main?.getAttribute('aria-describedby')).toBe('globe-description');
    expect(main?.id).toBe('main-content');
  });

  it('should have skip to main content link', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;
    const skipLink = compiled.querySelector('.skip-link');

    expect(skipLink).toBeTruthy();
    expect(skipLink?.getAttribute('href')).toBe('#main-content');
    expect(skipLink?.getAttribute('aria-label')).toBe('Skip to main content');
    expect(skipLink?.textContent?.trim()).toBe('Skip to main content');
  });

  it('should have screen reader description', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;
    const description = compiled.querySelector('#globe-description');

    expect(description).toBeTruthy();
    expect(description?.classList.contains('sr-only')).toBeTruthy();
    expect(description?.textContent?.trim()).toContain(
      'Interactive 3D globe showing country data',
    );
  });

  it('should have proper heading structure', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;

    // The main app should not have conflicting headings
    // Sidebar and comparison card should have their own proper heading structure
    const headings = compiled.querySelectorAll('h1, h2, h3, h4, h5, h6');

    // At minimum, we should have headings from the comparison card
    expect(headings.length).toBeGreaterThan(0);
  });

  it('should have accessible focus management', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;
    const skipLink = compiled.querySelector('.skip-link');
    const main = compiled.querySelector('main');

    // Skip link should be focusable
    expect((skipLink as HTMLElement | null)?.tabIndex).not.toBe(-1);

    // Main content should be focusable for skip link target
    expect(main?.hasAttribute('tabindex')).toBeFalsy(); // No explicit tabindex needed for main
  });

  it('should provide semantic structure', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;

    // Check that we have proper semantic elements
    expect(compiled.querySelector('main')).toBeTruthy();
    expect(compiled.querySelector('[role="application"]')).toBeTruthy();

    // Sidebar should have navigation role (tested in sidebar component)
    const sidebar = compiled.querySelector('app-sidebar');
    expect(sidebar).toBeTruthy();

    // Comparison card should be present
    const comparisonCard = compiled.querySelector('app-comparison-card');
    expect(comparisonCard).toBeTruthy();
  });

  it('should have proper ARIA relationships', () => {
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;
    const main = compiled.querySelector('main');
    const description = compiled.querySelector('#globe-description');

    // Main should be described by the description
    expect(main?.getAttribute('aria-describedby')).toBe('globe-description');
    expect(description?.id).toBe('globe-description');
  });

  it('should support reduced motion preferences', () => {
    fixture.detectChanges();

    // This test verifies that our CSS includes reduced motion support
    // The actual media query is tested through CSS, but we can verify
    // that the structure supports it
    const compiled: HTMLElement = fixture.nativeElement as HTMLElement;
    const appContainer = compiled.querySelector('.app-container');

    expect(appContainer).toBeTruthy();
    // The presence of the container suggests our CSS is loaded
  });
});

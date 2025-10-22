import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LoadingComponent,
  LoadingVariant,
  LoadingSize,
} from './loading.component';

describe('LoadingComponent', () => {
  let component: LoadingComponent;
  let fixture: ComponentFixture<LoadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display default spinner variant', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const spinner = compiled.querySelector('.spinner');
    const loadingText = compiled.querySelector('.loading-text');

    expect(spinner).toBeTruthy();
    expect(loadingText?.textContent?.trim()).toBe('Loading...');
  });

  it('should display globe variant with progress', () => {
    component.variant = 'globe';
    component.showProgress = true;
    component.progress = 50;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const globeSpinner = compiled.querySelector('.globe-spinner');
    const progressBar = compiled.querySelector('.progress-bar');
    const progressFill = compiled.querySelector('.progress-fill');
    const progressText = compiled.querySelector('.progress-text');

    expect(globeSpinner).toBeTruthy();
    expect(progressBar).toBeTruthy();
    expect(progressFill?.style.width).toBe('50%');
    expect(progressText?.textContent?.trim()).toBe('50%');
  });

  it('should display dots variant', () => {
    component.variant = 'dots';
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const dots = compiled.querySelectorAll('.dot');

    expect(dots.length).toBe(3);
  });

  it('should display skeleton variant', () => {
    component.variant = 'skeleton';
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const skeletonElements = compiled.querySelectorAll('.skeleton');

    expect(skeletonElements.length).toBe(3);
    expect(compiled.querySelector('.skeleton-title')).toBeTruthy();
    expect(compiled.querySelector('.skeleton-line')).toBeTruthy();
  });

  it('should display progress variant', () => {
    component.variant = 'progress';
    component.progress = 75;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const progressBar = compiled.querySelector('.progress-bar');
    const progressFill = compiled.querySelector('.progress-fill');
    const progressText = compiled.querySelector('.progress-text');

    expect(progressBar).toBeTruthy();
    expect(progressFill?.style.width).toBe('75%');
    expect(progressText?.textContent?.trim()).toBe('75%');
  });

  it('should apply size classes correctly', () => {
    // Test small size
    component.size = 'small';
    component.ngOnChanges(); // Trigger the class update
    fixture.detectChanges();

    let compiled = fixture.nativeElement;
    let container = compiled.querySelector('.loading-container');
    expect(container?.classList.contains('small')).toBeTruthy();

    // Test large size
    component.size = 'large';
    component.ngOnChanges(); // Trigger the class update
    fixture.detectChanges();

    compiled = fixture.nativeElement;
    container = compiled.querySelector('.loading-container');
    expect(container?.classList.contains('large')).toBeTruthy();
  });

  it('should apply fullscreen class when enabled', () => {
    component.fullscreen = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const container = compiled.querySelector('.loading-container');

    expect(container?.classList.contains('fullscreen')).toBeTruthy();
  });

  it('should apply overlay class when enabled', () => {
    component.overlay = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const container = compiled.querySelector('.loading-container');

    expect(container?.classList.contains('overlay')).toBeTruthy();
  });

  it('should hide text when showText is false', () => {
    component.showText = false;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const loadingText = compiled.querySelector('.loading-text');

    expect(loadingText).toBeFalsy();
  });

  it('should display custom loading text', () => {
    component.loadingText = 'Custom loading message';
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const loadingText = compiled.querySelector('.loading-text');

    expect(loadingText?.textContent?.trim()).toBe('Custom loading message');
  });

  it('should hide progress when showProgress is false', () => {
    component.variant = 'globe';
    component.showProgress = false;
    component.progress = 50;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const progressBar = compiled.querySelector('.progress-bar');

    expect(progressBar).toBeFalsy();
  });

  it('should have proper accessibility attributes', () => {
    component.loadingText = 'Loading globe data';
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const container = compiled.querySelector('.loading-container');

    expect(container?.getAttribute('aria-label')).toBe('Loading globe data');
    expect(container?.getAttribute('role')).toBe('status');
  });

  it('should update classes when inputs change', () => {
    // Initial state
    component.size = 'small';
    component.overlay = false;
    fixture.detectChanges();

    let compiled = fixture.nativeElement;
    let container = compiled.querySelector('.loading-container');
    expect(container?.classList.contains('small')).toBeTruthy();
    expect(container?.classList.contains('overlay')).toBeFalsy();

    // Change inputs
    component.size = 'large';
    component.overlay = true;
    component.ngOnChanges();
    fixture.detectChanges();

    compiled = fixture.nativeElement;
    container = compiled.querySelector('.loading-container');
    expect(container?.classList.contains('large')).toBeTruthy();
    expect(container?.classList.contains('overlay')).toBeTruthy();
    expect(container?.classList.contains('small')).toBeFalsy();
  });

  it('should handle null progress value', () => {
    component.variant = 'progress';
    component.progress = null;
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const progressFill = compiled.querySelector('.progress-fill');
    const progressText = compiled.querySelector('.progress-text');

    expect(progressFill?.style.width).toBe('0%');
    expect(progressText).toBeFalsy();
  });

  it('should display all variants correctly', () => {
    const variants: LoadingVariant[] = [
      'spinner',
      'globe',
      'dots',
      'skeleton',
      'progress',
    ];

    variants.forEach((variant) => {
      // Create a fresh fixture for each variant to avoid state pollution
      const newFixture = TestBed.createComponent(LoadingComponent);
      const newComponent = newFixture.componentInstance;

      // Set variant and required properties
      newComponent.variant = variant;
      newComponent.progress = 50;
      newComponent.showProgress = true;
      newFixture.detectChanges();

      const compiled = newFixture.nativeElement;
      const container = compiled.querySelector('.loading-container');

      expect(container).toBeTruthy();

      // Check for variant-specific elements
      switch (variant) {
        case 'spinner':
          const spinner = compiled.querySelector('.spinner');
          expect(spinner).toBeTruthy();
          break;
        case 'globe':
          const globeSpinner = compiled.querySelector('.globe-spinner');
          expect(globeSpinner).toBeTruthy();
          break;
        case 'dots':
          const dots = compiled.querySelectorAll('.dot');
          expect(dots.length).toBe(3);
          break;
        case 'skeleton':
          const skeletonElements = compiled.querySelectorAll('.skeleton');
          expect(skeletonElements.length).toBe(3);
          break;
        case 'progress':
          const progressBar = compiled.querySelector('.progress-bar');
          expect(progressBar).toBeTruthy();
          break;
      }

      // Clean up
      newFixture.destroy();
    });
  });

  it('should apply correct size classes for all variants', () => {
    const sizes: LoadingSize[] = ['small', 'medium', 'large'];

    sizes.forEach((size) => {
      component.size = size;
      component.ngOnChanges(); // Trigger the class update
      fixture.detectChanges();

      const compiled = fixture.nativeElement;
      const container = compiled.querySelector('.loading-container');

      if (size !== 'medium') {
        // medium is default, no class applied
        expect(container?.classList.contains(size)).toBeTruthy();
      }
    });
  });
});

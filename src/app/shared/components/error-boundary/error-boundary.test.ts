import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ErrorBoundaryComponent, ErrorInfo } from './error-boundary.component';

describe('ErrorBoundaryComponent', () => {
  let component: ErrorBoundaryComponent;
  let fixture: ComponentFixture<ErrorBoundaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ErrorBoundaryComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ErrorBoundaryComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display content when no error', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const errorContainer = compiled.querySelector('.error-boundary-container');

    expect(errorContainer).toBeFalsy();
    expect(component['hasError']()).toBeFalsy();
  });

  it('should handle error and display error boundary', () => {
    const testError = new Error('Test error message');

    component.handleError(testError);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const errorContainer = compiled.querySelector('.error-boundary-container');
    const errorTitle = compiled.querySelector('.error-title');

    expect(errorContainer).toBeTruthy();
    expect(errorTitle?.textContent).toContain('Something went wrong');
    expect(component['hasError']()).toBeTruthy();
    expect(component['errorInfo']()?.message).toBe('Test error message');
  });

  it('should handle custom error info', () => {
    const customErrorInfo: ErrorInfo = {
      message: 'Custom error',
      stack: 'Error stack trace',
      timestamp: new Date(),
      userAgent: 'test-agent',
      url: 'test-url',
    };

    component.handleError(customErrorInfo);
    fixture.detectChanges();

    expect(component['hasError']()).toBeTruthy();
    expect(component['errorInfo']()?.message).toBe('Custom error');
    expect(component['errorInfo']()?.stack).toBe('Error stack trace');
  });

  it('should reset error state when retry is called', () => {
    vi.useFakeTimers();
    const testError = new Error('Test error');

    component.handleError(testError);
    expect(component['hasError']()).toBeTruthy();

    component.retry();

    vi.advanceTimersByTime(1100);
    expect(component['hasError']()).toBeFalsy();
    expect(component['errorInfo']()).toBeNull();
    vi.useRealTimers();
  });

  it('should emit retry event when retry is called', () => {
    vi.spyOn(component.onRetry, 'emit');

    component.retry();

    expect(component.onRetry.emit).toHaveBeenCalled();
  });

  it('should emit reload event when reload is called', () => {
    vi.spyOn(component.onReload, 'emit');

    // Note: We can't easily mock window.location.reload in jsdom
    // So we'll just test that the event is emitted
    // The actual reload call is tested in E2E tests
    try {
      component.reload();
    } catch (e) {
      // Ignore errors from window.location.reload in test environment
    }

    expect(component.onReload.emit).toHaveBeenCalled();
  });

  it('should emit report event when reportError is called', () => {
    const testError = new Error('Test error');
    vi.spyOn(component.onReport, 'emit');
    vi.spyOn(window, 'open');

    component.handleError(testError);
    component.reportError();

    expect(component.onReport.emit).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalled();
  });

  it('should display retry button', () => {
    const testError = new Error('Test error');

    component.handleError(testError);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const retryButton = compiled.querySelector('.btn-primary');

    expect(retryButton).toBeTruthy();
    expect(retryButton?.textContent?.trim()).toBe('Try Again');
  });

  it('should display reload button', () => {
    const testError = new Error('Test error');

    component.handleError(testError);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const reloadButton = compiled.querySelector('.btn-secondary');

    expect(reloadButton).toBeTruthy();
    expect(reloadButton?.textContent?.trim()).toBe('Reload Page');
  });

  it('should show error details when showDetails is true', () => {
    component.showDetails = true;
    const testError = new Error('Test error with stack');

    component.handleError(testError);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const details = compiled.querySelector('.error-details');

    expect(details).toBeTruthy();
  });

  it('should hide error details when showDetails is false', () => {
    component.showDetails = false;
    const testError = new Error('Test error');

    component.handleError(testError);
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    const details = compiled.querySelector('.error-details');

    expect(details).toBeFalsy();
  });

  it('should handle auto-retry when enabled', () => {
    vi.useFakeTimers();
    component.autoRetry = true;
    component.retryDelay = 100; // Short delay for testing

    const retrySpy = vi.spyOn(component, 'retry');

    const testError = new Error('Test error');
    component.handleError(testError);

    vi.advanceTimersByTime(150);
    expect(retrySpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should track retry count', () => {
    expect(component['retryCount']()).toBe(0);

    component.retry();
    expect(component['retryCount']()).toBe(1);

    component.retry();
    expect(component['retryCount']()).toBe(2);
  });

  it('should reset retry count when reset is called', () => {
    component.retry();
    component.retry();
    expect(component['retryCount']()).toBe(2);

    component.reset();
    expect(component['retryCount']()).toBe(0);
    expect(component['hasError']()).toBeFalsy();
  });
});

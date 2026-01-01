import { Injectable, signal, computed, inject } from '@angular/core';
import { LoggerService } from './logger.service';

export interface TouchFeedbackOptions {
  readonly type:
    | 'light'
    | 'medium'
    | 'heavy'
    | 'selection'
    | 'impact'
    | 'notification';
  readonly pattern?: readonly number[]; // For custom vibration patterns
  readonly fallbackDuration?: number; // Fallback vibration duration in ms
}

export interface SwipeGestureEvent {
  readonly direction: 'left' | 'right' | 'up' | 'down';
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly distance: number;
  readonly duration: number;
  readonly velocity: number;
}

export interface MobileCapabilities {
  readonly hasHapticFeedback: boolean;
  readonly hasVibration: boolean;
  readonly isTouchDevice: boolean;
  readonly isIOSDevice: boolean;
  readonly isAndroidDevice: boolean;
  readonly supportsPinchZoom: boolean;
  readonly supportsOrientationChange: boolean;
  readonly screenSize: 'small' | 'medium' | 'large';
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

/**
 * Mobile Touch Service - Sprint BM2-T9
 * Provides haptic feedback, touch utilities, and mobile device detection
 */
@Injectable({
  providedIn: 'root',
})
export class MobileTouchService {
  // Logger service
  private readonly logger = inject(LoggerService);

  // Device capability signals
  private readonly _capabilities = signal<MobileCapabilities>(
    this.detectCapabilities(),
  );
  private readonly _isVirtualKeyboardOpen = signal<boolean>(false);
  private readonly _orientation = signal<'portrait' | 'landscape'>('portrait');

  // Public readonly signals
  readonly capabilities = this._capabilities.asReadonly();
  readonly isVirtualKeyboardOpen = this._isVirtualKeyboardOpen.asReadonly();
  readonly orientation = this._orientation.asReadonly();

  // Computed properties
  readonly isMobile = computed(() => this.capabilities().isTouchDevice);
  readonly isSmallScreen = computed(
    () => this.capabilities().screenSize === 'small',
  );
  readonly canUseHaptics = computed(
    () =>
      this.capabilities().hasHapticFeedback || this.capabilities().hasVibration,
  );

  constructor() {
    this.initializeEventListeners();
  }

  /**
   * Provide haptic feedback
   */
  hapticFeedback(options: TouchFeedbackOptions = { type: 'light' }): void {
    if (!this.canUseHaptics()) {
      return;
    }

    try {
      // Try modern Haptic Feedback API first (iOS Safari 16.4+)
      if (
        'DeviceMotionEvent' in window &&
        typeof DeviceMotionEvent === 'function' &&
        'requestPermission' in DeviceMotionEvent
      ) {
        this.tryIOSHapticFeedback(options.type);
        return;
      }

      // Try Android Chrome Haptic API
      if ('vibrate' in navigator) {
        this.tryVibrationAPI(options);
        return;
      }

      // Try Web Vibration API
      if ('vibrate' in navigator) {
        const pattern =
          options.pattern || this.getVibrationPattern(options.type);
        (navigator as any).vibrate(pattern);
      }
    } catch (error) {
      this.logger.debug(
        'Haptic feedback not available',
        'MobileTouchService',
        error,
      );
    }
  }

  /**
   * Detect swipe gestures
   */
  detectSwipeGesture(
    element: HTMLElement,
    callback: (event: SwipeGestureEvent) => void,
    options: {
      minDistance?: number;
      maxTime?: number;
      threshold?: number;
    } = {},
  ): () => void {
    const { minDistance = 50, maxTime = 300, threshold = 30 } = options;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance >= minDistance && deltaTime <= maxTime) {
        const velocity = distance / deltaTime;

        let direction: SwipeGestureEvent['direction'];

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          direction = deltaX > 0 ? 'right' : 'left';
        } else {
          direction = deltaY > 0 ? 'down' : 'up';
        }

        callback({
          direction,
          startX,
          startY,
          endX,
          endY,
          distance,
          duration: deltaTime,
          velocity,
        });
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }

  /**
   * Handle virtual keyboard detection
   */
  onVirtualKeyboardChange(callback: (isOpen: boolean) => void): () => void {
    const initialViewportHeight =
      window.visualViewport?.height || window.innerHeight;

    const handleViewportChange = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDifference = initialViewportHeight - currentHeight;
      const isKeyboardOpen = heightDifference > 150; // Threshold for keyboard detection

      this._isVirtualKeyboardOpen.set(isKeyboardOpen);
      callback(isKeyboardOpen);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () =>
        window.visualViewport?.removeEventListener(
          'resize',
          handleViewportChange,
        );
    } else {
      window.addEventListener('resize', handleViewportChange);
      return () => window.removeEventListener('resize', handleViewportChange);
    }
  }

  /**
   * Optimize for touch interactions
   */
  optimizeElementForTouch(element: HTMLElement): void {
    // Add touch-action optimization
    element.style.touchAction = 'manipulation';

    // Add user-select prevention for better touch experience
    element.style.webkitUserSelect = 'none';
    element.style.userSelect = 'none';

    // Add webkit-tap-highlight-color for iOS
    (element.style as any).webkitTapHighlightColor = 'transparent';

    // Add optimal cursor for touch devices
    if (this.isMobile()) {
      element.style.cursor = 'pointer';
    }
  }

  /**
   * Get optimal touch target size
   */
  getOptimalTouchTargetSize(baseSize: number): number {
    const capabilities = this.capabilities();

    if (!capabilities.isTouchDevice) {
      return baseSize;
    }

    // iOS Human Interface Guidelines: 44pt minimum
    // Android Material Design: 48dp minimum
    const minTouchTarget = capabilities.isIOSDevice ? 44 : 48;

    return Math.max(baseSize, minTouchTarget);
  }

  /**
   * Check if device supports pull-to-refresh
   */
  supportsPullToRefresh(): boolean {
    return this.isMobile() && 'onscroll' in window;
  }

  /**
   * Prevent overscroll behavior
   */
  preventOverscroll(element: HTMLElement): void {
    element.style.overscrollBehavior = 'contain';
    (element.style as any).webkitOverflowScrolling = 'touch';
  }

  /**
   * Get safe area insets for modern devices
   */
  getSafeAreaInsets(): {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } {
    const computedStyle = getComputedStyle(document.documentElement);

    return {
      top: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0',
      ),
      right: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0',
      ),
      bottom: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0',
      ),
      left: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0',
      ),
    };
  }

  // Private methods

  private detectCapabilities(): MobileCapabilities {
    const userAgent = navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroidDevice = /Android/.test(userAgent);
    const isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let screenSize: 'small' | 'medium' | 'large' = 'large';
    if (viewportWidth <= 480) {
      screenSize = 'small';
    } else if (viewportWidth <= 768) {
      screenSize = 'medium';
    }

    return {
      hasHapticFeedback: isIOSDevice && 'DeviceMotionEvent' in window,
      hasVibration: 'vibrate' in navigator,
      isTouchDevice,
      isIOSDevice,
      isAndroidDevice,
      supportsPinchZoom: isTouchDevice && 'ongesturestart' in window,
      supportsOrientationChange: 'orientation' in window,
      screenSize,
      viewportHeight,
      viewportWidth,
    };
  }

  private initializeEventListeners(): void {
    // Update capabilities on resize
    window.addEventListener('resize', () => {
      this._capabilities.set(this.detectCapabilities());
    });

    // Track orientation changes
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', () => {
        this._orientation.set(
          window.screen.orientation.angle === 0 ||
            window.screen.orientation.angle === 180
            ? 'portrait'
            : 'landscape',
        );
      });
    } else {
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          this._orientation.set(
            window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
          );
        }, 100);
      });
    }
  }

  private tryIOSHapticFeedback(type: TouchFeedbackOptions['type']): void {
    // iOS Safari 16.4+ Web Haptics API
    interface WindowWithHaptics extends Window {
      HapticFeedback?: {
        impact?: (type: string) => void;
      };
    }

    if ('HapticFeedback' in window) {
      const hapticMap = {
        light: 'impact',
        medium: 'impact',
        heavy: 'impact',
        selection: 'selection',
        impact: 'impact',
        notification: 'notification',
      };

      const hapticWindow = window as WindowWithHaptics;
      hapticWindow.HapticFeedback?.impact?.(hapticMap[type] || 'impact');
    }
  }

  private tryVibrationAPI(options: TouchFeedbackOptions): void {
    if ('vibrate' in navigator) {
      const pattern = options.pattern || this.getVibrationPattern(options.type);
      navigator.vibrate(pattern);
    }
  }

  private getVibrationPattern(type: TouchFeedbackOptions['type']): number[] {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      selection: [5],
      impact: [15],
      notification: [50, 50, 50],
    };

    return patterns[type] || patterns.light;
  }
}

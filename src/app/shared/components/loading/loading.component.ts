import { Component, Input, signal, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LoadingVariant =
  | 'spinner'
  | 'globe'
  | 'dots'
  | 'skeleton'
  | 'progress';
export type LoadingSize = 'small' | 'medium' | 'large';

@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="loading-container"
      [class]="containerClasses()"
      [attr.aria-label]="loadingText"
      role="status"
    >
      @switch (variant) {
        @case ('spinner') {
          <div class="spinner-container">
            <div class="spinner"></div>
            @if (showText) {
              <p class="loading-text">{{ loadingText }}</p>
            }
          </div>
        }
        @case ('globe') {
          <div class="globe-container">
            <div class="globe-spinner">
              <div class="globe-sphere"></div>
              <div class="globe-ring"></div>
            </div>
            @if (showText) {
              <p class="loading-text">{{ loadingText }}</p>
            }
            @if (showProgress && progress !== null) {
              <div class="progress-bar">
                <div class="progress-fill" [style.width.%]="progress"></div>
              </div>
              <p class="progress-text">{{ progress }}%</p>
            }
          </div>
        }
        @case ('dots') {
          <div class="dots-container">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
            @if (showText) {
              <p class="loading-text">{{ loadingText }}</p>
            }
          </div>
        }
        @case ('skeleton') {
          <div class="skeleton-container">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
          </div>
        }
        @case ('progress') {
          <div class="progress-container">
            @if (showText) {
              <p class="loading-text">{{ loadingText }}</p>
            }
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="progress || 0"></div>
            </div>
            @if (progress !== null) {
              <p class="progress-text">{{ progress }}%</p>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 200px;
        color: #f8fafc;
      }

      .loading-container.fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(30, 30, 46, 0.95);
        backdrop-filter: blur(10px);
        z-index: 9999;
        min-height: 100vh;
      }

      .loading-container.overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        z-index: 100;
      }

      .loading-container.inline {
        position: relative;
        min-height: auto;
        padding: 1rem;
      }

      /* Spinner Variant */
      .spinner-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(59, 130, 246, 0.3);
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .loading-container.small .spinner {
        width: 24px;
        height: 24px;
        border-width: 2px;
      }

      .loading-container.large .spinner {
        width: 60px;
        height: 60px;
        border-width: 4px;
      }

      /* Globe Variant */
      .globe-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
      }

      .globe-spinner {
        position: relative;
        width: 60px;
        height: 60px;
      }

      .globe-sphere {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border-radius: 50%;
        animation: globePulse 2s ease-in-out infinite;
        box-shadow:
          0 0 20px rgba(59, 130, 246, 0.5),
          inset 0 0 20px rgba(255, 255, 255, 0.2);
      }

      .globe-ring {
        position: absolute;
        top: -10px;
        left: -10px;
        right: -10px;
        bottom: -10px;
        border: 2px solid rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: globeRotate 3s linear infinite;
      }

      .loading-container.small .globe-spinner {
        width: 40px;
        height: 40px;
      }

      .loading-container.large .globe-spinner {
        width: 80px;
        height: 80px;
      }

      /* Dots Variant */
      .dots-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }

      .dots-container > div:first-child {
        display: flex;
        gap: 0.5rem;
      }

      .dot {
        width: 8px;
        height: 8px;
        background: #3b82f6;
        border-radius: 50%;
        animation: dotBounce 1.4s ease-in-out infinite both;
      }

      .dot:nth-child(1) {
        animation-delay: -0.32s;
      }
      .dot:nth-child(2) {
        animation-delay: -0.16s;
      }
      .dot:nth-child(3) {
        animation-delay: 0s;
      }

      .loading-container.small .dot {
        width: 6px;
        height: 6px;
      }

      .loading-container.large .dot {
        width: 12px;
        height: 12px;
      }

      /* Skeleton Variant */
      .skeleton-container {
        width: 100%;
        max-width: 300px;
        padding: 1rem;
      }

      .skeleton {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.1),
          rgba(255, 255, 255, 0.2),
          rgba(255, 255, 255, 0.1)
        );
        background-size: 200% 100%;
        animation: skeletonShimmer 1.5s ease-in-out infinite;
        border-radius: 4px;
        margin-bottom: 0.75rem;
      }

      .skeleton-title {
        height: 24px;
        width: 60%;
      }

      .skeleton-line {
        height: 16px;
        width: 100%;
      }

      .skeleton-line.short {
        width: 40%;
      }

      /* Progress Variant */
      .progress-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        width: 100%;
        max-width: 300px;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #1d4ed8);
        border-radius: 4px;
        transition: width 0.3s ease;
        animation: progressShimmer 2s ease-in-out infinite;
      }

      /* Text Styles */
      .loading-text {
        margin: 0;
        font-size: 1rem;
        color: #cbd5e1;
        text-align: center;
        font-weight: 500;
      }

      .progress-text {
        margin: 0;
        font-size: 0.875rem;
        color: #94a3b8;
        font-weight: 600;
      }

      .loading-container.small .loading-text {
        font-size: 0.875rem;
      }

      .loading-container.large .loading-text {
        font-size: 1.125rem;
      }

      /* Animations */
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes globePulse {
        0%,
        100% {
          transform: scale(1);
          opacity: 1;
        }
        50% {
          transform: scale(1.05);
          opacity: 0.8;
        }
      }

      @keyframes globeRotate {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes dotBounce {
        0%,
        80%,
        100% {
          transform: scale(0);
          opacity: 0.5;
        }
        40% {
          transform: scale(1);
          opacity: 1;
        }
      }

      @keyframes skeletonShimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }

      @keyframes progressShimmer {
        0% {
          box-shadow: 0 0 0 rgba(59, 130, 246, 0.5);
        }
        50% {
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
        }
        100% {
          box-shadow: 0 0 0 rgba(59, 130, 246, 0.5);
        }
      }

      /* Responsive Design */
      @media (max-width: 480px) {
        .loading-container {
          min-height: 150px;
        }

        .progress-container,
        .skeleton-container {
          max-width: 250px;
        }
      }

      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        .spinner,
        .globe-ring,
        .dot,
        .skeleton,
        .progress-fill {
          animation: none;
        }

        .globe-sphere {
          animation: none;
        }
      }
    `,
  ],
})
export class LoadingComponent implements OnInit, OnChanges {
  // Input properties
  @Input() variant: LoadingVariant = 'spinner';
  @Input() size: LoadingSize = 'medium';
  @Input() loadingText: string = 'Loading...';
  @Input() showText: boolean = true;
  @Input() showProgress: boolean = false;
  @Input() progress: number | null = null;
  @Input() fullscreen: boolean = false;
  @Input() overlay: boolean = false;

  // Computed classes
  protected containerClasses = signal('');

  ngOnInit(): void {
    this.updateContainerClasses();
  }

  ngOnChanges(): void {
    this.updateContainerClasses();
  }

  private updateContainerClasses(): void {
    const classes = [
      this.size,
      this.fullscreen ? 'fullscreen' : '',
      this.overlay ? 'overlay' : '',
      !this.fullscreen && !this.overlay ? 'inline' : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.containerClasses.set(classes);
  }
}

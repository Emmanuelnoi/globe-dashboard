/**
 * Timeline Scrubber Component
 * Interactive temporal controls for bird migration visualization
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  viewChild,
  ElementRef,
  HostListener,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  TimelineState,
  PlaybackSpeed,
  DateRange,
  MigrationPreview,
  AnimationConfig,
} from '../../models/ui.models';

export interface TimelineEvent {
  readonly type: 'play' | 'pause' | 'seek' | 'speed';
  readonly progress?: number; // 0-1 for seek events
  readonly speed?: PlaybackSpeed; // for speed events
  readonly timestamp: Date;
}

export interface TimelineMarker {
  readonly id: string;
  readonly date: Date;
  readonly progress: number; // 0-1 position on timeline
  readonly label: string;
  readonly type: 'peak' | 'event' | 'season';
  readonly color: string;
}

@Component({
  selector: 'app-timeline-scrubber',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="timeline-scrubber"
      [class.playing]="isPlaying()"
      [class.disabled]="disabled()"
      role="region"
      aria-label="Migration timeline controls"
    >
      <!-- Timeline Header -->
      <div class="timeline-header">
        <div class="timeline-info">
          <h4 class="timeline-title">Migration Timeline</h4>
          <div class="timeline-dates" aria-live="polite" role="status">
            <span class="start-date" aria-label="Start date">{{
              formatDate(dateRange().startDate)
            }}</span>
            <span class="current-date" aria-label="Current date">{{
              formatDate(currentDate())
            }}</span>
            <span class="end-date" aria-label="End date">{{
              formatDate(dateRange().endDate)
            }}</span>
          </div>
        </div>

        <div class="timeline-stats" *ngIf="preview()">
          <span class="data-points"
            >{{ preview()!.totalPoints.toLocaleString() }} observations</span
          >
          <span
            class="quality-indicator"
            [class]="'quality-' + preview()!.quality"
          >
            {{ preview()!.quality }}
          </span>
        </div>
      </div>

      <!-- Main Timeline -->
      <div class="timeline-container">
        <!-- Timeline Track -->
        <div
          class="timeline-track"
          #timelineTrack
          (mousedown)="onTrackMouseDown($event)"
          (touchstart)="onTrackTouchStart($event)"
          role="slider"
          [attr.aria-valuenow]="Math.round(progress() * 100)"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="100"
          [attr.aria-label]="
            'Timeline position: ' + Math.round(progress() * 100) + '%'
          "
        >
          <!-- Background Track -->
          <div class="track-background"></div>

          <!-- Data Histogram -->
          <div class="timeline-histogram" *ngIf="preview()?.histogram">
            @for (point of preview()!.histogram; track point.date) {
              <div
                class="histogram-bar"
                [style.left.%]="getHistogramPosition(point.date)"
                [style.height.%]="point.density * 100"
                [attr.title]="getHistogramTooltip(point)"
              ></div>
            }
          </div>

          <!-- Timeline Markers -->
          <div
            class="timeline-markers"
            role="group"
            aria-label="Timeline markers"
          >
            @for (marker of timelineMarkers(); track marker.id) {
              <div
                class="timeline-marker"
                [class]="'marker-' + marker.type"
                [style.left.%]="marker.progress * 100"
                [attr.title]="marker.label"
                [style.background-color]="marker.color"
                role="button"
                tabindex="0"
                [attr.aria-label]="'Jump to ' + marker.label"
                (click)="seekToMarker(marker)"
                (keydown)="onMarkerKeyDown($event, marker)"
              >
                <div class="marker-label">{{ marker.label }}</div>
              </div>
            }
          </div>

          <!-- Progress Fill -->
          <div class="track-progress" [style.width.%]="progress() * 100"></div>

          <!-- Scrubber Handle -->
          <div
            class="scrubber-handle"
            [style.left.%]="progress() * 100"
            [class.dragging]="isDragging()"
            tabindex="0"
            role="slider"
            [attr.aria-valuenow]="Math.round(progress() * 100)"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="100"
            [attr.aria-valuetext]="
              formatDate(currentDate()) +
              ' (' +
              Math.round(progress() * 100) +
              '% through timeline)'
            "
            [attr.aria-label]="
              'Timeline scrubber. Current position: ' +
              formatDate(currentDate())
            "
            (keydown)="onHandleKeyDown($event)"
            (focus)="onHandleFocus()"
            (blur)="onHandleBlur()"
          >
            <div class="handle-indicator"></div>
            <div
              class="handle-tooltip"
              *ngIf="showTooltip()"
              role="tooltip"
              [attr.aria-live]="isDragging() ? 'polite' : null"
            >
              {{ formatDate(currentDate()) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Control Panel -->
      <div class="timeline-controls">
        <!-- Playback Controls -->
        <div class="playback-controls">
          <button
            type="button"
            class="control-btn play-pause-btn"
            [class.playing]="isPlaying()"
            [disabled]="disabled()"
            (click)="togglePlayback()"
            [attr.aria-label]="
              isPlaying() ? 'Pause animation' : 'Play animation'
            "
          >
            <div class="btn-icon">
              @if (isPlaying()) {
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <polygon points="5,3 19,12 5,21"></polygon>
                </svg>
              }
            </div>
          </button>

          <button
            type="button"
            class="control-btn reset-btn"
            [disabled]="disabled() || progress() === 0"
            (click)="resetTimeline()"
            aria-label="Reset to beginning"
          >
            <div class="btn-icon">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M3 13c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9c-2.87 0-5.4-1.34-7.07-3.43l1.46-1.46C7.1 19.31 9.44 20.5 12 20.5c3.59 0 6.5-2.91 6.5-6.5S15.59 6.5 12 6.5 5.5 9.41 5.5 13H8l-3.5 3.5L1 13h2z"
                />
              </svg>
            </div>
          </button>
        </div>

        <!-- Speed Controls -->
        <div class="speed-controls">
          <span class="speed-label">Speed:</span>
          @for (speed of playbackSpeeds; track speed) {
            <button
              type="button"
              class="speed-btn"
              [class.active]="currentSpeed() === speed"
              [disabled]="disabled()"
              (click)="setPlaybackSpeed(speed)"
              [attr.aria-label]="'Set speed to ' + speed + 'x'"
            >
              {{ speed }}x
            </button>
          }
        </div>

        <!-- Additional Controls -->
        <div class="additional-controls">
          <button
            type="button"
            class="control-btn loop-btn"
            [class.active]="loopEnabled()"
            [disabled]="disabled()"
            (click)="toggleLoop()"
            [attr.aria-label]="loopEnabled() ? 'Disable loop' : 'Enable loop'"
          >
            <div class="btn-icon">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
                />
              </svg>
            </div>
          </button>

          <div class="timeline-progress-text" aria-live="polite">
            {{ Math.round(progress() * 100) }}%
          </div>
        </div>
      </div>

      <!-- Loading Overlay -->
      @if (isLoading()) {
        <div class="timeline-loading">
          <div class="loading-spinner"></div>
          <span>Preparing timeline...</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .timeline-scrubber {
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 20px;
        color: #fff;
        user-select: none;
        transition: all 0.3s ease;
      }

      .timeline-scrubber.disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      .timeline-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
      }

      .timeline-title {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: #0ff;
      }

      .timeline-dates {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #aaa;
      }

      .current-date {
        color: #0ff !important;
        font-weight: 500;
      }

      .timeline-stats {
        text-align: right;
        font-size: 12px;
      }

      .data-points {
        display: block;
        color: #ccc;
        margin-bottom: 4px;
      }

      .quality-indicator {
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
      }

      .quality-excellent {
        background: #28a745;
        color: white;
      }
      .quality-good {
        background: #6f42c1;
        color: white;
      }
      .quality-fair {
        background: #fd7e14;
        color: white;
      }
      .quality-poor {
        background: #dc3545;
        color: white;
      }

      .timeline-container {
        margin-bottom: 24px;
        position: relative;
      }

      .timeline-track {
        position: relative;
        height: 60px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        cursor: pointer;
        overflow: hidden;
      }

      .track-background {
        position: absolute;
        top: 50%;
        left: 0;
        right: 0;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-50%);
        border-radius: 2px;
      }

      .timeline-histogram {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 30px;
        pointer-events: none;
      }

      .histogram-bar {
        position: absolute;
        bottom: 0;
        width: 2px;
        background: rgba(0, 255, 255, 0.6);
        border-radius: 1px 1px 0 0;
        transition: opacity 0.2s ease;
      }

      .timeline-markers {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 100%;
        pointer-events: none;
      }

      .timeline-marker {
        position: absolute;
        top: 50%;
        width: 2px;
        height: 20px;
        transform: translateY(-50%);
        border-radius: 1px;
      }

      .marker-peak {
        background: #ff6b6b !important;
      }
      .marker-event {
        background: #4ecdc4 !important;
      }
      .marker-season {
        background: #45b7d1 !important;
      }

      .marker-label {
        position: absolute;
        top: -25px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        white-space: nowrap;
        background: rgba(0, 0, 0, 0.8);
        padding: 2px 6px;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .timeline-marker:hover .marker-label {
        opacity: 1;
      }

      .track-progress {
        position: absolute;
        top: 50%;
        left: 0;
        height: 4px;
        background: linear-gradient(90deg, #0ff, #00d4ff);
        transform: translateY(-50%);
        border-radius: 2px;
        transition: width 0.1s ease;
      }

      .scrubber-handle {
        position: absolute;
        top: 50%;
        width: 20px;
        height: 20px;
        background: #0ff;
        border: 2px solid #fff;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        cursor: grab;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0, 255, 255, 0.4);
      }

      .scrubber-handle:hover,
      .scrubber-handle:focus {
        transform: translate(-50%, -50%) scale(1.2);
        box-shadow: 0 4px 16px rgba(0, 255, 255, 0.6);
      }

      .scrubber-handle.dragging {
        cursor: grabbing;
        transform: translate(-50%, -50%) scale(1.3);
      }

      .handle-indicator {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: radial-gradient(circle, #fff 30%, transparent 30%);
        animation: pulse 2s infinite;
      }

      .timeline-scrubber.playing .handle-indicator {
        animation: pulse 1s infinite;
      }

      .handle-tooltip {
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        pointer-events: none;
      }

      .timeline-controls {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 20px;
        align-items: center;
      }

      .playback-controls {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .control-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        padding: 8px;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .control-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .play-pause-btn.playing {
        background: rgba(0, 255, 255, 0.2);
        border-color: #0ff;
        color: #0ff;
      }

      .control-btn.active {
        background: rgba(0, 255, 255, 0.2);
        border-color: #0ff;
        color: #0ff;
      }

      .btn-icon svg {
        fill: currentColor;
      }

      .speed-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
      }

      .speed-label {
        font-size: 12px;
        color: #aaa;
        margin-right: 4px;
      }

      .speed-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        padding: 4px 8px;
        color: #fff;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 32px;
      }

      .speed-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
      }

      .speed-btn.active {
        background: rgba(0, 255, 255, 0.2);
        border-color: #0ff;
        color: #0ff;
      }

      .additional-controls {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .timeline-progress-text {
        font-size: 12px;
        color: #0ff;
        font-weight: 500;
        min-width: 40px;
        text-align: center;
      }

      .timeline-loading {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        border-radius: 12px;
      }

      .loading-spinner {
        width: 24px;
        height: 24px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid #0ff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      /* Enhanced Mobile Responsiveness - Sprint BM2-T9 */
      @media (max-width: 1024px) {
        .timeline-scrubber {
          padding: 18px;
        }

        .timeline-track {
          height: 48px;
        }

        .scrubber-handle {
          width: 22px;
          height: 22px;
        }
      }

      @media (max-width: 768px) {
        .timeline-scrubber {
          padding: 14px;
          border-radius: 12px;
          /* Enhanced mobile backdrop filter */
          backdrop-filter: blur(16px) saturate(1.15);
          -webkit-backdrop-filter: blur(16px) saturate(1.15);
        }

        .timeline-header {
          flex-direction: column;
          gap: 10px;
          align-items: stretch;
        }

        .timeline-title {
          font-size: 16px;
          margin: 0;
        }

        .timeline-dates {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 11px;
        }

        .timeline-stats {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          font-size: 12px;
        }

        .timeline-track {
          height: 56px;
          margin: 16px 0;
          /* Enhanced touch area */
          padding: 8px 0;
          border-radius: 8px;
        }

        .track-background {
          border-radius: 6px;
        }

        .track-progress {
          border-radius: 6px;
        }

        .scrubber-handle {
          width: 28px;
          height: 28px;
          /* Enhanced mobile shadows */
          box-shadow:
            0 3px 12px rgba(0, 255, 255, 0.5),
            \n01px4px rgba(0, 0, 0, 0.3);
        }

        .scrubber-handle:hover,
        .scrubber-handle:focus {
          transform: translate(-50%, -50%) scale(1.15);
          box-shadow:
            0 4px 20px rgba(0, 255, 255, 0.7),
            \n02px8px rgba(0, 0, 0, 0.4);
        }

        .scrubber-handle.dragging {
          transform: translate(-50%, -50%) scale(1.25);
          box-shadow:
            0 6px 24px rgba(0, 255, 255, 0.8),
            \n03px12px rgba(0, 0, 0, 0.5);
        }

        .handle-tooltip {
          bottom: 35px;
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .timeline-controls {
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: stretch;
        }

        .playback-controls {
          order: 1;
          justify-content: center;
          gap: 12px;
        }

        .speed-controls {
          order: 0;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .additional-controls {
          order: 2;
          justify-content: center;
        }

        .control-btn {
          padding: 12px;
          border-radius: 10px;
          /* Enhanced touch targets */
          min-width: 48px;
          min-height: 48px;
          transition: all 0.2s ease;
        }

        .play-pause-btn {
          min-width: 56px;
          min-height: 56px;
          padding: 16px;
        }

        .speed-btn {
          padding: 10px 14px;
          min-width: 44px;
          min-height: 44px;
          font-size: 12px;
          border-radius: 8px;
        }

        .timeline-markers .timeline-marker {
          /* Enhanced mobile marker touch targets */
          min-width: 20px;
          min-height: 20px;
          border-radius: 4px;
        }

        .histogram-bar {
          /* Wider bars for easier interaction */
          min-width: 2px;
        }
      }

      @media (max-width: 480px) {
        .timeline-scrubber {
          padding: 12px;
          border-radius: 10px;
        }

        .timeline-title {
          font-size: 15px;
        }

        .timeline-dates {
          font-size: 10px;
          gap: 6px;
        }

        .timeline-stats {
          flex-direction: column;
          gap: 6px;
          align-items: stretch;
          text-align: center;
          font-size: 11px;
        }

        .timeline-track {
          height: 52px;
          margin: 12px 0;
        }

        .scrubber-handle {
          width: 26px;
          height: 26px;
        }

        .control-btn {
          padding: 10px;
          min-width: 44px;
          min-height: 44px;
        }

        .play-pause-btn {
          min-width: 52px;
          min-height: 52px;
          padding: 14px;
        }

        .speed-btn {
          padding: 8px 12px;
          min-width: 40px;
          min-height: 40px;
          font-size: 11px;
        }

        .speed-label {
          font-size: 11px;
        }

        .timeline-controls {
          gap: 12px;
        }

        .playback-controls {
          gap: 10px;
        }

        .speed-controls {
          gap: 6px;
        }
      }

      /* Enhanced Touch-friendly adjustments */
      @media (hover: none) and (pointer: coarse) {
        .timeline-scrubber {
          /* Enhanced touch scrolling */
          -webkit-overflow-scrolling: touch;
        }

        .timeline-track {
          /* Larger touch area */
          padding: 12px 0;
        }

        .scrubber-handle {
          width: 32px;
          height: 32px;
          /* Remove hover effects that don't work on touch */
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .scrubber-handle:hover {
          transform: translate(-50%, -50%);
          box-shadow: 0 2px 8px rgba(0, 255, 255, 0.4);
        }

        .scrubber-handle:active {
          transform: translate(-50%, -50%) scale(1.1);
          box-shadow: 0 4px 16px rgba(0, 255, 255, 0.6);
        }

        .control-btn {
          padding: 14px;
          min-width: 50px;
          min-height: 50px;
          /* Enhanced touch feedback */
          transition: all 0.15s ease;
        }

        .control-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
          transform: none;
        }

        .control-btn:active:not(:disabled) {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(0.96);
        }

        .speed-btn {
          padding: 10px 16px;
          min-width: 46px;
          min-height: 46px;
        }

        .speed-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .timeline-marker {
          /* Enhanced touch targets for markers */
          min-width: 24px;
          min-height: 24px;
          padding: 4px;
        }

        .timeline-marker:active {
          transform: scale(0.9);
        }

        /* Prevent text selection during touch interactions */
        .timeline-scrubber {
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
        }

        /* Enhanced visual feedback for touch */
        .histogram-bar:active {
          opacity: 0.8;
          transform: scaleY(1.1);
        }
      }

      /* Responsive typography */
      @media (max-width: 480px) {
        .timeline-progress-text {
          font-size: 11px;
        }

        .speed-label {
          display: none; /* Hide label on very small screens */
        }
      }

      /* Enhanced focus states for mobile accessibility */
      @media (max-width: 768px) {
        .scrubber-handle:focus {
          outline: 3px solid rgba(59, 130, 246, 0.8);
          outline-offset: 3px;
        }

        .control-btn:focus,
        .speed-btn:focus {
          outline: 2px solid rgba(59, 130, 246, 0.8);
          outline-offset: 2px;
        }

        .timeline-marker:focus {
          outline: 2px solid rgba(0, 255, 255, 0.8);
          outline-offset: 2px;
        }
      }

      /* Screen reader only content */
      .sr-only {
        position: absolute;
        left: -10000px;
        top: auto;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* Accessibility enhancements */
      .timeline-marker:focus {
        outline: 2px solid #0ff;
        outline-offset: 2px;
        z-index: 10;
      }

      .scrubber-handle:focus {
        outline: 2px solid #0ff;
        outline-offset: 4px;
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .timeline-track {
          border: 2px solid;
        }

        .scrubber-handle {
          border: 2px solid;
        }

        .control-btn {
          border: 2px solid;
        }
      }
    `,
  ],
})
export class TimelineScrubberComponent {
  private readonly destroyRef = inject(DestroyRef);

  // Input signals
  public readonly timelineState = input<TimelineState | null>(null);
  public readonly dateRange = input.required<DateRange>();
  public readonly preview = input<MigrationPreview | null>(null);
  public readonly disabled = input<boolean>(false);
  public readonly animationConfig = input<AnimationConfig>({
    duration: 300,
    easing: 'ease-out',
    delay: 0,
    enabled: true,
  });

  // Output events
  public readonly timelineEvent = output<TimelineEvent>();

  // Template references
  private readonly timelineTrack =
    viewChild<ElementRef<HTMLDivElement>>('timelineTrack');

  // Internal state
  private readonly _isPlaying = signal(false);
  private readonly _currentSpeed = signal<PlaybackSpeed>(1);
  private readonly _progress = signal(0);
  private readonly _loopEnabled = signal(false);
  private readonly _isDragging = signal(false);
  private readonly _showTooltip = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _timelineMarkers = signal<readonly TimelineMarker[]>([]);

  // Animation state
  private animationFrameId: number | null = null;
  private lastFrameTime = 0;
  private animationStartTime = 0;
  private lastProgressUpdate = 0;
  private frameSkipCounter = 0;
  private performanceMode: 'auto' | 'high' | 'reduced' = 'auto';

  // Interaction state
  private dragStartX = 0;
  private dragStartProgress = 0;

  // Performance monitoring
  private performanceMetrics = {
    frameRate: 60,
    lastFpsUpdate: 0,
    frameCount: 0,
    adaptiveThrottling: false,
  };

  // Constants
  public readonly playbackSpeeds: readonly PlaybackSpeed[] = [0.5, 1, 2, 4];

  // Computed values
  public readonly isPlaying = this._isPlaying.asReadonly();
  public readonly currentSpeed = this._currentSpeed.asReadonly();
  public readonly progress = this._progress.asReadonly();
  public readonly loopEnabled = this._loopEnabled.asReadonly();
  public readonly isDragging = this._isDragging.asReadonly();
  public readonly showTooltip = this._showTooltip.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly timelineMarkers = this._timelineMarkers.asReadonly();

  public readonly currentDate = computed(() => {
    const range = this.dateRange();
    const progress = this._progress();
    const totalTime = range.endDate.getTime() - range.startDate.getTime();
    return new Date(range.startDate.getTime() + totalTime * progress);
  });

  // Expose Math for template
  public readonly Math = Math;

  constructor() {
    // Sync with external timeline state
    effect(() => {
      const externalState = this.timelineState();
      if (externalState && !this._isDragging()) {
        this._progress.set(externalState.progress);
        this._isPlaying.set(externalState.isPlaying);
        this._currentSpeed.set(externalState.playbackSpeed);
      }
    });

    // Generate timeline markers when preview data changes
    effect(() => {
      const previewData = this.preview();
      if (previewData) {
        this.generateTimelineMarkers(previewData);
      }
    });

    // Start animation loop
    this.startAnimationLoop();
  }

  /**
   * Toggle playback state
   */
  togglePlayback(): void {
    if (this.disabled()) return;

    const newPlayingState = !this._isPlaying();
    this._isPlaying.set(newPlayingState);

    this.emitTimelineEvent({
      type: newPlayingState ? 'play' : 'pause',
      timestamp: new Date(),
    });

    if (newPlayingState) {
      this.animationStartTime = performance.now();
    }
  }

  /**
   * Set playback speed
   */
  setPlaybackSpeed(speed: PlaybackSpeed): void {
    if (this.disabled()) return;

    this._currentSpeed.set(speed);
    this.emitTimelineEvent({
      type: 'speed',
      speed,
      timestamp: new Date(),
    });
  }

  /**
   * Reset timeline to beginning
   */
  resetTimeline(): void {
    if (this.disabled()) return;

    this._progress.set(0);
    this._isPlaying.set(false);
    this.animationStartTime = 0;

    this.emitTimelineEvent({
      type: 'seek',
      progress: 0,
      timestamp: new Date(),
    });
  }

  /**
   * Toggle loop mode
   */
  toggleLoop(): void {
    if (this.disabled()) return;
    this._loopEnabled.update((enabled) => !enabled);
  }

  /**
   * Handle timeline track mouse interactions
   */
  onTrackMouseDown(event: MouseEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    this.startDrag(event.clientX);

    document.addEventListener('mousemove', this.onDocumentMouseMove);
    document.addEventListener('mouseup', this.onDocumentMouseUp);
  }

  /**
   * Handle timeline track touch interactions
   */
  onTrackTouchStart(event: TouchEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    const touch = event.touches[0];
    this.startDrag(touch.clientX);

    document.addEventListener('touchmove', this.onDocumentTouchMove);
    document.addEventListener('touchend', this.onDocumentTouchEnd);
  }

  /**
   * Handle keyboard navigation
   */
  onHandleKeyDown(event: KeyboardEvent): void {
    if (this.disabled()) return;

    const step = 0.01; // 1% steps
    let newProgress = this._progress();

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        newProgress = Math.max(0, newProgress - step);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        newProgress = Math.min(1, newProgress + step);
        break;
      case 'Home':
        newProgress = 0;
        break;
      case 'End':
        newProgress = 1;
        break;
      case ' ':
      case 'Enter':
        this.togglePlayback();
        return;
      default:
        return;
    }

    event.preventDefault();
    this.seekToProgress(newProgress);
  }

  /**
   * Format date for display
   */
  formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year:
        date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }

  /**
   * Get histogram bar position percentage
   */
  getHistogramPosition(date: Date): number {
    const range = this.dateRange();
    const totalTime = range.endDate.getTime() - range.startDate.getTime();
    const timeFromStart = date.getTime() - range.startDate.getTime();
    return (timeFromStart / totalTime) * 100;
  }

  /**
   * Get histogram tooltip text
   */
  getHistogramTooltip(point: {
    date: Date;
    count: number;
    density: number;
  }): string {
    return `${this.formatDate(point.date)}: ${point.count} observations`;
  }

  /**
   * Start drag interaction
   */
  private startDrag(clientX: number): void {
    this._isDragging.set(true);
    this._showTooltip.set(true);
    this.dragStartX = clientX;
    this.dragStartProgress = this._progress();

    // Pause animation during drag
    if (this._isPlaying()) {
      this._isPlaying.set(false);
    }
  }

  /**
   * Update drag position
   */
  private updateDrag(clientX: number): void {
    if (!this._isDragging()) return;

    const trackElement = this.timelineTrack()?.nativeElement;
    if (!trackElement) return;

    const rect = trackElement.getBoundingClientRect();
    const deltaX = clientX - this.dragStartX;
    const trackWidth = rect.width;
    const deltaProgress = deltaX / trackWidth;

    const newProgress = Math.max(
      0,
      Math.min(1, this.dragStartProgress + deltaProgress),
    );
    this.seekToProgress(newProgress);
  }

  /**
   * End drag interaction
   */
  private endDrag(): void {
    this._isDragging.set(false);
    this._showTooltip.set(false);

    document.removeEventListener('mousemove', this.onDocumentMouseMove);
    document.removeEventListener('mouseup', this.onDocumentMouseUp);
    document.removeEventListener('touchmove', this.onDocumentTouchMove);
    document.removeEventListener('touchend', this.onDocumentTouchEnd);
  }

  /**
   * Seek to specific progress
   */
  private seekToProgress(progress: number): void {
    this._progress.set(progress);
    this.emitTimelineEvent({
      type: 'seek',
      progress,
      timestamp: new Date(),
    });
  }

  /**
   * Document mouse move handler
   */
  private readonly onDocumentMouseMove = (event: MouseEvent) => {
    this.updateDrag(event.clientX);
  };

  /**
   * Document mouse up handler
   */
  private readonly onDocumentMouseUp = () => {
    this.endDrag();
  };

  /**
   * Document touch move handler
   */
  private readonly onDocumentTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    const touch = event.touches[0];
    this.updateDrag(touch.clientX);
  };

  /**
   * Document touch end handler
   */
  private readonly onDocumentTouchEnd = () => {
    this.endDrag();
  };

  /**
   * Emit timeline event
   */
  private emitTimelineEvent(
    event: Omit<TimelineEvent, 'timestamp'> & { timestamp: Date },
  ): void {
    this.timelineEvent.emit(event);
  }

  /**
   * Start optimized animation loop with adaptive performance
   */
  private startAnimationLoop(): void {
    const animate = (currentTime: number) => {
      if (this.destroyRef.destroyed) return;

      // Performance monitoring and adaptive throttling
      this.updatePerformanceMetrics(currentTime);

      if (this._isPlaying() && !this._isDragging()) {
        // Adaptive frame skipping for performance
        if (this.shouldSkipFrame(currentTime)) {
          this.frameSkipCounter++;
        } else {
          this.updateAnimation(currentTime);
          this.frameSkipCounter = 0;
        }
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.animationFrameId = requestAnimationFrame(animate);

    // Clean up on destroy
    this.destroyRef.onDestroy(() => {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
    });
  }

  /**
   * Update animation progress with performance optimizations
   */
  private updateAnimation(currentTime: number): void {
    if (this.animationStartTime === 0) {
      this.animationStartTime = currentTime;
      this.lastFrameTime = currentTime;
      return;
    }

    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Skip update if delta time is too small (reduces unnecessary calculations)
    if (deltaTime < 0.008) {
      // ~120fps cap
      return;
    }

    const range = this.dateRange();
    const totalDuration =
      (range.endDate.getTime() - range.startDate.getTime()) / 1000;
    const speedMultiplier = this._currentSpeed();

    // Calculate progress increment based on real time
    const progressIncrement = (deltaTime * speedMultiplier) / totalDuration;
    let newProgress = this._progress() + progressIncrement;

    // Handle loop or stop at end
    if (newProgress >= 1) {
      if (this._loopEnabled()) {
        newProgress = 0;
        this.animationStartTime = currentTime;
      } else {
        newProgress = 1;
        this._isPlaying.set(false);
      }
    }

    // Batch progress updates to reduce DOM thrashing
    const progressDelta = Math.abs(newProgress - this._progress());
    if (progressDelta > 0.001 || currentTime - this.lastProgressUpdate > 16) {
      // ~60fps max for DOM updates
      this._progress.set(newProgress);
      this.lastProgressUpdate = currentTime;

      // Throttle external event emission to reduce overhead
      if (currentTime - this.lastProgressUpdate > 33) {
        // ~30fps for external events
        this.emitTimelineEvent({
          type: 'seek',
          progress: newProgress,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Generate timeline markers based on data
   */
  private generateTimelineMarkers(preview: MigrationPreview): void {
    const markers: TimelineMarker[] = [];
    const range = this.dateRange();
    const totalTime = range.endDate.getTime() - range.startDate.getTime();

    // Add peak migration markers based on histogram
    if (preview.histogram && preview.histogram.length > 0) {
      const maxDensity = Math.max(...preview.histogram.map((p) => p.density));
      const peaks = preview.histogram.filter(
        (p) => p.density > maxDensity * 0.7,
      );

      peaks.forEach((peak, index) => {
        const progress =
          (peak.date.getTime() - range.startDate.getTime()) / totalTime;
        markers.push({
          id: `peak-${index}`,
          date: peak.date,
          progress,
          label: `Peak: ${peak.count}`,
          type: 'peak',
          color: '#ff6b6b',
        });
      });
    }

    // Add season markers (simplified - would integrate with season data)
    const seasons = [
      { name: 'Spring', month: 3, color: '#4ecdc4' },
      { name: 'Summer', month: 6, color: '#45b7d1' },
      { name: 'Autumn', month: 9, color: '#f39c12' },
      { name: 'Winter', month: 12, color: '#95a5a6' },
    ];

    seasons.forEach((season) => {
      const seasonDate = new Date(
        range.startDate.getFullYear(),
        season.month - 1,
        21,
      );
      if (seasonDate >= range.startDate && seasonDate <= range.endDate) {
        const progress =
          (seasonDate.getTime() - range.startDate.getTime()) / totalTime;
        markers.push({
          id: `season-${season.name.toLowerCase()}`,
          date: seasonDate,
          progress,
          label: season.name,
          type: 'season',
          color: season.color,
        });
      }
    });

    this._timelineMarkers.set(markers);
  }

  /**
   * Handle marker click/keyboard interaction
   */
  seekToMarker(marker: TimelineMarker): void {
    if (this.disabled()) return;

    this.seekToProgress(marker.progress);
    this.announceToScreenReader(
      `Jumped to ${marker.label} at ${this.formatDate(marker.date)}`,
    );
  }

  /**
   * Handle marker keyboard navigation
   */
  onMarkerKeyDown(event: KeyboardEvent, marker: TimelineMarker): void {
    if (this.disabled()) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.seekToMarker(marker);
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        // Let the browser handle focus navigation between markers
        break;
      default:
        return;
    }
  }

  /**
   * Handle scrubber handle focus
   */
  onHandleFocus(): void {
    this._showTooltip.set(true);
    this.announceToScreenReader(
      'Timeline scrubber focused. Use arrow keys to navigate, space to play/pause.',
    );
  }

  /**
   * Handle scrubber handle blur
   */
  onHandleBlur(): void {
    // Only hide tooltip if not dragging
    if (!this._isDragging()) {
      this._showTooltip.set(false);
    }
  }

  /**
   * Announce information to screen readers
   */
  private announceToScreenReader(message: string): void {
    // Create or update live region for announcements
    let liveRegion = document.getElementById('timeline-announcements');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'timeline-announcements';
      liveRegion.className = 'sr-only';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      document.body.appendChild(liveRegion);
    }

    liveRegion.textContent = message;

    // Clear after announcement to allow repeated messages
    setTimeout(() => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    }, 1000);
  }

  /**
   * Update performance metrics and adaptive behavior
   */
  private updatePerformanceMetrics(currentTime: number): void {
    this.performanceMetrics.frameCount++;

    // Calculate FPS every second
    if (currentTime - this.performanceMetrics.lastFpsUpdate >= 1000) {
      this.performanceMetrics.frameRate = this.performanceMetrics.frameCount;
      this.performanceMetrics.frameCount = 0;
      this.performanceMetrics.lastFpsUpdate = currentTime;

      // Enable adaptive throttling if performance is poor
      this.performanceMetrics.adaptiveThrottling =
        this.performanceMetrics.frameRate < 30;

      if (this.performanceMetrics.adaptiveThrottling) {
        console.warn(
          `⚡ Timeline performance reduced: ${this.performanceMetrics.frameRate}fps - enabling adaptive throttling`,
        );
      }
    }
  }

  /**
   * Determine if current frame should be skipped for performance
   */
  private shouldSkipFrame(currentTime: number): boolean {
    // Skip frames during reduced performance mode
    if (this.performanceMetrics.adaptiveThrottling) {
      return this.frameSkipCounter % 2 === 0; // Skip every other frame
    }

    // Skip frames during high-speed playback to maintain smoothness
    if (this._currentSpeed() >= 4) {
      return this.frameSkipCounter % 3 !== 0; // Render every 3rd frame
    }

    return false;
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): {
    frameRate: number;
    adaptiveThrottling: boolean;
    frameSkipCount: number;
    performanceMode: string;
  } {
    return {
      frameRate: this.performanceMetrics.frameRate,
      adaptiveThrottling: this.performanceMetrics.adaptiveThrottling,
      frameSkipCount: this.frameSkipCounter,
      performanceMode: this.performanceMode,
    };
  }

  /**
   * Manually set performance mode
   */
  setPerformanceMode(mode: 'auto' | 'high' | 'reduced'): void {
    this.performanceMode = mode;

    // Reset adaptive throttling when manually set
    if (mode !== 'auto') {
      this.performanceMetrics.adaptiveThrottling = mode === 'reduced';
    }
  }

  /**
   * Handle window resize for responsive timeline
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    // Force re-calculation of drag positions on resize
    if (this._isDragging()) {
      this.endDrag();
    }
  }
}

/**
 * Playback Controls Component
 * Controls for guided tour playback (play/pause/seek/speed)
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-playback-controls',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="playback-controls">
      <div class="controls-group">
        <!-- Play/Pause -->
        <button
          type="button"
          class="control-btn primary"
          (click)="onPlayPause()"
          [disabled]="disabled()"
          [attr.aria-label]="isPlaying() ? 'Pause tour' : 'Play tour'"
          title="{{ isPlaying() ? 'Pause' : 'Play' }}"
        >
          {{ isPlaying() ? '⏸' : '▶️' }}
        </button>

        <!-- Stop -->
        <button
          type="button"
          class="control-btn"
          (click)="onStop()"
          [disabled]="disabled()"
          aria-label="Stop tour"
          title="Stop"
        >
          ⏹️
        </button>

        <!-- Restart -->
        <button
          type="button"
          class="control-btn"
          (click)="onRestart()"
          [disabled]="disabled()"
          aria-label="Restart tour"
          title="Restart from beginning"
        >
          ⏮️
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-bar" (click)="onProgressClick($event)">
          <div class="progress-fill" [style.width.%]="progress()"></div>
          <div class="progress-handle" [style.left.%]="progress()"></div>
        </div>

        <div class="time-display">
          <span>{{ formatTime(currentTime()) }}</span>
          <span class="time-separator">/</span>
          <span>{{ formatTime(duration()) }}</span>
        </div>
      </div>

      <!-- Speed Control -->
      <div class="speed-control">
        <label for="speed-select">Speed:</label>
        <select
          id="speed-select"
          [value]="speed()"
          (change)="onSpeedChange($event)"
          [disabled]="disabled()"
        >
          <option [value]="0.5">0.5x</option>
          <option [value]="1">1x</option>
          <option [value]="1.5">1.5x</option>
          <option [value]="2">2x</option>
        </select>
      </div>
    </div>
  `,
  styles: [
    `
      .playback-controls {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px 20px;
        border-radius: 12px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(14px) saturate(1.15);
        -webkit-backdrop-filter: blur(14px) saturate(1.15);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
        z-index: 110;
        min-width: 320px;
      }

      .controls-group {
        display: flex;
        gap: 8px;
        justify-content: center;
      }

      .control-btn {
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.9);
        font-size: 18px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 48px;
        min-height: 44px;
      }

      .control-btn.primary {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        border-color: rgba(59, 130, 246, 0.3);
      }

      .control-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-1px);
      }

      .control-btn.primary:hover:not(:disabled) {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
      }

      .control-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .progress-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .progress-bar {
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        position: relative;
        cursor: pointer;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #60a5fa);
        border-radius: 3px;
        transition: width 0.1s linear;
      }

      .progress-handle {
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 14px;
        height: 14px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        transition: left 0.1s linear;
      }

      .time-display {
        display: flex;
        justify-content: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }

      .time-separator {
        color: rgba(255, 255, 255, 0.4);
      }

      .speed-control {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.8);
      }

      .speed-control label {
        font-weight: 500;
      }

      .speed-control select {
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        font-size: 13px;
      }

      .speed-control select:focus {
        outline: none;
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .playback-controls {
          bottom: 80px;
          left: 8px;
          right: 8px;
          transform: none;
          min-width: auto;
          padding: 14px 16px;
        }

        .controls-group {
          gap: 6px;
        }

        .control-btn {
          padding: 8px 12px;
          font-size: 16px;
          min-width: 44px;
          min-height: 42px;
        }

        .progress-bar {
          height: 8px;
        }

        .progress-handle {
          width: 16px;
          height: 16px;
        }

        .time-display {
          font-size: 12px;
        }

        .speed-control {
          font-size: 12px;
        }

        .speed-control select {
          padding: 5px 10px;
          font-size: 12px;
        }
      }

      @media (max-width: 480px) {
        .playback-controls {
          bottom: 70px;
          padding: 12px;
        }

        .controls-group {
          gap: 4px;
        }

        .control-btn {
          padding: 6px 10px;
          font-size: 14px;
          min-width: 40px;
          min-height: 40px;
        }
      }

      /* Touch-friendly enhancements */
      @media (hover: none) and (pointer: coarse) {
        .control-btn:active {
          transform: scale(0.95);
        }

        .control-btn.primary:active {
          background: linear-gradient(135deg, #1d4ed8, #1e40af);
        }

        .progress-handle {
          width: 18px;
          height: 18px;
        }
      }
    `,
  ],
})
export class PlaybackControlsComponent {
  readonly isPlaying = input.required<boolean>();
  readonly progress = input.required<number>();
  readonly currentTime = input.required<number>();
  readonly duration = input.required<number>();
  readonly speed = input.required<number>();
  readonly disabled = input<boolean>(false);

  readonly playPause = output<void>();
  readonly stop = output<void>();
  readonly restart = output<void>();
  readonly seek = output<number>();
  readonly speedChange = output<number>();

  onPlayPause(): void {
    this.playPause.emit();
  }

  onStop(): void {
    this.stop.emit();
  }

  onRestart(): void {
    this.restart.emit();
  }

  onProgressClick(event: MouseEvent): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const progress = (x / rect.width) * 100;
    this.seek.emit(Math.max(0, Math.min(100, progress)));
  }

  onSpeedChange(event: Event): void {
    const speed = parseFloat((event.target as HTMLSelectElement).value);
    this.speedChange.emit(speed);
  }

  formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

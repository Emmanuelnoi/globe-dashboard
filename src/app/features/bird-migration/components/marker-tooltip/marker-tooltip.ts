/**
 * Marker Tooltip Component
 * Displays species name on marker hover
 *
 * @module marker-tooltip.component
 * @description Floating tooltip that follows hovered markers
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MigrationStateService } from '../../services/migration-state.service';

/**
 * Tooltip position
 */
export interface TooltipPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Marker Tooltip Component
 * Shows species name when hovering over markers
 */
@Component({
  selector: 'app-marker-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isVisible()) {
      <div
        class="marker-tooltip"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
      >
        <div class="tooltip-content">
          <span class="species-name">{{ speciesName() }}</span>
          @if (markerType()) {
            <span class="marker-type">{{ markerTypeLabel() }}</span>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .marker-tooltip {
        position: fixed;
        pointer-events: none;
        z-index: 10000;
        transform: translate(-50%, -120%);
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translate(-50%, -110%);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -120%);
        }
      }

      .tooltip-content {
        background: rgba(10, 15, 30, 0.95);
        border: 1px solid rgba(0, 217, 255, 0.3);
        border-radius: 8px;
        padding: 8px 12px;
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.3),
          0 0 20px rgba(0, 217, 255, 0.2);
        backdrop-filter: blur(10px);
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .species-name {
        color: #e2e8f0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.3px;
      }

      .marker-type {
        color: #00d9ff;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        opacity: 0.8;
      }

      /* Mobile optimizations */
      @media (max-width: 768px) {
        .marker-tooltip {
          display: none; /* Hide on mobile - too small for tooltips */
        }
      }
    `,
  ],
})
export class MarkerTooltipComponent {
  /**
   * Tooltip screen position
   */
  readonly position = input.required<TooltipPosition>();

  /**
   * Marker type for label
   */
  readonly markerType = input<string>();

  constructor(private stateService: MigrationStateService) {}

  /**
   * Computed: Whether tooltip is visible
   */
  readonly isVisible = computed(() => {
    const hoveredMarker = this.stateService.hoveredMarker();
    return hoveredMarker !== null;
  });

  /**
   * Computed: Species name to display
   */
  readonly speciesName = computed(() => {
    const hoveredMarker = this.stateService.hoveredMarker();
    if (!hoveredMarker) return '';

    const species = this.stateService
      .species()
      .find((s) => s.id === hoveredMarker.speciesId);

    return species?.commonName || 'Unknown Species';
  });

  /**
   * Computed: Marker type label
   */
  readonly markerTypeLabel = computed(() => {
    const markerType = this.markerType();
    if (!markerType) return '';

    const labels: Record<string, string> = {
      start: '🐦 Breeding Site',
      end: '📍 Wintering Site',
      waypoint: '• Stopover',
    };

    return labels[markerType] || markerType;
  });
}

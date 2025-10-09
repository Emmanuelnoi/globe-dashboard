import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@lib/index';
import { CountryDataRecord } from '../../../core/types/country-data.types';

export interface TooltipPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-country-tooltip',
  standalone: true,
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible() && country()) {
      <div
        class="country-tooltip"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
        [attr.aria-live]="'polite'"
        role="tooltip"
      >
        <div class="tooltip-arrow"></div>

        <div class="tooltip-content">
          <!-- Country Header -->
          <div class="country-header">
            <div class="country-name">{{ country()?.name }}</div>
            <div class="country-code">{{ country()?.code }}</div>
          </div>

          <!-- Basic Info -->
          <div class="country-info">
            <div class="info-row">
              <app-icon name="map-pin" [size]="14" class="info-icon"></app-icon>
              <span class="info-label">Capital:</span>
              <span class="info-value">{{ country()?.capital }}</span>
            </div>

            <div class="info-row">
              <app-icon name="globe" [size]="14" class="info-icon"></app-icon>
              <span class="info-label">Region:</span>
              <span class="info-value">{{ country()?.region }}</span>
            </div>

            <div class="info-row">
              <app-icon name="users" [size]="14" class="info-icon"></app-icon>
              <span class="info-label">Population:</span>
              <span class="info-value">{{
                country()?.populationFormatted
              }}</span>
            </div>
          </div>

          <!-- Economic Data -->
          @if (country()?.gdpPerCapita !== null) {
            <div class="economic-data">
              <div class="data-row">
                <app-icon
                  name="dollar-sign"
                  [size]="14"
                  class="data-icon"
                ></app-icon>
                <span class="data-label">GDP per capita:</span>
                <span class="data-value">{{
                  country()?.gdpPerCapitaFormatted
                }}</span>
              </div>

              @if (country()?.lifeExpectancy !== null) {
                <div class="data-row">
                  <app-icon
                    name="heart"
                    [size]="14"
                    class="data-icon"
                  ></app-icon>
                  <span class="data-label">Life Expectancy:</span>
                  <span class="data-value">{{
                    country()?.lifeExpectancyFormatted
                  }}</span>
                </div>
              }

              @if (country()?.hdi !== null) {
                <div class="data-row">
                  <app-icon
                    name="trending-up"
                    [size]="14"
                    class="data-icon"
                  ></app-icon>
                  <span class="data-label">HDI:</span>
                  <span class="data-value">{{ country()?.hdiFormatted }}</span>
                  @if (country()?.hdiCategory) {
                    <span
                      class="hdi-category"
                      [class]="
                        'hdi-' +
                        country()?.hdiCategory?.toLowerCase()?.replace(' ', '-')
                      "
                    >
                      {{ country()?.hdiCategory }}
                    </span>
                  }
                </div>
              }

              @if (country()?.happiness !== null) {
                <div class="data-row">
                  <app-icon
                    name="smile"
                    [size]="14"
                    class="data-icon"
                  ></app-icon>
                  <span class="data-label">Happiness:</span>
                  <span class="data-value">{{
                    country()?.happinessFormatted
                  }}</span>
                </div>
              }
            </div>
          }

          <!-- Data Quality Indicator -->
          <div class="data-quality">
            <div class="quality-indicator">
              <div class="quality-bar">
                <div
                  class="quality-fill"
                  [style.width.%]="country()?.dataCompleteness || 0"
                ></div>
              </div>
              <span class="quality-text">
                {{ (country()?.dataCompleteness || 0).toFixed(0) }}% data
                complete
              </span>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .country-tooltip {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        max-width: 320px;
        transform: translateX(-50%) translateY(-10px);
        animation: tooltipFadeIn 0.2s ease-out forwards;
      }

      @keyframes tooltipFadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-5px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(-10px) scale(1);
        }
      }

      .tooltip-arrow {
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid rgba(255, 255, 255, 0.12);
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
      }

      .tooltip-content {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.12),
          rgba(255, 255, 255, 0.06)
        );
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        padding: 16px;
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.5),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
        color: rgba(255, 255, 255, 0.95);
        font-size: 13px;
        line-height: 1.4;
      }

      /* Country Header */
      .country-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .country-name {
        font-size: 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.98);
      }

      .country-code {
        background: rgba(255, 255, 255, 0.12);
        color: rgba(255, 255, 255, 0.8);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }

      /* Basic Info */
      .country-info {
        margin-bottom: 12px;
      }

      .info-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .info-row:last-child {
        margin-bottom: 0;
      }

      .info-icon {
        color: rgba(255, 255, 255, 0.6);
        flex-shrink: 0;
      }

      .info-label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        min-width: 70px;
      }

      .info-value {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 500;
        flex: 1;
      }

      /* Economic Data */
      .economic-data {
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding-top: 10px;
        margin-bottom: 10px;
      }

      .data-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }

      .data-row:last-child {
        margin-bottom: 0;
      }

      .data-icon {
        color: rgba(255, 255, 255, 0.6);
        flex-shrink: 0;
      }

      .data-label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 12px;
        min-width: 90px;
      }

      .data-value {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 500;
      }

      .hdi-category {
        margin-left: 8px;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .hdi-very-high {
        background: rgba(34, 197, 94, 0.2);
        color: rgba(34, 197, 94, 0.9);
      }

      .hdi-high {
        background: rgba(59, 130, 246, 0.2);
        color: rgba(59, 130, 246, 0.9);
      }

      .hdi-medium {
        background: rgba(245, 158, 11, 0.2);
        color: rgba(245, 158, 11, 0.9);
      }

      .hdi-low {
        background: rgba(239, 68, 68, 0.2);
        color: rgba(239, 68, 68, 0.9);
      }

      /* Data Quality */
      .data-quality {
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding-top: 10px;
      }

      .quality-indicator {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .quality-bar {
        flex: 1;
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .quality-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          rgba(59, 130, 246, 0.8),
          rgba(34, 197, 94, 0.8)
        );
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .quality-text {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        white-space: nowrap;
      }

      /* Responsive Design */
      @media (max-width: 480px) {
        .country-tooltip {
          max-width: 280px;
        }

        .tooltip-content {
          padding: 12px;
          font-size: 12px;
        }

        .country-name {
          font-size: 14px;
        }

        .info-label,
        .data-label {
          min-width: 60px;
          font-size: 11px;
        }
      }

      /* Accessibility */
      @media (prefers-reduced-motion: reduce) {
        .country-tooltip {
          animation: none;
        }

        .quality-fill {
          transition: none;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .tooltip-content {
          background: rgba(0, 0, 0, 0.95);
          border: 2px solid rgba(255, 255, 255, 0.8);
        }

        .tooltip-arrow {
          border-top-color: rgba(255, 255, 255, 0.8);
        }
      }
    `,
  ],
})
export class CountryTooltip {
  // Input properties
  visible = input<boolean>(false);
  country = input<CountryDataRecord | null>(null);
  position = input<TooltipPosition>({ x: 0, y: 0 });

  constructor() {
    // Automatically hide tooltip after 10 seconds for accessibility
    effect(() => {
      if (this.visible()) {
        const timer = setTimeout(() => {
          // This would ideally emit an event to hide the tooltip
          // For now, we rely on the parent component to manage visibility
        }, 10000);

        return () => clearTimeout(timer);
      }
      return undefined;
    });
  }
}

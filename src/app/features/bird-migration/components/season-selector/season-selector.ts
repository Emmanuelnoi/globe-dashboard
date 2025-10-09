import {
  ChangeDetectionStrategy,
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Season, Hemisphere, SeasonInfo } from '../../models/ui.models';
import {
  SEASON_CONFIGS,
  getSeasonDisplayLabel,
  getSeasonMonthLabels,
  getCurrentSeason,
} from '../../models/season.config';

/**
 * Season Selector Component
 * Displays season chips with hemisphere-aware month labels
 */
@Component({
  selector: 'app-season-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="season-selector"
      role="group"
      aria-labelledby="season-selector-label"
    >
      <div class="season-controls">
        <!-- Year Selector -->
        <div class="year-selector">
          <label for="year-select" class="year-label">Year:</label>
          <select
            id="year-select"
            class="year-dropdown"
            [value]="year"
            (change)="onYearChange($event)"
            [disabled]="disabled"
          >
            @for (yearOption of yearOptions(); track yearOption) {
              <option [value]="yearOption">{{ yearOption }}</option>
            }
          </select>
        </div>

        <!-- Custom Range Button -->
        <button
          type="button"
          class="custom-range-btn"
          (click)="onCustomRangeClick()"
          [disabled]="disabled"
          aria-label="Open custom date range selector"
        >
          📅 Custom Range
        </button>
      </div>

      <!-- Season Chips -->
      <div
        class="season-chips"
        role="radiogroup"
        aria-label="Select migration season"
      >
        @for (seasonInfo of seasonInfos(); track seasonInfo.season) {
          <button
            type="button"
            class="season-chip"
            [class.selected]="selectedSeason === seasonInfo.season"
            [class.current]="seasonInfo.isCurrentSeason"
            [disabled]="disabled"
            role="radio"
            [attr.aria-checked]="selectedSeason === seasonInfo.season"
            [attr.aria-label]="getSeasonAriaLabel(seasonInfo)"
            [title]="getSeasonTooltip(seasonInfo)"
            (click)="onSeasonSelect(seasonInfo.season)"
            (keydown)="onSeasonKeydown($event, seasonInfo.season)"
          >
            <div class="season-icon" aria-hidden="true">
              {{ getSeasonConfig(seasonInfo.season).icon }}
            </div>
            <div class="season-name">
              {{ getSeasonConfig(seasonInfo.season).name }}
            </div>
            <div class="season-months">
              {{ seasonInfo.displayLabel.split(' — ')[1] }}
            </div>
            @if (seasonInfo.isCurrentSeason) {
              <div class="current-indicator" aria-hidden="true">
                <span class="current-dot"></span>
              </div>
            }
          </button>
        }
      </div>

      <!-- Season Description -->
      @if (selectedSeason) {
        <div class="season-description" aria-live="polite">
          <p>{{ getSeasonConfig(selectedSeason).description }}</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .season-selector {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .season-controls {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        flex-wrap: wrap;
      }

      .year-selector {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .year-label {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        white-space: nowrap;
      }

      .year-dropdown {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 80px;
      }

      .year-dropdown:focus {
        outline: none;
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }

      .custom-range-btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .custom-range-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        transform: translateY(-1px);
      }

      .custom-range-btn:focus {
        outline: none;
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }

      .season-chips {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }

      .season-chip {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: 120px;
        height: 80px;
        padding: 12px 8px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        color: rgba(255, 255, 255, 0.8);
        cursor: pointer;
        transition: all 0.25s ease;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .season-chip:hover:not(:disabled) {
        transform: translateY(-2px);
        border-color: rgba(255, 255, 255, 0.2);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.04)
        );
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      }

      .season-chip:focus {
        outline: none;
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }

      .season-chip.selected {
        border-color: rgba(59, 130, 246, 0.6);
        background: linear-gradient(
          180deg,
          rgba(59, 130, 246, 0.2),
          rgba(59, 130, 246, 0.1)
        );
        color: rgba(255, 255, 255, 0.95);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
      }

      .season-chip.current::after {
        content: '';
        position: absolute;
        top: 8px;
        right: 8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
      }

      .season-icon {
        font-size: 24px;
        margin-bottom: 4px;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }

      .season-name {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 2px;
        text-align: center;
      }

      .season-months {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        text-align: center;
        line-height: 1.2;
      }

      .current-indicator {
        position: absolute;
        top: 6px;
        right: 6px;
      }

      .current-dot {
        display: block;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #22c55e;
        box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.3);
      }

      .season-description {
        padding: 12px 16px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        font-style: italic;
      }

      .season-description p {
        margin: 0;
      }

      /* Disabled state */
      .season-chip:disabled,
      .year-dropdown:disabled,
      .custom-range-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .season-chips {
          flex-direction: column;
          gap: 8px;
        }

        .season-chip {
          width: 100%;
          height: 60px;
          flex-direction: row;
          justify-content: flex-start;
          padding: 12px 16px;
          gap: 12px;
        }

        .season-icon {
          margin-bottom: 0;
          font-size: 20px;
        }

        .season-name {
          margin-bottom: 0;
          text-align: left;
          flex: 1;
        }

        .season-months {
          font-size: 12px;
          white-space: nowrap;
        }

        .season-controls {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .year-selector {
          justify-content: space-between;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .season-chip {
          border-width: 2px;
        }

        .season-chip.selected {
          border-color: #3b82f6;
          background: rgba(59, 130, 246, 0.3);
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        .season-chip {
          transition: none;
        }

        .season-chip:hover:not(:disabled) {
          transform: none;
        }
      }
    `,
  ],
})
export class SeasonSelectorComponent {
  @Input() hemisphere: Hemisphere = 'north';
  @Input() selectedSeason: Season | null = null;
  @Input() year: number = new Date().getFullYear();
  @Input() disabled: boolean = false;

  @Output() seasonChange = new EventEmitter<Season>();
  @Output() yearChange = new EventEmitter<number>();
  @Output() customRangeClick = new EventEmitter<void>();

  // Computed season information
  readonly seasonInfos = computed((): SeasonInfo[] => {
    const currentDate = new Date();
    const currentSeason = getCurrentSeason(currentDate, this.hemisphere);

    return (['spring', 'summer', 'autumn', 'winter'] as Season[]).map(
      (season): SeasonInfo => {
        const config = SEASON_CONFIGS[season];
        const months =
          this.hemisphere === 'north' ? config.northMonths : config.southMonths;
        const monthLabels = getSeasonMonthLabels(season, this.hemisphere);

        return {
          season,
          hemisphere: this.hemisphere,
          months,
          monthLabels,
          displayLabel: getSeasonDisplayLabel(season, this.hemisphere),
          isCurrentSeason:
            season === currentSeason && this.year === currentDate.getFullYear(),
        };
      },
    );
  });

  // Year options (current year and 4 previous years)
  readonly yearOptions = computed((): number[] => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  });

  onSeasonSelect(season: Season): void {
    if (this.disabled) return;
    this.seasonChange.emit(season);
  }

  onYearChange(event: Event): void {
    if (this.disabled) return;
    const select = event.target as HTMLSelectElement;
    const year = parseInt(select.value, 10);
    this.yearChange.emit(year);
  }

  onCustomRangeClick(): void {
    if (this.disabled) return;
    this.customRangeClick.emit();
  }

  onSeasonKeydown(event: KeyboardEvent, season: Season): void {
    if (this.disabled) return;

    // Handle arrow key navigation
    const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter'];
    const currentIndex = seasons.indexOf(season);

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : seasons.length - 1;
        this.focusSeason(seasons[prevIndex]);
        break;

      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex =
          currentIndex < seasons.length - 1 ? currentIndex + 1 : 0;
        this.focusSeason(seasons[nextIndex]);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        this.onSeasonSelect(season);
        break;

      case 'Home':
        event.preventDefault();
        this.focusSeason(seasons[0]);
        break;

      case 'End':
        event.preventDefault();
        this.focusSeason(seasons[seasons.length - 1]);
        break;
    }
  }

  getSeasonConfig(season: Season) {
    return SEASON_CONFIGS[season];
  }

  getSeasonAriaLabel(seasonInfo: SeasonInfo): string {
    const selected =
      this.selectedSeason === seasonInfo.season ? ', selected' : '';
    const current = seasonInfo.isCurrentSeason ? ', current season' : '';
    return `${seasonInfo.displayLabel}${selected}${current}`;
  }

  getSeasonTooltip(seasonInfo: SeasonInfo): string {
    const config = SEASON_CONFIGS[seasonInfo.season];
    let tooltip = `${seasonInfo.displayLabel} - ${config.description}`;

    if (seasonInfo.isCurrentSeason) {
      tooltip += ' (Current season)';
    }

    return tooltip;
  }

  private focusSeason(season: Season): void {
    // Focus the season chip
    const chipElement = document.querySelector(
      `.season-chip[aria-label*="${season}"]`,
    ) as HTMLButtonElement;

    if (chipElement) {
      chipElement.focus();
    }
  }
}

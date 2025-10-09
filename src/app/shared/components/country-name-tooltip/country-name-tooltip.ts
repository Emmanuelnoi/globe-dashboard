import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CountryTooltipPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-country-name-tooltip',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible() && countryName()) {
      <div
        class="country-name-tooltip"
        [style.left.px]="adjustedPosition().x"
        [style.top.px]="adjustedPosition().y"
        role="tooltip"
        [attr.aria-label]="'Country: ' + countryName()"
      >
        {{ countryName() }}
      </div>
    }
  `,
  styles: [
    `
      .country-name-tooltip {
        position: fixed;
        background: rgba(15, 23, 42, 0.95);
        color: #f1f5f9;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        pointer-events: none;
        white-space: nowrap;
        box-shadow:
          0 4px 12px rgba(0, 0, 0, 0.4),
          0 2px 4px rgba(0, 0, 0, 0.2);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(148, 163, 184, 0.2);
        transform: translateX(-50%) translateY(-100%);
        margin-top: -12px;
        animation: tooltip-appear 0.15s ease-out;
        font-family:
          -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      @keyframes tooltip-appear {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-100%) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(-100%) scale(1);
        }
      }

      .country-name-tooltip::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: rgba(15, 23, 42, 0.95);
        filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
      }
    `,
  ],
})
export class CountryNameTooltipComponent {
  visible = input<boolean>(false);
  countryName = input<string>('');
  position = input<CountryTooltipPosition>({ x: 0, y: 0 });

  // Adjust position to keep tooltip on screen
  adjustedPosition = computed(() => {
    const pos = this.position();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Estimate tooltip width based on country name length
    const tooltipWidth = Math.max(
      120,
      (this.countryName()?.length || 0) * 8 + 24,
    );
    const tooltipHeight = 40;

    let x = pos.x;
    let y = pos.y;

    // Keep within horizontal bounds
    if (x - tooltipWidth / 2 < 10) {
      x = tooltipWidth / 2 + 10;
    } else if (x + tooltipWidth / 2 > windowWidth - 10) {
      x = windowWidth - tooltipWidth / 2 - 10;
    }

    // Keep within vertical bounds
    if (y - tooltipHeight < 10) {
      y = tooltipHeight + 20; // Show below cursor if too close to top
    }

    return { x, y };
  });
}

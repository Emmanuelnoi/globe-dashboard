import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SimpleTooltipPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-simple-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (visible() && text()) {
      <div
        class="simple-tooltip"
        [style.left.px]="adjustedPosition().x"
        [style.top.px]="adjustedPosition().y"
        role="tooltip"
      >
        {{ text() }}
      </div>
    }
  `,
  styles: [
    `
      .simple-tooltip {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform: translateX(-50%) translateY(-100%);
        margin-top: -10px;
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-100%) scale(0.9);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(-100%) scale(1);
        }
      }
    `,
  ],
})
export class SimpleTooltipComponent {
  visible = input<boolean>(false);
  text = input<string>('');
  position = input<SimpleTooltipPosition>({ x: 0, y: 0 });

  // Adjust position to keep tooltip on screen
  adjustedPosition = computed(() => {
    const pos = this.position();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Estimate tooltip width (rough calculation)
    const tooltipWidth = (this.text()?.length || 0) * 8 + 24;

    let x = pos.x;
    let y = pos.y;

    // Keep within horizontal bounds
    if (x - tooltipWidth / 2 < 10) {
      x = tooltipWidth / 2 + 10;
    } else if (x + tooltipWidth / 2 > windowWidth - 10) {
      x = windowWidth - tooltipWidth / 2 - 10;
    }

    // Keep within vertical bounds
    if (y < 50) {
      y = 50;
    }

    return { x, y };
  });
}

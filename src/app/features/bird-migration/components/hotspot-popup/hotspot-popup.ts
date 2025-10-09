/**
 * Hotspot Popup Component
 * Displays narrative information for tour hotspots
 */

import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { NarrativeHotspot } from '../../models/tour.types';

@Component({
  selector: 'app-hotspot-popup',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hotspot()) {
      <div
        class="hotspot-popup"
        [style.left.px]="position().x"
        [style.top.px]="position().y"
      >
        <div class="popup-content">
          <div class="popup-header">
            <h3>{{ hotspot()!.title }}</h3>
            <button
              type="button"
              class="close-btn"
              (click)="onClose()"
              aria-label="Close hotspot"
            >
              ✕
            </button>
          </div>

          <div class="popup-body">
            <p>{{ hotspot()!.content }}</p>

            @if (hotspot()!.category) {
              <div
                class="category-badge"
                [class]="'category-' + hotspot()!.category"
              >
                {{ hotspot()!.category }}
              </div>
            }

            @if (hotspot()!.media) {
              <div class="media-section">
                <small class="media-caption">{{
                  hotspot()!.media.caption
                }}</small>
              </div>
            }
          </div>

          <div class="popup-footer">
            <div class="location-info">
              📍 {{ hotspot()!.location.latitude.toFixed(2) }}°,
              {{ hotspot()!.location.longitude.toFixed(2) }}°
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .hotspot-popup {
        position: fixed;
        z-index: 200;
        pointer-events: auto;
        transform: translate(-50%, -100%) translateY(-20px);
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translate(-50%, -100%) translateY(-40px);
        }
        to {
          opacity: 1;
          transform: translate(-50%, -100%) translateY(-20px);
        }
      }

      .popup-content {
        min-width: 300px;
        max-width: 400px;
        border-radius: 12px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.04)
        );
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }

      .popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .popup-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.95);
      }

      .close-btn {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.2s;
      }

      .close-btn:hover {
        color: rgba(255, 255, 255, 1);
      }

      .popup-body {
        padding: 16px 20px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 14px;
        line-height: 1.6;
      }

      .popup-body p {
        margin: 0 0 12px 0;
      }

      .category-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        margin-top: 8px;
      }

      .category-breeding {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
      }
      .category-stopover {
        background: rgba(59, 130, 246, 0.2);
        color: #3b82f6;
      }
      .category-passage {
        background: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
      }
      .category-wintering {
        background: rgba(168, 85, 247, 0.2);
        color: #a855f7;
      }

      .media-section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .media-caption {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
      }

      .popup-footer {
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.08);
      }

      .location-info {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .hotspot-popup {
          transform: translate(-50%, -100%) translateY(-10px);
        }

        .popup-content {
          min-width: 280px;
          max-width: 90vw;
        }

        .popup-header h3 {
          font-size: 16px;
        }

        .popup-body {
          font-size: 13px;
          padding: 14px 16px;
        }
      }
    `,
  ],
})
export class HotspotPopupComponent {
  readonly hotspot = input.required<NarrativeHotspot | null>();
  readonly position = input.required<{ x: number; y: number }>();
  readonly closed = output<void>();

  onClose(): void {
    this.closed.emit();
  }
}

/**
 * GBIF Attribution Component
 * Legal attribution for GBIF data source
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gbif-attribution',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gbif-attribution">
      <span class="attribution-text">
        Data provided by
        <a
          href="https://www.gbif.org"
          target="_blank"
          rel="noopener noreferrer"
          class="gbif-link"
          title="Global Biodiversity Information Facility"
        >
          GBIF
        </a>
      </span>
      <span class="separator">|</span>
      <span class="license-text">
        <a
          href="https://creativecommons.org/publicdomain/zero/1.0/"
          target="_blank"
          rel="noopener noreferrer"
          class="license-link"
          title="Creative Commons Zero License"
        >
          CC0 License
        </a>
      </span>
    </div>
  `,
  styles: [
    `
      .gbif-attribution {
        position: fixed;
        bottom: 8px;
        right: 8px;
        z-index: 100;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        transition: all 0.2s ease;
      }

      .gbif-attribution:hover {
        background: rgba(0, 0, 0, 0.8);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      .attribution-text,
      .license-text {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .gbif-link,
      .license-link {
        color: rgba(255, 255, 255, 0.9);
        text-decoration: none;
        font-weight: 600;
        transition: color 0.2s;
      }

      .gbif-link:hover,
      .license-link:hover {
        color: #3b82f6;
        text-decoration: underline;
      }

      .separator {
        color: rgba(255, 255, 255, 0.3);
      }

      /* Mobile Responsive */
      @media (max-width: 768px) {
        .gbif-attribution {
          font-size: 10px;
          padding: 5px 10px;
          gap: 6px;
          bottom: 6px;
          right: 6px;
        }
      }

      @media (max-width: 480px) {
        .gbif-attribution {
          font-size: 9px;
          padding: 4px 8px;
          gap: 4px;
        }

        .separator {
          display: none;
        }

        .license-text {
          display: none;
        }
      }
    `,
  ],
})
export class GbifAttributionComponent {}

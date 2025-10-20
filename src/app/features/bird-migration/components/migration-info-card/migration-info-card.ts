/**
 * Migration Info Card Component
 * Displays top 3 selected migrations with detailed information
 * Positioned in top-right corner (same position as country card)
 */

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type {
  MigrationRecord,
  Species,
  ActivePath,
} from '../../models/migration.types';

export interface MigrationCardData {
  migration: MigrationRecord;
  activePath: ActivePath;
  species?: Species;
  startCountry?: string;
  endCountry?: string;
  waypointCountries?: string[];
}

export interface MigrationInfoCardHandlers {
  onClearAll: () => void;
  onRemovePath: (migrationId: string) => void;
}

@Component({
  selector: 'app-migration-info-card',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="migration-info-container">
      @for (data of migrationData(); track data.migration.id) {
        <div
          class="migration-card"
          [class.most-recent]="data.activePath.selectionIndex === 0"
          [style.opacity]="data.activePath.opacity"
        >
          <!-- Close Button -->
          <button
            class="close-btn"
            (click)="onRemovePath()(data.migration.id)"
            aria-label="Close this migration path"
          >
            ✕
          </button>

          <!-- Species Header -->
          <div class="species-header">
            @if (data.activePath.selectionIndex === 0) {
              <div class="recent-badge">Most Recent</div>
            }
            <div class="species-name">
              {{ data.species?.commonName || 'Unknown Species' }}
            </div>
            <div class="species-scientific">
              {{ data.species?.scientificName || '' }}
            </div>
          </div>

          <!-- Migration Info -->
          <div class="migration-info">
            <!-- Distance -->
            <div class="info-row">
              <span class="info-label">Distance:</span>
              <span class="info-value">{{
                formatDistance(data.migration.distanceKm)
              }}</span>
            </div>

            <!-- Start Location -->
            <div class="info-row">
              <span class="info-label">From:</span>
              <span class="info-value">
                {{
                  data.startCountry ||
                    formatLocation(data.migration.startLocation)
                }}
              </span>
            </div>

            <!-- End Location -->
            <div class="info-row">
              <span class="info-label">To:</span>
              <span class="info-value">
                {{
                  data.endCountry || formatLocation(data.migration.endLocation)
                }}
              </span>
            </div>

            <!-- Flyway -->
            <div class="info-row">
              <span class="info-label">Flyway:</span>
              <span class="info-value">{{ data.migration.flyway }}</span>
            </div>

            <!-- Waypoints (if any) -->
            @if (
              data.migration.waypoints && data.migration.waypoints.length > 0
            ) {
              <div class="info-row">
                <span class="info-label">Stops:</span>
                <span class="info-value">
                  @if (
                    data.waypointCountries && data.waypointCountries.length > 0
                  ) {
                    {{ formatWaypointCountries(data.waypointCountries) }}
                  } @else {
                    {{ data.migration.waypoints.length }} location(s)
                  }
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Clear All Button -->
      @if (migrationData().length > 0) {
        <button class="clear-all-btn" (click)="onClearAll()()">
          Clear All Paths
        </button>
      }
    </div>
  `,
  styles: `
    .migration-info-container {
      position: fixed;
      top: 80px;
      right: 20px;
      bottom: 240px; /* Prevent overlap with migration hub panel (~200px height + spacing) */
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 350px;
      overflow-y: auto;
      overflow-x: hidden;
      pointer-events: auto;
      padding-bottom: 8px;
      padding-right: 4px; /* Space for scrollbar */
    }

    /* Scrollbar styling */
    .migration-info-container::-webkit-scrollbar {
      width: 6px;
    }

    .migration-info-container::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }

    .migration-info-container::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }

    .migration-info-container::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    .migration-card {
      /* Unified glass morphism styling */
      background: var(--glass-bg-primary);
      backdrop-filter: var(--glass-blur-strong);
      -webkit-backdrop-filter: var(--glass-blur-strong);
      border: var(--glass-border-primary);
      border-radius: var(--glass-radius-medium);
      padding: 16px;
      padding-top: 12px; /* Less top padding for close button */
      box-shadow: var(--glass-shadow-strong);
      /* No transition for instant removal */
      position: relative; /* For close button positioning */
    }

    .migration-card.most-recent {
      border-color: rgba(0, 255, 136, 0.3);
      box-shadow:
        0 4px 16px rgba(0, 255, 136, 0.1),
        0 8px 32px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(0, 255, 136, 0.2);
    }

    /* Close button in top-right corner of each card */
    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 28px;
      background: rgba(255, 107, 53, 0.2);
      border: 1px solid rgba(255, 107, 53, 0.3);
      border-radius: 6px;
      color: #ff6b35;
      font-size: 16px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }

    .close-btn:hover {
      background: rgba(255, 107, 53, 0.4);
      border-color: rgba(255, 107, 53, 0.6);
      transform: scale(1.1);
      box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
    }

    .close-btn:active {
      transform: scale(0.95);
    }

    .species-header {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-right: 36px; /* Make room for close button */
    }

    .species-name {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 4px;
      padding-right: 0; /* No extra padding needed now */
    }

    .species-scientific {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      font-style: italic;
    }

    /* Recent badge ABOVE species name to prevent overlap */
    .recent-badge {
      background: rgba(0, 255, 136, 0.2);
      color: #00ff88;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
      margin-bottom: 8px;
    }

    .migration-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      gap: 12px;
    }

    .info-label {
      color: rgba(255, 255, 255, 0.7);
      font-weight: 500;
      flex-shrink: 0;
    }

    .info-value {
      color: #00d9ff;
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }

    .clear-all-btn {
      /* Unified glass button styling with custom accent color */
      background: var(--glass-bg-secondary);
      border: var(--glass-border-secondary);
      backdrop-filter: var(--glass-blur-medium);
      -webkit-backdrop-filter: var(--glass-blur-medium);
      color: #ff6b35;
      padding: 10px 16px;
      border-radius: var(--glass-radius-small);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .clear-all-btn:hover {
      background: linear-gradient(
        180deg,
        rgba(255, 107, 53, 0.15),
        rgba(255, 107, 53, 0.08)
      );
      border-color: rgba(255, 107, 53, 0.5);
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(255, 107, 53, 0.25);
    }

    .clear-all-btn:active {
      transform: translateY(0);
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
      .migration-info-container {
        top: 60px;
        right: 12px;
        left: 12px;
        max-width: none;
      }

      .migration-card {
        padding: 12px;
      }

      .species-name {
        font-size: 16px;
      }

      .info-row {
        font-size: 13px;
      }
    }
  `,
})
export class MigrationInfoCardComponent {
  migrationData = input.required<readonly MigrationCardData[]>();
  onClearAll = input.required<() => void>();
  onRemovePath = input.required<(migrationId: string) => void>();

  /**
   * Format distance in both kilometers and miles
   */
  formatDistance(distanceKm: number): string {
    const distanceMiles = distanceKm * 0.621371;

    // Format km
    let kmFormatted: string;
    if (distanceKm >= 1000) {
      kmFormatted = `${(distanceKm / 1000).toFixed(1)}k km`;
    } else {
      kmFormatted = `${distanceKm.toFixed(0)} km`;
    }

    // Format miles
    let milesFormatted: string;
    if (distanceMiles >= 1000) {
      milesFormatted = `${(distanceMiles / 1000).toFixed(1)}k mi`;
    } else {
      milesFormatted = `${distanceMiles.toFixed(0)} mi`;
    }

    return `${kmFormatted} / ${milesFormatted}`;
  }

  /**
   * Format location coordinates
   */
  formatLocation(location: { lat: number; lon: number }): string {
    const latDir = location.lat >= 0 ? 'N' : 'S';
    const lonDir = location.lon >= 0 ? 'E' : 'W';
    return `${Math.abs(location.lat).toFixed(1)}°${latDir}, ${Math.abs(location.lon).toFixed(1)}°${lonDir}`;
  }

  /**
   * Format waypoint countries list
   * Shows first 3 countries, then "and X more" if there are more
   */
  formatWaypointCountries(countries: string[]): string {
    if (countries.length === 0) {
      return '';
    }

    if (countries.length <= 3) {
      // Join all countries with commas and "and"
      if (countries.length === 1) {
        return countries[0];
      } else if (countries.length === 2) {
        return `${countries[0]} and ${countries[1]}`;
      } else {
        return `${countries[0]}, ${countries[1]}, and ${countries[2]}`;
      }
    } else {
      // Show first 3 and count the rest
      const remaining = countries.length - 3;
      return `${countries[0]}, ${countries[1]}, ${countries[2]}, and ${remaining} more`;
    }
  }
}

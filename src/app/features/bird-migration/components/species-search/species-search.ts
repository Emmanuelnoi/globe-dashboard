import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  output,
  input,
  effect,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GbifAdapterService } from '../../services/gbif-adapter.service';
import { SpeciesInfo } from '../../models/ui.models';
import { GBIFSpecies } from '../../models/gbif.types';
import { LoggerService } from '../../../../core/services/logger.service';

interface SpeciesSearchResult extends SpeciesInfo {
  readonly vernacularNames?: readonly string[];
  readonly rank?: string;
  readonly status?: string;
  readonly imageUrl?: string;
  readonly matchScore?: number;
}

/**
 * Enhanced Species Search Component - BM2-T1
 * Provides real-time auto-complete search with GBIF API integration
 */
@Component({
  selector: 'app-species-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="species-search"
      role="combobox"
      aria-expanded="isDropdownOpen()"
      aria-haspopup="listbox"
    >
      <!-- Search Input -->
      <div class="search-input-container">
        <input
          #searchInput
          type="text"
          class="search-input"
          [value]="searchQuery()"
          (input)="onSearchInput($event)"
          (focus)="onInputFocus()"
          (blur)="onInputBlur()"
          (keydown)="onKeyDown($event)"
          placeholder="Search for bird species (e.g., 'robin', 'eagle')..."
          [disabled]="disabled()"
          autocomplete="off"
          aria-label="Search bird species"
          [attr.aria-activedescendant]="getActiveDescendant()"
          role="textbox"
        />

        <!-- Search Icon -->
        <div class="search-icon" aria-hidden="true">
          @if (isSearching()) {
            <div class="loading-spinner"></div>
          } @else {
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          }
        </div>

        <!-- Clear Button -->
        @if (searchQuery() && !disabled()) {
          <button
            type="button"
            class="clear-button"
            (click)="clearSearch()"
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        }
      </div>

      <!-- Selected Species Display -->
      @if (selectedSpecies() && !isDropdownOpen()) {
        <div class="selected-species" (click)="openDropdown()">
          <div class="species-info">
            @if (selectedSpecies()?.imageUrl) {
              <img
                [src]="selectedSpecies()!.imageUrl"
                [alt]="selectedSpecies()!.commonName"
                class="species-image"
                loading="lazy"
              />
            } @else {
              <div class="species-placeholder">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  />
                </svg>
              </div>
            }
            <div class="species-text">
              <div class="common-name">{{ selectedSpecies()?.commonName }}</div>
              <div class="scientific-name">
                {{ selectedSpecies()?.scientificName }}
              </div>
              @if (selectedSpecies()?.family) {
                <div class="family">{{ selectedSpecies()?.family }}</div>
              }
            </div>
          </div>
          <div class="edit-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              ></path>
              <path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              ></path>
            </svg>
          </div>
        </div>
      }

      <!-- Dropdown Results -->
      @if (isDropdownOpen()) {
        <div class="dropdown-container">
          <div
            class="dropdown-content"
            role="listbox"
            aria-label="Species search results"
          >
            <!-- Search Results -->
            @if (searchResults().length > 0) {
              @for (
                species of searchResults();
                let i = $index;
                track species.id
              ) {
                <div
                  class="search-result"
                  [class.focused]="focusedIndex() === i"
                  [class.selected]="selectedSpecies()?.id === species.id"
                  (click)="selectSpecies(species)"
                  (mouseenter)="setFocusedIndex(i)"
                  role="option"
                  [id]="'species-option-' + i"
                  [attr.aria-selected]="selectedSpecies()?.id === species.id"
                >
                  @if (species.imageUrl) {
                    <img
                      [src]="species.imageUrl"
                      [alt]="species.commonName"
                      class="result-image"
                      loading="lazy"
                    />
                  } @else {
                    <div class="result-placeholder">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                      </svg>
                    </div>
                  }

                  <div class="result-info">
                    <div class="result-common-name">
                      {{ species.commonName }}
                    </div>
                    <div class="result-scientific-name">
                      {{ species.scientificName }}
                    </div>
                    @if (species.family) {
                      <div class="result-family">{{ species.family }}</div>
                    }
                    @if (
                      species.vernacularNames &&
                      species.vernacularNames.length > 1
                    ) {
                      <div class="vernacular-names">
                        Also:
                        {{ species.vernacularNames.slice(1, 3).join(', ') }}
                      </div>
                    }
                  </div>

                  @if (species.matchScore) {
                    <div
                      class="match-score"
                      [title]="
                        'Match score: ' +
                        (species.matchScore * 100).toFixed(0) +
                        '%'
                      "
                    >
                      {{ (species.matchScore * 100).toFixed(0) }}%
                    </div>
                  }
                </div>
              }
            }

            <!-- No Results -->
            @if (
              searchQuery() && !isSearching() && searchResults().length === 0
            ) {
              <div class="no-results">
                <div class="no-results-icon">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.35-4.35"></path>
                  </svg>
                </div>
                <div class="no-results-text">
                  <div>No species found for "{{ searchQuery() }}"</div>
                  <div class="no-results-hint">
                    Try different keywords or scientific name
                  </div>
                </div>
              </div>
            }

            <!-- Loading State -->
            @if (isSearching()) {
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Searching GBIF database...</div>
              </div>
            }

            <!-- Popular Species -->
            @if (!searchQuery() && popularSpecies().length > 0) {
              <div class="popular-section">
                <div class="popular-header">Popular migration species:</div>
                @for (
                  species of popularSpecies();
                  let i = $index;
                  track species.id
                ) {
                  <div
                    class="popular-result"
                    [class.focused]="focusedIndex() === i"
                    (click)="selectSpecies(species)"
                    (mouseenter)="setFocusedIndex(i)"
                    role="option"
                    [id]="'popular-option-' + i"
                    [attr.aria-selected]="selectedSpecies()?.id === species.id"
                  >
                    <div class="popular-info">
                      <div class="popular-common-name">
                        {{ species.commonName }}
                      </div>
                      <div class="popular-scientific-name">
                        {{ species.scientificName }}
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Search Help -->
      @if (!selectedSpecies() && !isDropdownOpen()) {
        <div class="search-help" id="species-search-help">
          Search by common name (e.g., "robin") or scientific name (e.g.,
          "Turdus migratorius")
        </div>
      }
    </div>
  `,
  styles: [
    `
      .species-search {
        position: relative;
        width: 100%;
      }

      .search-input-container {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-input {
        width: 100%;
        padding: 12px 40px 12px 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        font-size: 14px;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
      }

      .search-input:focus {
        outline: none;
        border-color: rgba(59, 130, 246, 0.5);
        background: rgba(255, 255, 255, 0.08);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .search-input:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .search-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
      }

      .search-icon {
        position: absolute;
        right: 12px;
        color: rgba(255, 255, 255, 0.4);
        pointer-events: none;
      }

      .clear-button {
        position: absolute;
        right: 32px;
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .clear-button:hover {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.1);
      }

      .selected-species {
        margin-top: 8px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .selected-species:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
      }

      .species-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .species-image {
        width: 48px;
        height: 48px;
        border-radius: 6px;
        object-fit: cover;
      }

      .species-placeholder {
        width: 48px;
        height: 48px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
      }

      .species-text {
        flex: 1;
      }

      .common-name {
        font-size: 16px;
        font-weight: 600;
        color: white;
        margin-bottom: 2px;
      }

      .scientific-name {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
        font-style: italic;
        margin-bottom: 2px;
      }

      .family {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
      }

      .edit-icon {
        color: rgba(255, 255, 255, 0.4);
      }

      .dropdown-container {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 1000;
        margin-top: 4px;
      }

      .dropdown-content {
        background: rgba(30, 41, 59, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        backdrop-filter: blur(20px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
        max-height: 320px;
        overflow-y: auto;
        padding: 8px;
      }

      .search-result {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .search-result:hover,
      .search-result.focused {
        background: rgba(255, 255, 255, 0.08);
      }

      .search-result.selected {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid rgba(59, 130, 246, 0.3);
      }

      .result-image {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        object-fit: cover;
      }

      .result-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
      }

      .result-info {
        flex: 1;
      }

      .result-common-name {
        font-size: 14px;
        font-weight: 500;
        color: white;
        margin-bottom: 2px;
      }

      .result-scientific-name {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        font-style: italic;
        margin-bottom: 2px;
      }

      .result-family {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.5);
      }

      .vernacular-names {
        font-size: 10px;
        color: rgba(59, 130, 246, 0.7);
        margin-top: 2px;
      }

      .match-score {
        font-size: 11px;
        color: rgba(34, 197, 94, 0.8);
        font-weight: 500;
        background: rgba(34, 197, 94, 0.1);
        padding: 2px 6px;
        border-radius: 4px;
      }

      .no-results {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        text-align: center;
      }

      .no-results-icon {
        color: rgba(255, 255, 255, 0.3);
      }

      .no-results-text {
        color: rgba(255, 255, 255, 0.6);
      }

      .no-results-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.4);
        margin-top: 4px;
      }

      .loading-state {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        justify-content: center;
      }

      .loading-text {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.1);
        border-top: 2px solid rgba(59, 130, 246, 0.8);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      .popular-section {
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding-top: 8px;
        margin-top: 8px;
      }

      .popular-header {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        margin-bottom: 8px;
        padding: 0 12px;
        font-weight: 500;
      }

      .popular-result {
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .popular-result:hover,
      .popular-result.focused {
        background: rgba(255, 255, 255, 0.06);
      }

      .popular-common-name {
        font-size: 13px;
        color: white;
        margin-bottom: 2px;
      }

      .popular-scientific-name {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        font-style: italic;
      }

      .search-help {
        margin-top: 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        padding: 8px 0;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      /* Scrollbar Styling */
      .dropdown-content::-webkit-scrollbar {
        width: 6px;
      }

      .dropdown-content::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 3px;
      }

      .dropdown-content::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }

      .dropdown-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Enhanced Mobile Responsiveness - Sprint BM2-T9 */
      @media (max-width: 1024px) {
        .search-input {
          padding: 14px 44px 14px 18px;
          font-size: 15px;
          border-radius: 10px;
        }

        .selected-species {
          padding: 18px;
          border-radius: 10px;
        }

        .dropdown-content {
          border-radius: 10px;
        }
      }

      @media (max-width: 768px) {
        .species-search {
          /* Enhanced mobile positioning */
          width: 100%;
        }

        .search-input {
          padding: 16px 48px 16px 20px;
          font-size: 16px; /* Prevents zoom on iOS */
          border-radius: 12px;
          /* Enhanced mobile backdrop filter */
          backdrop-filter: blur(14px) saturate(1.1);
          -webkit-backdrop-filter: blur(14px) saturate(1.1);
          /* Better mobile touch targets */
          min-height: 48px;
          box-sizing: border-box;
        }

        .search-input:focus {
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15);
        }

        .search-icon {
          right: 16px;
          width: 20px;
          height: 20px;
        }

        .clear-button {
          right: 40px;
          padding: 8px;
          min-width: 32px;
          min-height: 32px;
          border-radius: 6px;
        }

        .clear-button:active {
          background: rgba(255, 255, 255, 0.15);
          transform: scale(0.95);
        }

        .selected-species {
          margin-top: 12px;
          padding: 20px;
          border-radius: 12px;
          backdrop-filter: blur(14px) saturate(1.1);
          -webkit-backdrop-filter: blur(14px) saturate(1.1);
          /* Enhanced touch feedback */
          transition: all 0.2s ease;
        }

        .selected-species:active {
          background: rgba(255, 255, 255, 0.12);
          transform: scale(0.98);
        }

        .species-image,
        .species-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 8px;
        }

        .common-name {
          font-size: 17px;
          margin-bottom: 4px;
        }

        .scientific-name {
          font-size: 14px;
          margin-bottom: 4px;
        }

        .family {
          font-size: 12px;
        }

        .edit-icon {
          width: 20px;
          height: 20px;
        }

        .dropdown-container {
          /* Enhanced mobile dropdown positioning */
          margin-top: 6px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .dropdown-content {
          border-radius: 12px;
          backdrop-filter: blur(24px) saturate(1.2);
          -webkit-backdrop-filter: blur(24px) saturate(1.2);
          /* Mobile-optimized max height */
          max-height: 60vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .search-result {
          padding: 16px;
          /* Enhanced touch targets */
          min-height: 72px;
          display: flex;
          align-items: center;
        }

        .search-result:active {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(0.98);
        }

        .result-image,
        .result-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .result-info {
          margin-left: 16px;
          flex: 1;
        }

        .result-common-name {
          font-size: 16px;
          margin-bottom: 4px;
        }

        .result-scientific-name {
          font-size: 14px;
          margin-bottom: 4px;
        }

        .result-family {
          font-size: 12px;
        }

        .vernacular-names {
          font-size: 11px;
          margin-top: 4px;
        }

        .match-score {
          margin-left: 12px;
          font-size: 13px;
          padding: 4px 8px;
          border-radius: 6px;
        }

        .no-results {
          padding: 24px 20px;
          text-align: center;
        }

        .no-results-text {
          font-size: 15px;
        }

        .no-results-hint {
          font-size: 13px;
          margin-top: 6px;
        }

        .loading-state {
          padding: 20px;
        }

        .loading-text {
          font-size: 15px;
        }

        .popular-header {
          font-size: 13px;
          padding: 0 16px;
          margin-bottom: 12px;
        }

        .popular-result {
          padding: 12px 16px;
          min-height: 60px;
          border-radius: 8px;
        }

        .popular-result:active {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(0.98);
        }

        .popular-common-name {
          font-size: 15px;
          margin-bottom: 4px;
        }

        .popular-scientific-name {
          font-size: 13px;
        }

        .search-help {
          padding: 12px 16px;
          font-size: 13px;
          margin-top: 12px;
        }
      }

      @media (max-width: 480px) {
        .search-input {
          padding: 14px 44px 14px 18px;
          font-size: 16px; /* Maintains zoom prevention */
          min-height: 44px;
        }

        .search-icon {
          right: 14px;
          width: 18px;
          height: 18px;
        }

        .clear-button {
          right: 36px;
          padding: 6px;
          min-width: 28px;
          min-height: 28px;
        }

        .selected-species {
          padding: 16px;
          margin-top: 10px;
        }

        .species-image,
        .species-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 6px;
        }

        .species-info {
          gap: 10px;
        }

        .common-name {
          font-size: 16px;
          margin-bottom: 3px;
        }

        .scientific-name {
          font-size: 13px;
          margin-bottom: 3px;
        }

        .family {
          font-size: 11px;
        }

        .dropdown-content {
          max-height: 55vh; /* Smaller on very small screens */
        }

        .search-result {
          padding: 14px;
          min-height: 66px;
        }

        .result-image,
        .result-placeholder {
          width: 44px;
          height: 44px;
          border-radius: 6px;
        }

        .result-info {
          margin-left: 14px;
        }

        .result-common-name {
          font-size: 15px;
          margin-bottom: 3px;
        }

        .result-scientific-name {
          font-size: 13px;
          margin-bottom: 3px;
        }

        .result-family {
          font-size: 11px;
        }

        .vernacular-names {
          font-size: 10px;
          margin-top: 3px;
        }

        .match-score {
          margin-left: 8px;
          font-size: 12px;
          padding: 3px 6px;
        }

        .popular-result {
          padding: 10px 14px;
          min-height: 54px;
        }

        .popular-common-name {
          font-size: 14px;
          margin-bottom: 3px;
        }

        .popular-scientific-name {
          font-size: 12px;
        }

        .no-results {
          padding: 20px 16px;
        }

        .loading-state {
          padding: 18px;
        }
      }

      /* Enhanced Touch-friendly adjustments */
      @media (hover: none) and (pointer: coarse) {
        .species-search {
          /* Enhanced touch scrolling */
          -webkit-overflow-scrolling: touch;
        }

        .search-input {
          /* Remove hover effects on touch devices */
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            box-shadow 0.2s ease;
        }

        .clear-button:hover {
          color: rgba(255, 255, 255, 0.6);
          background: none;
        }

        .clear-button:active {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.2);
          transform: scale(0.9);
        }

        .selected-species:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .search-result:hover,
        .popular-result:hover {
          background: rgba(255, 255, 255, 0.03);
        }

        /* Enhanced visual feedback for touch */
        .search-result:active,
        .popular-result:active {
          background: rgba(255, 255, 255, 0.1);
          transform: scale(0.98);
          transition: all 0.1s ease;
        }

        /* Prevent text selection during touch interactions */
        .dropdown-content {
          -webkit-user-select: none;
          -moz-user-select: none;
          user-select: none;
        }

        /* Hide scrollbars on touch devices for cleaner look */
        .dropdown-content {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }

        .dropdown-content::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
      }

      /* Enhanced focus states for mobile accessibility */
      @media (max-width: 768px) {
        .search-input:focus {
          outline: 3px solid rgba(59, 130, 246, 0.6);
          outline-offset: 2px;
        }

        .clear-button:focus {
          outline: 2px solid rgba(59, 130, 246, 0.6);
          outline-offset: 2px;
        }

        .selected-species:focus {
          outline: 2px solid rgba(59, 130, 246, 0.6);
          outline-offset: 2px;
        }

        .search-result:focus,
        .popular-result:focus {
          outline: 2px solid rgba(59, 130, 246, 0.6);
          outline-offset: 1px;
        }
      }

      /* Virtual keyboard handling for iOS */
      @supports (-webkit-touch-callout: none) {
        @media (max-width: 768px) {
          .dropdown-container {
            /* Adjust for iOS virtual keyboard */
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            max-height: 50vh;
            margin: 0;
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.4);
          }

          .dropdown-content {
            border-radius: 16px 16px 0 0;
            max-height: 50vh;
          }
        }
      }
    `,
  ],
})
export class SpeciesSearchComponent {
  private gbifAdapter = inject(GbifAdapterService);
  private logger = inject(LoggerService);
  private destroyRef = inject(DestroyRef);

  // Input properties
  readonly selectedSpecies = input<SpeciesInfo | null>(null);
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Search for bird species...');

  // Output events
  readonly speciesSelected = output<SpeciesInfo>();
  readonly searchStarted = output<void>();
  readonly searchCompleted = output<void>();

  // Component state
  readonly searchQuery = signal<string>('');
  readonly searchResults = signal<readonly SpeciesSearchResult[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isDropdownOpen = signal<boolean>(false);
  readonly focusedIndex = signal<number>(-1);

  // Popular migration species for initial suggestions
  readonly popularSpecies = signal<readonly SpeciesInfo[]>([
    {
      id: '2480598',
      scientificName: 'Turdus migratorius',
      commonName: 'American Robin',
      family: 'Turdidae',
      order: 'Passeriformes',
      migrationRange: 'medium',
      isPopular: true,
    },
    {
      id: '2481592',
      scientificName: 'Hirundo rustica',
      commonName: 'Barn Swallow',
      family: 'Hirundinidae',
      order: 'Passeriformes',
      migrationRange: 'long',
      isPopular: true,
    },
    {
      id: '2481677',
      scientificName: 'Limosa lapponica',
      commonName: 'Bar-tailed Godwit',
      family: 'Scolopacidae',
      order: 'Charadriiformes',
      migrationRange: 'long',
      isPopular: true,
    },
    {
      id: '2481234',
      scientificName: 'Falco peregrinus',
      commonName: 'Peregrine Falcon',
      family: 'Falconidae',
      order: 'Falconiformes',
      migrationRange: 'long',
      isPopular: true,
    },
  ]);

  // Timer references for cleanup
  private searchTimeout: number | null = null;
  private closeDropdownTimer: ReturnType<typeof setTimeout> | null = null;

  // Computed values
  readonly hasResults = computed(() => this.searchResults().length > 0);
  readonly shouldShowDropdown = computed(
    () =>
      this.isDropdownOpen() &&
      (this.hasResults() || this.isSearching() || !this.searchQuery()),
  );

  constructor() {
    // Watch for search query changes and trigger search
    effect(() => {
      const query = this.searchQuery();
      if (query.length >= 2) {
        this.debouncedSearch(query);
      } else {
        this.searchResults.set([]);
        this.isSearching.set(false);
      }
    });

    // Register cleanup for timers on component destroy
    this.destroyRef.onDestroy(() => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      if (this.closeDropdownTimer) clearTimeout(this.closeDropdownTimer);
    });
  }

  // Event handlers
  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
    this.openDropdown();
  }

  onInputFocus(): void {
    this.openDropdown();
  }

  onInputBlur(): void {
    // Delay closing to allow click events on dropdown items
    if (this.closeDropdownTimer) clearTimeout(this.closeDropdownTimer);
    this.closeDropdownTimer = setTimeout(() => this.closeDropdown(), 150);
  }

  onKeyDown(event: KeyboardEvent): void {
    const maxIndex = Math.max(
      this.searchResults().length - 1,
      this.popularSpecies().length - 1,
    );

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.setFocusedIndex(Math.min(this.focusedIndex() + 1, maxIndex));
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.setFocusedIndex(Math.max(this.focusedIndex() - 1, 0));
        break;

      case 'Enter':
        event.preventDefault();
        this.selectFocusedItem();
        break;

      case 'Escape':
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  // UI actions
  openDropdown(): void {
    if (!this.disabled()) {
      this.isDropdownOpen.set(true);
      this.setFocusedIndex(-1);
    }
  }

  closeDropdown(): void {
    this.isDropdownOpen.set(false);
    this.setFocusedIndex(-1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.focusedIndex.set(-1);
  }

  selectSpecies(species: SpeciesInfo): void {
    this.speciesSelected.emit(species);
    this.closeDropdown();
    this.clearSearch();
  }

  setFocusedIndex(index: number): void {
    this.focusedIndex.set(index);
  }

  selectFocusedItem(): void {
    const focusedIdx = this.focusedIndex();
    const results = this.searchResults();
    const popular = this.popularSpecies();

    if (focusedIdx >= 0) {
      if (results.length > 0 && focusedIdx < results.length) {
        this.selectSpecies(results[focusedIdx]);
      } else if (!this.searchQuery() && focusedIdx < popular.length) {
        this.selectSpecies(popular[focusedIdx]);
      }
    }
  }

  getActiveDescendant(): string | null {
    const focusedIdx = this.focusedIndex();
    if (focusedIdx >= 0) {
      if (this.searchResults().length > 0) {
        return `species-option-${focusedIdx}`;
      } else if (!this.searchQuery()) {
        return `popular-option-${focusedIdx}`;
      }
    }
    return null;
  }

  // Search functionality
  private debouncedSearch(query: string): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    this.searchTimeout = window.setTimeout(() => {
      this.performSearch(query);
    }, 300);
  }

  private async performSearch(query: string): Promise<void> {
    try {
      this.isSearching.set(true);
      this.searchStarted.emit();

      // Call GBIF species search API
      const results = await this.gbifAdapter.searchSpecies(query);

      // Transform and enhance results
      const enhancedResults: SpeciesSearchResult[] = results.map((result) => ({
        id: result.key.toString(),
        scientificName: result.scientificName,
        commonName: this.extractCommonName(result),
        family: this.extractFamily(result),
        order: this.extractOrder(result),
        migrationRange: this.estimateMigrationRange(result),
        isPopular: false,
        vernacularNames: this.extractVernacularNames(result),
        rank: result.rank,
        status: result.status,
        matchScore: this.calculateMatchScore(query, result),
        imageUrl: this.generateImageUrl(result),
      }));

      // Sort by match score
      enhancedResults.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

      this.searchResults.set(enhancedResults.slice(0, 10)); // Limit to top 10 results
    } catch (error) {
      this.logger.error('Species search failed:', 'SpeciesSearch', error);
      this.searchResults.set([]);
    } finally {
      this.isSearching.set(false);
      this.searchCompleted.emit();
    }
  }

  private extractCommonName(result: GBIFSpecies): string {
    if (result.vernacularNames?.length && result.vernacularNames.length > 0) {
      const englishName = result.vernacularNames.find(
        (vn) => vn.language === 'eng',
      );
      if (englishName) return englishName.vernacularName;
    }

    // Fallback to scientific name
    return result.canonicalName || result.scientificName;
  }

  private extractVernacularNames(species: GBIFSpecies): string[] {
    // Extract vernacular names from GBIF species data
    if (species.vernacularNames && Array.isArray(species.vernacularNames)) {
      return species.vernacularNames
        .filter((vn) => vn.language === 'en')
        .map((vn) => vn.vernacularName)
        .filter((name: string) => name && name !== species.vernacularName);
    }
    return [];
  }

  private extractFamily(species: GBIFSpecies): string | undefined {
    // Extract family from GBIF species data
    return species.family || undefined;
  }

  private extractOrder(species: GBIFSpecies): string | undefined {
    // Extract order from GBIF species data
    return species.order || undefined;
  }

  private estimateMigrationRange(
    species: GBIFSpecies,
  ): 'short' | 'medium' | 'long' | 'transcontinental' | 'polar' {
    // Basic migration range estimation based on scientific name patterns
    const scientificName = (species.scientificName || '').toLowerCase();
    const commonName = this.extractCommonName(species).toLowerCase();

    // Known long-distance migrants
    if (
      scientificName.includes('sterna') ||
      scientificName.includes('limosa') ||
      scientificName.includes('falco') ||
      scientificName.includes('hirundo') ||
      commonName.includes('tern') ||
      commonName.includes('godwit') ||
      commonName.includes('swallow') ||
      commonName.includes('warbler')
    ) {
      return 'long';
    }

    // Medium distance migrants (many songbirds, raptors)
    if (
      scientificName.includes('turdus') ||
      scientificName.includes('sylvia') ||
      scientificName.includes('phylloscopus') ||
      commonName.includes('thrush') ||
      commonName.includes('robin') ||
      commonName.includes('flycatcher')
    ) {
      return 'medium';
    }

    // Default to medium range for most bird species
    return 'medium';
  }

  private calculateMatchScore(query: string, species: GBIFSpecies): number {
    // Simple fuzzy matching score
    const queryLower = query.toLowerCase();
    const commonNameLower = (species.commonName || '').toLowerCase();
    const scientificNameLower = (species.scientificName || '').toLowerCase();

    let score = 0;

    // Exact matches get highest score
    if (commonNameLower === queryLower || scientificNameLower === queryLower) {
      score = 1.0;
    }
    // Starts with query gets high score
    else if (
      commonNameLower.startsWith(queryLower) ||
      scientificNameLower.startsWith(queryLower)
    ) {
      score = 0.9;
    }
    // Contains query gets medium score
    else if (
      commonNameLower.includes(queryLower) ||
      scientificNameLower.includes(queryLower)
    ) {
      score = 0.7;
    }
    // Partial word matches get lower score
    else {
      const words = queryLower.split(' ');
      const nameWords = (commonNameLower + ' ' + scientificNameLower).split(
        ' ',
      );
      const matchingWords = words.filter((word) =>
        nameWords.some(
          (nameWord) => nameWord.includes(word) || word.includes(nameWord),
        ),
      );
      score = (matchingWords.length / words.length) * 0.5;
    }

    return score;
  }

  private generateImageUrl(species: GBIFSpecies): string | undefined {
    // For now, return placeholder. In real implementation, would call GBIF multimedia API
    // return `https://api.gbif.org/v1/species/${species.id}/media`;
    return undefined;
  }
}

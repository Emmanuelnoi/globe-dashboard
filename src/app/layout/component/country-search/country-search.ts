import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fromEvent } from 'rxjs';
import { IconComponent } from '@lib/index';
import { CountryDataRecord } from '../../../core/types/country-data.types';
import { CountryDataService } from '../../../core/services/country-data.service';

@Component({
  selector: 'app-country-search',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="country-search" [class.collapsed]="collapsed()">
      <!-- Search Input -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <app-icon
            name="search"
            [size]="16"
            class="search-icon"
            aria-hidden="true"
          ></app-icon>
          <input
            #searchInput
            type="search"
            class="search-input"
            placeholder="Search countries..."
            [(ngModel)]="searchQuery"
            (input)="onSearchInput($event)"
            [attr.aria-expanded]="
              showResults() && filteredCountries().length > 0
            "
            aria-label="Search for countries by name, capital, or region"
            aria-describedby="search-description"
            autocomplete="off"
            spellcheck="false"
          />
          @if (searchQuery()) {
            <button
              type="button"
              class="clear-button"
              (click)="clearSearch()"
              aria-label="Clear search"
            >
              <app-icon name="x" [size]="14"></app-icon>
            </button>
          }
        </div>

        <!-- Hidden description for screen readers -->
        <div id="search-description" class="sr-only">
          Search through 241 countries by name, capital city, or region. Use
          arrow keys to navigate results and Enter to select.
        </div>
      </div>

      <!-- Search Results -->
      @if (showResults() && filteredCountries().length > 0) {
        <div
          class="search-results"
          role="listbox"
          aria-label="Search results"
          [attr.aria-activedescendant]="'country-result-' + focusedIndex()"
        >
          @for (
            country of filteredCountries();
            let i = $index;
            track country.id
          ) {
            <div
              class="search-result"
              role="option"
              [id]="'country-result-' + i"
              [class.focused]="i === focusedIndex()"
              [attr.aria-selected]="i === focusedIndex()"
              (click)="selectCountry(country)"
              (mouseenter)="setFocusedIndex(i)"
            >
              <div class="country-info">
                <div class="country-name">{{ country.name }}</div>
                <div class="country-details">
                  <span class="capital">{{ country.capital }}</span>
                  @if (country.region !== country.subregion) {
                    <span class="region">{{ country.region }}</span>
                  }
                </div>
              </div>
              <div class="country-stats">
                <div class="stat">
                  <app-icon name="users" [size]="12"></app-icon>
                  {{ country.populationFormatted }}
                </div>
                @if (country.gdpPerCapitaFormatted !== 'No data') {
                  <div class="stat">
                    <app-icon name="dollar-sign" [size]="12"></app-icon>
                    {{ country.gdpPerCapitaFormatted }}
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- No Results -->
      @if (showResults() && filteredCountries().length === 0 && searchQuery()) {
        <div class="no-results" role="status" aria-live="polite">
          <app-icon name="search-x" [size]="20"></app-icon>
          <span>No countries found for "{{ searchQuery() }}"</span>
        </div>
      }

      <!-- Search Stats -->
      @if (!collapsed() && searchQuery()) {
        <div class="search-stats" role="status" aria-live="polite">
          {{ filteredCountries().length }} of {{ totalCountries }} countries
        </div>
      }
    </div>
  `,
  styles: [
    `
      .country-search {
        position: relative;
        z-index: 200;
        display: flex;
        align-items: center;
        width: 100%;
      }

      /* Search Container */
      .search-container {
        position: relative;
        width: 100%;
      }

      .search-input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .search-input {
        width: 100%;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 12px 16px 12px 44px;
        color: rgba(255, 255, 255, 0.95);
        font-size: 14px;
        font-family: inherit;
        outline: none;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.2s ease;
      }

      .search-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .search-input:focus {
        border-color: rgba(255, 255, 255, 0.24);
        background: rgba(255, 255, 255, 0.12);
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
      }

      .search-icon {
        position: absolute;
        left: 16px;
        color: rgba(255, 255, 255, 0.6);
        pointer-events: none;
        z-index: 1;
      }

      .clear-button {
        position: absolute;
        right: 12px;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .clear-button:hover {
        color: rgba(255, 255, 255, 0.9);
        background: rgba(255, 255, 255, 0.08);
      }

      .clear-button:focus {
        outline: 2px solid rgba(255, 255, 255, 0.12);
        outline-offset: 1px;
      }

      /* Search Results */
      .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 8px;
        max-height: 320px;
        overflow-y: auto;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.95),
          rgba(0, 0, 0, 0.95)
        );
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        backdrop-filter: blur(16px) saturate(1.2);
        -webkit-backdrop-filter: blur(16px) saturate(1.2);
        box-shadow:
          0 20px 40px rgba(0, 0, 0, 0.6),
          inset 0 1px 0 rgba(255, 255, 255, 0.08);
        z-index: 300;
      }

      .search-result {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        transition: all 0.2s ease;
      }

      .search-result:last-child {
        border-bottom: none;
      }

      .search-result:hover,
      .search-result.focused {
        background: rgba(255, 255, 255, 0.12);
        transform: translateX(2px);
      }

      .country-info {
        flex: 1;
        min-width: 0;
      }

      .country-name {
        font-size: 14px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.95);
        margin-bottom: 4px;
      }

      .country-details {
        display: flex;
        gap: 8px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }

      .capital {
        font-style: italic;
      }

      .region {
        opacity: 0.8;
      }

      .country-stats {
        display: flex;
        flex-direction: column;
        gap: 4px;
        align-items: flex-end;
      }

      .stat {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
      }

      /* No Results */
      .no-results {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 16px;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        text-align: center;
        justify-content: center;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.02)
        );
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        margin-top: 8px;
      }

      /* Search Stats */
      .search-stats {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
        margin-top: 8px;
        padding: 4px;
      }

      /* Screen reader only text */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      /* Collapsed State */
      .country-search.collapsed .search-input {
        padding: 10px 12px;
        font-size: 13px;
      }

      .country-search.collapsed .search-icon {
        left: 12px;
      }

      .country-search.collapsed .clear-button {
        right: 8px;
      }

      /* Responsive */
      @media (max-width: 720px) {
        .search-results {
          max-height: 280px;
        }

        .country-stats {
          display: none;
        }
      }

      /* Scrollbar Styling */
      .search-results::-webkit-scrollbar {
        width: 4px;
      }

      .search-results::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
      }

      .search-results::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
      }

      .search-results::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Focus trap for keyboard navigation */
      .search-results {
        contain: layout;
      }
    `,
  ],
})
export class CountrySearch {
  private destroyRef = inject(DestroyRef);
  private countryDataService = inject(CountryDataService);

  // Props
  collapsed = input<boolean>(false);

  // Internal state
  searchQuery: WritableSignal<string> = signal('');
  showResults: WritableSignal<boolean> = signal(false);
  focusedIndex: WritableSignal<number> = signal(-1);

  // Data
  readonly totalCountries = this.countryDataService.getAllCountries().length;

  // Computed values
  filteredCountries = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return [];

    return this.countryDataService
      .getAllCountries()
      .filter((country: CountryDataRecord) => {
        const searchFields = [
          country.name.toLowerCase(),
          country.capital.toLowerCase(),
          country.region.toLowerCase(),
          country.subregion.toLowerCase(),
          country.code.toLowerCase(),
        ];

        return searchFields.some((field) => field.includes(query));
      })
      .slice(0, 20); // Limit results for performance
  });

  constructor() {
    // Setup keyboard navigation
    this.setupKeyboardNavigation();

    // Close results when clicking outside
    this.setupClickOutside();
  }

  private setupKeyboardNavigation(): void {
    // Handle keyboard navigation
    effect(() => {
      if (this.showResults() && this.filteredCountries().length > 0) {
        const handleKeydown = (event: KeyboardEvent) => {
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              this.navigateResults(1);
              break;
            case 'ArrowUp':
              event.preventDefault();
              this.navigateResults(-1);
              break;
            case 'Enter':
              event.preventDefault();
              this.selectFocusedCountry();
              break;
            case 'Escape':
              event.preventDefault();
              this.hideResults();
              break;
          }
        };

        fromEvent<KeyboardEvent>(document, 'keydown')
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(handleKeydown);
      }
    });
  }

  private setupClickOutside(): void {
    fromEvent<MouseEvent>(document, 'click')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const target = event.target as Element;
        if (!target?.closest('.country-search')) {
          this.hideResults();
        }
      });
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value;

    this.searchQuery.set(value);
    this.focusedIndex.set(-1);
    this.showResults.set(value.length > 0);
  }

  navigateResults(direction: number): void {
    const maxIndex = this.filteredCountries().length - 1;
    const currentIndex = this.focusedIndex();

    let newIndex = currentIndex + direction;

    if (newIndex > maxIndex) {
      newIndex = 0;
    } else if (newIndex < 0) {
      newIndex = maxIndex;
    }

    this.setFocusedIndex(newIndex);
    this.scrollResultIntoView(newIndex);
  }

  private scrollResultIntoView(index: number): void {
    const resultElement = document.getElementById(`country-result-${index}`);
    if (resultElement) {
      resultElement.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }

  selectFocusedCountry(): void {
    const focusedCountry = this.filteredCountries()[this.focusedIndex()];
    if (focusedCountry) {
      this.selectCountry(focusedCountry);
    }
  }

  selectCountry(country: CountryDataRecord): void {
    // Add country to comparison selection
    this.countryDataService.addToSelection([country.code]);

    // Clear search after selection
    this.clearSearch();
  }

  setFocusedIndex(index: number): void {
    this.focusedIndex.set(index);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.hideResults();
  }

  private hideResults(): void {
    this.showResults.set(false);
    this.focusedIndex.set(-1);
  }
}

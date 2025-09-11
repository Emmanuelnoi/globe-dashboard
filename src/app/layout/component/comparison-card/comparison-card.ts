import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  inject,
  signal,
  computed,
} from '@angular/core';
import { TableKeyboardDirective } from '@lib/directives/table-keyboard.directive';
import { CountryDataService } from '../../../core/services/country-data.service';
import { CountryDataRecord } from '../../../core/types/country-data.types';

@Component({
  selector: 'app-comparison-card',
  imports: [CommonModule, TableKeyboardDirective],
  template: `
    <section class="cmp-card centered-card" aria-labelledby="cmp-title">
      <header class="cmp-header">
        <h2 id="cmp-title">Country Statistics Comparison</h2>
        <div class="stats-summary">
          <span class="stats-item">
            <strong>{{ countryDataService.countryCount() }}</strong> countries
          </span>
          <span class="stats-item">
            <strong>{{ countryDataService.selectedCountries().length }}</strong>
            selected
          </span>
          <span
            class="stats-item"
            *ngIf="countryDataService.dataCompleteness() > 0"
          >
            <strong
              >{{
                (countryDataService.dataCompleteness() * 100).toFixed(1)
              }}%</strong
            >
            data completeness
          </span>
        </div>

        <div class="controls" role="toolbar" aria-label="Table actions">
          <!-- Search + Add -->
          <div class="search-group" role="search">
            <label class="sr-only" for="search-input">Search countries</label>
            <input
              id="search-input"
              class="search"
              type="search"
              placeholder="Search countries..."
              [value]="countryDataService.searchQuery()"
              (input)="onSearch($event)"
              aria-label="Search countries"
            />
            <button
              class="btn ghost"
              type="button"
              (click)="showAddModal()"
              aria-label="Add country"
              [disabled]="availableCountries().length === 0"
            >
              Add Country
            </button>
          </div>

          <!-- Filter + Clear + Export -->
          <button
            class="btn ghost"
            type="button"
            (click)="showFilterModal()"
            aria-label="Filter countries"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 7h18M7 12h10M10 17h4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                fill="none"
              />
            </svg>
            Filter
          </button>

          <button
            class="btn ghost"
            type="button"
            (click)="onClearAll()"
            aria-label="Clear all filters"
          >
            Clear All
          </button>

          <button
            class="btn primary"
            type="button"
            (click)="onExportCSV()"
            aria-label="Export CSV"
            [disabled]="!countryDataService.hasSelectedCountries()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3v12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M8 11l4 4 4-4"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
              <path
                d="M21 21H3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                fill="none"
              />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </header>

      <!-- glass wrapper: fixed header + scrollable body inside this wrapper -->
      <div
        class="glass-table-wrapper"
        role="region"
        aria-label="Country comparison table"
        [appTableKeyboard]="displayedCountries().length"
        [(focusedIndex)]="_focusedIndex"
        (navigate)="focusRow($event)"
        (activate)="toggleRowSelection($event)"
      >
        <table
          class="cmp-table"
          role="table"
          aria-describedby="cmp-title"
          tabindex="0"
        >
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col">Country</th>
              <th scope="col">Code</th>
              <th scope="col">Capital</th>
              <th scope="col">Region</th>
              <th scope="col">GDP per Capita</th>
              <th scope="col">HDI</th>
              <th scope="col" class="highlighted">Population</th>
              <th scope="col">Life Expectancy</th>
              <th scope="col">Happiness Index</th>
              <th scope="col" class="actions-col" aria-hidden="true">
                Actions
              </th>
            </tr>
          </thead>

          <tbody role="rowgroup">
            <tr
              *ngFor="
                let country of displayedCountries();
                let i = index;
                trackBy: trackByCode
              "
              #rowItem
              role="row"
              class="data-row"
              [attr.data-code]="country.code"
              [attr.tabindex]="i === focusedIndex() ? 0 : -1"
              [attr.aria-selected]="isSelected(country.code)"
              (click)="toggleRowSelection(i)"
            >
              <td role="cell" class="country-cell">
                <a
                  class="country-link"
                  href="#"
                  (click)="$event.preventDefault(); selectCountry(country.code)"
                >
                  <span class="country-name">{{ country.name }}</span>
                </a>
              </td>

              <td role="cell">
                <span class="code-pill">{{ country.code }}</span>
              </td>

              <td role="cell">{{ country.capital }}</td>
              <td role="cell">
                <span class="region-badge">{{ country.region }}</span>
              </td>

              <td role="cell">
                <span class="gdp-value">{{
                  country.gdpPerCapitaFormatted
                }}</span>
              </td>

              <td role="cell">
                <span class="hdi-value">{{ country.hdiFormatted }}</span>
                <span
                  *ngIf="country.hdiCategory"
                  class="hdi-badge"
                  [attr.data-category]="country.hdiCategory"
                >
                  {{ country.hdiCategory }}
                </span>
              </td>

              <td role="cell" class="population-cell">
                <strong>{{ country.populationFormatted }}</strong>
              </td>

              <td role="cell">
                <span class="life-expectancy">{{
                  country.lifeExpectancyFormatted
                }}</span>
              </td>

              <td role="cell">
                <span class="heart" aria-hidden="true">❤</span>
                <span class="happiness-value">{{
                  country.happinessFormatted
                }}</span>
              </td>

              <td role="cell" class="actions-col">
                <button
                  class="icon-btn"
                  [attr.aria-label]="'Remove ' + country.name"
                  (click)="
                    removeCountry(country.code); $event.stopPropagation()
                  "
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 6h18M8 6v12M16 6v12M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14"
                      stroke="currentColor"
                      stroke-width="1.25"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Empty state -->
        <div *ngIf="displayedCountries().length === 0" class="empty-state">
          <div class="empty-content">
            <h3>No countries selected</h3>
            <p>Search and add countries to start comparing statistics.</p>
            <button class="btn primary" type="button" (click)="showAddModal()">
              Add Countries
            </button>
          </div>
        </div>
      </div>

      <!-- Add Country Modal (Simple overlay) -->
      <div
        *ngIf="showingAddModal()"
        class="modal-overlay"
        (click)="closeAddModal()"
      >
        <div class="modal-content" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>Add Countries</h3>
            <button class="btn ghost" (click)="closeAddModal()">×</button>
          </header>

          <div class="modal-body">
            <div class="quick-add-buttons">
              <button
                *ngFor="let country of topCountriesSample()"
                class="country-quick-add"
                (click)="addCountryQuick(country.code)"
                [disabled]="isSelected(country.code)"
              >
                {{ country.name }}
                <span class="country-region">{{ country.region }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        --page-side-padding: 36px;
        --page-bottom-padding: 20px;
        --content-max-width: 1400px;
        --card-radius: 14px;

        --cmp-glass-bg-1: rgba(255, 255, 255, 0.06);
        --cmp-glass-bg-2: rgba(255, 255, 255, 0.02);
        --muted: rgba(255, 255, 255, 0.85);

        --row-height: 56px;
        --visible-rows: 4;
        --table-header-height: 56px;

        display: block;
        font-family:
          Inter,
          system-ui,
          -apple-system,
          'Segoe UI',
          Roboto,
          'Helvetica Neue',
          Arial;
      }

      /* ------------------ CENTERED, WIDER, LOWER card ------------------ */
      .cmp-card.centered-card {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        bottom: var(--page-bottom-padding);
        width: min(96vw, var(--content-max-width));
        max-width: var(--content-max-width);
        z-index: 120;
        pointer-events: auto;
        box-sizing: border-box;

        border-radius: var(--card-radius);
        padding: 16px 20px;
        background: linear-gradient(
          180deg,
          var(--cmp-glass-bg-1),
          var(--cmp-glass-bg-2)
        );
        border: 1px solid rgba(255, 255, 255, 0.12);
        backdrop-filter: blur(14px) saturate(1.15);
        -webkit-backdrop-filter: blur(14px) saturate(1.15);
        box-shadow:
          0 18px 40px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      /* header + controls */
      .cmp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
        flex-wrap: wrap;
      }

      .cmp-header h2 {
        margin: 0;
        font-weight: 600;
        font-size: 20px;
        color: var(--muted);
      }

      .stats-summary {
        display: flex;
        gap: 16px;
        align-items: center;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.7);
      }

      .stats-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .stats-item strong {
        color: rgba(255, 255, 255, 0.9);
      }

      .controls {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }

      .search-group {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.01)
        );
        backdrop-filter: blur(12px) saturate(1.1);
        -webkit-backdrop-filter: blur(12px) saturate(1.1);
        box-shadow:
          0 8px 20px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.03);
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition:
          transform 150ms ease,
          box-shadow 150ms ease,
          color 150ms ease;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
        color: rgba(255, 255, 255, 0.95);
      }

      .btn.primary {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.05),
          rgba(255, 255, 255, 0.02)
        );
        border-color: rgba(255, 255, 255, 0.15);
        color: #fff;
      }

      .btn.ghost {
        background: transparent;
        border-color: rgba(255, 255, 255, 0.06);
      }

      .search {
        padding: 9px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
        color: var(--muted);
        min-width: 200px;
        font-size: 14px;
      }

      .search::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      /* ------------------ GLASS TABLE WITH STICKY HEADER ------------------ */
      .glass-table-wrapper {
        border-radius: 12px;
        padding: 10px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.03),
          rgba(255, 255, 255, 0)
        );
        border: 1px solid rgba(255, 255, 255, 0.06);
        max-height: calc(
          var(--table-header-height) +
            (var(--row-height) * var(--visible-rows)) + 12px
        );
        overflow-y: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        position: relative;
      }

      .cmp-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1100px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.92);
        table-layout: fixed;
      }

      thead th {
        text-align: left;
        padding: 14px 16px;
        font-weight: 600;
        font-size: 13px;
        color: rgba(255, 255, 255, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);

        position: sticky;
        top: 0;
        z-index: 115;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.6),
          rgba(0, 0, 0, 0.4)
        );
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }

      tbody tr {
        transition:
          background 0.15s ease,
          transform 0.15s ease;
      }

      tbody tr:nth-child(odd) {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.015),
          transparent
        );
      }

      tbody td {
        padding: 12px 16px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        height: var(--row-height);
        box-sizing: border-box;
      }

      .data-row[aria-selected='true'] {
        background: linear-gradient(
          180deg,
          rgba(25, 184, 148, 0.08),
          rgba(25, 184, 148, 0.02)
        );
        box-shadow: inset 0 1px 0 rgba(25, 184, 148, 0.1);
      }

      .data-row:focus {
        outline: none;
        box-shadow: 0 0 0 2px rgba(25, 184, 148, 0.3);
      }

      .country-cell .country-link {
        text-decoration: none;
        color: #19b894;
        font-weight: 600;
        transition: color 0.15s ease;
      }

      .country-cell .country-link:hover {
        color: #20c9a6;
      }

      .code-pill {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.9);
        font-size: 11px;
        font-weight: 600;
        border: 1px solid rgba(255, 255, 255, 0.04);
      }

      .region-badge {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(100, 149, 237, 0.1);
        color: #6495ed;
        font-size: 11px;
        font-weight: 500;
        border: 1px solid rgba(100, 149, 237, 0.2);
      }

      .hdi-badge {
        display: inline-block;
        padding: 3px 7px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 10px;
        margin-left: 8px;
        text-transform: uppercase;
      }

      .hdi-badge[data-category='Very High'] {
        background: rgba(20, 200, 120, 0.12);
        color: #14c878;
        border: 1px solid rgba(20, 200, 120, 0.2);
      }

      .hdi-badge[data-category='High'] {
        background: rgba(255, 193, 7, 0.12);
        color: #ffc107;
        border: 1px solid rgba(255, 193, 7, 0.2);
      }

      .hdi-badge[data-category='Medium'] {
        background: rgba(255, 152, 0, 0.12);
        color: #ff9800;
        border: 1px solid rgba(255, 152, 0, 0.2);
      }

      .hdi-badge[data-category='Low'] {
        background: rgba(244, 67, 54, 0.12);
        color: #f44336;
        border: 1px solid rgba(244, 67, 54, 0.2);
      }

      .population-cell {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 600;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.03),
          rgba(255, 255, 255, 0.01)
        );
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .icon-btn:hover {
        color: #ff6b6b;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
      }

      /* Empty state */
      .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        text-align: center;
      }

      .empty-content h3 {
        margin: 0 0 8px 0;
        color: rgba(255, 255, 255, 0.8);
        font-size: 18px;
        font-weight: 600;
      }

      .empty-content p {
        margin: 0 0 20px 0;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      /* Modal styles */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .modal-content {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.04)
        );
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 12px;
        padding: 0;
        max-width: 600px;
        width: 90vw;
        max-height: 80vh;
        overflow: auto;
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .modal-header h3 {
        margin: 0;
        color: rgba(255, 255, 255, 0.95);
        font-size: 18px;
        font-weight: 600;
      }

      .modal-body {
        padding: 24px;
      }

      .quick-add-buttons {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 12px;
      }

      .country-quick-add {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        padding: 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.01)
        );
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        transition: all 0.15s ease;
        font-weight: 500;
      }

      .country-quick-add:not(:disabled):hover {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.04)
        );
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      }

      .country-quick-add:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .country-region {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 4px;
      }

      /* Responsive */
      @media (max-width: 720px) {
        .cmp-header {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .stats-summary {
          justify-content: center;
        }

        .controls {
          justify-content: center;
        }

        .search-group {
          flex: 1;
        }

        .search {
          flex: 1;
          min-width: 0;
        }

        .cmp-card.centered-card {
          left: 12px;
          right: 12px;
          bottom: 24px;
          width: calc(100% - 24px);
          transform: none;
        }
      }

      .sr-only {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      /* Scrollbar styling */
      .glass-table-wrapper::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      .glass-table-wrapper::-webkit-scrollbar-thumb {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.08),
          rgba(255, 255, 255, 0.04)
        );
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .glass-table-wrapper {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
      }
    `,
  ],
})
export class ComparisonCard implements AfterViewInit {
  // Inject the country data service
  protected readonly countryDataService = inject(CountryDataService);

  // UI state signals
  readonly _focusedIndex = signal(0);
  private readonly _showingAddModal = signal(false);

  readonly focusedIndex = this._focusedIndex.asReadonly();
  readonly showingAddModal = this._showingAddModal.asReadonly();

  // Computed values
  readonly displayedCountries = computed(() =>
    this.countryDataService.selectedCountryData(),
  );

  readonly availableCountries = computed(() =>
    this.countryDataService
      .filteredCountries()
      .filter(
        (country) =>
          !this.countryDataService.selectedCountries().includes(country.code),
      ),
  );

  readonly topCountriesSample = computed(() => {
    const topCountries = this.countryDataService.getTopCountries();
    const selected = new Set(this.countryDataService.selectedCountries());

    // Mix of top countries from different categories
    const sample = [
      ...topCountries.byGDP.slice(0, 5),
      ...topCountries.byPopulation.slice(0, 5),
      ...topCountries.byHDI.slice(0, 5),
      ...topCountries.byHappiness.slice(0, 5),
    ];

    // Remove duplicates and already selected countries
    const unique = Array.from(
      new Map(sample.map((c) => [c.code, c])).values(),
    ).filter((c) => !selected.has(c.code));

    return unique.slice(0, 12); // Show max 12 for quick add
  });

  // DOM refs for keyboard focus
  @ViewChildren('rowItem', { read: ElementRef }) rowItems!: QueryList<
    ElementRef<HTMLElement>
  >;

  ngAfterViewInit(): void {
    // Initialize with some default countries if none selected
    if (this.countryDataService.selectedCountries().length === 0) {
      this.countryDataService.selectCountries([
        'USA',
        'CHN',
        'JPN',
        'DEU',
        'GBR',
      ]);
    }

    this.clampFocusedIndex();
  }

  // Search handling
  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.countryDataService.setSearchQuery(target.value);
    this._focusedIndex.set(0);
  }

  // Country selection
  selectCountry(code: string): void {
    this.countryDataService.toggleCountrySelection(code);
  }

  toggleRowSelection(index: number): void {
    const countries = this.displayedCountries();
    if (index < 0 || index >= countries.length) return;

    const country = countries[index];
    this.countryDataService.toggleCountrySelection(country.code);

    this._focusedIndex.set(index);
    this.focusRow(index);
  }

  isSelected(code: string): boolean {
    return this.countryDataService.selectedCountries().includes(code);
  }

  removeCountry(code: string): void {
    this.countryDataService.removeFromSelection([code]);
    this.clampFocusedIndex();
  }

  // Modal handling
  showAddModal(): void {
    this._showingAddModal.set(true);
  }

  closeAddModal(): void {
    this._showingAddModal.set(false);
  }

  showFilterModal(): void {
    // TODO: Implement filter modal
    console.log('Filter modal not yet implemented');
  }

  addCountryQuick(code: string): void {
    this.countryDataService.addToSelection([code]);
  }

  // Clear and export
  onClearAll(): void {
    this.countryDataService.clearSelection();
    this.countryDataService.clearSearch();
    this._focusedIndex.set(0);
  }

  onExportCSV(): void {
    if (!this.countryDataService.hasSelectedCountries()) return;

    const csv = this.countryDataService.exportSelectedAsCSV();
    if (!csv) return;

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `country-comparison-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Focus and keyboard navigation
  focusRow(index: number): void {
    queueMicrotask(() => {
      const elems = this.rowItems ? this.rowItems.toArray() : [];
      if (index < 0 || index >= elems.length) return;

      const el = elems[index].nativeElement as HTMLElement | null;
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    });
  }

  private clampFocusedIndex(): void {
    const maxIndex = Math.max(0, this.displayedCountries().length - 1);
    const currentIndex = this.focusedIndex();
    if (currentIndex > maxIndex) {
      this._focusedIndex.set(maxIndex);
    }
  }

  // Track by function for ngFor
  trackByCode(_index: number, country: CountryDataRecord): string {
    return country.code;
  }
}

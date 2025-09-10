import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { TableKeyboardDirective } from '@lib/directives/table-keyboard.directive';

type CountryRow = {
  id: string;
  name: string;
  code: string;
  capital: string;
  gdpPerCapita: string;
  hdi: string;
  hdiTag?: string;
  population: string;
  lifeExpectancy: string;
  happiness: string;
};

@Component({
  selector: 'app-comparison-card',
  imports: [CommonModule, TableKeyboardDirective],
  template: `
    <section class="cmp-card centered-card" aria-labelledby="cmp-title">
      <header class="cmp-header">
        <h2 id="cmp-title">Country Statistics Comparison</h2>

        <div class="controls" role="toolbar" aria-label="Table actions">
          <!-- Search + Add -->
          <div class="search-group" role="search">
            <label class="sr-only" for="search-input">Search countries</label>
            <input
              id="search-input"
              class="search"
              type="search"
              placeholder="Search countries..."
              [value]="searchTerm"
              (input)="onSearch($event)"
              aria-label="Search countries"
            />
            <button
              class="btn ghost"
              type="button"
              (click)="addCountry()"
              aria-label="Add country"
            >
              Add Country
            </button>
          </div>

          <!-- Clear + Export -->
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
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
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
      <!-- max-height is calculated so only X rows are visible before scroll -->
      <div
        class="glass-table-wrapper"
        role="region"
        aria-label="Country comparison table"
        [appTableKeyboard]="filteredRows().length"
        [(focusedIndex)]="focusedIndex"
        (navigate)="focusRow($event)"
        (activate)="selectRowByIndex($event)"
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
                let r of filteredRows();
                let i = index;
                trackBy: trackById
              "
              #rowItem
              role="row"
              class="data-row"
              [attr.data-id]="r.id"
              [attr.tabindex]="i === focusedIndex ? 0 : -1"
              [attr.aria-selected]="isSelected(r.id)"
              (click)="selectRowByIndex(i)"
            >
              <td role="cell" class="country-cell">
                <a
                  class="country-link"
                  href="#"
                  (click)="$event.preventDefault()"
                >
                  <span class="country-name">{{ r.name }}</span>
                </a>
              </td>

              <td role="cell">
                <span class="code-pill">{{ r.code }}</span>
              </td>
              <td role="cell">{{ r.capital }}</td>
              <td role="cell">{{ r.gdpPerCapita }}</td>

              <td role="cell">
                <span class="hdi">{{ r.hdi }}</span>
                <span *ngIf="r.hdiTag" class="hdi-badge">{{ r.hdiTag }}</span>
              </td>

              <td role="cell" class="population-cell">
                <strong>{{ r.population }}</strong>
              </td>

              <td role="cell">{{ r.lifeExpectancy }}</td>

              <td role="cell">
                <span class="heart" aria-hidden="true">❤</span>
                <span class="happy">{{ r.happiness }}</span>
              </td>

              <td role="cell" class="actions-col">
                <button
                  class="icon-btn"
                  aria-label="Remove row"
                  (click)="onRemove(r.id); $event.stopPropagation()"
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
        --visible-rows: 3;
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
        padding: 14px 18px;
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
        gap: 12px;
        margin-bottom: 12px;
      }
      .cmp-header h2 {
        margin: 0;
        font-weight: 600;
        font-size: 18px;
        color: var(--muted);
      }

      .controls {
        display: flex;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }
      .search-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.03),
          rgba(255, 255, 255, 0.01)
        );
        backdrop-filter: blur(10px) saturate(1.05);
        -webkit-backdrop-filter: blur(10px) saturate(1.05);
        box-shadow:
          0 8px 20px rgba(0, 0, 0, 0.45),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
        color: var(--muted);
        cursor: pointer;
        font-size: 13px;
        transition:
          transform 160ms ease,
          box-shadow 160ms ease,
          color 160ms ease;
      }
      .btn.primary {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.04),
          rgba(255, 255, 255, 0.02)
        );
        border-color: rgba(255, 255, 255, 0.12);
        color: #fff;
      }
      .btn.ghost {
        background: transparent;
      }

      .icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.02),
          rgba(255, 255, 255, 0.01)
        );
        box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
      }
      .btn:hover,
      .icon-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
      }

      .search {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(255, 255, 255, 0.02);
        color: var(--muted);
        min-width: 180px;
      }

      /* ------------------ GLASS TABLE WITH STICKY HEADER ------------------ */
      .glass-table-wrapper {
        border-radius: 10px;
        padding: 8px;
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.02),
          rgba(255, 255, 255, 0)
        );
        border: 1px solid rgba(255, 255, 255, 0.04);
        /* limit height so only X rows visible before scroll (header + rows) */
        max-height: calc(
          var(--table-header-height) +
            (var(--row-height) * var(--visible-rows)) + 8px
        );
        overflow-y: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        z-index: 110;
      }

      .cmp-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 900px;
        font-size: 14px;
        color: rgba(255, 255, 255, 0.92);
        table-layout: fixed;
      }

      thead th {
        text-align: left;
        padding: 12px 16px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);

        /* make header sticky */
        position: sticky;
        top: 0;
        z-index: 115;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.55),
          rgba(0, 0, 0, 0.35)
        );
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      tbody tr {
        transition:
          background 0.12s ease,
          transform 0.12s ease;
      }
      tbody tr:nth-child(odd) {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.01),
          transparent
        );
      }

      tbody td {
        padding: 10px 14px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        height: var(--row-height);
        box-sizing: border-box;
      }

      /* selection visuals */
      .data-row[aria-selected='true'] {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.03),
          rgba(255, 255, 255, 0.01)
        );
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }
      .data-row:focus {
        outline: none;
        box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.06);
      }

      .country-cell .country-link {
        text-decoration: none;
        color: #19b894;
        font-weight: 600;
      }
      .code-pill {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.04);
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        border: 1px solid rgba(255, 255, 255, 0.03);
      }

      .hdi-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 8px;
        background: rgba(20, 200, 120, 0.12);
        color: #0b8a55;
        font-weight: 600;
        font-size: 12px;
        border: 1px solid rgba(20, 200, 120, 0.12);
        margin-left: 6px;
      }
      .population-cell {
        color: rgba(255, 255, 255, 0.95);
      }
      .actions-col {
        text-align: right;
      }

      /* styled scrollbar for wrapper */
      .glass-table-wrapper::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      .glass-table-wrapper::-webkit-scrollbar-thumb {
        background: linear-gradient(
          180deg,
          rgba(255, 255, 255, 0.06),
          rgba(255, 255, 255, 0.02)
        );
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .glass-table-wrapper {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
      }

      /* responsive: convert to card list below 720px */
      .cmp-cards {
        display: none;
        gap: 12px;
      }
      .cmp-card-row {
        display: none;
      }

      @media (max-width: 720px) {
        .cmp-table {
          display: none;
        }
        .cmp-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 6px 0;
        }
        .cmp-card-row {
          display: block;
          border-radius: 12px;
          padding: 12px;
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.02),
            transparent
          );
          border: 1px solid rgba(255, 255, 255, 0.04);
        }
        :host {
          --row-height: 84px;
          --table-header-height: 64px;
        }
        .cmp-card {
          left: 12px;
          right: 12px;
          bottom: 24px;
          max-width: calc(100% - 24px);
        }
        .controls {
          width: 100%;
          justify-content: flex-end;
        }
        .search {
          min-width: 120px;
        }
      }

      .sr-only {
        position: absolute;
        left: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        .active-pill::before,
        .active-pill::after,
        tbody tr {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class ComparisonCard implements AfterViewInit {
  rows: CountryRow[] = [
    {
      id: 'peru',
      name: 'Peru',
      code: 'PER',
      capital: 'Lima',
      gdpPerCapita: '$15,294',
      hdi: '79.4%',
      hdiTag: 'High',
      population: '33.8M',
      lifeExpectancy: '77.74 years',
      happiness: '5.95/10',
    },
    {
      id: 'usa',
      name: 'United States',
      code: 'USA',
      capital: 'Washington, D.C.',
      gdpPerCapita: '$74,578',
      hdi: '93.8%',
      hdiTag: 'Very High',
      population: '343.5M',
      lifeExpectancy: '79.3 years',
      happiness: '6.72/10',
    },
    {
      id: 'mex',
      name: 'Mexico',
      code: 'MEX',
      capital: 'Mexico City',
      gdpPerCapita: '$22,143',
      hdi: '78.9%',
      hdiTag: 'High',
      population: '129.7M',
      lifeExpectancy: '75.07 years',
      happiness: '6.98/10',
    },
    // extra rows to demo scroll
    {
      id: 'bra',
      name: 'Brazil',
      code: 'BRA',
      capital: 'Brasília',
      gdpPerCapita: '$9,000',
      hdi: '67.2%',
      hdiTag: 'Medium',
      population: '213.0M',
      lifeExpectancy: '75.0 years',
      happiness: '6.5/10',
    },
    {
      id: 'chn',
      name: 'China',
      code: 'CHN',
      capital: 'Beijing',
      gdpPerCapita: '$10,500',
      hdi: '77.3%',
      hdiTag: 'High',
      population: '1.43B',
      lifeExpectancy: '77.3 years',
      happiness: '5.6/10',
    },
  ];

  // UI state
  searchTerm = '';
  focusedIndex = 0;
  selectedRowId: string | null = null;

  // DOM refs for keyboard focus
  @ViewChildren('rowItem', { read: ElementRef }) rowItems!: QueryList<
    ElementRef<HTMLElement>
  >;

  ngAfterViewInit(): void {
    // clamp focusedIndex
    this.focusedIndex = Math.max(
      0,
      Math.min(this.focusedIndex, this.filteredRows().length - 1),
    );
  }

  // filtering
  filteredRows(): CountryRow[] {
    if (!this.searchTerm?.trim()) return this.rows;
    const q = this.searchTerm.trim().toLowerCase();
    return this.rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.capital.toLowerCase().includes(q),
    );
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm = target.value;
    this.focusedIndex = 0;
  }

  addCountry(): void {
    const id = `new-${Date.now()}`;
    const newRow: CountryRow = {
      id,
      name: 'New Country',
      code: 'NEW',
      capital: 'Capital City',
      gdpPerCapita: '$0',
      hdi: '0.0%',
      hdiTag: undefined,
      population: '0.0M',
      lifeExpectancy: '0.0 years',
      happiness: '0.00/10',
    };
    this.rows = [newRow, ...this.rows];
    queueMicrotask(() => {
      this.focusedIndex = 0;
      this.focusRow(0);
    });
  }

  onClearAll(): void {
    this.searchTerm = '';
    this.selectedRowId = null;
    this.focusedIndex = 0;
  }

  onRemove(id: string): void {
    this.rows = this.rows.filter((r) => r.id !== id);
    this.focusedIndex = Math.max(
      0,
      Math.min(this.focusedIndex, this.filteredRows().length - 1),
    );
  }

  // CSV export
  onExportCSV(): void {
    const rows = this.filteredRows();
    if (!rows.length) return;
    const headers = [
      'Country',
      'Code',
      'Capital',
      'GDP per Capita',
      'HDI',
      'Population',
      'Life Expectancy',
      'Happiness Index',
    ];
    const csvLines = [headers.join(',')];
    for (const r of rows) {
      const fields = [
        this.csvEscape(r.name),
        this.csvEscape(r.code),
        this.csvEscape(r.capital),
        this.csvEscape(r.gdpPerCapita),
        this.csvEscape(r.hdi),
        this.csvEscape(r.population),
        this.csvEscape(r.lifeExpectancy),
        this.csvEscape(r.happiness),
      ];
      csvLines.push(fields.join(','));
    }
    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'country-comparison.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private csvEscape(value: string): string {
    if (value == null) return '';
    const needQuotes = /[",\n]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needQuotes ? `"${escaped}"` : escaped;
  }

  // selection & focus
  isSelected(id: string): boolean {
    return this.selectedRowId === id;
  }

  selectRowByIndex(index: number): void {
    const list = this.filteredRows();
    if (index < 0 || index >= list.length) return;
    const id = list[index].id;
    this.selectedRowId = id;
    this.focusedIndex = index;
    this.focusRow(index);
  }

  public focusRow(index: number): void {
    queueMicrotask(() => {
      const elems = this.rowItems ? this.rowItems.toArray() : [];
      if (index < 0 || index >= elems.length) return;
      const el = elems[index].nativeElement as HTMLElement | null;
      if (!el) return;
      if (typeof el.focus === 'function') el.focus();
    });
  }

  trackById(_i: number, r: CountryRow): string {
    return r.id;
  }
}

import { Injectable, signal, computed } from '@angular/core';
import {
  CountryDataRecord,
  CountryFilter,
  CountrySearchOptions,
  HDICategory,
  CountryRegion,
} from '../types/country-data.types';
import {
  COUNTRY_DATA,
  COUNTRY_BY_CODE,
  COUNTRY_BY_NAME,
  COUNTRIES_BY_REGION,
  TOP_COUNTRIES,
} from '../../../assets/data/country-data';

/**
 * High-Performance Country Data Service
 *
 * Uses bundled country data for zero-latency access.
 * Optimized for Three.js integration and fast filtering/searching.
 *
 * Features:
 * - Instant data access (no API calls)
 * - Optimized lookup maps for performance
 * - Advanced filtering and searching
 * - Angular 20 signals for reactive state
 * - Type-safe operations
 */
@Injectable({
  providedIn: 'root',
})
export class CountryDataService {
  // Private signals for internal state management
  private readonly _selectedCountries = signal<string[]>([]);
  private readonly _currentFilter = signal<CountryFilter | null>(null);
  private readonly _searchQuery = signal<string>('');

  // Public readonly signals
  readonly selectedCountries = this._selectedCountries.asReadonly();
  readonly currentFilter = this._currentFilter.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  // Computed values
  readonly allCountries = computed(() => COUNTRY_DATA);

  readonly filteredCountries = computed(() => {
    let countries = COUNTRY_DATA;
    const filter = this.currentFilter();
    const query = this.searchQuery();

    // Apply filters
    if (filter) {
      countries = this.applyFilter(countries, filter);
    }

    // Apply search
    if (query) {
      countries = this.searchCountries(countries, { query });
    }

    return countries;
  });

  readonly selectedCountryData = computed(() =>
    this.selectedCountries()
      .map((id) => COUNTRY_BY_CODE.get(id))
      .filter((country): country is CountryDataRecord => country !== undefined),
  );

  readonly hasSelectedCountries = computed(
    () => this.selectedCountries().length > 0,
  );

  readonly canCompare = computed(() => this.selectedCountries().length >= 2);

  readonly countryCount = computed(() => this.filteredCountries().length);

  readonly dataCompleteness = computed(() => {
    const countries = this.filteredCountries();
    if (countries.length === 0) return 0;

    const totalCompleteness = countries.reduce(
      (sum, c) => sum + c.dataCompleteness,
      0,
    );
    return totalCompleteness / countries.length;
  });

  /**
   * Get all countries (from bundled data)
   */
  getAllCountries(): readonly CountryDataRecord[] {
    return COUNTRY_DATA;
  }

  /**
   * Get filtered countries based on current filter and search
   */
  getFilteredCountries(): readonly CountryDataRecord[] {
    return this.filteredCountries();
  }

  /**
   * Get country by code (optimized lookup)
   */
  getCountryByCode(code: string): CountryDataRecord | undefined {
    return COUNTRY_BY_CODE.get(code);
  }

  /**
   * Get country by name (optimized lookup, case-insensitive)
   */
  getCountryByName(name: string): CountryDataRecord | undefined {
    return COUNTRY_BY_NAME.get(name.toLowerCase());
  }

  /**
   * Get countries by region (optimized lookup)
   */
  getCountriesByRegion(region: CountryRegion): readonly CountryDataRecord[] {
    return COUNTRIES_BY_REGION.get(region) || [];
  }

  /**
   * Get top countries by various metrics
   */
  getTopCountries() {
    return TOP_COUNTRIES;
  }

  /**
   * Select/deselect a country for comparison
   */
  toggleCountrySelection(code: string): void {
    this._selectedCountries.update((selected) => {
      const isSelected = selected.includes(code);
      if (isSelected) {
        return selected.filter((selectedCode) => selectedCode !== code);
      } else {
        return [...selected, code];
      }
    });
  }

  /**
   * Select multiple countries by codes
   */
  selectCountries(codes: string[]): void {
    // Validate that all codes exist
    const validCodes = codes.filter((code) => COUNTRY_BY_CODE.has(code));
    this._selectedCountries.set(validCodes);
  }

  /**
   * Add countries to selection
   */
  addToSelection(codes: string[]): void {
    this._selectedCountries.update((selected) => {
      const validNewCodes = codes.filter(
        (code) => COUNTRY_BY_CODE.has(code) && !selected.includes(code),
      );
      return [...selected, ...validNewCodes];
    });
  }

  /**
   * Remove countries from selection
   */
  removeFromSelection(codes: string[]): void {
    this._selectedCountries.update((selected) =>
      selected.filter((code) => !codes.includes(code)),
    );
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this._selectedCountries.set([]);
  }

  /**
   * Set search query (reactive)
   */
  setSearchQuery(query: string): void {
    this._searchQuery.set(query.trim());
  }

  /**
   * Clear search query
   */
  clearSearch(): void {
    this._searchQuery.set('');
  }

  /**
   * Search countries with advanced options
   */
  searchCountries(
    countries: readonly CountryDataRecord[] = COUNTRY_DATA,
    options: CountrySearchOptions = {},
  ): readonly CountryDataRecord[] {
    const { query, fields, caseSensitive = false } = options;

    if (!query?.trim()) return countries;

    const normalizedQuery = caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();
    const searchFields = fields || ['name', 'code', 'capital', 'region'];

    return countries.filter((country) => {
      return searchFields.some((field) => {
        const value = country[field as keyof CountryDataRecord];
        if (value === null || value === undefined) return false;

        const stringValue = Array.isArray(value)
          ? value.join(' ')
          : String(value);
        const normalizedValue = caseSensitive
          ? stringValue
          : stringValue.toLowerCase();

        return normalizedValue.includes(normalizedQuery);
      });
    });
  }

  /**
   * Set filter (reactive)
   */
  setFilter(filter: CountryFilter | null): void {
    this._currentFilter.set(filter);
  }

  /**
   * Clear filter
   */
  clearFilter(): void {
    this._currentFilter.set(null);
  }

  /**
   * Apply filter to countries
   */
  private applyFilter(
    countries: readonly CountryDataRecord[],
    filter: CountryFilter,
  ): readonly CountryDataRecord[] {
    return countries.filter((country) => {
      // Region filter
      if (
        filter.regions?.length &&
        !filter.regions.includes(country.region as CountryRegion)
      ) {
        return false;
      }

      // HDI category filter
      if (
        filter.hdiCategories?.length &&
        (!country.hdiCategory ||
          !filter.hdiCategories.includes(country.hdiCategory))
      ) {
        return false;
      }

      // Population range
      if (
        filter.minPopulation !== undefined &&
        country.population < filter.minPopulation
      ) {
        return false;
      }
      if (
        filter.maxPopulation !== undefined &&
        country.population > filter.maxPopulation
      ) {
        return false;
      }

      // GDP range
      if (
        filter.minGDP !== undefined &&
        (country.gdpPerCapita || 0) < filter.minGDP
      ) {
        return false;
      }
      if (
        filter.maxGDP !== undefined &&
        (country.gdpPerCapita || 0) > filter.maxGDP
      ) {
        return false;
      }

      // Data completeness
      if (
        filter.minDataCompleteness !== undefined &&
        country.dataCompleteness < filter.minDataCompleteness
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Export selected countries data as CSV
   */
  exportSelectedAsCSV(): string {
    const selectedData = this.selectedCountryData();
    if (selectedData.length === 0) return '';

    const headers = [
      'Country',
      'Code',
      'Capital',
      'Region',
      'Population',
      'GDP per Capita',
      'Life Expectancy',
      'HDI',
      'HDI Category',
      'Happiness Index',
      'Latitude',
      'Longitude',
    ];

    const csvLines = [headers.join(',')];

    for (const country of selectedData) {
      const fields = [
        this.csvEscape(country.name),
        this.csvEscape(country.code),
        this.csvEscape(country.capital),
        this.csvEscape(country.region),
        this.csvEscape(country.populationFormatted),
        this.csvEscape(country.gdpPerCapitaFormatted),
        this.csvEscape(country.lifeExpectancyFormatted),
        this.csvEscape(country.hdiFormatted),
        this.csvEscape(country.hdiCategory || ''),
        this.csvEscape(country.happinessFormatted),
        this.csvEscape(country.latitude.toString()),
        this.csvEscape(country.longitude.toString()),
      ];
      csvLines.push(fields.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Export filtered countries as JSON
   */
  exportFilteredAsJSON(): string {
    const data = this.filteredCountries();
    return JSON.stringify(data, null, 2);
  }

  /**
   * Get countries for Three.js visualization (optimized for geographic data)
   */
  getCountriesForVisualization(): Array<{
    code: string;
    name: string;
    latitude: number;
    longitude: number;
    population: number;
    gdp: number | null;
    hdi: number | null;
    happiness: number | null;
    isSelected: boolean;
  }> {
    const selectedCodes = new Set(this.selectedCountries());

    return this.filteredCountries().map((country) => ({
      code: country.code,
      name: country.name,
      latitude: country.latitude,
      longitude: country.longitude,
      population: country.population,
      gdp: country.gdpPerCapita,
      hdi: country.hdi,
      happiness: country.happiness,
      isSelected: selectedCodes.has(country.code),
    }));
  }

  /**
   * Reset all filters and selections
   */
  resetToDefaults(): void {
    this._selectedCountries.set([]);
    this._currentFilter.set(null);
    this._searchQuery.set('');
  }

  /**
   * Get countries similar to a given country (by region and HDI category)
   */
  getSimilarCountries(
    targetCode: string,
    limit: number = 10,
  ): readonly CountryDataRecord[] {
    const target = this.getCountryByCode(targetCode);
    if (!target) return [];

    return COUNTRY_DATA.filter(
      (country) =>
        country.code !== targetCode &&
        country.region === target.region &&
        country.hdiCategory === target.hdiCategory,
    )
      .sort((a, b) => {
        // Sort by data completeness, then population similarity
        const completenessSort = b.dataCompleteness - a.dataCompleteness;
        if (Math.abs(completenessSort) > 0.1) return completenessSort;

        const popDiffA = Math.abs(a.population - target.population);
        const popDiffB = Math.abs(b.population - target.population);
        return popDiffA - popDiffB;
      })
      .slice(0, limit);
  }

  /**
   * Add country to selection from globe interaction (by name)
   * Used when double-clicking countries on the 3D globe
   */
  addCountryFromGlobe(countryName: string): boolean {
    // Try exact match first
    let country = this.getCountryByName(countryName);

    // If no exact match, try fuzzy matching for problematic countries
    if (!country) {
      country = this.findCountryByFuzzyName(countryName);
    }

    if (!country) {
      console.warn(`Country not found after fuzzy matching: ${countryName}`);
      return false;
    }

    // Check if already selected to prevent duplicates
    if (this.selectedCountries().includes(country.code)) {
      return false;
    }

    this.addToSelection([country.code]);
    return true;
  }

  /**
   * Find country using fuzzy name matching for mesh names that don't exactly match data names
   */
  private findCountryByFuzzyName(
    meshName: string,
  ): CountryDataRecord | undefined {
    const normalizedMeshName = meshName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '');

    // Special mappings for problematic countries
    const specialMappings: Record<string, string> = {
      unitedstates: 'United States',
      unitedstatesofamerica: 'United States',
      usa: 'United States',
      america: 'United States',
      us: 'United States',
      unitedmexicanstates: 'Mexico',
      estados: 'Mexico',
      mexicanrepublic: 'Mexico',
      unitedkingdom: 'United Kingdom',
      uk: 'United Kingdom',
      southkorea: 'South Korea',
      northkorea: 'North Korea',
    };

    // Check special mappings first
    if (specialMappings[normalizedMeshName]) {
      const targetName = specialMappings[normalizedMeshName];
      const country = this.getCountryByName(targetName);
      if (country) {
        return country;
      }
    }

    // Try partial matching against all country names
    for (const country of COUNTRY_DATA) {
      const normalizedCountryName = country.name
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z]/g, '');

      // Check if the mesh name contains the country name or vice versa
      if (
        normalizedMeshName.includes(normalizedCountryName) ||
        normalizedCountryName.includes(normalizedMeshName)
      ) {
        return country;
      }

      // Also check against country code
      if (country.code.toLowerCase() === normalizedMeshName) {
        return country;
      }
    }

    console.warn(
      `❌ No fuzzy match found for: "${meshName}" (normalized: "${normalizedMeshName}")`,
    );
    return undefined;
  }

  /**
   * Remove country from selection (for both globe and table interactions)
   */
  removeCountryFromSelection(countryCode: string): boolean {
    if (!this.selectedCountries().includes(countryCode)) {
      return false;
    }

    this.removeFromSelection([countryCode]);
    return true;
  }

  /**
   * Check if a country is currently selected (used by globe for visual state)
   */
  isCountrySelected(countryCode: string): boolean {
    return this.selectedCountries().includes(countryCode);
  }

  /**
   * Check if a country is selected by name (used by globe interactions)
   */
  isCountrySelectedByName(countryName: string): boolean {
    const country = this.getCountryByName(countryName);
    return country ? this.isCountrySelected(country.code) : false;
  }

  /**
   * Get all selected country codes (for globe visual synchronization)
   */
  getSelectedCountryCodes(): readonly string[] {
    return this.selectedCountries();
  }

  /**
   * Get data statistics
   */
  getDataStatistics() {
    const countries = COUNTRY_DATA;
    const total = countries.length;

    return {
      total,
      withGDP: countries.filter((c) => c.gdpPerCapita !== null).length,
      withLifeExpectancy: countries.filter((c) => c.lifeExpectancy !== null)
        .length,
      withHDI: countries.filter((c) => c.hdi !== null).length,
      withHappiness: countries.filter((c) => c.happiness !== null).length,
      regions: Array.from(new Set(countries.map((c) => c.region))).sort(),
      averageDataCompleteness:
        countries.reduce((sum, c) => sum + c.dataCompleteness, 0) / total,
      selected: this.selectedCountries().length,
      filtered: this.filteredCountries().length,
    };
  }

  /**
   * Escape CSV values
   */
  private csvEscape(value: string): string {
    if (value == null) return '';
    const needQuotes = /[",\n]/.test(value);
    const escaped = value.replace(/"/g, '""');
    return needQuotes ? `"${escaped}"` : escaped;
  }
}

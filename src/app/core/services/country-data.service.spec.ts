import { TestBed } from '@angular/core/testing';
import { CountryDataService } from './country-data.service';
import { LoggerService } from './logger.service';
import type {
  CountryFilter,
  HDICategory,
  CountryRegion,
} from '../types/country-data.types';
import { vi } from 'vitest';

/**
 * Unit Tests for CountryDataService
 *
 * Tests all core functionality including:
 * - Data lookup (by code, name, region)
 * - Search and filtering
 * - Selection management
 * - Export functionality
 * - Computed values
 * - Fuzzy matching
 */
describe('CountryDataService', () => {
  let service: CountryDataService;
  let mockLoggerService: {
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Mock logger service
    mockLoggerService = {
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        CountryDataService,
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    });

    service = TestBed.inject(CountryDataService);
  });

  describe('Data Access - Basic Lookups', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should return all countries', () => {
      const countries = service.getAllCountries();
      expect(countries).toBeDefined();
      expect(countries.length).toBeGreaterThan(0);
      expect(Array.isArray(countries)).toBe(true);
    });

    it('should get country by valid code', () => {
      const usa = service.getCountryByCode('USA');
      expect(usa).toBeDefined();
      expect(usa?.code).toBe('USA');
      expect(usa?.name).toBe('United States');
    });

    it('should return undefined for invalid country code', () => {
      const invalid = service.getCountryByCode('INVALID');
      expect(invalid).toBeUndefined();
    });

    it('should get country by name (case-insensitive)', () => {
      const usa = service.getCountryByName('United States');
      expect(usa).toBeDefined();
      expect(usa?.code).toBe('USA');

      const usaLowercase = service.getCountryByName('united states');
      expect(usaLowercase).toBeDefined();
      expect(usaLowercase?.code).toBe('USA');
    });

    it('should return undefined for invalid country name', () => {
      const invalid = service.getCountryByName('Atlantis');
      expect(invalid).toBeUndefined();
    });

    it('should get countries by region', () => {
      const europeCountries = service.getCountriesByRegion(
        'Europe' as CountryRegion,
      );
      expect(europeCountries).toBeDefined();
      expect(europeCountries.length).toBeGreaterThan(0);
      europeCountries.forEach((country) => {
        expect(country.region).toBe('Europe');
      });
    });

    it('should return empty array for region with no countries', () => {
      const countries = service.getCountriesByRegion(
        'InvalidRegion' as CountryRegion,
      );
      expect(countries).toEqual([]);
    });

    it('should get top countries', () => {
      const topCountries = service.getTopCountries();
      expect(topCountries).toBeDefined();
      expect(Object.keys(topCountries).length).toBeGreaterThan(0);
    });
  });

  describe('Selection Management', () => {
    beforeEach(() => {
      // Reset selections before each test
      service.clearSelection();
    });

    it('should start with no selected countries', () => {
      expect(service.selectedCountries()).toEqual([]);
      expect(service.hasSelectedCountries()).toBe(false);
    });

    it('should toggle country selection (add)', () => {
      service.toggleCountrySelection('USA');
      expect(service.selectedCountries()).toContain('USA');
      expect(service.hasSelectedCountries()).toBe(true);
    });

    it('should toggle country selection (remove)', () => {
      service.toggleCountrySelection('USA');
      expect(service.selectedCountries()).toContain('USA');

      service.toggleCountrySelection('USA');
      expect(service.selectedCountries()).not.toContain('USA');
    });

    it('should select multiple countries', () => {
      service.selectCountries(['USA', 'CAN', 'MEX']);
      expect(service.selectedCountries().length).toBe(3);
      expect(service.selectedCountries()).toContain('USA');
      expect(service.selectedCountries()).toContain('CAN');
      expect(service.selectedCountries()).toContain('MEX');
    });

    it('should filter out invalid country codes when selecting', () => {
      service.selectCountries(['USA', 'INVALID', 'CAN']);
      expect(service.selectedCountries().length).toBe(2);
      expect(service.selectedCountries()).toContain('USA');
      expect(service.selectedCountries()).toContain('CAN');
      expect(service.selectedCountries()).not.toContain('INVALID');
    });

    it('should add to existing selection', () => {
      service.selectCountries(['USA']);
      service.addToSelection(['CAN', 'MEX']);
      expect(service.selectedCountries().length).toBe(3);
    });

    it('should not add duplicates when adding to selection', () => {
      service.selectCountries(['USA', 'CAN']);
      service.addToSelection(['CAN', 'MEX']);
      expect(service.selectedCountries().length).toBe(3);
      expect(
        service.selectedCountries().filter((c) => c === 'CAN').length,
      ).toBe(1);
    });

    it('should remove countries from selection', () => {
      service.selectCountries(['USA', 'CAN', 'MEX']);
      service.removeFromSelection(['CAN']);
      expect(service.selectedCountries().length).toBe(2);
      expect(service.selectedCountries()).not.toContain('CAN');
    });

    it('should clear all selections', () => {
      service.selectCountries(['USA', 'CAN', 'MEX']);
      service.clearSelection();
      expect(service.selectedCountries()).toEqual([]);
      expect(service.hasSelectedCountries()).toBe(false);
    });

    it('should check if country is selected by code', () => {
      service.selectCountries(['USA']);
      expect(service.isCountrySelected('USA')).toBe(true);
      expect(service.isCountrySelected('CAN')).toBe(false);
    });

    it('should check if country is selected by name', () => {
      service.selectCountries(['USA']);
      expect(service.isCountrySelectedByName('United States')).toBe(true);
      expect(service.isCountrySelectedByName('Canada')).toBe(false);
    });

    it('should return false for invalid country name when checking selection', () => {
      expect(service.isCountrySelectedByName('Atlantis')).toBe(false);
    });

    it('should get selected country codes', () => {
      service.selectCountries(['USA', 'CAN']);
      const codes = service.getSelectedCountryCodes();
      expect(codes).toEqual(['USA', 'CAN']);
    });
  });

  describe('Computed Values', () => {
    beforeEach(() => {
      service.clearSelection();
      service.clearFilter();
      service.clearSearch();
    });

    it('should compute selectedCountryData correctly', () => {
      service.selectCountries(['USA', 'CAN']);
      const data = service.selectedCountryData();
      expect(data.length).toBe(2);
      expect(data[0]?.code).toBe('USA');
      expect(data[1]?.code).toBe('CAN');
    });

    it('should filter out invalid codes from selectedCountryData', () => {
      service.selectCountries(['USA']);
      // Manually add invalid code to test computed filtering
      service['_selectedCountries'].update((arr) => [...arr, 'INVALID']);
      const data = service.selectedCountryData();
      expect(data.length).toBe(1);
      expect(data[0]?.code).toBe('USA');
    });

    it('should compute canCompare correctly', () => {
      service.selectCountries(['USA']);
      expect(service.canCompare()).toBe(false);

      service.addToSelection(['CAN']);
      expect(service.canCompare()).toBe(true);
    });

    it('should compute countryCount correctly', () => {
      const count = service.countryCount();
      expect(count).toBeGreaterThan(0);
    });

    it('should compute dataCompleteness correctly', () => {
      const completeness = service.dataCompleteness();
      expect(completeness).toBeGreaterThan(0);
      expect(completeness).toBeLessThanOrEqual(1);
    });

    it('should return 0 completeness when no countries match filter', () => {
      service.setFilter({
        minPopulation: 999999999999, // Impossible population
      });
      const completeness = service.dataCompleteness();
      expect(completeness).toBe(0);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      service.clearSearch();
      service.clearFilter();
    });

    it('should set search query', () => {
      service.setSearchQuery('United');
      expect(service.searchQuery()).toBe('United');
    });

    it('should trim search query', () => {
      service.setSearchQuery('  United  ');
      expect(service.searchQuery()).toBe('United');
    });

    it('should clear search query', () => {
      service.setSearchQuery('United');
      service.clearSearch();
      expect(service.searchQuery()).toBe('');
    });

    it('should search countries by name', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: 'United',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((c) => c.name.includes('United'))).toBe(true);
    });

    it('should search countries case-insensitively by default', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: 'united',
      });
      expect(results.length).toBeGreaterThan(0);
    });

    it('should search countries case-sensitively when specified', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: 'united',
        caseSensitive: true,
      });
      // Should find fewer results with strict case matching
      expect(results.length).toBe(0);
    });

    it('should search specific fields only', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: 'USA',
        fields: ['code'],
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((c) => c.code === 'USA')).toBe(true);
    });

    it('should return all countries when query is empty', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: '',
      });
      expect(results.length).toBe(service.getAllCountries().length);
    });

    it('should return all countries when query is whitespace', () => {
      const results = service.searchCountries(service.getAllCountries(), {
        query: '   ',
      });
      expect(results.length).toBe(service.getAllCountries().length);
    });

    it('should update filteredCountries when search query changes', () => {
      const initialCount = service.filteredCountries().length;
      service.setSearchQuery('United');
      expect(service.filteredCountries().length).toBeLessThan(initialCount);
      expect(
        service.filteredCountries().some((c) => c.name.includes('United')),
      ).toBe(true);
    });
  });

  describe('Filter Functionality', () => {
    beforeEach(() => {
      service.clearFilter();
      service.clearSearch();
    });

    it('should set filter', () => {
      const filter: CountryFilter = { regions: ['Europe' as CountryRegion] };
      service.setFilter(filter);
      expect(service.currentFilter()).toEqual(filter);
    });

    it('should clear filter', () => {
      service.setFilter({ regions: ['Europe' as CountryRegion] });
      service.clearFilter();
      expect(service.currentFilter()).toBeNull();
    });

    it('should filter by region', () => {
      service.setFilter({ regions: ['Europe' as CountryRegion] });
      const filtered = service.getFilteredCountries();
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((country) => {
        expect(country.region).toBe('Europe');
      });
    });

    it('should filter by HDI category', () => {
      service.setFilter({ hdiCategories: ['Very High' as HDICategory] });
      const filtered = service.getFilteredCountries();
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((country) => {
        expect(country.hdiCategory).toBe('Very High');
      });
    });

    it('should filter by minimum population', () => {
      const minPop = 100000000; // 100 million
      service.setFilter({ minPopulation: minPop });
      const filtered = service.getFilteredCountries();
      filtered.forEach((country) => {
        expect(country.population).toBeGreaterThanOrEqual(minPop);
      });
    });

    it('should filter by maximum population', () => {
      const maxPop = 10000000; // 10 million
      service.setFilter({ maxPopulation: maxPop });
      const filtered = service.getFilteredCountries();
      filtered.forEach((country) => {
        expect(country.population).toBeLessThanOrEqual(maxPop);
      });
    });

    it('should filter by population range', () => {
      const minPop = 10000000;
      const maxPop = 100000000;
      service.setFilter({ minPopulation: minPop, maxPopulation: maxPop });
      const filtered = service.getFilteredCountries();
      filtered.forEach((country) => {
        expect(country.population).toBeGreaterThanOrEqual(minPop);
        expect(country.population).toBeLessThanOrEqual(maxPop);
      });
    });

    it('should filter by GDP range', () => {
      const minGDP = 10000;
      const maxGDP = 50000;
      service.setFilter({ minGDP, maxGDP });
      const filtered = service.getFilteredCountries();
      filtered.forEach((country) => {
        const gdp = country.gdpPerCapita || 0;
        expect(gdp).toBeGreaterThanOrEqual(minGDP);
        expect(gdp).toBeLessThanOrEqual(maxGDP);
      });
    });

    it('should filter by data completeness', () => {
      service.setFilter({ minDataCompleteness: 0.8 });
      const filtered = service.getFilteredCountries();
      filtered.forEach((country) => {
        expect(country.dataCompleteness).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('should combine multiple filters', () => {
      service.setFilter({
        regions: ['Europe' as CountryRegion],
        hdiCategories: ['Very High' as HDICategory],
        minPopulation: 1000000,
      });
      const filtered = service.getFilteredCountries();
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((country) => {
        expect(country.region).toBe('Europe');
        expect(country.hdiCategory).toBe('Very High');
        expect(country.population).toBeGreaterThanOrEqual(1000000);
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      service.clearSelection();
    });

    it('should export selected countries as CSV', () => {
      service.selectCountries(['USA', 'CAN']);
      const csv = service.exportSelectedAsCSV();
      expect(csv).toBeTruthy();
      expect(csv).toContain('Country,Code,Capital');
      expect(csv).toContain('United States');
      expect(csv).toContain('Canada');
    });

    it('should return empty string when no countries selected for CSV', () => {
      const csv = service.exportSelectedAsCSV();
      expect(csv).toBe('');
    });

    it('should escape CSV special characters', () => {
      // Using csvEscape via reflection since it's private
      const csvEscape = (value: string) => service['csvEscape'](value);
      expect(csvEscape('Test, Value')).toBe('"Test, Value"');
      expect(csvEscape('Test "Quote"')).toBe('"Test ""Quote"""');
      expect(csvEscape('Normal')).toBe('Normal');
    });

    it('should export filtered countries as JSON', () => {
      const json = service.exportFilteredAsJSON();
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });
  });

  describe('Fuzzy Matching', () => {
    beforeEach(() => {
      service.clearSelection();
    });

    it('should add country from globe using exact name', () => {
      const result = service.addCountryFromGlobe('United States');
      expect(result).toBe(true);
      expect(service.selectedCountries()).toContain('USA');
    });

    it('should not add duplicate country from globe', () => {
      service.addCountryFromGlobe('United States');
      const result = service.addCountryFromGlobe('United States');
      expect(result).toBe(false);
      expect(service.selectedCountries().length).toBe(1);
    });

    it('should handle fuzzy matching for special cases', () => {
      const specialCases = [
        { input: 'USA', expectedCode: 'USA' },
        { input: 'United States of America', expectedCode: 'USA' },
        { input: 'United Kingdom', expectedCode: 'GBR' },
      ];

      specialCases.forEach(({ input, expectedCode }) => {
        service.clearSelection();
        const result = service.addCountryFromGlobe(input);
        expect(result).toBe(true);
        expect(service.selectedCountries()).toContain(expectedCode);
      });
    });

    it('should log warning when country not found', () => {
      const result = service.addCountryFromGlobe('Atlantis');
      expect(result).toBe(false);
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should remove country from selection by code', () => {
      service.selectCountries(['USA']);
      const result = service.removeCountryFromSelection('USA');
      expect(result).toBe(true);
      expect(service.selectedCountries()).not.toContain('USA');
    });

    it('should return false when removing non-selected country', () => {
      const result = service.removeCountryFromSelection('USA');
      expect(result).toBe(false);
    });
  });

  describe('Data Statistics', () => {
    it('should return data statistics', () => {
      const stats = service.getDataStatistics();
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.withGDP).toBeDefined();
      expect(stats.withLifeExpectancy).toBeDefined();
      expect(stats.withHDI).toBeDefined();
      expect(stats.withHappiness).toBeDefined();
      expect(Array.isArray(stats.regions)).toBe(true);
      expect(stats.averageDataCompleteness).toBeGreaterThan(0);
      expect(stats.selected).toBe(0);
      expect(stats.filtered).toBeGreaterThan(0);
    });

    it('should update statistics when selection changes', () => {
      const statsBeforeSelection = service.getDataStatistics();
      service.selectCountries(['USA', 'CAN']);
      const statsAfterSelection = service.getDataStatistics();

      expect(statsAfterSelection.selected).toBe(2);
      expect(statsBeforeSelection.selected).toBe(0);
    });
  });

  describe('Similar Countries', () => {
    it('should find similar countries by region and HDI', () => {
      const similar = service.getSimilarCountries('USA', 5);
      expect(similar.length).toBeGreaterThan(0);
      expect(similar.length).toBeLessThanOrEqual(5);

      const target = service.getCountryByCode('USA');
      similar.forEach((country) => {
        expect(country.code).not.toBe('USA');
        expect(country.region).toBe(target?.region);
        expect(country.hdiCategory).toBe(target?.hdiCategory);
      });
    });

    it('should return empty array for invalid country code', () => {
      const similar = service.getSimilarCountries('INVALID', 5);
      expect(similar).toEqual([]);
    });

    it('should respect limit parameter', () => {
      const similar = service.getSimilarCountries('USA', 3);
      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Visualization Data', () => {
    it('should get countries for visualization', () => {
      service.selectCountries(['USA', 'CAN']);
      const vizData = service.getCountriesForVisualization();

      expect(vizData.length).toBeGreaterThan(0);
      expect(vizData[0]).toHaveProperty('code');
      expect(vizData[0]).toHaveProperty('name');
      expect(vizData[0]).toHaveProperty('latitude');
      expect(vizData[0]).toHaveProperty('longitude');
      expect(vizData[0]).toHaveProperty('population');
      expect(vizData[0]).toHaveProperty('isSelected');

      const usData = vizData.find((d) => d.code === 'USA');
      expect(usData?.isSelected).toBe(true);

      const frData = vizData.find((d) => d.code === 'FRA');
      expect(frData?.isSelected).toBe(false);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state to defaults', () => {
      service.selectCountries(['USA', 'CAN']);
      service.setSearchQuery('United');
      service.setFilter({ regions: ['Europe' as CountryRegion] });

      service.resetToDefaults();

      expect(service.selectedCountries()).toEqual([]);
      expect(service.searchQuery()).toBe('');
      expect(service.currentFilter()).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null values in CSV escape', () => {
      const csvEscape = (value: any) => service['csvEscape'](value);
      expect(csvEscape(null)).toBe('');
    });

    it('should handle empty country array in search', () => {
      const results = service.searchCountries([], { query: 'United' });
      expect(results).toEqual([]);
    });

    it('should handle undefined query in search', () => {
      const results = service.searchCountries(service.getAllCountries(), {});
      expect(results.length).toBe(service.getAllCountries().length);
    });

    it('should handle empty selection array operations', () => {
      service.selectCountries([]);
      expect(service.selectedCountries()).toEqual([]);

      service.addToSelection([]);
      expect(service.selectedCountries()).toEqual([]);

      service.removeFromSelection([]);
      expect(service.selectedCountries()).toEqual([]);
    });
  });
});

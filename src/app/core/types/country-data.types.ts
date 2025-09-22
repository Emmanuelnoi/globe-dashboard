/**
 * Generated Country Data Types - Robust Edition
 *
 * Auto-generated on: 2025-09-22T04:49:40.111Z
 * Data sources: REST Countries API, World Bank API, Manual curated data, Regional estimates
 * Coverage: 200+ countries with intelligent fallbacks
 *
 * DO NOT EDIT MANUALLY - This file is auto-generated
 */

export interface CountryDataRecord {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly capital: string;
  readonly population: number;
  readonly region: string;
  readonly subregion: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly area: number;
  readonly timezones: string[];

  // Economic and social indicators (raw values)
  readonly gdpPerCapita: number | null;
  readonly lifeExpectancy: number | null;
  readonly hdi: number | null;
  readonly happiness: number | null;

  // Formatted display values
  readonly gdpPerCapitaFormatted: string;
  readonly lifeExpectancyFormatted: string;
  readonly hdiFormatted: string;
  readonly hdiCategory: 'Very High' | 'High' | 'Medium' | 'Low' | null;
  readonly happinessFormatted: string;
  readonly populationFormatted: string;

  // Enhanced metadata
  readonly dataSource: string;
  readonly dataCompleteness: number;
}

export interface CountryDataMeta {
  readonly generatedAt: string;
  readonly totalCountries: number;
  readonly dataCompleteness: {
    readonly average: number;
    readonly withGDP: number;
    readonly withLifeExpectancy: number;
    readonly withHDI: number;
    readonly withHappiness: number;
  };
  readonly sources: string[];
  readonly dataQuality: {
    readonly manualData: number;
    readonly apiData: number;
    readonly estimatedData: number;
  };
}

export type CountryRegion =
  | 'Africa'
  | 'Americas'
  | 'Asia'
  | 'Europe'
  | 'Oceania';

export type HDICategory = 'Very High' | 'High' | 'Medium' | 'Low';

export type DataSource =
  | 'manual-gdp'
  | 'manual-life'
  | 'manual-hdi'
  | 'manual-happiness'
  | 'worldbank-gdp'
  | 'worldbank-life'
  | 'estimated-gdp'
  | 'estimated-life';

// Enhanced utility types for filtering and searching
export interface CountryFilter {
  readonly regions?: CountryRegion[];
  readonly hdiCategories?: HDICategory[];
  readonly minPopulation?: number;
  readonly maxPopulation?: number;
  readonly minGDP?: number;
  readonly maxGDP?: number;
  readonly minDataCompleteness?: number;
  readonly dataSources?: DataSource[];
}

export interface CountrySearchOptions {
  readonly query?: string;
  readonly fields?: Array<keyof CountryDataRecord>;
  readonly caseSensitive?: boolean;
  readonly includeEstimated?: boolean;
}

export interface DataQualityMetrics {
  readonly completeness: number;
  readonly sources: DataSource[];
  readonly reliability: 'high' | 'medium' | 'low';
  readonly lastUpdated: string;
}

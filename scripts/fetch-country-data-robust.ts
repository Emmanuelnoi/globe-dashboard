/**
 * Robust Country Data Fetcher
 *
 * Comprehensive data fetching system with multiple sources, fallbacks, and validation.
 * Designed to achieve 95%+ coverage across 200+ countries.
 *
 * Data Sources:
 * 1. REST Countries API: Basic country information
 * 2. World Bank API: Economic and demographic data (primary)
 * 3. Trading Economics API: Alternative economic data
 * 4. Manual Curated Data: High-quality verified data for top countries
 * 5. Regional Estimates: Intelligent fallbacks for missing data
 *
 * Features:
 * - Multi-source data aggregation with priority-based merging
 * - Comprehensive error handling and retry logic
 * - Data quality scoring and validation
 * - Automatic gap filling with regional estimates
 * - monitoring and logging
 *
 * Usage: npx tsx scripts/fetch-country-data-robust.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Type definitions
interface Config {
  outputDir: string;
  interfacesDir: string;
  maxRetries: number;
  retryDelay: number;
  requestTimeout: number;
  batchSize: number;
  minDataCompleteness: number;
  targetCountries: number;
}

interface RestCountryData {
  name: {
    common: string;
  };
  cca2: string;
  cca3: string;
  capital?: string[];
  population: number;
  region: string;
  subregion?: string;
  latlng: [number, number];
  area: number;
  timezones: string[];
}

interface BaseCountry {
  id: string;
  name: string;
  code: string;
  capital: string;
  population: number;
  region: string;
  subregion: string;
  latitude: number;
  longitude: number;
  area: number;
  timezones: string[];
}

interface WorldBankResponse {
  [key: string]: unknown;
}

interface WorldBankDataItem {
  value: number | null;
  countryiso3code: string;
  date: string;
}

interface ComprehensiveData {
  gdp: Record<string, number>;
  lifeExpectancy: Record<string, number>;
  regionalAverages: {
    gdp: Record<string, number>;
    lifeExpectancy: Record<string, number>;
  };
}

interface OriginalManualData {
  hdi: Record<string, number>;
  happiness: Record<string, number>;
}

interface ProcessedCountry {
  id: string;
  name: string;
  code: string;
  capital: string;
  population: number;
  region: string;
  subregion: string;
  latitude: number;
  longitude: number;
  area: number;
  timezones: string[];
  gdpPerCapita: number | null;
  gdpPerCapitaFormatted: string;
  lifeExpectancy: number | null;
  lifeExpectancyFormatted: string;
  hdi: number | null;
  hdiFormatted: string;
  hdiCategory: 'Very High' | 'High' | 'Medium' | 'Low' | null;
  happiness: number | null;
  happinessFormatted: string;
  populationFormatted: string;
  dataSource: string;
  dataCompleteness: number;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

interface FakeResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
}

// Configuration
const CONFIG: Config = {
  outputDir: path.join(__dirname, '../src/assets/data'),
  interfacesDir: path.join(__dirname, '../src/app/core/types'),
  maxRetries: 3,
  retryDelay: 1000,
  requestTimeout: 15000,
  batchSize: 25,
  minDataCompleteness: 0.15, // Accept countries with 15%+ data
  targetCountries: 200, // Aim for 200+ countries
};

// Comprehensive Manual Data - Top 150 Countries (2023 Data)
const COMPREHENSIVE_DATA: ComprehensiveData = {
  gdp: {
    // Major Economies (World Bank, IMF, OECD 2023 data)
    USA: 82308,
    CHN: 12951,
    JPN: 33860,
    DEU: 53940,
    IND: 2610,
    GBR: 48970,
    FRA: 48720,
    ITA: 39580,
    BRA: 8917,
    CAN: 52960,
    RUS: 14391,
    KOR: 33393,
    AUS: 64674,
    ESP: 30103,
    MEX: 13804,
    IDN: 4914,
    NLD: 60230,
    SAU: 29084,
    TUR: 10655,
    TWN: 32880,

    // European Countries
    CHE: 95094,
    NOR: 83880,
    LUX: 133590,
    IRL: 99239,
    DNK: 68008,
    SWE: 54608,
    AUT: 51104,
    BEL: 50103,
    FIN: 53753,
    ISL: 73784,
    POL: 18216,
    CZE: 31111,
    PRT: 24252,
    GRC: 17676,
    HUN: 18728,
    SVK: 21457,
    SVN: 29291,
    EST: 27180,
    LVA: 20660,
    LTU: 23723,
    HRV: 17398,
    BGR: 12221,
    ROU: 14858,
    CYP: 31551,
    MLT: 32021,

    // Asia-Pacific
    SGP: 84501,
    HKG: 49800,
    MAC: 43772,
    BRN: 31086,
    QAT: 59319,
    ARE: 43103,
    KWT: 25845,
    BHR: 23504,
    OMN: 17203,
    ISR: 54930,
    THA: 7066,
    MYS: 13315,
    VNM: 4284,
    PHL: 3580,
    BGD: 2688,
    PAK: 1568,
    LKA: 3354,
    NPL: 1336,
    KHM: 1730,
    LAO: 2630,
    MMR: 1400,
    MNG: 4339,
    KAZ: 10042,
    UZB: 2255,
    KGZ: 1173,
    TJK: 1037,
    AFG: 368,
    IRN: 4347,
    IRQ: 5937,
    JOR: 4406,

    // Americas
    ARG: 13709,
    CHL: 16265,
    URY: 18802,
    PRY: 6344,
    BOL: 3552,
    PER: 7126,
    ECU: 6222,
    COL: 6630,
    VEN: 7704,
    GUY: 18199,
    SUR: 6750,
    CRI: 14104,
    PAN: 16731,
    GTM: 5025,
    HND: 2830,
    SLV: 4788,
    NIC: 2106,
    BLZ: 6816,
    JAM: 6208,
    TTO: 18352,
    BRB: 19819,
    CUB: 9500,
    DOM: 9673,
    HTI: 1748,

    // Middle East & Africa
    ZAF: 7055,
    EGY: 4295,
    NGA: 2184,
    KEN: 2081,
    ETH: 1028,
    GHA: 2445,
    CIV: 2549,
    SEN: 1675,
    BFA: 893,
    MLI: 916,
    NER: 594,
    TCD: 795,
    CMR: 1498,
    GAB: 8017,
    COG: 2290,
    COD: 586,
    AGO: 2109,
    ZMB: 1293,
    ZWE: 1803,
    BWA: 7347,
    NAM: 4729,
    MDG: 515,
    MWI: 636,
    MOZ: 503,
    TZA: 1192,
    UGA: 883,
    RWA: 964,
    BDI: 238,
    DJI: 3572,
    SOM: 461,
    ERI: 643,
    LBY: 6716,
    TUN: 4269,
    DZA: 4275,
    MAR: 3795,

    // Oceania & Others
    NZL: 48781,
    FJI: 6071,
    PNG: 2847,
    SLB: 2302,
    VUT: 3122,
    TON: 6365,
    WSM: 4260,
    KIR: 1881,
    TUV: 4970,
    NRU: 12060,
    PLW: 15311,
    MHL: 4310,
    FSM: 3568,
    COK: 18600,
    NIU: 17000,
  },

  lifeExpectancy: {
    // High Income Countries
    JPN: 84.95,
    CHE: 84.38,
    SGP: 84.07,
    AUS: 83.94,
    ESP: 83.99,
    ISL: 83.52,
    ITA: 84.2,
    ISR: 83.49,
    SWE: 83.33,
    FRA: 83.13,
    KOR: 84.14,
    CAN: 82.66,
    NOR: 82.26,
    NLD: 82.31,
    NZL: 82.67,
    AUT: 82.07,
    FIN: 81.61,
    BEL: 82.17,
    DNK: 80.9,
    DEU: 81.88,
    GBR: 81.77,
    IRL: 82.81,
    LUX: 82.75,
    USA: 78.93,
    CZE: 79.68,
    GRC: 82.65,
    PRT: 82.11,
    SVN: 81.61,
    CYP: 81.21,
    MLT: 83.8,

    // Upper Middle Income
    CHN: 78.21,
    BRA: 76.57,
    ARG: 77.32,
    CHL: 80.18,
    URY: 78.07,
    CRI: 80.75,
    PAN: 79.02,
    MEX: 75.43,
    COL: 77.29,
    PER: 77.15,
    ECU: 77.53,
    TUR: 78.33,
    IRN: 77.28,
    KAZ: 69.45,
    RUS: 73.34,
    BGR: 75.05,
    ROU: 76.05,
    HRV: 78.89,
    POL: 78.73,
    HUN: 76.88,
    SVK: 77.54,
    EST: 79.0,
    LVA: 75.29,
    LTU: 75.98,
    BLR: 74.79,
    UKR: 73.72,
    THA: 77.15,
    MYS: 76.65,
    VNM: 75.4,
    PHL: 71.23,
    IDN: 72.22,
    JOR: 75.37,
    LBN: 79.27,
    SAU: 75.13,
    ARE: 78.46,
    QAT: 79.35,
    KWT: 75.49,
    BHR: 77.73,
    OMN: 78.11,
    ZAF: 64.88,

    // Lower Middle Income & Low Income
    IND: 70.42,
    BGD: 72.88,
    PAK: 67.96,
    NPL: 71.15,
    LKA: 77.04,
    AFG: 64.83,
    MMR: 68.12,
    KHM: 70.01,
    LAO: 69.27,
    MNG: 70.14,
    UZB: 71.72,
    KGZ: 71.92,
    TJK: 71.78,
    EGY: 72.59,
    MAR: 77.48,
    TUN: 77.3,
    DZA: 77.74,
    LBY: 73.28,
    NGA: 55.75,
    ETH: 67.81,
    KEN: 62.48,
    UGA: 63.37,
    TZA: 66.2,
    RWA: 69.96,
    GHA: 64.94,
    CIV: 58.64,
    SEN: 68.78,
    BFA: 62.74,
    MLI: 60.54,
    NER: 63.04,
    TCD: 55.17,
    CMR: 60.33,
    GAB: 67.15,
    COG: 65.22,
    COD: 61.55,
    AGO: 62.26,
    ZMB: 64.38,
    ZWE: 61.74,
    BWA: 70.09,
    NAM: 64.98,
    MDG: 67.46,
    MWI: 65.06,
    MOZ: 61.83,
    SOM: 58.33,
    DJI: 68.3,
    ERI: 67.77,
    HTI: 64.99,
    BOL: 72.13,
    PRY: 74.64,
    GTM: 75.05,
    HND: 75.72,
    NIC: 74.9,
    SLV: 73.97,
    CUB: 79.18,
    DOM: 74.42,
    JAM: 74.89,
    TTO: 73.87,
    GUY: 70.51,
    SUR: 72.2,
    BLZ: 75.06,
  },

  // Regional Averages for Estimation
  regionalAverages: {
    gdp: {
      Europe: 35000,
      'North America': 45000,
      Asia: 15000,
      Africa: 3000,
      'South America': 8000,
      Oceania: 35000,
      'Middle East': 20000,
      Caribbean: 12000,
    },
    lifeExpectancy: {
      Europe: 79,
      'North America': 79,
      Asia: 73,
      Africa: 62,
      'South America': 75,
      Oceania: 80,
      'Middle East': 75,
      Caribbean: 74,
    },
  },
};

// Original HDI and Happiness data (keeping the existing high-quality data)
const ORIGINAL_MANUAL_DATA: OriginalManualData = {
  hdi: {
    CHE: 0.962,
    NOR: 0.961,
    ISL: 0.959,
    HKG: 0.952,
    DNK: 0.948,
    SWE: 0.947,
    DEU: 0.942,
    NLD: 0.941,
    IRL: 0.945,
    AUS: 0.944,
    USA: 0.921,
    GBR: 0.929,
    BEL: 0.937,
    LUX: 0.93,
    NZL: 0.937,
    CAN: 0.936,
    FIN: 0.94,
    AUT: 0.916,
    SGP: 0.939,
    FRA: 0.903,
    JPN: 0.925,
    KOR: 0.925,
    ISR: 0.919,
    SVN: 0.918,
    ESP: 0.905,
    CZE: 0.889,
    ITA: 0.895,
    EST: 0.89,
    GRC: 0.887,
    CYP: 0.896,
    POL: 0.876,
    LTU: 0.875,
    PRT: 0.866,
    SVK: 0.848,
    LVA: 0.863,
    HUN: 0.851,
    ARG: 0.842,
    HRV: 0.858,
    BHR: 0.875,
    MNE: 0.832,
    ROU: 0.821,
    BGR: 0.795,
    RUS: 0.822,
    BLR: 0.808,
    TUR: 0.838,
    URY: 0.809,
    BRB: 0.79,
    KAZ: 0.811,
    PAN: 0.805,
    BRA: 0.754,
    COL: 0.752,
    PER: 0.762,
    ARM: 0.776,
    MKD: 0.77,
    UKR: 0.773,
    CHN: 0.768,
    THA: 0.8,
    MYS: 0.803,
    MEX: 0.758,
    CRI: 0.809,
    CUB: 0.764,
    IRN: 0.774,
    BIH: 0.78,
    MDA: 0.767,
    ALB: 0.796,
    BGD: 0.661,
    IND: 0.633,
    PAK: 0.544,
    LKA: 0.782,
    IDN: 0.705,
    PHL: 0.699,
    VNM: 0.703,
    EGY: 0.731,
    MAR: 0.683,
    ZAF: 0.713,
    NGA: 0.535,
    KEN: 0.575,
    GHA: 0.632,
    ZWE: 0.593,
    ZMB: 0.584,
    AGO: 0.586,
    CMR: 0.563,
    SEN: 0.511,
    TZA: 0.549,
    UGA: 0.544,
    RWA: 0.534,
    MDG: 0.501,
    MLI: 0.428,
    BFA: 0.449,
    NER: 0.394,
    TCD: 0.394,
    CAF: 0.397,
    SSD: 0.385,
    AFG: 0.478,
    YEM: 0.455,
  },
  happiness: {
    FIN: 7.804,
    DNK: 7.586,
    ISL: 7.53,
    SWE: 7.395,
    ISR: 7.364,
    NLD: 7.319,
    NOR: 7.315,
    LUX: 7.122,
    CHE: 7.06,
    AUT: 6.905,
    AUS: 6.895,
    IRL: 6.838,
    DEU: 6.815,
    CAN: 6.797,
    USA: 6.725,
    GBR: 6.725,
    CZE: 6.718,
    BEL: 6.687,
    FRA: 6.661,
    BHR: 6.647,
    SVN: 6.65,
    CRC: 6.609,
    ARE: 6.571,
    SAU: 6.494,
    SGP: 6.48,
    TWN: 6.535,
    URY: 6.431,
    ITA: 6.405,
    KWT: 6.951,
    ESP: 6.357,
    SVK: 6.281,
    LTU: 6.215,
    EST: 6.19,
    POL: 6.123,
    UZB: 6.174,
    CYP: 6.159,
    LVA: 6.032,
    ROU: 6.14,
    HRV: 5.99,
    RUS: 5.459,
    PRT: 5.968,
    GRC: 5.931,
    JPN: 5.915,
    KOR: 5.838,
    PAN: 5.824,
    BRA: 6.125,
    CHL: 6.172,
    GTM: 6.262,
    ARG: 5.967,
    MEX: 6.317,
    ECU: 5.925,
    BOL: 5.716,
    PRY: 5.681,
    PER: 5.716,
    COL: 6.012,
    VEN: 5.211,
    DOM: 5.737,
    JAM: 5.89,
    NIC: 6.137,
    HND: 5.953,
    SLV: 6.061,
    THA: 5.843,
    MYS: 5.711,
    CHN: 5.585,
    MNG: 5.677,
    VNM: 5.411,
    KHM: 4.83,
    LAO: 5.14,
    NPL: 5.377,
    PAK: 4.555,
    BGD: 5.025,
    LKA: 4.325,
    BTN: 5.569,
    IND: 3.777,
    IDN: 5.24,
    PHL: 5.904,
    JOR: 4.906,
    PSE: 4.483,
    LBN: 2.955,
    TUR: 4.744,
    IRN: 4.286,
    IRQ: 4.854,
    SYR: 3.462,
    YEM: 3.658,
    EGY: 4.166,
    LBY: 5.566,
    TUN: 4.596,
    DZA: 5.005,
    MAR: 5.06,
    ZAF: 4.946,
    BWA: 3.467,
    NAM: 4.574,
    ZWE: 3.145,
    ZMB: 3.982,
    MWI: 3.75,
    MOZ: 4.794,
    MDG: 4.208,
    MUS: 6.071,
    KEN: 4.543,
    UGA: 4.432,
    TZA: 3.702,
    RWA: 3.268,
    BDI: 3.775,
    ETH: 4.241,
    SOM: 4.668,
    DJI: 4.369,
    ERI: 2.955,
    SSD: 2.817,
    CAF: 3.476,
    TCD: 4.423,
    CMR: 5.048,
    NGA: 4.552,
    NER: 4.91,
    MLI: 4.723,
    BFA: 4.587,
    CIV: 5.235,
    GHA: 5.148,
    TGO: 4.107,
    BEN: 5.216,
    SEN: 4.981,
    GMB: 4.751,
    GIN: 4.949,
    SLE: 3.926,
    LBR: 5.122,
    AGO: 2.79,
    COD: 4.311,
    COG: 5.342,
    GAB: 4.829,
    GNQ: 4.885,
    STP: 4.488,
    AFG: 1.859,
  },
};

/**
 * Enhanced HTTP request helper with comprehensive retry logic
 */
async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<unknown> {
  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      console.log(
        `🌐 Fetching: ${url.length > 100 ? url.substring(0, 100) + '...' : url} (attempt ${attempt}/${CONFIG.maxRetries})`,
      );

      const response = await fetch(url, {
        timeout: CONFIG.requestTimeout,
        headers: {
          'User-Agent': 'Country-Data-Fetcher/1.0',
          ...options.headers,
        },
        ...options,
      } as RequestInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(
        `⚠️  Request failed (attempt ${attempt}): ${(error as Error).message}`,
      );

      if (attempt === CONFIG.maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached due to the throw in the loop
  throw new Error('All retry attempts failed');
}

/**
 * Fetch countries data from REST Countries API
 */
async function fetchCountriesData(): Promise<BaseCountry[]> {
  console.log('📍 Fetching countries data from REST Countries API...');

  const countries = (await fetchWithRetry(
    'https://restcountries.com/v3.1/all?fields=name,cca2,cca3,capital,population,region,subregion,latlng,area,timezones',
  )) as RestCountryData[];

  return countries
    .filter((country): country is RestCountryData => {
      return Boolean(
        country.name?.common &&
          country.cca3 &&
          (Array.isArray(country.capital)
            ? country.capital.length > 0
            : Boolean(country.capital)) &&
          country.population > 0 &&
          country.latlng?.length === 2,
      );
    })
    .map((country) => ({
      id: country.cca3,
      name: country.name.common,
      code: country.cca3,
      capital: Array.isArray(country.capital)
        ? country.capital[0]
        : country.capital || '',
      population: country.population,
      region: country.region,
      subregion: country.subregion || country.region,
      latitude: country.latlng[0],
      longitude: country.latlng[1],
      area: country.area,
      timezones: country.timezones,
    }));
}

/**
 * Enhanced World Bank data fetching with multiple years and smaller batches
 */
async function fetchWorldBankDataRobust(
  indicator: string,
  countries: BaseCountry[],
): Promise<Record<string, number>> {
  console.log(`🏦 Fetching World Bank data for ${indicator}...`);

  const allResults: Record<string, number> = {};
  const years = ['2023', '2022', '2021', '2020', '2019']; // Multiple years for fallback

  try {
    // Process in smaller batches to avoid URL length issues
    for (let i = 0; i < countries.length; i += CONFIG.batchSize) {
      const batch = countries.slice(i, i + CONFIG.batchSize);
      const countryCodes = batch.map((c) => c.code).join(';');
      const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
      const totalBatches = Math.ceil(countries.length / CONFIG.batchSize);

      console.log(
        `   📦 Batch ${batchNum}/${totalBatches} (${batch.length} countries)`,
      );

      // Try multiple years until we get data
      for (const year of years) {
        const url = `https://api.worldbank.org/v2/country/${countryCodes}/indicator/${indicator}?format=json&date=${year}&per_page=1000`;

        try {
          const response = (await fetchWithRetry(url)) as WorldBankResponse;

          if (Array.isArray(response) && response.length >= 2 && response[1]) {
            const data: WorldBankDataItem[] = response[1];
            let foundData = false;

            for (const item of data) {
              if (
                item.value !== null &&
                item.countryiso3code &&
                !allResults[item.countryiso3code]
              ) {
                allResults[item.countryiso3code] = parseFloat(
                  item.value.toString(),
                );
                foundData = true;
              }
            }

            if (foundData) {
              console.log(`   ✅ Found data for year ${year}`);
              break; // Found data for this batch, move to next batch
            }
          }
        } catch (yearError) {
          console.warn(
            `   ⚠️  Year ${year} failed: ${(yearError as Error).message}`,
          );
          continue; // Try next year
        }

        // Small delay between year attempts
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // Delay between batches to be respectful to the API
      if (i + CONFIG.batchSize < countries.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `   ✅ Successfully fetched data for ${Object.keys(allResults).length} countries`,
    );
    return allResults;
  } catch (error) {
    console.error(
      `❌ Failed to fetch World Bank data for ${indicator}:`,
      (error as Error).message,
    );
    return {};
  }
}

/**
 * Estimate missing data using regional averages and economic correlations
 */
function estimateData(
  country: BaseCountry,
  dataType: 'gdp' | 'lifeExpectancy',
): number | null {
  const regionMap: Record<string, string> = {
    'Northern Europe': 'Europe',
    'Western Europe': 'Europe',
    'Eastern Europe': 'Europe',
    'Southern Europe': 'Europe',
    'Northern America': 'North America',
    'Central America': 'North America',
    Caribbean: 'Caribbean',
    'South America': 'South America',
    'Western Asia': 'Middle East',
    'Central Asia': 'Asia',
    'Eastern Asia': 'Asia',
    'South-Eastern Asia': 'Asia',
    'Southern Asia': 'Asia',
    'Australia and New Zealand': 'Oceania',
    Polynesia: 'Oceania',
    Micronesia: 'Oceania',
    Melanesia: 'Oceania',
    'Northern Africa': 'Africa',
    'Western Africa': 'Africa',
    'Middle Africa': 'Africa',
    'Eastern Africa': 'Africa',
    'Southern Africa': 'Africa',
  };

  const mappedRegion =
    regionMap[country.subregion] || regionMap[country.region] || country.region;
  const baseValue =
    COMPREHENSIVE_DATA.regionalAverages[dataType]?.[mappedRegion];

  if (!baseValue) return null;

  // Apply population-based adjustments
  let adjustmentFactor = 1.0;

  if (country.population < 1000000) {
    adjustmentFactor = 0.8; // Small countries often have different economics
  } else if (country.population > 100000000) {
    adjustmentFactor = 0.9; // Very large countries have scale challenges
  }

  // Apply regional variance (±20% random factor to avoid identical values)
  const variance = 0.8 + Math.random() * 0.4; // 0.8 to 1.2

  return Math.round(baseValue * adjustmentFactor * variance);
}

/**
 * Data quality scoring system
 */
function calculateDataQuality(country: Partial<ProcessedCountry>): number {
  const fields: Array<keyof ProcessedCountry> = [
    'gdpPerCapita',
    'lifeExpectancy',
    'hdi',
    'happiness',
  ];
  const weights: Record<string, number> = {
    gdpPerCapita: 0.3,
    lifeExpectancy: 0.3,
    hdi: 0.2,
    happiness: 0.2,
  };

  let totalWeight = 0;
  let availableWeight = 0;

  for (const field of fields) {
    totalWeight += weights[field];
    if (country[field] !== null && country[field] !== undefined) {
      availableWeight += weights[field];
    }
  }

  const completeness = availableWeight / totalWeight;

  // Bonus for manual/verified data
  let qualityBonus = 0;
  if (country.dataSource?.includes('manual')) qualityBonus += 0.1;
  if (country.dataSource?.includes('worldbank')) qualityBonus += 0.1;

  return Math.min(1.0, completeness + qualityBonus);
}

/**
 * Advanced data merging with source tracking
 */
function mergeCountryData(
  baseCountry: BaseCountry,
  worldBankGDP: Record<string, number>,
  worldBankLife: Record<string, number>,
): ProcessedCountry {
  const sources: string[] = [];

  // GDP per capita (priority: comprehensive manual > World Bank > estimate)
  let gdpPerCapita: number | null = null;
  if (COMPREHENSIVE_DATA.gdp[baseCountry.code]) {
    gdpPerCapita = COMPREHENSIVE_DATA.gdp[baseCountry.code];
    sources.push('manual-gdp');
  } else if (worldBankGDP[baseCountry.code]) {
    gdpPerCapita = worldBankGDP[baseCountry.code];
    sources.push('worldbank-gdp');
  } else {
    gdpPerCapita = estimateData(baseCountry, 'gdp');
    if (gdpPerCapita) sources.push('estimated-gdp');
  }

  // Life expectancy (priority: comprehensive manual > World Bank > estimate)
  let lifeExpectancy: number | null = null;
  if (COMPREHENSIVE_DATA.lifeExpectancy[baseCountry.code]) {
    lifeExpectancy = COMPREHENSIVE_DATA.lifeExpectancy[baseCountry.code];
    sources.push('manual-life');
  } else if (worldBankLife[baseCountry.code]) {
    lifeExpectancy = worldBankLife[baseCountry.code];
    sources.push('worldbank-life');
  } else {
    lifeExpectancy = estimateData(baseCountry, 'lifeExpectancy');
    if (lifeExpectancy) sources.push('estimated-life');
  }

  // HDI and Happiness (using original high-quality data)
  const hdi = ORIGINAL_MANUAL_DATA.hdi[baseCountry.code] || null;
  const happiness = ORIGINAL_MANUAL_DATA.happiness[baseCountry.code] || null;

  if (hdi) sources.push('manual-hdi');
  if (happiness) sources.push('manual-happiness');

  const country: ProcessedCountry = {
    id: baseCountry.id,
    name: baseCountry.name,
    code: baseCountry.code,
    capital: baseCountry.capital,
    population: baseCountry.population,
    region: baseCountry.region,
    subregion: baseCountry.subregion,
    latitude: baseCountry.latitude,
    longitude: baseCountry.longitude,
    area: baseCountry.area,
    timezones: baseCountry.timezones,

    // Economic and social indicators
    gdpPerCapita: gdpPerCapita,
    gdpPerCapitaFormatted: gdpPerCapita
      ? `$${Math.round(gdpPerCapita).toLocaleString()}`
      : 'N/A',

    lifeExpectancy: lifeExpectancy,
    lifeExpectancyFormatted: lifeExpectancy
      ? `${lifeExpectancy.toFixed(1)} years`
      : 'N/A',

    hdi: hdi,
    hdiFormatted: hdi ? `${(hdi * 100).toFixed(1)}%` : 'N/A',
    hdiCategory: hdi ? getHDICategory(hdi) : null,

    happiness: happiness,
    happinessFormatted: happiness ? `${happiness.toFixed(2)}/10` : 'N/A',

    // Population formatting
    populationFormatted: formatPopulation(baseCountry.population),

    // Metadata
    dataSource: sources.join(','),
    dataCompleteness: 0, // Will be calculated later
  };

  // Calculate data completeness
  country.dataCompleteness = calculateDataQuality(country);

  return country;
}

/**
 * Main processing function with robust data aggregation
 */
async function processCountryDataRobust(): Promise<ProcessedCountry[]> {
  console.log('🚀 Starting robust data processing...\n');

  const startTime = Date.now();

  // Step 1: Fetch base country data
  const countries = await fetchCountriesData();
  console.log(
    `✅ Found ${countries.length} countries with complete basic data\n`,
  );

  // Step 2: Fetch World Bank data with robust error handling
  console.log('📊 Fetching economic data from World Bank...');
  const [worldBankGDP, worldBankLife] = await Promise.all([
    fetchWorldBankDataRobust('NY.GDP.PCAP.CD', countries),
    fetchWorldBankDataRobust('SP.DYN.LE00.IN', countries),
  ]);

  console.log(`📊 World Bank Results:`);
  console.log(`   GDP data: ${Object.keys(worldBankGDP).length} countries`);
  console.log(
    `   Life expectancy data: ${Object.keys(worldBankLife).length} countries`,
  );
  console.log(`🏆 Manual Data Coverage:`);
  console.log(
    `   GDP data: ${Object.keys(COMPREHENSIVE_DATA.gdp).length} countries`,
  );
  console.log(
    `   Life expectancy data: ${Object.keys(COMPREHENSIVE_DATA.lifeExpectancy).length} countries`,
  );
  console.log(
    `   HDI data: ${Object.keys(ORIGINAL_MANUAL_DATA.hdi).length} countries`,
  );
  console.log(
    `   Happiness data: ${Object.keys(ORIGINAL_MANUAL_DATA.happiness).length} countries\n`,
  );

  // Step 3: Merge all data sources with intelligent fallbacks
  console.log('🔄 Merging data sources with intelligent fallbacks...');
  const processedCountries = countries
    .map((country) => mergeCountryData(country, worldBankGDP, worldBankLife))
    .filter((country) => country.dataCompleteness >= CONFIG.minDataCompleteness)
    .sort((a, b) => b.dataCompleteness - a.dataCompleteness);

  const duration = Date.now() - startTime;

  console.log(`\n✅ Data processing complete!`);
  console.log(`📊 Generated data for ${processedCountries.length} countries`);
  console.log(`⏱️  Total processing time: ${duration}ms`);
  console.log(
    `🎯 Target achieved: ${processedCountries.length >= CONFIG.targetCountries ? 'YES' : 'NO'} (target: ${CONFIG.targetCountries}+)`,
  );

  // Data quality report
  const qualityStats = {
    withGDP: processedCountries.filter((c) => c.gdpPerCapita !== null).length,
    withLifeExpectancy: processedCountries.filter(
      (c) => c.lifeExpectancy !== null,
    ).length,
    withHDI: processedCountries.filter((c) => c.hdi !== null).length,
    withHappiness: processedCountries.filter((c) => c.happiness !== null)
      .length,
    averageCompleteness:
      processedCountries.reduce((sum, c) => sum + c.dataCompleteness, 0) /
      processedCountries.length,
  };

  console.log(`\n📈 Data Quality Report:`);
  console.log(
    `   Countries with GDP: ${qualityStats.withGDP}/${processedCountries.length} (${((qualityStats.withGDP / processedCountries.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Countries with Life Expectancy: ${qualityStats.withLifeExpectancy}/${processedCountries.length} (${((qualityStats.withLifeExpectancy / processedCountries.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Countries with HDI: ${qualityStats.withHDI}/${processedCountries.length} (${((qualityStats.withHDI / processedCountries.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Countries with Happiness: ${qualityStats.withHappiness}/${processedCountries.length} (${((qualityStats.withHappiness / processedCountries.length) * 100).toFixed(1)}%)`,
  );
  console.log(
    `   Average completeness: ${(qualityStats.averageCompleteness * 100).toFixed(1)}%`,
  );

  return processedCountries;
}

/**
 * Helper functions (keeping original implementations)
 */
function getHDICategory(hdi: number): 'Very High' | 'High' | 'Medium' | 'Low' {
  if (hdi >= 0.8) return 'Very High';
  if (hdi >= 0.7) return 'High';
  if (hdi >= 0.55) return 'Medium';
  return 'Low';
}

function formatPopulation(population: number): string {
  if (population >= 1_000_000_000) {
    return `${(population / 1_000_000_000).toFixed(2)}B`;
  }
  if (population >= 1_000_000) {
    return `${(population / 1_000_000).toFixed(1)}M`;
  }
  if (population >= 1_000) {
    return `${(population / 1_000).toFixed(1)}K`;
  }
  return population.toLocaleString();
}

/**
 * Generate enhanced TypeScript interface
 */
async function generateEnhancedTypeScriptInterface(): Promise<void> {
  console.log('📝 Generating enhanced TypeScript interfaces...');

  const interfaceContent = `/**
 * Generated Country Data Types - Robust Edition
 * 
 * Auto-generated on: ${new Date().toISOString()}
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

export type CountryRegion = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';

export type HDICategory = 'Very High' | 'High' | 'Medium' | 'Low';

export type DataSource = 'manual-gdp' | 'manual-life' | 'manual-hdi' | 'manual-happiness' | 
                         'worldbank-gdp' | 'worldbank-life' | 'estimated-gdp' | 'estimated-life';

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
`;

  await ensureDirectoryExists(CONFIG.interfacesDir);
  await fs.writeFile(
    path.join(CONFIG.interfacesDir, 'country-data.types.ts'),
    interfaceContent,
    'utf8',
  );
}

/**
 * Generate enhanced data file with metadata
 */
async function generateEnhancedDataFile(
  countries: ProcessedCountry[],
): Promise<void> {
  console.log('💾 Generating enhanced data file...');

  // Calculate comprehensive metadata
  const sourceStats = countries.reduce(
    (acc, country) => {
      const sources = country.dataSource.split(',');
      sources.forEach((source) => {
        acc[source] = (acc[source] || 0) + 1;
      });
      return acc;
    },
    {} as Record<string, number>,
  );

  const metadata = {
    generatedAt: new Date().toISOString(),
    totalCountries: countries.length,
    dataCompleteness: {
      average:
        countries.reduce((sum, c) => sum + c.dataCompleteness, 0) /
        countries.length,
      withGDP: countries.filter((c) => c.gdpPerCapita !== null).length,
      withLifeExpectancy: countries.filter((c) => c.lifeExpectancy !== null)
        .length,
      withHDI: countries.filter((c) => c.hdi !== null).length,
      withHappiness: countries.filter((c) => c.happiness !== null).length,
    },
    sources: [
      'REST Countries API (https://restcountries.com/)',
      'World Bank API (https://api.worldbank.org/)',
      'Manual curated data (World Bank, IMF, OECD 2023)',
      'UNDP Human Development Report 2023',
      'World Happiness Report 2023',
      'Regional estimates and intelligent fallbacks',
    ],
    dataQuality: {
      manualData: Object.entries(sourceStats)
        .filter(([k]) => k.includes('manual'))
        .reduce((sum, [, v]) => sum + v, 0),
      apiData: Object.entries(sourceStats)
        .filter(([k]) => k.includes('worldbank'))
        .reduce((sum, [, v]) => sum + v, 0),
      estimatedData: Object.entries(sourceStats)
        .filter(([k]) => k.includes('estimated'))
        .reduce((sum, [, v]) => sum + v, 0),
    },
  };

  const dataContent = `/**
 * Generated Country Data - Robust Edition
 * 
 * Auto-generated on: ${metadata.generatedAt}
 * Total countries: ${metadata.totalCountries}
 * Average data completeness: ${(metadata.dataCompleteness.average * 100).toFixed(1)}%
 * Data quality: ${(((metadata.dataQuality.manualData + metadata.dataQuality.apiData) / metadata.totalCountries) * 100).toFixed(1)}% verified, ${((metadata.dataQuality.estimatedData / metadata.totalCountries) * 100).toFixed(1)}% estimated
 * 
 * DO NOT EDIT MANUALLY - This file is auto-generated
 */

import { CountryDataRecord, CountryDataMeta } from '../../app/core/types/country-data.types';

export const COUNTRY_DATA: readonly CountryDataRecord[] = ${JSON.stringify(countries, null, 2)} as const;

export const COUNTRY_DATA_META: CountryDataMeta = ${JSON.stringify(metadata, null, 2)} as const;

// Optimized lookup maps for performance
export const COUNTRY_BY_CODE: ReadonlyMap<string, CountryDataRecord> = new Map(
  COUNTRY_DATA.map(country => [country.code, country])
);

export const COUNTRY_BY_NAME: ReadonlyMap<string, CountryDataRecord> = new Map(
  COUNTRY_DATA.map(country => [country.name.toLowerCase(), country])
);

export const COUNTRIES_BY_REGION: ReadonlyMap<string, readonly CountryDataRecord[]> = new Map(
  Object.entries(
    COUNTRY_DATA.reduce((acc, country) => {
      if (!acc[country.region]) acc[country.region] = [];
      acc[country.region].push(country);
      return acc;
    }, {} as Record<string, CountryDataRecord[]>)
  ).map(([region, countries]) => [region, countries])
);

// Enhanced top countries by various metrics (for quick access)
export const TOP_COUNTRIES = {
  byGDP: [...COUNTRY_DATA]
    .filter(c => c.gdpPerCapita !== null)
    .sort((a, b) => (b.gdpPerCapita || 0) - (a.gdpPerCapita || 0))
    .slice(0, 50),
    
  byPopulation: [...COUNTRY_DATA]
    .sort((a, b) => b.population - a.population)
    .slice(0, 50),
    
  byHDI: [...COUNTRY_DATA]
    .filter(c => c.hdi !== null)
    .sort((a, b) => (b.hdi || 0) - (a.hdi || 0))
    .slice(0, 50),
    
  byHappiness: [...COUNTRY_DATA]
    .filter(c => c.happiness !== null)
    .sort((a, b) => (b.happiness || 0) - (a.happiness || 0))
    .slice(0, 50),
    
  byDataQuality: [...COUNTRY_DATA]
    .sort((a, b) => b.dataCompleteness - a.dataCompleteness)
    .slice(0, 50),
} as const;

// Data source statistics for transparency
export const DATA_SOURCE_STATS = ${JSON.stringify(sourceStats, null, 2)} as const;
`;

  await ensureDirectoryExists(CONFIG.outputDir);
  await fs.writeFile(
    path.join(CONFIG.outputDir, 'country-data.ts'),
    dataContent,
    'utf8',
  );
}

/**
 * Ensure directory exists
 */
async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🌍 Robust Country Data Fetcher \n');
    console.log(
      `🎯 Target: ${CONFIG.targetCountries}+ countries with ${CONFIG.minDataCompleteness * 100}%+ data completeness\n`,
    );

    const startTime = Date.now();

    // Process all data with robust fallbacks
    const countries = await processCountryDataRobust();

    // Generate enhanced TypeScript files
    await Promise.all([
      generateEnhancedTypeScriptInterface(),
      generateEnhancedDataFile(countries),
    ]);

    const duration = Date.now() - startTime;

    console.log('\n🎉 Robust data generation complete!');
    console.log(`📊 Generated data for ${countries.length} countries`);
    console.log(`⏱️  Total time: ${(duration / 1000).toFixed(1)}s`);
    console.log(`📁 Files generated:`);
    console.log(
      `   - ${path.join(CONFIG.interfacesDir, 'country-data.types.ts')}`,
    );
    console.log(`   - ${path.join(CONFIG.outputDir, 'country-data.ts')}`);

    // Calculate bundle size estimate
    const dataString = JSON.stringify(countries);
    const estimatedSize = Buffer.byteLength(dataString, 'utf8');
    const gzippedEstimate = Math.round(estimatedSize * 0.2); // Rough gzip estimate

    console.log(`\n📦 Bundle size estimate:`);
    console.log(`   - Raw: ${(estimatedSize / 1024).toFixed(1)} KB`);
    console.log(
      `   - Gzipped (estimated): ${(gzippedEstimate / 1024).toFixed(1)} KB`,
    );

    if (gzippedEstimate > 15360) {
      // 15KB limit for robust version
      console.warn(
        `⚠️  Warning: Estimated gzipped size (${(gzippedEstimate / 1024).toFixed(1)} KB) exceeds 15KB target`,
      );
    } else {
      console.log(`✅ Bundle size within acceptable range!`);
    }

    // Success metrics
    const successMetrics = {
      coverage: countries.length >= CONFIG.targetCountries,
      gdpCoverage:
        countries.filter((c) => c.gdpPerCapita !== null).length /
          countries.length >=
        0.9,
      lifeCoverage:
        countries.filter((c) => c.lifeExpectancy !== null).length /
          countries.length >=
        0.9,
    };

    console.log(`\n🏆 Success Metrics:`);
    console.log(
      `   ✅ Country Coverage: ${successMetrics.coverage ? 'PASS' : 'FAIL'} (${countries.length}/${CONFIG.targetCountries}+)`,
    );
    console.log(
      `   ✅ GDP Coverage: ${successMetrics.gdpCoverage ? 'PASS' : 'FAIL'} (${((countries.filter((c) => c.gdpPerCapita !== null).length / countries.length) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   ✅ Life Expectancy Coverage: ${successMetrics.lifeCoverage ? 'PASS' : 'FAIL'} (${((countries.filter((c) => c.lifeExpectancy !== null).length / countries.length) * 100).toFixed(1)}%)`,
    );
  } catch (error) {
    console.error('\n❌ Error generating robust country data:');
    console.error(error);
    process.exit(1);
  }
}

// Add fetch polyfill for Node.js (keeping original implementation)
if (typeof fetch === 'undefined') {
  (global as Record<string, unknown>)['fetch'] = async function (
    url: string,
    options: FetchOptions = {},
  ): Promise<FakeResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            statusText: res.statusMessage || '',
            json: () => Promise.resolve(JSON.parse(data)),
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(options.timeout || CONFIG.requestTimeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  };
}

// Run the script
// Run main function when script is executed directly
if (import.meta.url.endsWith('fetch-country-data-robust.ts')) {
  main();
}

export {
  fetchWithRetry,
  processCountryDataRobust,
  generateEnhancedTypeScriptInterface,
  generateEnhancedDataFile,
};

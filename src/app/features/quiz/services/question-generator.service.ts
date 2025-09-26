import { Injectable, inject } from '@angular/core';
import {
  GameMode,
  Difficulty,
  GameConfiguration,
  Question,
} from '../models/quiz.models';
import { CountryDataService } from '../../../core/services/country-data.service';
import { CountryDataRecord } from '../../../core/types/country-data.types';

/**
 * Question Generation Service
 *
 * Generates quiz questions with intelligent distractor selection based on:
 * - Difficulty level (Easy: 4 choices, Medium: 6 choices, Hard: 8 choices)
 * - Regional proximity for realistic distractors
 * - Similar characteristics (population, GDP, etc.)
 * - Reproducible sessions with seed support
 */
@Injectable({
  providedIn: 'root',
})
export class QuestionGeneratorService {
  private readonly countryDataService = inject(CountryDataService);

  // Distractor count by difficulty
  private readonly CHOICE_COUNTS = {
    easy: 4,
    medium: 6,
    hard: 8,
  } as const;

  // Regional neighbors for distractor generation
  private readonly REGIONAL_NEIGHBORS: Record<string, string[]> = {
    'Northern Europe': ['Western Europe', 'Eastern Europe'],
    'Western Europe': ['Northern Europe', 'Southern Europe'],
    'Eastern Europe': ['Northern Europe', 'Southern Europe', 'Western Asia'],
    'Southern Europe': ['Western Europe', 'Eastern Europe', 'Northern Africa'],
    'Western Asia': ['Eastern Europe', 'Central Asia', 'Southern Asia'],
    'Central Asia': ['Western Asia', 'Southern Asia', 'Eastern Asia'],
    'Southern Asia': [
      'Western Asia',
      'Central Asia',
      'Eastern Asia',
      'South-Eastern Asia',
    ],
    'Eastern Asia': ['Central Asia', 'Southern Asia', 'South-Eastern Asia'],
    'South-Eastern Asia': ['Southern Asia', 'Eastern Asia', 'Oceania'],
    'Northern America': ['Central America', 'Caribbean'],
    'Central America': ['Northern America', 'South America', 'Caribbean'],
    Caribbean: ['Northern America', 'Central America', 'South America'],
    'South America': ['Central America', 'Caribbean'],
    'Northern Africa': ['Western Africa', 'Eastern Africa', 'Middle Africa'],
    'Western Africa': ['Northern Africa', 'Middle Africa'],
    'Middle Africa': ['Northern Africa', 'Western Africa', 'Eastern Africa'],
    'Eastern Africa': ['Northern Africa', 'Middle Africa', 'Southern Africa'],
    'Southern Africa': ['Eastern Africa', 'Middle Africa'],
    'Australia and New Zealand': ['Melanesia', 'Polynesia'],
    Melanesia: ['Australia and New Zealand', 'Micronesia', 'Polynesia'],
    Micronesia: ['Melanesia', 'Polynesia'],
    Polynesia: ['Australia and New Zealand', 'Melanesia', 'Micronesia'],
  };

  /**
   * Generate a complete quiz session with questions and distractors
   */
  generateSession(
    mode: GameMode,
    difficulty: Difficulty,
    questionCount: number,
    seed?: string,
  ): Question[] {
    // Set random seed for reproducible sessions if provided
    if (seed) {
      this.seedRandom(seed);
    }

    switch (mode) {
      case 'find-country':
        return this.generateFindCountryQuestions(difficulty, questionCount);
      case 'capital-match':
        return this.generateCapitalMatchQuestions(difficulty, questionCount);
      case 'flag-id':
        return this.generateFlagIdQuestions(difficulty, questionCount);
      case 'facts-guess':
        return this.generateFactsGuessQuestions(difficulty, questionCount);
      default:
        console.warn(
          `Question generation for mode '${mode}' not implemented yet`,
        );
        return this.generateStubQuestions(mode, difficulty, questionCount);
    }
  }

  // ========== FIND COUNTRY QUESTIONS ==========

  private generateFindCountryQuestions(
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const allCountries = this.countryDataService.getAllCountries();

    if (allCountries.length === 0) {
      console.error('No countries available for quiz generation');
      return this.generateStubQuestions('find-country', difficulty, count);
    }

    const eligibleCountries = this.filterCountriesByDifficulty(
      allCountries,
      difficulty,
    );

    if (eligibleCountries.length === 0) {
      console.warn(
        'No eligible countries for difficulty, falling back to stub questions',
      );
      return this.generateStubQuestions('find-country', difficulty, count);
    }

    const selectedCountries = this.selectRandomCountries(
      eligibleCountries,
      count,
    );

    return selectedCountries.map((country, index) => ({
      id: `find_country_${index + 1}`,
      type: 'find-country' as GameMode,
      prompt: this.generateFindCountryPrompt(country, difficulty),
      correctAnswer: country.id,
      metadata: {
        countryId: country.id,
        countryName: country.name,
        capital: country.capital,
        region: country.region,
        difficulty,
      },
    }));
  }

  private generateFindCountryPrompt(
    country: CountryDataRecord,
    difficulty: Difficulty,
  ): string {
    const prompts: string[] = [];

    // Capital-based prompts (most common)
    if (country.capital && country.capital !== 'N/A') {
      prompts.push(`Find the country whose capital is ${country.capital}`);
    }

    // Region-based prompts
    if (country.region) {
      prompts.push(`Find this ${country.region} country: ${country.name}`);
    }

    // Population-based prompts for larger countries
    if (difficulty !== 'easy' && country.population > 50_000_000) {
      const popFormatted =
        country.populationFormatted ||
        `${Math.round(country.population / 1_000_000)}M+`;
      prompts.push(
        `Find the country with approximately ${popFormatted} people: ${country.name}`,
      );
    }

    // GDP-based prompts for hard difficulty
    if (
      difficulty === 'hard' &&
      country.gdpPerCapita &&
      country.gdpPerCapita > 30000
    ) {
      prompts.push(`Find this high-income country: ${country.name}`);
    }

    // Subregion context
    if (country.subregion) {
      prompts.push(`Find this ${country.subregion} country: ${country.name}`);
    }

    // Fallback
    if (prompts.length === 0) {
      prompts.push(`Find the country: ${country.name}`);
    }

    // Select random prompt
    const selectedPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // Make harder by removing country name sometimes
    if (
      difficulty === 'hard' &&
      Math.random() < 0.3 &&
      country.capital &&
      country.capital !== 'N/A'
    ) {
      return `Find the country whose capital is ${country.capital}`;
    }

    return selectedPrompt;
  }

  // ========== CAPITAL MATCH QUESTIONS ==========

  private generateCapitalMatchQuestions(
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const allCountries = this.countryDataService.getAllCountries();
    const eligibleCountries = allCountries.filter(
      (country) =>
        country.capital &&
        country.capital !== 'N/A' &&
        country.capital.trim() !== '',
    );

    const selectedCountries = this.selectRandomCountries(
      eligibleCountries,
      count,
    );

    return selectedCountries.map((country, index) => {
      const distractors = this.generateCapitalDistractors(
        country,
        eligibleCountries,
        difficulty,
      );
      const allChoices = this.shuffleArray([country.capital, ...distractors]);

      return {
        id: `capital_match_${index + 1}`,
        type: 'capital-match' as GameMode,
        prompt: `What is the capital of ${country.name}?`,
        correctAnswer: country.capital,
        choices: allChoices,
        metadata: {
          countryId: country.id,
          countryName: country.name,
          correctCapital: country.capital,
          region: country.region,
          difficulty,
        },
      };
    });
  }

  private generateCapitalDistractors(
    correctCountry: CountryDataRecord,
    allCountries: readonly CountryDataRecord[],
    difficulty: Difficulty,
  ): string[] {
    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const distractorCount = choiceCount - 1; // -1 for correct answer
    const distractors = new Set<string>();

    // Get regional distractors first (more realistic)
    const regionalCountries = allCountries.filter(
      (country) =>
        country.subregion === correctCountry.subregion &&
        country.capital &&
        country.capital !== correctCountry.capital &&
        country.capital !== 'N/A',
    );

    // Add regional capitals
    for (const country of this.shuffleArray([...regionalCountries]).slice(
      0,
      Math.ceil(distractorCount * 0.6),
    )) {
      if (distractors.size < distractorCount) {
        distractors.add(country.capital);
      }
    }

    // Add neighboring region capitals if needed
    if (distractors.size < distractorCount && correctCountry.subregion) {
      const neighboringRegions =
        this.REGIONAL_NEIGHBORS[correctCountry.subregion] || [];
      const neighboringCountries = allCountries.filter(
        (country) =>
          neighboringRegions.includes(country.subregion || '') &&
          country.capital &&
          country.capital !== correctCountry.capital &&
          country.capital !== 'N/A' &&
          !distractors.has(country.capital),
      );

      for (const country of this.shuffleArray([...neighboringCountries]).slice(
        0,
        distractorCount - distractors.size,
      )) {
        distractors.add(country.capital);
      }
    }

    // Fill remaining with random capitals
    const remainingCountries = allCountries.filter(
      (country) =>
        country.capital &&
        country.capital !== correctCountry.capital &&
        country.capital !== 'N/A' &&
        !distractors.has(country.capital),
    );

    for (const country of this.shuffleArray([...remainingCountries]).slice(
      0,
      distractorCount - distractors.size,
    )) {
      distractors.add(country.capital);
    }

    return Array.from(distractors).slice(0, distractorCount);
  }

  // ========== FLAG ID QUESTIONS ==========

  private generateFlagIdQuestions(
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const allCountries = this.countryDataService.getAllCountries();
    // For now, generate flag URL from country code using a standard flag API
    const eligibleCountries = allCountries.filter(
      (country) => country.code && country.code.length >= 2,
    );
    const selectedCountries = this.selectRandomCountries(
      eligibleCountries,
      count,
    );

    return selectedCountries.map((country, index) => {
      const distractors = this.generateFlagDistractors(
        country,
        eligibleCountries,
        difficulty,
      );
      const allChoices = this.shuffleArray([country.name, ...distractors]);

      // Generate flag URL from country code - convert 3-letter to 2-letter ISO codes
      const twoLetterCode = this.convertToTwoLetterCode(country.code);
      const flagUrl = `https://flagcdn.com/w320/${twoLetterCode.toLowerCase()}.png`;

      return {
        id: `flag_id_${index + 1}`,
        type: 'flag-id' as GameMode,
        prompt: `Which country does this flag belong to?`,
        correctAnswer: country.name,
        choices: allChoices,
        metadata: {
          countryId: country.id,
          countryName: country.name,
          flagUrl: flagUrl,
          region: country.region,
          difficulty,
        },
      };
    });
  }

  private generateFlagDistractors(
    correctCountry: CountryDataRecord,
    allCountries: readonly CountryDataRecord[],
    difficulty: Difficulty,
  ): string[] {
    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const distractorCount = choiceCount - 1;
    const distractors = new Set<string>();

    // Regional distractors (similar flags often in same region)
    const regionalCountries = allCountries.filter(
      (country) =>
        country.subregion === correctCountry.subregion &&
        country.name !== correctCountry.name &&
        country.code &&
        country.code.length >= 2,
    );

    for (const country of this.shuffleArray([...regionalCountries]).slice(
      0,
      Math.ceil(distractorCount * 0.5),
    )) {
      if (distractors.size < distractorCount) {
        distractors.add(country.name);
      }
    }

    // Add neighboring regions
    if (distractors.size < distractorCount && correctCountry.subregion) {
      const neighboringRegions =
        this.REGIONAL_NEIGHBORS[correctCountry.subregion] || [];
      const neighboringCountries = allCountries.filter(
        (country) =>
          neighboringRegions.includes(country.subregion || '') &&
          country.name !== correctCountry.name &&
          !distractors.has(country.name) &&
          country.code &&
          country.code.length >= 2,
      );

      for (const country of this.shuffleArray([...neighboringCountries]).slice(
        0,
        distractorCount - distractors.size,
      )) {
        distractors.add(country.name);
      }
    }

    // Fill with random countries
    const remainingCountries = allCountries.filter(
      (country) =>
        country.name !== correctCountry.name &&
        !distractors.has(country.name) &&
        country.code &&
        country.code.length >= 2,
    );

    for (const country of this.shuffleArray([...remainingCountries]).slice(
      0,
      distractorCount - distractors.size,
    )) {
      distractors.add(country.name);
    }

    return Array.from(distractors).slice(0, distractorCount);
  }

  // ========== FACTS GUESS QUESTIONS ==========

  private generateFactsGuessQuestions(
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const questions: Question[] = [];
    const factTypes = ['population', 'area', 'gdp', 'density'];

    for (let i = 0; i < count; i++) {
      const factType = factTypes[Math.floor(Math.random() * factTypes.length)];
      const question = this.generateFactsQuestion(factType, difficulty, i + 1);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  private generateFactsQuestion(
    factType: string,
    difficulty: Difficulty,
    questionNumber: number,
  ): Question | null {
    const allCountries = this.countryDataService.getAllCountries();

    switch (factType) {
      case 'population':
        return this.generatePopulationFactsQuestion(
          allCountries,
          difficulty,
          questionNumber,
        );
      case 'area':
        return this.generateAreaFactsQuestion(
          allCountries,
          difficulty,
          questionNumber,
        );
      case 'gdp':
        return this.generateGdpFactsQuestion(
          allCountries,
          difficulty,
          questionNumber,
        );
      case 'density':
        return this.generateDensityFactsQuestion(
          allCountries,
          difficulty,
          questionNumber,
        );
      default:
        return null;
    }
  }

  private generatePopulationFactsQuestion(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
    questionNumber: number,
  ): Question {
    const eligibleCountries = countries.filter(
      (country) => country.population > 1000,
    );
    const sortedByPopulation = [...eligibleCountries].sort(
      (a, b) => b.population - a.population,
    );

    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const isLargest = Math.random() < 0.5;

    const selectedCountries = isLargest
      ? sortedByPopulation.slice(0, choiceCount)
      : sortedByPopulation.slice(-choiceCount).reverse();

    const correctAnswer = selectedCountries[0];
    const shuffledChoices = this.shuffleArray(
      selectedCountries.map((c) => c.name),
    );

    return {
      id: `facts_population_${questionNumber}`,
      type: 'facts-guess' as GameMode,
      prompt: `Which country has the ${isLargest ? 'largest' : 'smallest'} population?`,
      correctAnswer: correctAnswer.name,
      choices: shuffledChoices,
      metadata: {
        factType: 'population',
        factValue: correctAnswer.population,
        isLargest,
        difficulty,
      },
    };
  }

  private generateAreaFactsQuestion(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
    questionNumber: number,
  ): Question {
    const eligibleCountries = countries.filter(
      (country) => country.area && country.area > 0,
    );
    const sortedByArea = [...eligibleCountries].sort(
      (a, b) => (b.area || 0) - (a.area || 0),
    );

    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const isLargest = Math.random() < 0.5;

    const selectedCountries = isLargest
      ? sortedByArea.slice(0, choiceCount)
      : sortedByArea.slice(-choiceCount).reverse();

    const correctAnswer = selectedCountries[0];
    const shuffledChoices = this.shuffleArray(
      selectedCountries.map((c) => c.name),
    );

    return {
      id: `facts_area_${questionNumber}`,
      type: 'facts-guess' as GameMode,
      prompt: `Which country has the ${isLargest ? 'largest' : 'smallest'} land area?`,
      correctAnswer: correctAnswer.name,
      choices: shuffledChoices,
      metadata: {
        factType: 'area',
        factValue: correctAnswer.area,
        isLargest,
        difficulty,
      },
    };
  }

  private generateGdpFactsQuestion(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
    questionNumber: number,
  ): Question {
    const eligibleCountries = countries.filter(
      (country) => country.gdpPerCapita && country.gdpPerCapita > 0,
    );
    const sortedByGdp = [...eligibleCountries].sort(
      (a, b) => (b.gdpPerCapita || 0) - (a.gdpPerCapita || 0),
    );

    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const isHighest = Math.random() < 0.5;

    const selectedCountries = isHighest
      ? sortedByGdp.slice(0, choiceCount)
      : sortedByGdp.slice(-choiceCount).reverse();

    const correctAnswer = selectedCountries[0];
    const shuffledChoices = this.shuffleArray(
      selectedCountries.map((c) => c.name),
    );

    return {
      id: `facts_gdp_${questionNumber}`,
      type: 'facts-guess' as GameMode,
      prompt: `Which country has the ${isHighest ? 'highest' : 'lowest'} GDP per capita?`,
      correctAnswer: correctAnswer.name,
      choices: shuffledChoices,
      metadata: {
        factType: 'gdp',
        factValue: correctAnswer.gdpPerCapita,
        isHighest,
        difficulty,
      },
    };
  }

  private generateDensityFactsQuestion(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
    questionNumber: number,
  ): Question {
    const eligibleCountries = countries.filter(
      (country) =>
        country.population > 1000 && country.area && country.area > 0,
    );

    // Calculate population density
    const countriesWithDensity = eligibleCountries.map((country) => ({
      ...country,
      density: country.population / (country.area || 1),
    }));

    const sortedByDensity = countriesWithDensity.sort(
      (a, b) => b.density - a.density,
    );

    const choiceCount = this.CHOICE_COUNTS[difficulty];
    const isHighest = Math.random() < 0.5;

    const selectedCountries = isHighest
      ? sortedByDensity.slice(0, choiceCount)
      : sortedByDensity.slice(-choiceCount).reverse();

    const correctAnswer = selectedCountries[0];
    const shuffledChoices = this.shuffleArray(
      selectedCountries.map((c) => c.name),
    );

    return {
      id: `facts_density_${questionNumber}`,
      type: 'facts-guess' as GameMode,
      prompt: `Which country has the ${isHighest ? 'highest' : 'lowest'} population density?`,
      correctAnswer: correctAnswer.name,
      choices: shuffledChoices,
      metadata: {
        factType: 'density',
        factValue: correctAnswer.density,
        isHighest,
        difficulty,
      },
    };
  }

  // ========== UTILITY METHODS ==========

  /**
   * Convert 3-letter ISO country code to 2-letter ISO country code for flag URLs
   */
  private convertToTwoLetterCode(threeLetterCode: string): string {
    // Common country code mappings (3-letter to 2-letter ISO codes)
    const codeMap: { [key: string]: string } = {
      ABW: 'aw',
      AND: 'ad',
      USA: 'us',
      GBR: 'gb',
      FRA: 'fr',
      DEU: 'de',
      JPN: 'jp',
      CHN: 'cn',
      IND: 'in',
      BRA: 'br',
      RUS: 'ru',
      CAN: 'ca',
      AUS: 'au',
      ITA: 'it',
      ESP: 'es',
      MEX: 'mx',
      KOR: 'kr',
      NLD: 'nl',
      SWE: 'se',
      CHE: 'ch',
      TUR: 'tr',
      POL: 'pl',
      BEL: 'be',
      IRL: 'ie',
      NOR: 'no',
      AUT: 'at',
      DNK: 'dk',
      FIN: 'fi',
      NZL: 'nz',
      PRT: 'pt',
      GRC: 'gr',
      CZE: 'cz',
      HUN: 'hu',
      SVK: 'sk',
      ROU: 'ro',
      BGR: 'bg',
      HRV: 'hr',
      SVN: 'si',
      LTU: 'lt',
      LVA: 'lv',
      EST: 'ee',
      CYP: 'cy',
      MLT: 'mt',
      LUX: 'lu',
      ISL: 'is',
      ARG: 'ar',
      CHL: 'cl',
      COL: 'co',
      PER: 'pe',
      VEN: 've',
      URY: 'uy',
      PRY: 'py',
      BOL: 'bo',
      ECU: 'ec',
      GUY: 'gy',
      SUR: 'sr',
      GUF: 'gf',
      ZAF: 'za',
      EGY: 'eg',
      NGA: 'ng',
      KEN: 'ke',
      GHA: 'gh',
      UGA: 'ug',
      TZA: 'tz',
      ETH: 'et',
      ZWE: 'zw',
      BWA: 'bw',
      ZMB: 'zm',
      MOZ: 'mz',
      MDG: 'mg',
      MWI: 'mw',
      NAM: 'na',
      SWZ: 'sz',
      LSO: 'ls',
      MAR: 'ma',
      DZA: 'dz',
      TUN: 'tn',
      LBY: 'ly',
      SDN: 'sd',
      TCD: 'td',
      NER: 'ne',
      MLI: 'ml',
      BFA: 'bf',
      SEN: 'sn',
      GIN: 'gn',
      SLE: 'sl',
      LBR: 'lr',
      CIV: 'ci',
      GNB: 'gw',
      GMB: 'gm',
      CPV: 'cv',
      MRT: 'mr',
      CMR: 'cm',
      GAB: 'ga',
      GNQ: 'gq',
      COG: 'cg',
      COD: 'cd',
      CAF: 'cf',
      AGO: 'ao',
      RWA: 'rw',
      BDI: 'bi',
      DJI: 'dj',
      SOM: 'so',
      ERI: 'er',
      COM: 'km',
      MUS: 'mu',
      SYC: 'sc',
      MDV: 'mv',
      LKA: 'lk',
      BGD: 'bd',
      PAK: 'pk',
      AFG: 'af',
      IRN: 'ir',
      IRQ: 'iq',
      SAU: 'sa',
      ARE: 'ae',
      OMN: 'om',
      YEM: 'ye',
      JOR: 'jo',
      ISR: 'il',
      LBN: 'lb',
      SYR: 'sy',
      KWT: 'kw',
      QAT: 'qa',
      BHR: 'bh',
      GEO: 'ge',
      ARM: 'am',
      AZE: 'az',
      KAZ: 'kz',
      UZB: 'uz',
      TKM: 'tm',
      KGZ: 'kg',
      TJK: 'tj',
      MNG: 'mn',
      PRK: 'kp',
      VNM: 'vn',
      LAO: 'la',
      KHM: 'kh',
      THA: 'th',
      MMR: 'mm',
      MYS: 'my',
      SGP: 'sg',
      IDN: 'id',
      BRN: 'bn',
      PHL: 'ph',
      TWN: 'tw',
      HKG: 'hk',
      MAC: 'mo',
      FJI: 'fj',
      PNG: 'pg',
      SLB: 'sb',
      VUT: 'vu',
      NCL: 'nc',
      PLW: 'pw',
      MHL: 'mh',
      FSM: 'fm',
      NRU: 'nr',
      KIR: 'ki',
      TON: 'to',
      WSM: 'ws',
      TUV: 'tv',
      COK: 'ck',
      // Additional countries that were missing
      AIA: 'ai',
      ALA: 'ax',
      ALB: 'al',
      BEN: 'bj',
      BHS: 'bs',
      BLR: 'by',
      BLZ: 'bz',
      BMU: 'bm',
      BRB: 'bb',
      BTN: 'bt',
      CUB: 'cu',
      CUW: 'cw',
      CRI: 'cr',
      DMA: 'dm',
      DOM: 'do',
      ESH: 'eh',
      GGY: 'gg',
      GRD: 'gd',
      GRL: 'gl',
      GTM: 'gt',
      GUM: 'gu',
      HND: 'hn',
      HTI: 'ht',
      IMN: 'im',
      JAM: 'jm',
      JEY: 'je',
      LCA: 'lc',
      LIE: 'li',
      MDA: 'md',
      MCO: 'mc',
      MNE: 'me',
      MSR: 'ms',
      NIC: 'ni',
      NIU: 'nu',
      NPL: 'np',
      PAN: 'pa',
      PSE: 'ps',
      SLV: 'sv',
      SMR: 'sm',
      SRB: 'rs',
      SSD: 'ss',
      TGO: 'tg',
      UKR: 'ua',
      VAT: 'va',
      VCT: 'vc',
      // All remaining territories supported by flagcdn.com (100% coverage)
      ASM: 'as',
      ATA: 'at',
      ATF: 'tf',
      ATG: 'ag',
      BIH: 'ba',
      BLM: 'bl',
      CYM: 'ky',
      FLK: 'fk',
      FRO: 'fo',
      HMD: 'hm',
      IOT: 'io',
      KNA: 'kn',
      MKD: 'mk',
      MNP: 'mp',
      NFK: 'nf',
      PCN: 'pn',
      PRI: 'pr',
      PYF: 'pf',
      SGS: 'gs',
      SHN: 'sh',
      SPM: 'pm',
      STP: 'st',
      SXM: 'sx',
      TCA: 'tc',
      TLS: 'tl',
      TTO: 'tt',
      VGB: 'vg',
      WLF: 'wf',
    };

    return (
      codeMap[threeLetterCode.toUpperCase()] ||
      threeLetterCode.toLowerCase().slice(0, 2)
    );
  }

  private filterCountriesByDifficulty(
    countries: readonly CountryDataRecord[],
    difficulty: Difficulty,
  ): CountryDataRecord[] {
    switch (difficulty) {
      case 'easy':
        return [
          ...countries.filter(
            (country) =>
              country.population > 10_000_000 ||
              [
                'United States',
                'China',
                'Russia',
                'Canada',
                'Brazil',
                'Australia',
                'India',
                'Mexico',
              ].includes(country.name),
          ),
        ];

      case 'medium':
        return [
          ...countries.filter(
            (country) =>
              country.population > 1_000_000 ||
              ['Luxembourg', 'Malta', 'Iceland', 'Singapore'].includes(
                country.name,
              ),
          ),
        ];

      case 'hard':
        return [...countries]; // All countries available

      default:
        return [...countries];
    }
  }

  private selectRandomCountries(
    countries: CountryDataRecord[],
    count: number,
  ): CountryDataRecord[] {
    const shuffled = this.shuffleArray([...countries]);
    return shuffled.slice(0, Math.min(count, countries.length));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private generateStubQuestions(
    mode: GameMode,
    difficulty: Difficulty,
    count: number,
  ): Question[] {
    const questions: Question[] = [];
    for (let i = 0; i < count; i++) {
      questions.push({
        id: `stub_${mode}_${i + 1}`,
        type: mode,
        prompt: `${mode} Question ${i + 1} (${difficulty}) - Coming Soon`,
        correctAnswer: 'SAMPLE_COUNTRY_ID',
        metadata: {
          countryId: 'SAMPLE_COUNTRY_ID',
          isStub: true,
        },
      });
    }
    return questions;
  }

  private seedRandom(seed: string): void {
    // Simple seeding for reproducible randomness
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    // Override Math.random with seeded version
    const seededRandom = () => {
      hash = Math.abs(Math.sin(hash) * 10000);
      return hash - Math.floor(hash);
    };

    // Note: In production, use a proper seeded random number generator
    Math.random = seededRandom;
  }
}

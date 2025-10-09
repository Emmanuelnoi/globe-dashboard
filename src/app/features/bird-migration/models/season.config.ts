/**
 * Season Configuration Constants
 * Defines the seasonal data and hemisphere-aware month mappings
 */

import {
  Season,
  SeasonConfig,
  DatePreset,
  Hemisphere,
  DateRange,
} from './ui.models';

/**
 * Season configuration with hemisphere-aware month definitions
 */
export const SEASON_CONFIGS: Record<Season, SeasonConfig> = {
  spring: {
    id: 'spring',
    name: 'Spring',
    icon: '🌸',
    northMonths: [2, 3, 4], // Mar, Apr, May (0-indexed)
    southMonths: [8, 9, 10], // Sep, Oct, Nov
    color: '#22c55e', // Green-500
    description: 'Spring migration period - birds moving to breeding grounds',
  },
  summer: {
    id: 'summer',
    name: 'Summer',
    icon: '☀️',
    northMonths: [5, 6, 7], // Jun, Jul, Aug
    southMonths: [11, 0, 1], // Dec, Jan, Feb
    color: '#f59e0b', // Amber-500
    description: 'Summer breeding season - birds in nesting areas',
  },
  autumn: {
    id: 'autumn',
    name: 'Autumn',
    icon: '🍂',
    northMonths: [8, 9, 10], // Sep, Oct, Nov
    southMonths: [2, 3, 4], // Mar, Apr, May
    color: '#f97316', // Orange-500
    description: 'Autumn migration period - birds moving to wintering grounds',
  },
  winter: {
    id: 'winter',
    name: 'Winter',
    icon: '❄️',
    northMonths: [11, 0, 1], // Dec, Jan, Feb
    southMonths: [5, 6, 7], // Jun, Jul, Aug
    color: '#06b6d4', // Cyan-500
    description: 'Winter period - birds in wintering areas',
  },
} as const;

/**
 * Month names for display
 */
export const MONTH_NAMES: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * Month names (full) for accessibility
 */
export const MONTH_NAMES_FULL: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Quick preset date ranges
 */
export const DATE_PRESETS: readonly DatePreset[] = [
  {
    id: 'last-30-days',
    label: 'Last 30 days',
    description: 'Recent migration activity',
    getDates: (currentDate: Date) => ({
      startDate: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(currentDate),
      granularity: 'day' as const,
    }),
    isAvailable: () => true,
  },
  {
    id: 'current-season',
    label: 'Current migration season',
    description: 'Full current seasonal period',
    getDates: (currentDate: Date, hemisphere: Hemisphere) => {
      const currentSeason = getCurrentSeason(currentDate, hemisphere);
      const config = SEASON_CONFIGS[currentSeason];
      const months =
        hemisphere === 'north' ? config.northMonths : config.southMonths;

      const year = currentDate.getFullYear();
      const startDate = new Date(year, months[0], 1);
      const endDate = new Date(year, months[2] + 1, 0); // Last day of end month

      // Handle cross-year seasons (winter)
      if (months[0] > months[2]) {
        if (currentDate.getMonth() <= months[2]) {
          startDate.setFullYear(year - 1);
        } else {
          endDate.setFullYear(year + 1);
        }
      }

      return {
        startDate,
        endDate,
        granularity: 'week' as const,
      };
    },
    isAvailable: () => true,
  },
  {
    id: 'breeding-season',
    label: 'Breeding season',
    description: 'April to August - peak breeding activity',
    getDates: (currentDate: Date, hemisphere: Hemisphere) => {
      const year = currentDate.getFullYear();
      if (hemisphere === 'north') {
        return {
          startDate: new Date(year, 3, 1), // April 1
          endDate: new Date(year, 7, 31), // August 31
          granularity: 'week' as const,
        };
      } else {
        return {
          startDate: new Date(year, 9, 1), // October 1
          endDate: new Date(year + 1, 1, 28), // February 28
          granularity: 'week' as const,
        };
      }
    },
    isAvailable: (currentDate: Date) => {
      const month = currentDate.getMonth();
      return month >= 3 && month <= 7; // Available during NH breeding season
    },
  },
  {
    id: 'wintering-period',
    label: 'Wintering period',
    description: 'November to February - overwintering areas',
    getDates: (currentDate: Date, hemisphere: Hemisphere) => {
      const year = currentDate.getFullYear();
      if (hemisphere === 'north') {
        return {
          startDate: new Date(year, 10, 1), // November 1
          endDate: new Date(year + 1, 1, 28), // February 28
          granularity: 'week' as const,
        };
      } else {
        return {
          startDate: new Date(year, 4, 1), // May 1
          endDate: new Date(year, 7, 31), // August 31
          granularity: 'week' as const,
        };
      }
    },
    isAvailable: (currentDate: Date) => {
      const month = currentDate.getMonth();
      return month >= 10 || month <= 1; // Available during NH winter
    },
  },
] as const;

/**
 * Get current season based on date and hemisphere
 */
export function getCurrentSeason(date: Date, hemisphere: Hemisphere): Season {
  const month = date.getMonth();

  for (const [season, config] of Object.entries(SEASON_CONFIGS) as Array<
    [Season, SeasonConfig]
  >) {
    const months =
      hemisphere === 'north' ? config.northMonths : config.southMonths;

    // Handle cross-year seasons (winter)
    if (months[0] > months[2]) {
      if (month >= months[0] || month <= months[2]) {
        return season;
      }
    } else {
      if (month >= months[0] && month <= months[2]) {
        return season;
      }
    }
  }

  // Fallback (should never happen)
  return 'spring';
}

/**
 * Get month labels for a season and hemisphere
 */
export function getSeasonMonthLabels(
  season: Season,
  hemisphere: Hemisphere,
): readonly [string, string, string] {
  const config = SEASON_CONFIGS[season];
  const months =
    hemisphere === 'north' ? config.northMonths : config.southMonths;

  return [
    MONTH_NAMES[months[0]],
    MONTH_NAMES[months[1]],
    MONTH_NAMES[months[2]],
  ] as const;
}

/**
 * Get full month labels for accessibility
 */
export function getSeasonMonthLabelsAccessible(
  season: Season,
  hemisphere: Hemisphere,
): readonly [string, string, string] {
  const config = SEASON_CONFIGS[season];
  const months =
    hemisphere === 'north' ? config.northMonths : config.southMonths;

  return [
    MONTH_NAMES_FULL[months[0]],
    MONTH_NAMES_FULL[months[1]],
    MONTH_NAMES_FULL[months[2]],
  ] as const;
}

/**
 * Get season display label
 */
export function getSeasonDisplayLabel(
  season: Season,
  hemisphere: Hemisphere,
): string {
  const config = SEASON_CONFIGS[season];
  const monthLabels = getSeasonMonthLabels(season, hemisphere);
  const hemisphereLabel = hemisphere === 'north' ? 'NH' : 'SH';

  return `${config.name} — ${monthLabels[0]}–${monthLabels[2]} (${hemisphereLabel})`;
}

/**
 * Validate date range
 */
export function validateDateRange(
  startDate: Date,
  endDate: Date,
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (startDate >= endDate) {
    errors.push('Start date must be before end date');
  }

  // Check if end date is in the future
  const now = new Date();
  if (endDate > now) {
    errors.push('End date cannot be in the future');
  }

  // Check range duration
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 7) {
    warnings.push('Range is very short - may have limited data');
  }

  if (diffDays > 365) {
    warnings.push('Range is very long - may impact performance');
  }

  // Check if range spans too many years
  const yearDiff = endDate.getFullYear() - startDate.getFullYear();
  if (yearDiff > 1) {
    errors.push('Date range cannot span more than one year');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Default animation durations (ms)
 */
export const ANIMATION_DURATIONS = {
  FAST: 150,
  NORMAL: 250,
  SLOW: 400,
  LOADING: 1000,
} as const;

/**
 * Component dimensions
 */
export const UI_DIMENSIONS = {
  SEASON_CHIP: {
    WIDTH: 120,
    HEIGHT: 80,
    GAP: 12,
  },
  HEMISPHERE_TOGGLE: {
    WIDTH: 160,
    HEIGHT: 36,
  },
  TIMELINE_SCRUBBER: {
    HEIGHT: 60,
    THUMB_SIZE: 20,
  },
  MODAL: {
    MAX_WIDTH: 800,
    MAX_HEIGHT: 600,
    PADDING: 24,
  },
} as const;

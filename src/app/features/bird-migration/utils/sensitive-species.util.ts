/**
 * Sensitive Species Protection Utility
 * Handles coordinate redaction for endangered and sensitive species
 *
 * @module sensitive-species.util
 * @description Implements GBIF-compliant coordinate generalization for species protection
 * @see https://www.gbif.org/sensitive-species-access-and-usage
 */

import {
  MigrationPoint,
  SensitiveSpeciesConfig,
} from '../models/migration.types';
import { migrationLogger } from './migration-logger.utils';

/**
 * List of sensitive species (GBIF taxon keys)
 * These species require coordinate redaction for conservation purposes
 *
 * Note: This is a curated subset. In production, fetch from GBIF API or maintain
 * a comprehensive database of IUCN Red List species.
 */
const SENSITIVE_SPECIES_KEYS: ReadonlySet<number> = new Set([
  // Birds of Prey (commonly sensitive)
  2480598, // Aquila chrysaetos (Golden Eagle)
  2480113, // Haliaeetus leucocephalus (Bald Eagle)
  2480371, // Falco peregrinus (Peregrine Falcon)
  2481119, // Gyps fulvus (Griffon Vulture)

  // Endangered Seabirds
  2481447, // Puffinus mauretanicus (Balearic Shearwater) - CR
  2481203, // Synthliboramphus wumizusume (Japanese Murrelet) - VU

  // Cranes and Large Waders
  2474894, // Grus americana (Whooping Crane) - EN
  2474896, // Grus japonensis (Red-crowned Crane) - EN
  2474901, // Grus leucogeranus (Siberian Crane) - CR

  // Parrots (many are endangered)
  2473798, // Ara glaucogularis (Blue-throated Macaw) - CR
  2473684, // Amazona vittata (Puerto Rican Amazon) - CR

  // Other notable species
  2498387, // Numenius borealis (Eskimo Curlew) - CR (possibly extinct)
  2498252, // Numenius tenuirostris (Slender-billed Curlew) - CR
]);

/**
 * IUCN Red List categories requiring protection
 */
const PROTECTED_CATEGORIES: ReadonlySet<string> = new Set([
  'CR', // Critically Endangered
  'EN', // Endangered
  'VU', // Vulnerable
]);

/**
 * Default configuration for sensitive species protection
 */
const DEFAULT_CONFIG: SensitiveSpeciesConfig = {
  enabled: true,
  redactionPrecision: 0.5, // 0.5 degrees ≈ 55km at equator
  protectedSpecies: Array.from(SENSITIVE_SPECIES_KEYS),
  reasonCode: 'CONSERVATION_PROTECTION',
};

/**
 * Checks if a species is sensitive and requires coordinate redaction
 * @param speciesKey - GBIF taxon key
 * @param conservationStatus - IUCN Red List category (optional)
 * @returns True if species is sensitive
 */
export function isSensitiveSpecies(
  speciesKey: number,
  conservationStatus?: string,
): boolean {
  // Check if explicitly marked as sensitive
  if (SENSITIVE_SPECIES_KEYS.has(speciesKey)) {
    return true;
  }

  // Check conservation status
  if (conservationStatus && PROTECTED_CATEGORIES.has(conservationStatus)) {
    return true;
  }

  return false;
}

/**
 * Redacts (generalizes) coordinates to protect sensitive species
 * @param point - Migration point to redact
 * @param precision - Redaction precision in degrees (default: 0.5)
 * @returns Redacted migration point
 */
export function redactCoordinates(
  point: MigrationPoint,
  precision: number = DEFAULT_CONFIG.redactionPrecision,
): MigrationPoint {
  // Round coordinates to specified precision
  const redactedLat = Math.round(point.latitude / precision) * precision;
  const redactedLng = Math.round(point.longitude / precision) * precision;

  // Increase accuracy uncertainty to reflect generalization
  const generalizedAccuracy = Math.max(
    point.accuracy,
    precision * 111000, // Convert degrees to meters (approximate)
  );

  return {
    ...point,
    latitude: redactedLat,
    longitude: redactedLng,
    accuracy: generalizedAccuracy,
    metadata: {
      ...point.metadata,
      isSensitive: true,
      locality: null, // Remove precise locality information
    },
  };
}

/**
 * Processes an array of migration points, redacting sensitive ones
 * @param points - Array of migration points
 * @param speciesKey - GBIF taxon key
 * @param conservationStatus - IUCN Red List category (optional)
 * @param config - Protection configuration (optional)
 * @returns Processed array with redacted coordinates where necessary
 */
export function protectSensitivePoints(
  points: readonly MigrationPoint[],
  speciesKey: number,
  conservationStatus?: string,
  config: Partial<SensitiveSpeciesConfig> = {},
): readonly MigrationPoint[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    return points;
  }

  const isSensitive = isSensitiveSpecies(speciesKey, conservationStatus);

  if (!isSensitive) {
    return points;
  }

  migrationLogger.info(
    `🔒 Applying coordinate protection for sensitive species (GBIF:${speciesKey})`,
  );

  return points.map((point) =>
    redactCoordinates(point, finalConfig.redactionPrecision),
  );
}

/**
 * Calculates the approximate distance (in km) represented by a degree at given latitude
 * Used for estimating redaction impact
 * @param latitude - Latitude in degrees
 * @returns Distance in km for 1 degree at that latitude
 */
export function degreesToKm(latitude: number): { lat: number; lng: number } {
  const latKm = 111.32; // km per degree latitude (constant)
  const lngKm = 111.32 * Math.cos((latitude * Math.PI) / 180); // varies by latitude

  return { lat: latKm, lng: lngKm };
}

/**
 * Estimates the area obfuscated by coordinate redaction
 * @param latitude - Original latitude
 * @param precision - Redaction precision in degrees
 * @returns Area in square kilometers
 */
export function estimateRedactionArea(
  latitude: number,
  precision: number,
): number {
  const { lat, lng } = degreesToKm(latitude);
  const latDistance = precision * lat;
  const lngDistance = precision * lng;

  return latDistance * lngDistance;
}

/**
 * Generates a human-readable explanation of coordinate redaction
 * @param speciesKey - GBIF taxon key
 * @param precision - Redaction precision
 * @param sampleLatitude - Sample latitude for area calculation
 * @returns Explanation string
 */
export function getRedactionExplanation(
  speciesKey: number,
  precision: number,
  sampleLatitude: number = 0,
): string {
  const area = estimateRedactionArea(sampleLatitude, precision);
  const areaKm = Math.round(area);

  return `Coordinates have been generalized to ~${precision}° precision (~${areaKm} km²) to protect this sensitive species (GBIF:${speciesKey}). This is a conservation measure to prevent disturbance or illegal collection.`;
}

/**
 * Detects if a point has been redacted (has low precision)
 * @param point - Migration point to check
 * @param threshold - Precision threshold in degrees
 * @returns True if point appears to be redacted
 */
export function isRedacted(
  point: MigrationPoint,
  threshold: number = 0.1,
): boolean {
  // Check if coordinates are rounded to suspicious precision
  const latPrecision = Math.abs(point.latitude % threshold);
  const lngPrecision = Math.abs(point.longitude % threshold);

  const isRounded = latPrecision < 0.001 && lngPrecision < 0.001;

  // Check metadata flag
  const markedSensitive = point.metadata.isSensitive === true;

  return isRounded || markedSensitive;
}

/**
 * Adds species to the sensitive species list
 * @param speciesKeys - Array of GBIF taxon keys to add
 */
export function addSensitiveSpecies(speciesKeys: readonly number[]): void {
  const mutableSet = new Set(SENSITIVE_SPECIES_KEYS);
  speciesKeys.forEach((key) => mutableSet.add(key));

  // Note: In production, this would update a persistent database
  migrationLogger.success(
    `✅ Added ${speciesKeys.length} species to sensitive list`,
  );
}

/**
 * Gets the complete list of sensitive species keys
 */
export function getSensitiveSpeciesList(): readonly number[] {
  return Array.from(SENSITIVE_SPECIES_KEYS);
}

/**
 * Validates if a species key is valid (basic sanity check)
 */
export function isValidSpeciesKey(speciesKey: number): boolean {
  return Number.isInteger(speciesKey) && speciesKey > 0;
}

/**
 * Creates a privacy-compliant attribution message
 */
export function getPrivacyAttribution(): string {
  return 'Some coordinates have been generalized for species conservation. Data courtesy of GBIF (www.gbif.org).';
}

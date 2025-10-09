/**
 * GBIF API Type Definitions
 * Comprehensive TypeScript interfaces for GBIF API responses
 *
 * @module gbif.types
 * @description Type-safe GBIF API integration
 * @see https://www.gbif.org/developer/occurrence
 */

/**
 * GBIF Occurrence Record
 * Represents a single species observation from GBIF
 */
export interface GBIFOccurrence {
  readonly key: number; // Unique GBIF occurrence identifier
  readonly datasetKey: string;
  readonly publishingOrgKey?: string;
  readonly publishingCountry?: string;
  readonly protocol?: string;
  readonly lastCrawled?: string;
  readonly lastParsed?: string;
  readonly crawlId?: number;
  readonly basisOfRecord: string; // OBSERVATION, HUMAN_OBSERVATION, MACHINE_OBSERVATION, etc.
  readonly taxonKey: number; // Species taxon key
  readonly kingdomKey?: number;
  readonly phylumKey?: number;
  readonly classKey?: number;
  readonly orderKey?: number;
  readonly familyKey?: number;
  readonly genusKey?: number;
  readonly speciesKey?: number;
  readonly acceptedTaxonKey?: number;
  readonly scientificName: string;
  readonly acceptedScientificName?: string;
  readonly kingdom?: string;
  readonly phylum?: string;
  readonly order?: string;
  readonly family?: string;
  readonly genus?: string;
  readonly species?: string;
  readonly genericName?: string;
  readonly specificEpithet?: string;
  readonly taxonRank?: string;
  readonly taxonomicStatus?: string;
  readonly decimalLatitude: number | null;
  readonly decimalLongitude: number | null;
  readonly coordinateUncertaintyInMeters: number | null;
  readonly coordinatePrecision?: number | null;
  readonly elevation?: number | null;
  readonly elevationAccuracy?: number | null;
  readonly depth?: number | null;
  readonly depthAccuracy?: number | null;
  readonly eventDate: string | null; // ISO 8601 date string
  readonly eventTime?: string | null;
  readonly startDayOfYear?: number;
  readonly endDayOfYear?: number;
  readonly year?: number;
  readonly month?: number;
  readonly day?: number;
  readonly verbatimEventDate?: string;
  readonly countryCode: string | null; // ISO 3166-1 alpha-2
  readonly locality: string | null;
  readonly stateProvince?: string | null;
  readonly continent?: string;
  readonly waterBody?: string;
  readonly recordedBy?: string; // Observer name
  readonly identifiedBy?: string;
  readonly dateIdentified?: string;
  readonly license?: string;
  readonly rightsHolder?: string;
  readonly recordedByID?: readonly string[];
  readonly identifiedByID?: readonly string[];
  readonly occurrenceID?: string;
  readonly catalogNumber?: string;
  readonly recordNumber?: string;
  readonly individualCount?: number;
  readonly organismQuantity?: number;
  readonly organismQuantityType?: string;
  readonly sampleSizeValue?: number;
  readonly sampleSizeUnit?: string;
  readonly relativeOrganismQuantity?: number;
  readonly occurrenceStatus?: string;
  readonly dataGeneralizations?: string;
  readonly informationWithheld?: string; // Indicates sensitive data
  readonly datasetName?: string;
  readonly verbatimLocality?: string;
  readonly verbatimElevation?: string;
  readonly verbatimDepth?: string;
  readonly geodeticDatum?: string;
  readonly class?: string;
  readonly establishmentMeans?: string;
  readonly lifeStage?: string;
  readonly sex?: string;
  readonly issues: readonly string[]; // Data quality issues
  readonly modified?: string;
  readonly lastInterpreted?: string;
  readonly references?: string;
  readonly identificationQualifier?: string;
  readonly typeStatus?: string;
  readonly taxonConceptID?: string;
  readonly nomenclaturalCode?: string;
  readonly higherGeography?: string;
  readonly higherClassification?: string;
  readonly preparations?: string;
  readonly disposition?: string;
  readonly associatedMedia?: readonly string[];
  readonly associatedReferences?: readonly string[];
  readonly associatedOccurrences?: readonly string[];
  readonly associatedSequences?: readonly string[];
  readonly associatedTaxa?: readonly string[];
  readonly mediaType?: readonly string[];
  readonly occurrenceRemarks?: string;
  readonly georeferencedBy?: string;
  readonly georeferencedDate?: string;
  readonly georeferenceProtocol?: string;
  readonly georeferenceSources?: string;
  readonly georeferenceVerificationStatus?: string;
  readonly georeferenceRemarks?: string;
}

/**
 * GBIF Search API Response
 */
export interface GBIFResponse {
  readonly offset: number;
  readonly limit: number;
  readonly endOfRecords: boolean;
  readonly count: number; // Total matching records
  readonly results: readonly GBIFOccurrence[];
  readonly facets?: readonly GBIFFacet[];
}

/**
 * GBIF Facet for aggregation queries
 */
export interface GBIFFacet {
  readonly field: string;
  readonly counts: readonly {
    readonly name: string;
    readonly count: number;
  }[];
}

/**
 * GBIF Species Information
 */
export interface GBIFSpecies {
  readonly key: number;
  readonly nubKey?: number;
  readonly nameKey?: number;
  readonly taxonID?: string;
  readonly sourceTaxonKey?: number;
  readonly kingdom: string;
  readonly phylum?: string;
  readonly order?: string;
  readonly family?: string;
  readonly genus?: string;
  readonly species?: string;
  readonly kingdomKey?: number;
  readonly phylumKey?: number;
  readonly classKey?: number;
  readonly orderKey?: number;
  readonly familyKey?: number;
  readonly genusKey?: number;
  readonly speciesKey?: number;
  readonly datasetKey: string;
  readonly constituentKey?: string;
  readonly parentKey?: number;
  readonly parent?: string;
  readonly acceptedKey?: number;
  readonly accepted?: string;
  readonly basionymKey?: number;
  readonly basionym?: string;
  readonly scientificName: string;
  readonly canonicalName: string;
  readonly vernacularName?: string;
  readonly vernacularNames?: readonly {
    readonly vernacularName: string;
    readonly language: string;
    readonly source?: string;
    readonly taxonKey?: number;
    readonly preferred?: boolean;
  }[];
  readonly authorship?: string;
  readonly publishedIn?: string;
  readonly accordingTo?: string;
  readonly nameType?: string;
  readonly rank: string;
  readonly origin?: string;
  readonly taxonomicStatus: string;
  readonly nomenclaturalStatus?: readonly string[];
  readonly remarks?: string;
  readonly numDescendants?: number;
  readonly lastCrawled?: string;
  readonly lastInterpreted?: string;
  readonly issues?: readonly string[];
  readonly synonym?: boolean;
  readonly class?: string;
}

/**
 * GBIF Query Parameters
 */
export interface GBIFQueryParams {
  readonly taxonKey?: number;
  readonly scientificName?: string;
  readonly country?: string; // ISO 3166-1 alpha-2
  readonly year?: number;
  readonly month?: number;
  readonly decimalLatitude?: number;
  readonly decimalLongitude?: number;
  readonly hasCoordinate?: boolean;
  readonly hasGeospatialIssue?: boolean;
  readonly limit?: number;
  readonly offset?: number;
  readonly basisOfRecord?: string | readonly string[];
  readonly eventDate?: string; // Date range: YYYY,YYYY or YYYY-MM-DD,YYYY-MM-DD
  readonly continent?: string;
  readonly datasetKey?: string;
  readonly publishingCountry?: string;
  readonly issue?: string | readonly string[];
  readonly license?: string;
  readonly occurrenceStatus?: 'PRESENT' | 'ABSENT';
  readonly establishmentMeans?: string;
  readonly repatriated?: boolean;
  readonly protocol?: string;
  readonly mediaType?: string;
  readonly recordedBy?: string;
  readonly identifiedBy?: string;
  readonly catalogNumber?: string;
  readonly recordNumber?: string;
  readonly collectionCode?: string;
  readonly institutionCode?: string;
  readonly q?: string; // Full-text search
}

/**
 * GBIF Error Response
 */
export interface GBIFErrorResponse {
  readonly error: string;
  readonly message: string;
  readonly statusCode: number;
  readonly path?: string;
  readonly timestamp?: string;
}

/**
 * GBIF Dataset Information
 */
export interface GBIFDataset {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly type: string;
  readonly license?: string;
  readonly created?: string;
  readonly modified?: string;
  readonly doi?: string;
  readonly citation?: {
    readonly text: string;
  };
  readonly contacts?: readonly {
    readonly key: number;
    readonly type: string;
    readonly primary: boolean;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly position?: readonly string[];
    readonly email?: readonly string[];
    readonly phone?: readonly string[];
    readonly organization?: string;
    readonly address?: readonly string[];
    readonly city?: string;
    readonly province?: string;
    readonly country?: string;
    readonly postalCode?: string;
  }[];
}

/**
 * GBIF Issue Types (data quality flags)
 * @see https://gbif.github.io/gbif-api/apidocs/org/gbif/api/vocabulary/OccurrenceIssue.html
 */
export type GBIFIssue =
  | 'BASIS_OF_RECORD_INVALID'
  | 'CONTINENT_COUNTRY_MISMATCH'
  | 'CONTINENT_DERIVED_FROM_COORDINATES'
  | 'CONTINENT_INVALID'
  | 'COORDINATE_INVALID'
  | 'COORDINATE_OUT_OF_RANGE'
  | 'COORDINATE_PRECISION_INVALID'
  | 'COORDINATE_REPROJECTED'
  | 'COORDINATE_REPROJECTION_FAILED'
  | 'COORDINATE_REPROJECTION_SUSPICIOUS'
  | 'COORDINATE_ROUNDED'
  | 'COORDINATE_UNCERTAINTY_METERS_INVALID'
  | 'COUNTRY_COORDINATE_MISMATCH'
  | 'COUNTRY_DERIVED_FROM_COORDINATES'
  | 'COUNTRY_INVALID'
  | 'COUNTRY_MISMATCH'
  | 'DEPTH_MIN_MAX_SWAPPED'
  | 'DEPTH_NON_NUMERIC'
  | 'DEPTH_NOT_METRIC'
  | 'DEPTH_UNLIKELY'
  | 'ELEVATION_MIN_MAX_SWAPPED'
  | 'ELEVATION_NON_NUMERIC'
  | 'ELEVATION_NOT_METRIC'
  | 'ELEVATION_UNLIKELY'
  | 'GEODETIC_DATUM_ASSUMED_WGS84'
  | 'GEODETIC_DATUM_INVALID'
  | 'IDENTIFIED_DATE_INVALID'
  | 'IDENTIFIED_DATE_UNLIKELY'
  | 'INDIVIDUAL_COUNT_INVALID'
  | 'INTERPRETATION_ERROR'
  | 'MODIFIED_DATE_INVALID'
  | 'MODIFIED_DATE_UNLIKELY'
  | 'MULTIMEDIA_DATE_INVALID'
  | 'MULTIMEDIA_URI_INVALID'
  | 'PRESUMED_NEGATED_LATITUDE'
  | 'PRESUMED_NEGATED_LONGITUDE'
  | 'PRESUMED_SWAPPED_COORDINATE'
  | 'RECORDED_DATE_INVALID'
  | 'RECORDED_DATE_MISMATCH'
  | 'RECORDED_DATE_UNLIKELY'
  | 'REFERENCES_URI_INVALID'
  | 'TAXON_MATCH_FUZZY'
  | 'TAXON_MATCH_HIGHERRANK'
  | 'TAXON_MATCH_NONE'
  | 'TYPE_STATUS_INVALID'
  | 'ZERO_COORDINATE';

/**
 * Worker message types for GBIF parsing
 */
export interface GBIFWorkerRequest {
  readonly type: 'parse' | 'decimate';
  readonly id: string;
  readonly data: GBIFResponse | readonly GBIFOccurrence[];
  readonly options?: GBIFParseOptions;
}

/**
 * GBIF parse options for worker
 */
export interface GBIFParseOptions {
  readonly decimationLevel?: number; // 0-1, where 1 = no decimation
  readonly filterIssues?: boolean; // Remove records with critical issues
  readonly redactSensitive?: boolean; // Apply coordinate redaction
  readonly sortByDate?: boolean;
  readonly deduplicateRadius?: number; // meters
}

/**
 * GBIF worker response
 */
export interface GBIFWorkerResponse {
  readonly type: 'success' | 'error' | 'progress';
  readonly id: string;
  readonly data?: unknown;
  readonly error?: string;
  readonly progress?: number; // 0-100
}

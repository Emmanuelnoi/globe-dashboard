/**
 * GeoJSON and TopoJSON Type Definitions
 * Extracted from geojson.utils.ts for better organization
 */

/**
 * GeoJSON Feature interface
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: unknown;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/**
 * GeoJSON FeatureCollection interface
 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * TopoJSON interfaces for type safety
 */
export interface TopoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon';
  id?: string | number;
  properties?: Record<string, unknown>;
  arcs?: number[][] | number[][][];
}

export interface TopoJSONFeatureCollection {
  type: 'GeometryCollection';
  geometries: TopoJSONGeometry[];
}

export interface TopoJSONTopology {
  type: 'Topology';
  bbox?: [number, number, number, number];
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
  arcs: number[][][];
  objects: {
    countries: TopoJSONFeatureCollection;
  };
}

/**
 * Type for converted GeoJSON features from TopoJSON
 */
export interface ConvertedGeoJSONFeature {
  type: 'Feature';
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon' | 'Point' | 'LineString';
    coordinates: number[] | number[][] | number[][][] | number[][][][];
  };
}

/**
 * Configuration for TopoJSON rendering
 */
export interface TopoJSONRenderOptions {
  radius?: number;
  borderOffset?: number;
  enableFillMeshes?: boolean;
  simplifyTolerance?: number;
}

/**
 * Result from unified border generation
 */
export interface UnifiedBorderResult {
  borderMesh: import('three').LineSegments;
  selectionMeshes: import('three').Group;
  countryCount: number;
  arcCount: number;
}

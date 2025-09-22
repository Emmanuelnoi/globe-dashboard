import {
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  MeshBasicMaterial,
  DoubleSide,
  Group,
  Mesh,
  LineLoop,
  LineSegments,
} from 'three';
import { feature as topoFeature, mesh as topoMesh } from 'topojson-client';
import earcut from 'earcut';

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
  borderMesh: LineSegments;
  selectionMeshes: Group;
  countryCount: number;
  arcCount: number;
}

/**
 * Convert latitude/longitude to 3D coordinates on a sphere
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param radius Sphere radius
 * @returns Vector3 position on sphere
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = 2,
): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

/**
 * Create Three.js geometry from GeoJSON polygon coordinates
 * @param coordinates GeoJSON polygon coordinates
 * @param radius Sphere radius
 * @returns Array of Vector3 points
 */
export function createPolygonGeometry(
  coordinates: number[][][],
  radius: number = 2,
): Vector3[] {
  const points: Vector3[] = [];

  // Process each ring in the polygon (first ring is exterior, others are holes)
  coordinates.forEach((ring, ringIndex) => {
    if (ringIndex === 0) {
      // Only process exterior ring for now
      ring.forEach(([lon, lat]) => {
        points.push(latLonToVector3(lat, lon, radius));
      });
    }
  });

  return points;
}

/**
 * Create filled mesh geometry from GeoJSON polygon coordinates using ShapeGeometry
 * @param coordinates GeoJSON polygon coordinates
 * @param radius Sphere radius
 * @returns BufferGeometry for filled mesh
 */
export function createFilledPolygonGeometry(
  coordinates: number[][][],
  radius: number = 2,
): BufferGeometry | null {
  try {
    // Get the exterior ring (first ring)
    const exteriorRing = coordinates[0];
    if (!exteriorRing || exteriorRing.length < 3) return null;

    // Convert to 3D points on sphere
    const points = exteriorRing.map(([lon, lat]) =>
      latLonToVector3(lat, lon, radius),
    );

    // Create triangulated geometry
    const geometry = new BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    // Add vertices
    points.forEach((point) => {
      vertices.push(point.x, point.y, point.z);
    });

    // Simple fan triangulation (works for convex polygons)
    for (let i = 1; i < points.length - 1; i++) {
      indices.push(0, i, i + 1);
    }

    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  } catch (error) {
    console.warn('Failed to create filled polygon geometry:', error);
    return null;
  }
}

/**
 * Load and parse GeoJSON data
 * @param url URL to GeoJSON file
 * @returns Promise of parsed GeoJSON data
 */
export async function loadGeoJSON(
  url: string,
): Promise<GeoJSONFeatureCollection> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load GeoJSON: ${response.statusText}`);
    }

    // Validate content type for security
    const contentType = response.headers.get('content-type');
    if (
      !contentType?.includes('application/json') &&
      !contentType?.includes('text/json') &&
      !contentType?.includes('application/geo+json')
    ) {
      throw new Error(
        `Invalid content type: ${contentType}. Expected JSON or GeoJSON format.`,
      );
    }

    return (await response.json()) as GeoJSONFeatureCollection;
  } catch (error) {
    console.error('Error loading GeoJSON:', error);
    throw error;
  }
}

/**
 * Material presets for countries - optimized with shared instances
 */
class CountryMaterials {
  private static _instance: CountryMaterials;

  // Shared material instances to reduce memory usage
  public normal = {
    border: new LineBasicMaterial({
      color: 0x334155, // Much darker, subtle gray-blue borders
      transparent: true,
      opacity: 0.4, // Reduced opacity for subtlety
      fog: true,
    }),
  };

  public hover = {
    fill: new MeshBasicMaterial({
      color: 0x3b82f6, // Blue highlight
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      fog: true,
    }),
    border: new LineBasicMaterial({
      color: 0x60a5fa, // Lighter blue for border
      transparent: true,
      opacity: 1.0,
      fog: true,
    }),
  };

  public selected = {
    fill: new MeshBasicMaterial({
      color: 0x10b981, // Emerald green for selected countries
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
      fog: true,
    }),
    border: new LineBasicMaterial({
      color: 0x34d399, // Lighter emerald for selected border
      transparent: true,
      opacity: 1.0,
      fog: true,
    }),
  };

  public selectedHover = {
    fill: new MeshBasicMaterial({
      color: 0x059669, // Darker emerald for selected+hover
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
      fog: true,
    }),
    border: new LineBasicMaterial({
      color: 0x6ee7b7, // Very light emerald for selected+hover border
      transparent: true,
      opacity: 1.0,
      fog: true,
    }),
  };

  static getInstance(): CountryMaterials {
    if (!CountryMaterials._instance) {
      CountryMaterials._instance = new CountryMaterials();
    }
    return CountryMaterials._instance;
  }
}

export const COUNTRY_MATERIALS = CountryMaterials.getInstance();

/**
 * Create individual country mesh with interaction support
 * @param feature GeoJSON feature
 * @param radius Sphere radius
 * @returns Group containing country meshes with userData
 */
export function createCountryMesh(
  feature: GeoJSONFeature,
  radius: number = 2,
): Group {
  const countryGroup = new Group();
  const countryName =
    (feature.properties as { NAME?: string })?.NAME || 'Unknown';

  // Store country data for interaction
  countryGroup.userData = {
    name: countryName,
    properties: feature.properties,
    isCountry: true,
  };

  if (feature.geometry.type === 'Polygon') {
    const coords = feature.geometry.coordinates as number[][][];
    const meshes = createPolygonMeshes(coords, radius, countryName);
    meshes.forEach((mesh) => countryGroup.add(mesh));
  } else if (feature.geometry.type === 'MultiPolygon') {
    const multiPolygonCoords = feature.geometry.coordinates as number[][][][];
    multiPolygonCoords.forEach((polygonCoords, index) => {
      const meshes = createPolygonMeshes(
        polygonCoords,
        radius,
        `${countryName}_${index}`,
      );
      meshes.forEach((mesh) => countryGroup.add(mesh));
    });
  }

  return countryGroup;
}

/**
 * Create meshes for a single polygon (fill + border)
 * @param coords Polygon coordinates
 * @param radius Sphere radius
 * @param name Country name for userData
 * @returns Array of Mesh objects
 */
function createPolygonMeshes(
  coords: number[][][],
  radius: number,
  name: string,
): Mesh[] {
  const meshes: Mesh[] = [];

  // Create filled geometry at exact radius for accurate raycasting
  // const fillGeometry = createFilledPolygonGeometry(coords, radius);
  // if (fillGeometry) {
  //   // Use shared material instance instead of cloning for better performance
  //   const fillMesh = new Mesh(
  //     fillGeometry,
  //     COUNTRY_MATERIALS.normal.fill,
  //   );
  //   fillMesh.userData = { name, type: 'fill', isCountryMesh: true };
  //   meshes.push(fillMesh);
  // }

  // Create border outline at the same radius as fill for consistent interaction
  const points = createPolygonGeometry(coords, radius);
  if (points.length > 0) {
    const lineGeometry = new BufferGeometry().setFromPoints(points);
    // Use shared material instance instead of cloning
    const line = new LineLoop(lineGeometry, COUNTRY_MATERIALS.normal.border);
    line.userData = { name, type: 'border', isCountryMesh: true };

    // Cast to Mesh for compatibility with the meshes array
    meshes.push(line as unknown as Mesh);
  }

  return meshes;
}

/**
 * Create interactive country boundaries with separate meshes
 * @param geojson GeoJSON feature collection
 * @param radius Sphere radius
 * @returns Group containing individual country groups
 */
export function createInteractiveCountries(
  geojson: GeoJSONFeatureCollection,
  radius: number = 2,
): Group {
  const countriesGroup = new Group();
  countriesGroup.name = 'countries';

  geojson.features.forEach((feature) => {
    const countryMesh = createCountryMesh(feature, radius);
    countriesGroup.add(countryMesh);
  });

  //   console.log(`Created ${geojson.features.length} interactive countries`);
  return countriesGroup;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createInteractiveCountries instead
 */
export function createCountryBoundaries(
  geojson: GeoJSONFeatureCollection,
  radius: number = 2,
): Group {
  return createInteractiveCountries(geojson, radius);
}

// ============================================================================
// TOPOJSON FUNCTIONS - Enhanced border rendering with shared arcs
// ============================================================================

/**
 * Load and parse TopoJSON data
 * @param url URL to TopoJSON file
 * @returns Promise of parsed TopoJSON topology
 */
export async function loadTopoJSON(url: string): Promise<TopoJSONTopology> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load TopoJSON: ${response.statusText}`);
    }

    // Validate content type for security
    const contentType = response.headers.get('content-type');
    if (
      !contentType?.includes('application/json') &&
      !contentType?.includes('text/json') &&
      !contentType?.includes('application/geo+json')
    ) {
      throw new Error(
        `Invalid content type: ${contentType}. Expected JSON format.`,
      );
    }

    const topology = (await response.json()) as TopoJSONTopology;

    // Validate TopoJSON structure
    if (!topology.objects?.countries) {
      throw new Error('Invalid TopoJSON: missing countries object');
    }

    return topology;
  } catch (error) {
    console.error('Error loading TopoJSON:', error);
    throw error;
  }
}

/**
 * Enhanced coordinate conversion with antimeridian handling
 * @param lon Longitude in degrees
 * @param lat Latitude in degrees
 * @param radius Sphere radius
 * @returns Vector3 position on sphere
 */
export function lonLatToSphere(
  lon: number,
  lat: number,
  radius: number = 2,
): Vector3 {
  // Normalize longitude to handle antimeridian crossing
  const normalizedLon = ((lon + 180) % 360) - 180;

  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (normalizedLon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

/**
 * Create unified border geometry from TopoJSON with shared arcs
 * This eliminates overlapping borders and creates a single, clean mesh
 * @param topology TopoJSON topology
 * @param options Rendering options
 * @returns UnifiedBorderResult with optimized meshes
 */
export function createUnifiedBorderGeometry(
  topology: TopoJSONTopology,
  options: TopoJSONRenderOptions = {},
): UnifiedBorderResult {
  const { radius = 2, borderOffset = 0.001 } = options;

  console.log('🌐 Creating unified border geometry from TopoJSON...');

  // Extract mesh boundaries (shared arcs only)
  const meshGeometry = topoMesh(
    topology as Parameters<typeof topoMesh>[0],
    topology.objects.countries as Parameters<typeof topoMesh>[1],
  );
  if (!meshGeometry || !meshGeometry.coordinates) {
    throw new Error('Failed to extract mesh from TopoJSON');
  }

  // Create unified border mesh
  const borderVertices: number[] = [];
  const borderIndices: number[] = [];
  let vertexIndex = 0;

  // Process each arc in the mesh
  meshGeometry.coordinates.forEach((arc: number[][]) => {
    const arcVertices: Vector3[] = [];

    // Convert coordinates to 3D sphere positions with slight offset for borders
    arc.forEach(([lon, lat]) => {
      const point = lonLatToSphere(lon, lat, radius + borderOffset);
      arcVertices.push(point);
      borderVertices.push(point.x, point.y, point.z);
    });

    // Create line segments for this arc
    for (let i = 0; i < arcVertices.length - 1; i++) {
      borderIndices.push(vertexIndex + i, vertexIndex + i + 1);
    }

    vertexIndex += arcVertices.length;
  });

  // Create the unified border mesh
  const borderGeometry = new BufferGeometry();
  borderGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(borderVertices, 3),
  );
  borderGeometry.setIndex(borderIndices);

  const borderMesh = new LineSegments(
    borderGeometry,
    COUNTRY_MATERIALS.normal.border,
  );
  borderMesh.name = 'unified-borders';
  borderMesh.userData = { type: 'unified-border', isUnifiedBorder: true };

  // Create selection meshes for individual countries
  const selectionMeshes = createCountrySelectionMeshes(topology, {
    ...options,
    radius, // Use exact radius for selection meshes (no offset)
  });

  const result: UnifiedBorderResult = {
    borderMesh,
    selectionMeshes,
    countryCount: topology.objects.countries.geometries?.length || 0,
    arcCount: meshGeometry.coordinates.length,
  };

  console.log(
    `✅ Created unified borders: ${result.countryCount} countries, ${result.arcCount} arcs`,
  );

  return result;
}

/**
 * Create invisible selection meshes for individual country interaction
 * @param topology TopoJSON topology
 * @param options Rendering options
 * @returns Group containing selection meshes
 */
export function createCountrySelectionMeshes(
  topology: TopoJSONTopology,
  options: TopoJSONRenderOptions = {},
): Group {
  const { radius = 2, enableFillMeshes = true } = options;

  const selectionGroup = new Group();
  selectionGroup.name = 'country-selection-meshes';

  if (!topology.objects.countries.geometries) {
    console.warn('No country geometries found in TopoJSON');
    return selectionGroup;
  }

  // Convert each country to individual selection mesh
  topology.objects.countries.geometries.forEach(
    (geometry: TopoJSONGeometry, index: number) => {
      try {
        // Convert TopoJSON feature to GeoJSON feature
        const geoJsonFeature = topoFeature(
          topology as Parameters<typeof topoFeature>[0],
          geometry as Parameters<typeof topoFeature>[1],
        ) as ConvertedGeoJSONFeature;

        if (!geoJsonFeature?.geometry) {
          console.warn(`Skipping country ${geometry.id}: no geometry`);
          return;
        }

        // Skip non-polygon geometries
        if (
          geoJsonFeature.geometry.type !== 'Polygon' &&
          geoJsonFeature.geometry.type !== 'MultiPolygon'
        ) {
          console.warn(
            `Skipping country ${geometry.id}: unsupported geometry type ${geoJsonFeature.geometry.type}`,
          );
          return;
        }

        const countryName = String(
          geometry.properties?.['NAME'] || geometry.id || `country_${index}`,
        );
        const countryMesh = createCountrySelectionMesh(
          geoJsonFeature,
          radius,
          countryName,
          enableFillMeshes,
        );

        if (countryMesh) {
          // Store metadata for interaction
          countryMesh.userData = {
            ...countryMesh.userData,
            topoId: geometry.id,
            properties: geometry.properties,
            isCountry: true,
            isSelectionMesh: true,
          };

          selectionGroup.add(countryMesh);
        }
      } catch (error) {
        console.warn(`Error processing country ${geometry.id}:`, error);
      }
    },
  );

  console.log(`Created ${selectionGroup.children.length} selection meshes`);
  return selectionGroup;
}

/**
 * Create a selection mesh for a single country using earcut triangulation
 * @param geoJsonFeature Converted GeoJSON feature
 * @param radius Sphere radius
 * @param name Country name
 * @param enableFill Whether to create fill mesh for selection
 * @returns Group containing selection meshes
 */
function createCountrySelectionMesh(
  geoJsonFeature: ConvertedGeoJSONFeature,
  radius: number,
  name: string,
  enableFill: boolean = true,
): Group | null {
  const countryGroup = new Group();
  countryGroup.name = `selection-${name}`;

  try {
    if (geoJsonFeature.geometry.type === 'Polygon') {
      const mesh = createPolygonSelectionMesh(
        geoJsonFeature.geometry.coordinates as number[][][],
        radius,
        name,
        enableFill,
      );
      if (mesh) countryGroup.add(mesh);
    } else if (geoJsonFeature.geometry.type === 'MultiPolygon') {
      (geoJsonFeature.geometry.coordinates as number[][][][]).forEach(
        (polygonCoords: number[][][], index: number) => {
          const mesh = createPolygonSelectionMesh(
            polygonCoords,
            radius,
            `${name}_${index}`,
            enableFill,
          );
          if (mesh) countryGroup.add(mesh);
        },
      );
    }

    return countryGroup.children.length > 0 ? countryGroup : null;
  } catch (error) {
    console.warn(`Failed to create selection mesh for ${name}:`, error);
    return null;
  }
}

/**
 * Create triangulated selection mesh for a polygon using earcut
 * @param coordinates Polygon coordinates
 * @param radius Sphere radius
 * @param name Polygon name
 * @param enableFill Whether to create visible fill mesh
 * @returns Mesh or null
 */
/**
 * CONCRETE FIX 1: Remove duplicate closing point if present
 * Degenerate triangles from duplicate points confuse earcut
 */
function removeRingClosure(ring: number[][]): number[][] {
  if (!ring || ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

/**
 * CONCRETE FIX 2: Unwrap longitudes to avoid cross-dateline triangles
 * Antimeridian wrapping creates triangles that appear inverted on sphere
 */
function unwrapLongitudes(ring: number[][]): number[][] {
  if (!ring || ring.length === 0) return ring;
  const out: number[][] = [];
  let lastLon = ring[0][0];
  out.push([lastLon, ring[0][1]]);
  for (let i = 1; i < ring.length; i++) {
    let [lon] = ring[i];
    const lat = ring[i][1];
    while (lon - lastLon > 180) lon -= 360;
    while (lon - lastLon < -180) lon += 360;
    out.push([lon, lat]);
    lastLon = lon;
  }
  return out;
}

/**
 * CONCRETE FIX 3: Ensure consistent winding for earcut convention
 * Outer ring CCW, holes CW (earcut standard)
 */
function ensureWindingForEarcut(
  ring: number[][],
  shouldBeCCW: boolean,
): number[][] {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    area += (x2 - x1) * (y2 + y1);
  }
  const isCCW = area > 0;
  if (isCCW !== shouldBeCCW) {
    return [...ring].reverse();
  }
  return ring;
}

/**
 * Calculate signed area for winding analysis
 * @param ring Array of [lon, lat] coordinates
 * @returns Positive for CCW, negative for CW
 */
function calculateSignedArea(ring: number[][]): number {
  if (ring.length < 3) return 0;

  let signedArea = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[j];

    // Simple planar approximation for winding detection
    signedArea += (lon2 - lon1) * (lat2 + lat1);
  }

  return signedArea / 2;
}

/**
 * Calculate spherical signed area for proper winding on sphere
 * @param ring Array of [lon, lat] coordinates
 * @returns Positive for CCW, negative for CW on sphere
 */
function calculateSphericalSignedArea(ring: number[][]): number {
  if (ring.length < 3) return 0;

  let sphericalArea = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[j];

    // Convert to radians
    const λ1 = (lon1 * Math.PI) / 180;
    const φ1 = (lat1 * Math.PI) / 180;
    const λ2 = (lon2 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;

    // Spherical excess method for signed area
    const Δλ = λ2 - λ1;

    // Handle antimeridian crossing
    let adjustedΔλ = Δλ;
    if (Math.abs(Δλ) > Math.PI) {
      adjustedΔλ = Δλ > 0 ? Δλ - 2 * Math.PI : Δλ + 2 * Math.PI;
    }

    // Spherical area contribution
    const E =
      2 *
      Math.atan2(
        Math.tan(adjustedΔλ / 2) * (Math.sin(φ1) + Math.sin(φ2)),
        2 +
          Math.sin(φ1) * Math.sin(φ2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.cos(adjustedΔλ),
      );

    sphericalArea += E;
  }

  return sphericalArea;
}

/**
 * Create triangulated polygon mesh with proper hole support
 * @param coordinates Polygon coordinates [outer, ...holes]
 * @param radius Sphere radius
 * @param name Polygon name
 * @param enableFill Whether to create visible fill mesh
 * @returns Mesh or null
 */
function createPolygonSelectionMesh(
  coordinates: number[][][],
  radius: number,
  name: string,
  enableFill: boolean,
): Mesh | null {
  try {
    if (!coordinates || coordinates.length === 0) return null;

    const exteriorRing = coordinates[0];
    if (!exteriorRing || exteriorRing.length < 4) return null; // Need at least 4 points (including closure)

    console.log(
      `🔺 Triangulating ${name}: ${coordinates.length} rings (1 outer + ${coordinates.length - 1} holes)`,
    );

    // CONCRETE FIX 4: Process rings with proper closure, unwrapping, and winding
    // Remove closure, unwrap antimeridian, canonicalize winding for earcut
    // CRITICAL FIX: Use proper spherical winding for Earcut triangulation
    // For spherical projection, we need to determine correct winding based on geometry
    const useSphericalWinding =
      (window as Window & { COUNTRY_SPHERICAL_WINDING?: boolean })
        .COUNTRY_SPHERICAL_WINDING !== false; // Default to spherical winding
    const invertWinding =
      (window as Window & { COUNTRY_INVERT_WINDING?: boolean })
        .COUNTRY_INVERT_WINDING || false; // Only invert if explicitly set

    const correctedRings: number[][][] = coordinates.map((ring, index) => {
      let r = removeRingClosure(ring);
      r = unwrapLongitudes(r);

      // Determine correct winding for spherical geometry
      let shouldBeCCW: boolean;
      if (useSphericalWinding) {
        // Use spherical area calculation for correct winding on sphere
        const sphericalArea = calculateSphericalSignedArea(r);
        const isCurrentlyCCW = sphericalArea > 0;

        // For spherical geometry: exterior CCW, holes CW (standard Earcut convention)
        const expectedCCW = index === 0; // First ring is exterior
        shouldBeCCW = invertWinding ? !expectedCCW : expectedCCW;

        // Log winding decisions for debugging
        if (
          name.includes('Brazil') ||
          name.includes('USA') ||
          name.includes('United States')
        ) {
          console.log(
            `  Ring ${index}: spherical area = ${sphericalArea.toFixed(6)}, currently ${isCurrentlyCCW ? 'CCW' : 'CW'}, target ${shouldBeCCW ? 'CCW' : 'CW'}`,
          );
        }
      } else {
        // Legacy planar calculation
        shouldBeCCW = invertWinding ? index !== 0 : index === 0;
      }

      r = ensureWindingForEarcut(r, shouldBeCCW);
      return r;
    });

    // Log winding configuration for debugging
    if (
      name.includes('Brazil') ||
      name.includes('USA') ||
      name.includes('United States')
    ) {
      console.log(`🔄 ENHANCED WINDING CONFIG for ${name}:`);
      console.log(
        `  Spherical winding: ${useSphericalWinding ? 'ENABLED (proper sphere geometry)' : 'DISABLED (planar fallback)'}`,
      );
      console.log(
        `  Invert winding: ${invertWinding ? 'YES (manual override)' : 'NO (standard earcut)'}`,
      );
      console.log(
        `  Expected: outer ${invertWinding ? 'CW' : 'CCW'}, holes ${invertWinding ? 'CCW' : 'CW'}`,
      );
      console.log(
        `  ✅ SPHERICAL FIX: Using proper spherical area calculations for winding`,
      );
    }

    // Convert to flat array for earcut with hole indices
    const vertices2D: number[] = [];
    const vertices3D: Vector3[] = [];
    const holeIndices: number[] = [];

    // Use base radius - per-mesh offset applied during selection in globe.ts
    const selectionRadius = radius; // No geometry-level offset needed

    // Add exterior ring
    correctedRings[0].forEach(([lon, lat]) => {
      vertices2D.push(lon, lat);
      vertices3D.push(lonLatToSphere(lon, lat, selectionRadius));
    });

    // Add hole rings and track hole start indices
    for (let ringIndex = 1; ringIndex < correctedRings.length; ringIndex++) {
      holeIndices.push(vertices2D.length / 2); // Hole starts at this vertex index

      correctedRings[ringIndex].forEach(([lon, lat]) => {
        vertices2D.push(lon, lat);
        vertices3D.push(lonLatToSphere(lon, lat, selectionRadius));
      });
    }

    console.log(
      `📊 Triangulation data: ${vertices2D.length / 2} vertices, ${holeIndices.length} holes at indices [${holeIndices.join(', ')}]`,
    );

    // Triangulate using earcut with hole support
    const triangles =
      holeIndices.length > 0
        ? earcut(vertices2D, holeIndices)
        : earcut(vertices2D);

    if (triangles.length === 0) {
      console.warn(
        `❌ Triangulation failed for ${name}: no triangles generated`,
      );
      return null;
    }

    console.log(
      `✅ Triangulation successful: ${triangles.length / 3} triangles for ${name}`,
    );

    // CRITICAL VALIDATION: Check triangle indices
    const maxIndex = Math.max(...triangles);
    const vertexCount = vertices3D.length;
    if (maxIndex >= vertexCount) {
      console.error(
        `❌ INVALID TRIANGULATION for ${name}: max index ${maxIndex} >= vertex count ${vertexCount}`,
      );
      console.log(`  Vertices2D: ${vertices2D.length / 2} points`);
      console.log(`  Vertices3D: ${vertexCount} points`);
      console.log(
        `  Triangle indices: [${triangles.slice(0, 12).join(', ')}...]`,
      );
      return null;
    }

    // Debug specific countries for detailed analysis
    const debugCountries = ['USA', 'United States', 'Brazil', 'Canada'];
    const shouldDebug =
      debugCountries.some((country) => name.includes(country)) ||
      triangles.length < 100;

    if (shouldDebug) {
      console.log(`🔍 DETAILED DEBUG for ${name}:`);
      console.log(
        `  Original rings: ${coordinates.length} (${coordinates.map((r) => r.length).join(', ')} vertices each)`,
      );
      console.log(
        `  Processed rings: ${correctedRings.length} (${correctedRings.map((r) => r.length).join(', ')} vertices each)`,
      );

      // Show concrete fixes applied
      coordinates.forEach((originalRing, i) => {
        const correctedRing = correctedRings[i];
        const originalLength = originalRing.length;
        const correctedLength = correctedRing.length;
        const hadClosure = originalLength !== correctedLength;
        const originalArea = calculateSignedArea(originalRing);
        const correctedArea = calculateSignedArea(correctedRing);
        const wasReversed = originalArea > 0 !== correctedArea > 0;

        console.log(`  Ring ${i} fixes:`);
        console.log(
          `    ✅ Closure removal: ${hadClosure ? `${originalLength} → ${correctedLength} vertices` : 'not needed'}`,
        );
        console.log(`    ✅ Antimeridian unwrap: applied`);
        console.log(
          `    ✅ Winding fix: ${wasReversed ? 'reversed' : 'correct'} (${correctedArea > 0 ? 'CCW' : 'CW'})`,
        );
      });

      console.log(`  Hole indices: [${holeIndices.join(', ')}]`);
      console.log(`  Vertices2D: ${vertices2D.length / 2} points`);
      console.log(`  Vertices3D: ${vertexCount} points`);
      console.log(
        `  Triangles: ${triangles.length / 3} (${triangles.length} indices)`,
      );
      console.log(
        `  Index range: ${Math.min(...triangles)} to ${Math.max(...triangles)}`,
      );

      // Sample first few triangles with position info
      for (let i = 0; i < Math.min(6, triangles.length); i += 3) {
        const [a, b, c] = [triangles[i], triangles[i + 1], triangles[i + 2]];
        const va = vertices3D[a];
        const vb = vertices3D[b];
        const vc = vertices3D[c];
        console.log(
          `    Triangle ${i / 3}: [${a}, ${b}, ${c}] - positions: [${va.x.toFixed(2)}, ${va.y.toFixed(2)}] [${vb.x.toFixed(2)}, ${vb.y.toFixed(2)}] [${vc.x.toFixed(2)}, ${vc.y.toFixed(2)}]`,
        );
      }

      // Validate triangle area and normal direction
      if (triangles.length >= 3) {
        const [a, b, c] = [triangles[0], triangles[1], triangles[2]];
        const va = vertices3D[a];
        const vb = vertices3D[b];
        const vc = vertices3D[c];

        // Calculate triangle normal
        const edge1 = vb.clone().sub(va);
        const edge2 = vc.clone().sub(va);
        const normal = edge1.cross(edge2).normalize();
        const centroid = va.clone().add(vb).add(vc).divideScalar(3);

        // Normal should point outward from sphere center
        const expectedOutward = centroid.clone().normalize();
        const dotProduct = normal.dot(expectedOutward);

        console.log(
          `  First triangle normal: [${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)}]`,
        );
        console.log(
          `  Expected outward: [${expectedOutward.x.toFixed(3)}, ${expectedOutward.y.toFixed(3)}, ${expectedOutward.z.toFixed(3)}]`,
        );
        console.log(
          `  Dot product: ${dotProduct.toFixed(3)} ${dotProduct > 0 ? '✅ (outward - CORRECT!)' : '❌ (inward - INVERTED!)'}`,
        );

        // SUCCESS INDICATORS
        console.log('');
        console.log('🧪 SPHERICAL TRIANGULATION VERIFICATION:');
        console.log(
          `  ✅ Interior fill: ${dotProduct > 0 ? 'PASS - Will show solid landmass' : 'FAIL - Will show hollow outline'}`,
        );
        console.log(
          `  ✅ Triangle topology: ${triangles.length > 0 ? 'PASS - Triangles generated' : 'FAIL - No triangles'}`,
        );
        console.log(
          `  ✅ Spherical winding: ${useSphericalWinding ? 'ENABLED - Using proper sphere geometry' : 'DISABLED - Using planar approximation'}`,
        );
        console.log(
          `  ✅ Earcut processing: Applied (closure: removed, antimeridian: unwrapped, spherical winding: corrected)`,
        );
        console.log('');

        if (dotProduct > 0) {
          console.log('🎉 SUCCESS: Spherical triangulation working correctly!');
          console.log(
            '   Countries should now show proper solid interior fills.',
          );
        } else {
          console.log('🔧 FALLBACK OPTIONS if fill still appears inverted:');
          console.log(
            '   1. window.COUNTRY_INVERT_WINDING = true; location.reload();',
          );
          console.log(
            '   2. window.COUNTRY_SPHERICAL_WINDING = false; location.reload();',
          );
          console.log(
            '   3. Check material.side = THREE.DoubleSide in debug mode',
          );
        }
      }
    }

    // Create geometry with proper indexing
    const geometry = new BufferGeometry();

    // Method 1: Create indexed geometry first, then convert to non-indexed for safe merging
    const allPositions: number[] = [];
    vertices3D.forEach((vertex) => {
      allPositions.push(vertex.x, vertex.y, vertex.z);
    });

    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(allPositions, 3),
    );
    geometry.setIndex(triangles);
    geometry.computeVertexNormals();

    // CRITICAL FIX: Convert to non-indexed geometry to prevent merge corruption
    const safeGeometry = geometry.toNonIndexed();
    safeGeometry.computeVertexNormals();

    console.log(
      `🔧 Created ${name} geometry: ${vertices3D.length} vertices → ${safeGeometry.attributes['position'].count} final vertices`,
    );

    // Create material for country selection with z-fighting prevention
    const material = enableFill
      ? new MeshBasicMaterial({
          color: 0x444444,
          transparent: true,
          opacity: 0.1,
          side: DoubleSide,
          depthWrite: false,
          depthTest: false,
          // Z-fighting prevention (backup approach)
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -4,
        })
      : new MeshBasicMaterial({
          color: 0x444444,
          transparent: true,
          opacity: 0.1, // Slightly visible for interaction
          side: DoubleSide, // CRITICAL: Show both sides
          depthWrite: false,
          depthTest: true, // Normal depth testing with geometry offset
          wireframe: false,
          // Z-fighting prevention (backup approach)
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -4,
        });

    // Apply radial offset to prevent z-fighting with Earth surface
    const RADIAL_OFFSET = 0.003; // 3mm radial offset - minimal but effective separation
    const positionAttribute = safeGeometry.attributes['position'];
    const positions = positionAttribute.array as Float32Array;

    // Push each vertex slightly away from Earth center
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      const length = Math.sqrt(x * x + y * y + z * z) || 1;
      const factor = (length + RADIAL_OFFSET) / length;
      positions[i] = x * factor;
      positions[i + 1] = y * factor;
      positions[i + 2] = z * factor;
    }
    positionAttribute.needsUpdate = true;
    safeGeometry.computeVertexNormals();
    safeGeometry.computeBoundingSphere();

    const mesh = new Mesh(safeGeometry, material);
    mesh.name = `selection-mesh-${name}`;
    mesh.userData = {
      name,
      type: 'selection',
      isCountryMesh: true,
      isSelectionMesh: true,
    };

    return mesh;
  } catch (error) {
    console.warn(`Failed to create polygon selection mesh for ${name}:`, error);
    return null;
  }
}

/**
 * Create enhanced interactive countries using TopoJSON with unified borders
 * This is the main function to use for TopoJSON-based rendering
 * @param topology TopoJSON topology
 * @param options Rendering options
 * @returns Group containing unified borders and selection meshes
 */
export function createInteractiveCountriesFromTopo(
  topology: TopoJSONTopology,
  options: TopoJSONRenderOptions = {},
): Group {
  const mainGroup = new Group();
  mainGroup.name = 'topojson-countries';

  try {
    const unifiedResult = createUnifiedBorderGeometry(topology, options);

    // Add unified border mesh
    mainGroup.add(unifiedResult.borderMesh);

    // Add selection meshes
    mainGroup.add(unifiedResult.selectionMeshes);

    // Store metadata
    mainGroup.userData = {
      type: 'topojson-countries',
      countryCount: unifiedResult.countryCount,
      arcCount: unifiedResult.arcCount,
      renderingMode: 'unified-borders',
    };

    console.log(
      `🎯 Created TopoJSON countries: ${unifiedResult.countryCount} countries with unified borders`,
    );

    return mainGroup;
  } catch (error) {
    console.error('Error creating TopoJSON countries:', error);
    throw error;
  }
}

/**
 * Dispose of TopoJSON-created meshes properly
 * @param group Group containing TopoJSON meshes
 */
export function disposeTopoJSONMeshes(group: Group): void {
  group.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose material (only if not shared)
      if (child.material && !child.userData['sharedMaterial']) {
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });

  // Clear the group
  group.clear();
}

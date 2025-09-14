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
export interface TopoJSONTopology {
  type: 'Topology';
  bbox?: [number, number, number, number];
  transform?: {
    scale: [number, number];
    translate: [number, number];
  };
  arcs: number[][][];
  objects: {
    countries: {
      type: 'FeatureCollection';
      features: Array<{
        type: 'Feature';
        id: string;
        properties: Record<string, unknown>;
        geometry: unknown;
      }>;
    };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshGeometry = topoMesh(
    topology as any,
    topology.objects.countries as any,
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
    countryCount: (topology.objects.countries as any).geometries?.length || 0,
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

  if (!(topology.objects.countries as any).geometries) {
    console.warn('No country geometries found in TopoJSON');
    return selectionGroup;
  }

  // Convert each country to individual selection mesh
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (topology.objects.countries as any).geometries.forEach(
    (geometry: any, index: number) => {
      try {
        // Convert TopoJSON feature to GeoJSON feature
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geoJsonFeature = topoFeature(
          topology as any,
          geometry as any,
        ) as any;

        if (!geoJsonFeature?.geometry) {
          console.warn(`Skipping country ${geometry.id}: no geometry`);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonFeature: any,
  radius: number,
  name: string,
  enableFill: boolean = true,
): Group | null {
  const countryGroup = new Group();
  countryGroup.name = `selection-${name}`;

  try {
    if (geoJsonFeature.geometry.type === 'Polygon') {
      const mesh = createPolygonSelectionMesh(
        geoJsonFeature.geometry.coordinates,
        radius,
        name,
        enableFill,
      );
      if (mesh) countryGroup.add(mesh);
    } else if (geoJsonFeature.geometry.type === 'MultiPolygon') {
      geoJsonFeature.geometry.coordinates.forEach(
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
function createPolygonSelectionMesh(
  coordinates: number[][][],
  radius: number,
  name: string,
  enableFill: boolean,
): Mesh | null {
  try {
    const exteriorRing = coordinates[0];
    if (!exteriorRing || exteriorRing.length < 3) return null;

    // Convert to flat array for earcut
    const vertices2D: number[] = [];
    const vertices3D: Vector3[] = [];

    exteriorRing.forEach(([lon, lat]) => {
      vertices2D.push(lon, lat);
      vertices3D.push(lonLatToSphere(lon, lat, radius));
    });

    // Triangulate using earcut
    const triangles = earcut(vertices2D);
    if (triangles.length === 0) return null;

    // Create geometry
    const geometry = new BufferGeometry();
    const positions: number[] = [];

    // Add vertices from triangulation
    for (let i = 0; i < triangles.length; i++) {
      const vertex = vertices3D[triangles[i]];
      positions.push(vertex.x, vertex.y, vertex.z);
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    // Create material based on whether fill is enabled
    const material = enableFill
      ? new MeshBasicMaterial({
          color: 0x444444,
          transparent: true,
          opacity: 0.0, // Invisible but raycastable
          side: DoubleSide,
        })
      : new MeshBasicMaterial({
          visible: false, // Completely invisible
          side: DoubleSide,
        });

    const mesh = new Mesh(geometry, material);
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

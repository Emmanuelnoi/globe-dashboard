import * as THREE from 'three';

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
 * Convert latitude/longitude to 3D coordinates on a sphere
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param radius Sphere radius
 * @returns THREE.Vector3 position on sphere
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = 2,
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

/**
 * Create Three.js geometry from GeoJSON polygon coordinates
 * @param coordinates GeoJSON polygon coordinates
 * @param radius Sphere radius
 * @returns Array of THREE.Vector3 points
 */
export function createPolygonGeometry(
  coordinates: number[][][],
  radius: number = 2,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

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
 * @returns THREE.BufferGeometry for filled mesh
 */
export function createFilledPolygonGeometry(
  coordinates: number[][][],
  radius: number = 2,
): THREE.BufferGeometry | null {
  try {
    // Get the exterior ring (first ring)
    const exteriorRing = coordinates[0];
    if (!exteriorRing || exteriorRing.length < 3) return null;

    // Convert to 3D points on sphere
    const points = exteriorRing.map(([lon, lat]) =>
      latLonToVector3(lat, lon, radius),
    );

    // Create triangulated geometry
    const geometry = new THREE.BufferGeometry();
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

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
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
    // fill: new THREE.MeshBasicMaterial({
    //   color: 0x00ff00,
    //   // color: 0xffffff,
    //   transparent: false,
    //   opacity: 1,
    //   // side: THREE.DoubleSide,
    //   fog: false,
    // }),
    border: new THREE.LineBasicMaterial({
      color: 0xff0000,
      // color: 0x888888,
      transparent: true,
      opacity: 0.9,
      fog: true,
    }),
  };

  public hover = {
    fill: new THREE.MeshBasicMaterial({
      color: 0x3b82f6, // Blue highlight
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      fog: true,
    }),
    border: new THREE.LineBasicMaterial({
      color: 0x60a5fa, // Lighter blue for border
      transparent: true,
      opacity: 1.0,
      fog: true,
    }),
  };

  public selected = {
    fill: new THREE.MeshBasicMaterial({
      color: 0x10b981, // Emerald green for selected countries
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      fog: true,
    }),
    border: new THREE.LineBasicMaterial({
      color: 0x34d399, // Lighter emerald for selected border
      transparent: true,
      opacity: 1.0,
      fog: true,
    }),
  };

  public selectedHover = {
    fill: new THREE.MeshBasicMaterial({
      color: 0x059669, // Darker emerald for selected+hover
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      fog: true,
    }),
    border: new THREE.LineBasicMaterial({
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
 * @returns THREE.Group containing country meshes with userData
 */
export function createCountryMesh(
  feature: GeoJSONFeature,
  radius: number = 2,
): THREE.Group {
  const countryGroup = new THREE.Group();
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
 * @returns Array of THREE.Mesh objects
 */
function createPolygonMeshes(
  coords: number[][][],
  radius: number,
  name: string,
): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];

  // Create filled geometry at exact radius for accurate raycasting
  // const fillGeometry = createFilledPolygonGeometry(coords, radius);
  // if (fillGeometry) {
  //   // Use shared material instance instead of cloning for better performance
  //   const fillMesh = new THREE.Mesh(
  //     fillGeometry,
  //     COUNTRY_MATERIALS.normal.fill,
  //   );
  //   fillMesh.userData = { name, type: 'fill', isCountryMesh: true };
  //   meshes.push(fillMesh);
  // }

  // Create border outline at the same radius as fill for consistent interaction
  const points = createPolygonGeometry(coords, radius);
  if (points.length > 0) {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    // Use shared material instance instead of cloning
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const line = new THREE.LineLoop(
      lineGeometry,
      COUNTRY_MATERIALS.normal.border,
    ) as any;
    line.userData = { name, type: 'border', isCountryMesh: true };
    meshes.push(line);
  }

  return meshes;
}

/**
 * Create interactive country boundaries with separate meshes
 * @param geojson GeoJSON feature collection
 * @param radius Sphere radius
 * @returns THREE.Group containing individual country groups
 */
export function createInteractiveCountries(
  geojson: GeoJSONFeatureCollection,
  radius: number = 2,
): THREE.Group {
  const countriesGroup = new THREE.Group();
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
): THREE.Group {
  return createInteractiveCountries(geojson, radius);
}

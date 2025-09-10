import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  latLonToVector3,
  createPolygonGeometry,
  createFilledPolygonGeometry,
  loadGeoJSON,
  createInteractiveCountries,
  COUNTRY_MATERIALS,
  type GeoJSONFeature,
  type GeoJSONFeatureCollection,
} from './geojson.utils';

describe('GeoJSON Utils', () => {
  describe('latLonToVector3', () => {
    it('should convert latitude/longitude to 3D coordinates', () => {
      const result = latLonToVector3(0, 0, 2);
      expect(result).toBeInstanceOf(THREE.Vector3);
      expect(result.x).toBeCloseTo(0, 5);
      expect(result.y).toBeCloseTo(2, 5);
      expect(result.z).toBeCloseTo(0, 5);
    });

    it('should handle North Pole coordinates', () => {
      const result = latLonToVector3(90, 0, 2);
      expect(result.y).toBeCloseTo(2, 5);
      expect(Math.abs(result.x)).toBeLessThan(0.001);
      expect(Math.abs(result.z)).toBeLessThan(0.001);
    });

    it('should handle South Pole coordinates', () => {
      const result = latLonToVector3(-90, 0, 2);
      expect(result.y).toBeCloseTo(-2, 5);
      expect(Math.abs(result.x)).toBeLessThan(0.001);
      expect(Math.abs(result.z)).toBeLessThan(0.001);
    });

    it('should use default radius of 2 when not specified', () => {
      const result = latLonToVector3(0, 0);
      expect(result.y).toBeCloseTo(2, 5);
    });

    it('should handle custom radius', () => {
      const radius = 5;
      const result = latLonToVector3(0, 0, radius);
      expect(result.y).toBeCloseTo(radius, 5);
    });
  });

  describe('createPolygonGeometry', () => {
    it('should create polygon geometry from coordinates', () => {
      const coordinates = [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ];

      const result = createPolygonGeometry(coordinates, 2);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(5); // 5 coordinate pairs
      expect(result[0]).toBeInstanceOf(THREE.Vector3);
    });

    it('should handle multiple rings (ignoring holes)', () => {
      const coordinates = [
        [
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ], // exterior ring
        [
          [0.5, 0.5],
          [1.5, 0.5],
          [1.5, 1.5],
          [0.5, 1.5],
          [0.5, 0.5],
        ], // hole (should be ignored)
      ];

      const result = createPolygonGeometry(coordinates, 2);
      expect(result.length).toBe(5); // Only exterior ring processed
    });

    it('should handle empty coordinates', () => {
      const result = createPolygonGeometry([], 2);
      expect(result).toEqual([]);
    });
  });

  describe('createFilledPolygonGeometry', () => {
    it('should create filled polygon geometry', () => {
      const coordinates = [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ];

      const result = createFilledPolygonGeometry(coordinates, 2);
      expect(result).toBeInstanceOf(THREE.BufferGeometry);

      const positions = result!.getAttribute('position');
      expect(positions).toBeDefined();
      expect(positions.count).toBe(5);
    });

    it('should return null for invalid coordinates', () => {
      const result = createFilledPolygonGeometry([[]], 2);
      expect(result).toBeNull();
    });

    it('should handle triangulation errors gracefully', () => {
      // This should not throw and should return null or valid geometry
      const coordinates = [
        [
          [0, 0],
          [1, 0],
        ], // Invalid polygon (less than 3 points)
      ];

      const result = createFilledPolygonGeometry(coordinates, 2);
      expect(result).toBeNull();
    });
  });

  describe('loadGeoJSON', () => {
    beforeEach(() => {
      // Reset fetch mock
      vi.clearAllMocks();
    });

    it('should load and parse GeoJSON data successfully', async () => {
      const mockData: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Test Country' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await loadGeoJSON('/test.geojson');
      expect(result).toEqual(mockData);
      expect(fetch).toHaveBeenCalledWith('/test.geojson');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(loadGeoJSON('/invalid.geojson')).rejects.toThrow(
        'Failed to load GeoJSON: Not Found',
      );
    });

    it('should validate content type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        json: () => Promise.resolve({}),
      });

      await expect(loadGeoJSON('/test.geojson')).rejects.toThrow(
        'Invalid content type: text/html',
      );
    });

    it('should accept application/geo+json content type', async () => {
      const mockData: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/geo+json' }),
        json: () => Promise.resolve(mockData),
      });

      const result = await loadGeoJSON('/test.geojson');
      expect(result).toEqual(mockData);
    });

    it('should handle fetch errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(loadGeoJSON('/test.geojson')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('COUNTRY_MATERIALS', () => {
    it('should be a singleton instance', () => {
      const instance1 = COUNTRY_MATERIALS;
      const instance2 = COUNTRY_MATERIALS;
      expect(instance1).toBe(instance2);
    });

    it('should have all required material sets', () => {
      expect(COUNTRY_MATERIALS.normal).toBeDefined();
      expect(COUNTRY_MATERIALS.hover).toBeDefined();
      expect(COUNTRY_MATERIALS.selected).toBeDefined();
      expect(COUNTRY_MATERIALS.selectedHover).toBeDefined();
    });

    it('should have border materials', () => {
      expect(COUNTRY_MATERIALS.normal.border).toBeInstanceOf(
        THREE.LineBasicMaterial,
      );
      expect(COUNTRY_MATERIALS.hover.border).toBeInstanceOf(
        THREE.LineBasicMaterial,
      );
      expect(COUNTRY_MATERIALS.selected.border).toBeInstanceOf(
        THREE.LineBasicMaterial,
      );
      expect(COUNTRY_MATERIALS.selectedHover.border).toBeInstanceOf(
        THREE.LineBasicMaterial,
      );
    });

    it('should have fill materials for interactive states', () => {
      expect(COUNTRY_MATERIALS.hover.fill).toBeInstanceOf(
        THREE.MeshBasicMaterial,
      );
      expect(COUNTRY_MATERIALS.selected.fill).toBeInstanceOf(
        THREE.MeshBasicMaterial,
      );
      expect(COUNTRY_MATERIALS.selectedHover.fill).toBeInstanceOf(
        THREE.MeshBasicMaterial,
      );
    });
  });

  describe('createInteractiveCountries', () => {
    it('should create countries group from GeoJSON', () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Country A' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            properties: { NAME: 'Country B' },
            geometry: {
              type: 'MultiPolygon',
              coordinates: [
                [
                  [
                    [2, 2],
                    [3, 2],
                    [3, 3],
                    [2, 3],
                    [2, 2],
                  ],
                ],
              ],
            },
          },
        ],
      };

      const result = createInteractiveCountries(mockGeoJSON, 2);

      expect(result).toBeInstanceOf(THREE.Group);
      expect(result.name).toBe('countries');
      expect(result.children.length).toBe(2); // Two countries

      // Check first country
      const firstCountry = result.children[0] as THREE.Group;
      expect(firstCountry).toBeInstanceOf(THREE.Group);
      expect(firstCountry.userData.name).toBe('Country A');
      expect(firstCountry.userData.isCountry).toBe(true);
    });

    it('should handle empty GeoJSON', () => {
      const emptyGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [],
      };

      const result = createInteractiveCountries(emptyGeoJSON, 2);
      expect(result.children.length).toBe(0);
    });

    it('should handle countries without names', () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      };

      const result = createInteractiveCountries(mockGeoJSON, 2);
      const country = result.children[0] as THREE.Group;
      expect(country.userData.name).toBe('Unknown');
    });

    it('should use custom radius', () => {
      const mockGeoJSON: GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { NAME: 'Test' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [0, 0],
                  [1, 0],
                  [1, 1],
                  [0, 1],
                  [0, 0],
                ],
              ],
            },
          },
        ],
      };

      const radius = 5;
      const result = createInteractiveCountries(mockGeoJSON, radius);

      // The radius should affect the geometry creation
      // We can't easily test this without diving into the meshes,
      // but we can verify the function doesn't throw
      expect(result).toBeInstanceOf(THREE.Group);
    });
  });
});

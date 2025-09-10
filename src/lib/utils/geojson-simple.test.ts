import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  latLonToVector3,
  createPolygonGeometry,
  loadGeoJSON,
} from './geojson.utils';

describe('GeoJSON Utils (Unit Tests)', () => {
  describe('latLonToVector3', () => {
    it('should convert latitude/longitude to 3D coordinates', () => {
      const result = latLonToVector3(0, 0, 2);
      expect(result).toBeInstanceOf(THREE.Vector3);

      // At lat=0, lon=0: phi = 90 degrees, theta = 180 degrees
      // x = -(2 * sin(90) * cos(180)) = -(2 * 1 * -1) = 2
      // y = 2 * cos(90) = 2 * 0 = 0
      // z = 2 * sin(90) * sin(180) = 2 * 1 * 0 = 0
      expect(Math.abs(result.x - 2)).toBeLessThan(0.001);
      expect(Math.abs(result.y)).toBeLessThan(0.001);
      expect(Math.abs(result.z)).toBeLessThan(0.001);
    });

    it('should handle North Pole coordinates', () => {
      const result = latLonToVector3(90, 0, 2);
      // At lat=90, lon=0: phi = 0 degrees, theta = 180 degrees
      // x = -(2 * sin(0) * cos(180)) = 0
      // y = 2 * cos(0) = 2 * 1 = 2
      // z = 2 * sin(0) * sin(180) = 0
      expect(Math.abs(result.y - 2)).toBeLessThan(0.001);
      expect(Math.abs(result.x)).toBeLessThan(0.001);
      expect(Math.abs(result.z)).toBeLessThan(0.001);
    });

    it('should use default radius of 2', () => {
      const result = latLonToVector3(0, 0);
      // Should behave same as radius=2 case
      expect(Math.abs(result.x - 2)).toBeLessThan(0.001);
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
      expect(result.length).toBe(5);
      expect(result[0]).toBeInstanceOf(THREE.Vector3);
    });

    it('should handle empty coordinates', () => {
      const result = createPolygonGeometry([], 2);
      expect(result).toEqual([]);
    });
  });

  describe('loadGeoJSON', () => {
    it('should load and parse GeoJSON data successfully', async () => {
      const mockData = {
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
  });
});

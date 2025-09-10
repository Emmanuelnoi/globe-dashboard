import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getStarfield } from './starfield.utils';

describe('Starfield Utils', () => {
  describe('getStarfield', () => {
    it('should create a starfield with default parameters', () => {
      const starfield = getStarfield();

      expect(starfield).toBeInstanceOf(THREE.Points);
      expect(starfield.geometry).toBeInstanceOf(THREE.BufferGeometry);
      expect(starfield.material).toBeInstanceOf(THREE.PointsMaterial);
    });

    it('should create starfield with custom number of stars', () => {
      const numStars = 500;
      const starfield = getStarfield({ numStars });

      const positions = starfield.geometry.getAttribute('position');
      expect(positions.count).toBe(numStars);
    });

    it('should have proper geometry attributes', () => {
      const starfield = getStarfield({ numStars: 100 });

      const geometry = starfield.geometry;
      expect(geometry.hasAttribute('position')).toBe(true);

      const positions = geometry.getAttribute('position');
      expect(positions.itemSize).toBe(3); // x, y, z coordinates
      expect(positions.count).toBe(100);
    });

    it('should create stars within reasonable bounds', () => {
      const starfield = getStarfield({ numStars: 10 });
      const positions = starfield.geometry.getAttribute('position');

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        // Stars should be positioned on or near a sphere
        const distance = Math.sqrt(x * x + y * y + z * z);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThanOrEqual(300); // Assuming reasonable max distance
      }
    });

    it('should have proper material properties', () => {
      const starfield = getStarfield();
      const material = starfield.material as THREE.PointsMaterial;

      expect(material.transparent).toBe(true);
      expect(material.opacity).toBeGreaterThan(0);
      expect(material.size).toBeGreaterThan(0);
      expect(material.sizeAttenuation).toBeDefined();
    });

    it('should handle zero stars gracefully', () => {
      const starfield = getStarfield({ numStars: 0 });
      const positions = starfield.geometry.getAttribute('position');
      expect(positions.count).toBe(0);
    });

    it('should handle large number of stars', () => {
      const numStars = 10000;
      const starfield = getStarfield({ numStars });

      expect(starfield).toBeInstanceOf(THREE.Points);
      const positions = starfield.geometry.getAttribute('position');
      expect(positions.count).toBe(numStars);
    });

    it('should create unique star positions', () => {
      const starfield = getStarfield({ numStars: 100 });
      const positions = starfield.geometry.getAttribute('position');

      const positionSet = new Set<string>();

      for (let i = 0; i < Math.min(positions.count, 50); i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        const positionKey = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
        expect(positionSet.has(positionKey)).toBe(false);
        positionSet.add(positionKey);
      }
    });
  });
});

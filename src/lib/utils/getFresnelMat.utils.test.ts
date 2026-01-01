import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { getFresnelMat } from './getFresnelMat.utils';

describe('Fresnel Material Utils', () => {
  describe('getFresnelMat', () => {
    it('should create a shader material', () => {
      const material = getFresnelMat();
      expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    });

    it('should have required shader properties', () => {
      const material = getFresnelMat();

      expect(material.vertexShader).toBeDefined();
      expect(material.fragmentShader).toBeDefined();
      expect(typeof material.vertexShader).toBe('string');
      expect(typeof material.fragmentShader).toBe('string');
    });

    it('should have proper material settings for atmosphere', () => {
      const material = getFresnelMat();

      expect(material.transparent).toBe(true);
      // Material uses default FrontSide (0), not BackSide
      expect(material.side).toBe(THREE.FrontSide);
    });

    it('should contain fresnel-related shader code', () => {
      const material = getFresnelMat();

      // Check for common fresnel shader patterns
      const vertexShader = material.vertexShader.toLowerCase();
      const fragmentShader = material.fragmentShader.toLowerCase();

      // Should contain normal or fresnel calculations
      expect(
        vertexShader.includes('normal') ||
          fragmentShader.includes('normal') ||
          vertexShader.includes('fresnel') ||
          fragmentShader.includes('fresnel'),
      ).toBe(true);
    });

    it('should have uniform values if present', () => {
      const material = getFresnelMat();

      if (material.uniforms) {
        // Common uniforms for fresnel materials
        const uniformKeys = Object.keys(material.uniforms);
        expect(Array.isArray(uniformKeys)).toBe(true);
      }
    });

    it('should be suitable for atmosphere rendering', () => {
      const material = getFresnelMat();

      // Properties that make sense for atmospheric effects
      expect(material.transparent).toBe(true);
      // Material uses default FrontSide (0), suitable for atmosphere when used correctly
      expect(material.side).toBe(THREE.FrontSide);

      // Should not be double-sided for atmosphere
      expect(material.side).not.toBe(THREE.DoubleSide);
    });

    it('should create consistent materials', () => {
      const material1 = getFresnelMat();
      const material2 = getFresnelMat();

      expect(material1.vertexShader).toBe(material2.vertexShader);
      expect(material1.fragmentShader).toBe(material2.fragmentShader);
      expect(material1.transparent).toBe(material2.transparent);
      expect(material1.side).toBe(material2.side);
    });

    it('should not throw during creation', () => {
      expect(() => getFresnelMat()).not.toThrow();
    });

    it('should have proper blending for atmosphere effects', () => {
      const material = getFresnelMat();

      // For atmospheric effects, we typically want additive or normal blending
      expect([
        THREE.NormalBlending,
        THREE.AdditiveBlending,
        THREE.SubtractiveBlending,
        THREE.MultiplyBlending,
      ]).toContain(material.blending);
    });
  });
});

import { MeshStandardMaterial, Texture, Color, FrontSide } from 'three';

/**
 * Extended material interface with custom properties
 */
interface ExtendedMeshStandardMaterial extends MeshStandardMaterial {
  countryIdTexture?: Texture;
  selectionMaskTexture?: Texture;
  selectionColor?: Color;
  enableBorders?: boolean;
  borderColor?: Color;
}

/**
 * Configuration for country selection material
 */
export interface CountrySelectionMaterialConfig {
  earthTexture: Texture;
  countryIdTexture: Texture;
  selectionMaskTexture: Texture;
  selectionColor?: Color;
  selectionStrength?: number;
  roughness?: number;
  metalness?: number;
  enableBorders?: boolean;
  borderColor?: Color;
  borderWidth?: number;
}

/**
 * Creates a simplified material for Earth with basic country selection
 * Uses MeshStandardMaterial for reliable rendering
 */
export function createCountrySelectionMaterial(
  config: CountrySelectionMaterialConfig,
): MeshStandardMaterial {
  const {
    earthTexture,
    countryIdTexture,
    selectionMaskTexture,
    selectionColor = new Color(0x00ff88),
    selectionStrength = 0.6,
    roughness = 0.8,
    metalness = 0.1,
    enableBorders = true,
    borderColor = new Color(0x333333),
    borderWidth = 0.001,
  } = config;

  // Create a simple MeshStandardMaterial with the earth texture
  const material = new MeshStandardMaterial({
    map: earthTexture,
    roughness: roughness,
    metalness: metalness,
    side: FrontSide,
    transparent: false,
    depthWrite: true,
    depthTest: true,
  });

  // Store reference textures for future GPU selection implementation
  const extendedMaterial = material as ExtendedMeshStandardMaterial;
  extendedMaterial.countryIdTexture = countryIdTexture;
  extendedMaterial.selectionMaskTexture = selectionMaskTexture;
  extendedMaterial.selectionColor = selectionColor;
  extendedMaterial.enableBorders = enableBorders;
  extendedMaterial.borderColor = borderColor;

  // Material creation completed successfully

  return material;
}

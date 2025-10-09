import { Color, ShaderMaterial, AdditiveBlending } from 'three';

// An interface to define the shape of the function's optional parameter object.
interface FresnelMatProps {
  rimHex?: number;
  facingHex?: number;
  fresnelBias?: number;
  fresnelScale?: number;
  fresnelPower?: number;
}

/**
 * Creates a THREE.js ShaderMaterial with a Fresnel effect.
 * @param {FresnelMatProps} props - The properties for the Fresnel material.
 * @returns {ShaderMaterial} - The created shader material.
 */
function getFresnelMat({
  rimHex = 0x0088ff,
  facingHex = 0x000000,
  fresnelBias = 0.1,
  fresnelScale = 0.5,
  fresnelPower = 4.5,
}: FresnelMatProps = {}): ShaderMaterial {
  const uniforms = {
    color1: { value: new Color(rimHex) },
    color2: { value: new Color(facingHex) },
    fresnelBias: { value: fresnelBias },
    fresnelScale: { value: fresnelScale },
    fresnelPower: { value: fresnelPower },
  };

  const vs: string = `
    uniform float fresnelBias;
    uniform float fresnelScale;
    uniform float fresnelPower;
    
    varying float vReflectionFactor;
    
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
    
      vec3 worldNormal = normalize( mat3( modelMatrix[0].xyz, modelMatrix[1].xyz, modelMatrix[2].xyz ) * normal );
    
      vec3 I = worldPosition.xyz - cameraPosition;
    
      vReflectionFactor = fresnelBias + fresnelScale * pow( 1.0 + dot( normalize( I ), worldNormal ), fresnelPower );
    
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fs: string = `
    uniform vec3 color1;
    uniform vec3 color2;
    
    varying float vReflectionFactor;
    
    void main() {
      float f = clamp( vReflectionFactor, 0.0, 1.0 );
      gl_FragColor = vec4(mix(color2, color1, vec3(f)), f);
    }
  `;

  const fresnelMat = new ShaderMaterial({
    uniforms: uniforms,
    vertexShader: vs,
    fragmentShader: fs,
    transparent: true,
    blending: AdditiveBlending,
    // wireframe: true,
  });

  return fresnelMat;
}

export { getFresnelMat };

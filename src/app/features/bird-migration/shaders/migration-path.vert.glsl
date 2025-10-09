// Migration Path Vertex Shader
// Handles vertex transformations for migration path rendering

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDistance;

uniform float time;
uniform float animationProgress;
uniform float waveAmplitude;
uniform float waveFrequency;

void main() {
  // Pass data to fragment shader
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
  vUv = uv;

  // Calculate distance along path for gradient effects
  // Assuming path goes from -1 to 1 in local space
  vDistance = (position.y + 1.0) * 0.5; // Normalize to 0-1

  // Apply pulsing wave effect along path
  vec3 pos = position;

  if (waveAmplitude > 0.0) {
    // Traveling wave along the path
    float wave = sin(vDistance * waveFrequency - time * 2.0) * waveAmplitude;

    // Apply wave in normal direction for smooth undulation
    pos += normal * wave * animationProgress;
  }

  // Final position transformation
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}

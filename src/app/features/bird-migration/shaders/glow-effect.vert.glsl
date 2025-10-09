// Glow Effect Vertex Shader
// Enhanced glow with more dramatic effects

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vIntensity;

uniform float time;
uniform float glowScale;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  // Calculate glow intensity based on vertex position
  // Center is less intense, edges are more intense
  float centerDistance = length(position.xz);
  vIntensity = smoothstep(0.0, 1.0, centerDistance);

  // Pulsing scale effect
  float pulse = 1.0 + sin(time * 2.0) * 0.05;
  vec3 scaledPosition = position * pulse * glowScale;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPosition, 1.0);
}

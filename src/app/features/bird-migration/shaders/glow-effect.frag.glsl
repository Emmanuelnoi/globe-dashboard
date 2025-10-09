// Glow Effect Fragment Shader
// Outer glow halo effect

varying vec3 vNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;
varying float vIntensity;

uniform vec3 glowColor;
uniform float glowIntensity;
uniform float time;
uniform float innerGlow;
uniform float outerGlow;

void main() {
  // View direction
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);

  // Enhanced fresnel for outer glow
  float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 3.0);

  // Radial gradient from center
  float radialGradient = 1.0 - vIntensity;

  // Pulsing animation
  float pulse = 0.5 + 0.5 * sin(time * 4.0);

  // Combine glow effects
  float glowAmount = fresnel * glowIntensity;
  glowAmount = mix(innerGlow, outerGlow, fresnel);
  glowAmount *= pulse;

  // Final glow color
  vec3 finalColor = glowColor * glowAmount;

  // Alpha falloff from center to edge
  float alpha = fresnel * glowIntensity * 0.4;

  gl_FragColor = vec4(finalColor, alpha);
}

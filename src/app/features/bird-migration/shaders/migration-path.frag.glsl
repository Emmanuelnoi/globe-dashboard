// Migration Path Fragment Shader
// Creates gradient and glow effects for migration paths

varying vec3 vNormal;
varying vec3 vPosition;
varying vec2 vUv;
varying float vDistance;

uniform vec3 colorStart;
uniform vec3 colorEnd;
uniform float opacity;
uniform float glowIntensity;
uniform float time;
uniform float fresnelPower;

void main() {
  // Gradient color along path (start to end)
  vec3 pathColor = mix(colorStart, colorEnd, vDistance);

  // Fresnel effect for glow (edges glow more than center)
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), fresnelPower);

  // Pulsing animation
  float pulse = 0.7 + 0.3 * sin(time * 3.0);

  // Traveling light along path
  float travelingLight = smoothstep(0.0, 0.1, sin(vDistance * 20.0 - time * 5.0));

  // Combine effects
  vec3 finalColor = pathColor * (1.0 + fresnel * glowIntensity * pulse);
  finalColor += pathColor * travelingLight * 0.3;

  // Alpha with fresnel enhancement
  float alpha = opacity * (0.6 + 0.4 * fresnel);

  gl_FragColor = vec4(finalColor, alpha);
}

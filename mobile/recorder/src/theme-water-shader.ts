/**
 * The glass-water shader recovered from the approved 1,180 ms preview.
 *
 * The preview composited two captured scenes. The native app deliberately keeps
 * the destination live instead: this shader refracts the captured old scene and
 * fades its alpha behind the wave, revealing the already-rendered new theme.
 */
export const THEME_WATER_SHADER_SOURCE = `
uniform shader oldScene;
uniform float2 size;
uniform float2 origin;
uniform float radius;
uniform float progress;
uniform float refraction;

half4 main(float2 xy) {
  if (progress <= 0.0) return oldScene.eval(xy);
  if (progress >= 1.0) return half4(0.0);

  float2 delta = xy - origin;
  float distance = length(delta);
  float2 direction = delta / max(distance, 1.0);
  float front = progress * (radius + 210.0) - 24.0;
  float wake = front - distance;
  float arrival = smoothstep(-12.0, 8.0, wake);
  float decay = exp(-max(wake, 0.0) / 74.0);
  float tail = 1.0 - smoothstep(125.0, 195.0, wake);
  float settle = 1.0 - smoothstep(0.72, 1.0, progress);
  float envelope = arrival * decay * tail * settle;
  float phase = wake * 0.115;
  float wave = sin(phase);
  float slope = cos(phase);
  float displacement = wave * envelope * 11.0 * refraction;
  float2 sampleAt = clamp(xy + direction * displacement, float2(0.5), size - 0.5);
  float reveal = smoothstep(-5.0, 9.0, wake);
  half4 color = oldScene.eval(sampleAt);

  // Narrow highlights and opposing shadows describe curved, clear water.
  // Directional lighting breaks up the rings without adding colored outlines.
  float light = dot(direction, float2(-0.55, -0.835));
  float normalLight = slope * light;
  float glint = pow(max(normalLight, 0.0), 4.0) * 0.24;
  float shade = pow(max(-normalLight, 0.0), 3.0) * 0.13;
  float lens = envelope * refraction;
  color.rgb = color.rgb * (1.0 - shade * lens) + (color.a - color.rgb) * glint * lens;
  return color * (1.0 - reveal);
}
`;

export const THEME_WATER_GOLDEN_PROGRESS = [0, 0.12, 0.23, 0.35, 0.48, 0.64, 0.8, 1] as const;

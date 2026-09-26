// Text-free Aurora Glass scene: midnight sky, aurora curtain, mountains, lake and road.
// Procedural and seeded, so the artwork is reproducible and has no third-party license.
// Shared by the production artwork generator and the V4 design mockups.
export const SCENE_WIDTH = 390, SCENE_HEIGHT = 844;
const W = SCENE_WIDTH, H = SCENE_HEIGHT;

export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let r = Math.imul(seed ^ seed >>> 15, 1 | seed); r = r + Math.imul(r ^ r >>> 7, 61 | r) ^ r; return ((r ^ r >>> 14) >>> 0) / 4294967296; };
}

/** SVG body for a 390x844 viewBox. */
export function auroraSceneSvg() {
  const r = rng(26);
  const band = x => 238 - 150 * (x / 430) + 30 * Math.sin(x / 58) + 12 * Math.sin(x / 23);
  const band2 = x => 300 - 40 * (x / 390) + 18 * Math.sin(x / 41 + 1.3);
  const bandPath = (f, dy = 0) => Array.from({ length: 48 }, (_, i) => { const x = -30 + i * 10; return `${i ? 'L' : 'M'}${x} ${(f(x) + dy).toFixed(1)}`; }).join(' ');
  let rays = '';
  for (let x = -20; x < 420; x += 2.2) {
    const y = band(x), len = 70 + r() * 150;
    rays += `<rect x="${x.toFixed(1)}" y="${(y - len).toFixed(1)}" width="1.7" height="${len.toFixed(1)}" fill="url(#ray)" opacity="${(0.12 + r() * 0.55).toFixed(2)}"/>`;
  }
  let rays2 = '';
  for (let x = 120; x < 420; x += 2.6) {
    const y = band2(x), len = 40 + r() * 80;
    rays2 += `<rect x="${x.toFixed(1)}" y="${(y - len).toFixed(1)}" width="1.6" height="${len.toFixed(1)}" fill="url(#ray)" opacity="${(0.06 + r() * 0.28).toFixed(2)}"/>`;
  }
  let stars = '';
  for (let i = 0; i < 260; i++) stars += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * 400).toFixed(1)}" r="${(0.25 + r() * r() * 1.0).toFixed(2)}" fill="#fff" opacity="${(0.25 + r() * 0.7).toFixed(2)}"/>`;
  const trees = (x0, x1, yBase, hMin, hMax, fill) => {
    let d = '';
    for (let x = x0; x < x1; x += 4 + r() * 6) { const h = hMin + r() * (hMax - hMin), w = h * 0.32; d += `M${(x - w).toFixed(1)} ${yBase} L${x.toFixed(1)} ${(yBase - h).toFixed(1)} L${(x + w).toFixed(1)} ${yBase}Z`; }
    return `<path d="${d}" fill="${fill}"/>`;
  };
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#02050d"/><stop offset="0.3" stop-color="#051024"/>
      <stop offset="0.43" stop-color="#0a1c38"/><stop offset="0.5" stop-color="#13304a"/><stop offset="1" stop-color="#03060c"/>
    </linearGradient>
    <linearGradient id="ray" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#9dffdc"/><stop offset="0.25" stop-color="#46f5b5"/>
      <stop offset="0.65" stop-color="#6f7cff" stop-opacity="0.55"/><stop offset="1" stop-color="#a66bff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="farMtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a5078"/><stop offset="0.5" stop-color="#1c2c4a"/><stop offset="1" stop-color="#0b1426"/></linearGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#123150"/><stop offset="0.5" stop-color="#0a1a2e"/><stop offset="1" stop-color="#050b15"/></linearGradient>
    <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2b3d"/><stop offset="0.45" stop-color="#0d141f"/><stop offset="1" stop-color="#0a0f18"/></linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5ff2c4" stop-opacity="0"/><stop offset="0.5" stop-color="#8fffe0" stop-opacity="0.16"/><stop offset="1" stop-color="#5ff2c4" stop-opacity="0"/></linearGradient>
    <filter id="b30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="b16" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="b6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="rayBlur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6 7"/></filter>
    <filter id="b2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}
  <path d="${bandPath(band, -95)}" stroke="#8a5cff" stroke-width="110" fill="none" opacity="0.22" filter="url(#b30)"/>
  <path d="${bandPath(band, -20)}" stroke="#2fe8a6" stroke-width="80" fill="none" opacity="0.32" filter="url(#b30)"/>
  <g filter="url(#rayBlur)">${rays}${rays2}</g>
  <path d="${bandPath(band, -4)}" stroke="#b6ffe6" stroke-width="7" fill="none" opacity="0.55" filter="url(#b6)"/>
  <path d="${bandPath(band2, -10)}" stroke="#3ff0b0" stroke-width="40" fill="none" opacity="0.16" filter="url(#b16)"/>
  <!-- far range with snow edges -->
  <path d="M0 338 L22 322 L48 330 L78 286 L96 298 L128 250 L150 272 L170 262 L205 318 L232 344 L256 352 L282 336 L300 318 L318 330 L340 300 L362 318 L390 306 L390 430 L0 430Z" fill="url(#farMtn)"/>
  <g fill="#cfe4ff" opacity="0.5"><path d="M78 286 L96 298 L90 302 L84 296 L80 304 L72 296Z"/><path d="M128 250 L150 272 L142 270 L136 280 L130 268 L120 276 L116 266Z"/><path d="M170 262 L186 284 L178 282 L172 290 L164 276Z"/><path d="M340 300 L356 312 L348 312 L342 318 L334 308Z"/></g>
  <path d="M0 338 L22 322 L48 330 L78 286 L96 298 L128 250 L150 272 L170 262 L205 318 L232 344 L256 352 L282 336 L300 318 L318 330 L340 300 L362 318 L390 306" stroke="#bfe8ff" stroke-width="0.8" fill="none" opacity="0.35"/>
  <path d="M0 372 L36 356 L70 378 L112 352 L150 380 L196 372 L236 392 L270 382 L312 360 L350 376 L390 364 L390 432 L0 432Z" fill="#081122"/>
  <!-- lake + reflection -->
  <rect y="418" width="${W}" height="80" fill="url(#lake)"/>
  <ellipse cx="170" cy="440" rx="190" ry="16" fill="#3ff0b0" opacity="0.14" filter="url(#b16)"/>
  <g stroke="#9dffdc" stroke-width="0.8" opacity="0.18"><path d="M40 432h90M150 442h120M60 452h70M230 456h110M110 466h60"/></g>
  ${trees(0, 180, 424, 8, 22, '#040913')}${trees(250, 390, 424, 8, 20, '#040913')}
  <!-- foreground land -->
  <path d="M0 470 C120 452 260 450 390 468 L390 ${H} L0 ${H}Z" fill="#050a12"/>
  ${trees(0, 110, 520, 30, 90, '#03060c')}${trees(300, 390, 540, 40, 110, '#03060c')}
  <!-- road -->
  <path d="M-70 ${H} C40 700 150 560 224 446 L240 446 C262 560 320 700 350 ${H}Z" fill="url(#road)"/>
  <path d="M-70 ${H} C40 700 150 560 224 446 L240 446 C262 560 320 700 350 ${H}Z" fill="url(#sheen)"/>
  <path d="M140 ${H} C190 700 214 560 232 446" stroke="#eaf2ff" stroke-width="2.2" stroke-dasharray="20 18" fill="none" opacity="0.4"/>
  <path d="M-70 ${H} C40 700 150 560 224 446" stroke="#8fffe0" stroke-width="1.4" fill="none" opacity="0.28" filter="url(#b2)"/>
  <path d="M350 ${H} C320 700 262 560 240 446" stroke="#d5e6ff" stroke-width="1.2" fill="none" opacity="0.22"/>`;
}


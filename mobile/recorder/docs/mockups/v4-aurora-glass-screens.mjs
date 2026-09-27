// Aurora Glass matched-screen mockups (design artifacts only; not production UI).
// Renders a text-free procedural aurora scene, then builds glass by blurring the
// pixels actually beneath each surface. User photos, album art and the map stay crisp.
// Run from mobile/recorder: node docs/mockups/v4-aurora-glass-screens.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { auroraSceneSvg as sceneSvg, rng } from '../../scripts/aurora-glass-scene.mjs';

const W = 390, H = 844, S = 3;
const asset = name => fileURLToPath(new URL(`../../assets/${name}`, import.meta.url));
const out = name => fileURLToPath(new URL(`./${name}`, import.meta.url));
const FONT = "'Segoe UI Variable Display','Segoe UI',Arial,sans-serif";
const MINT = '#5ff2c4';
const TEXT = '#f4f8ff', TEXT2 = 'rgba(226,236,255,0.68)', TEXT3 = 'rgba(226,236,255,0.48)';

const svg = (body, w = W, h = H) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, { size = 15, weight = 400, fill = TEXT, anchor = 'start', ls = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${esc(s)}</text>`;


// ---------- Icons (24-unit SF-Symbol-like strokes) ----------
const ico = (path, x, y, { size = 24, color = TEXT, width = 1.7, fill = 'none' } = {}) =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="${fill}" stroke="${color}" stroke-width="${width * 24 / size}" stroke-linecap="round" stroke-linejoin="round">${path}</g>`;
const I = {
  house: '<path d="M3 11.2 12 3.8l9 7.4M5.6 9.6V20h4.6v-5.4h3.6V20h4.6V9.6"/>',
  music: '<path d="M9 17.5V5.8l10-2.2v11.6"/><circle cx="6.6" cy="17.6" r="2.5"/><circle cx="16.6" cy="15.3" r="2.5"/>',
  photos: '<rect x="3.5" y="7.5" width="14.5" height="12" rx="2.2"/><path d="M7 4.5h11.8a2 2 0 0 1 2 2V16"/><path d="M5.5 17.5l3.8-4 2.8 2.8 1.8-1.8 2.6 3"/>',
  chart: '<path d="M3.5 3.5v17h17"/><path d="M6.8 15.5l4-4.8 3.3 2.6 5.6-6.6"/>',
  gear: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/><circle cx="12" cy="12" r="6.6"/>',
  chevronL: '<path d="M14.5 5 7.5 12l7 7"/>',
  chevronR: '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
  share: '<path d="M12 3.5v11M7.8 7.6 12 3.5l4.2 4.1"/><path d="M8 10.5H6.2v9.5h11.6v-9.5H16"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  locate: '<path d="M20 4 4.5 10.8l6.6 2.1 2.1 6.6z"/>',
  layers: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5z"/><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.2 12 20.6l8.5-4.4"/>',
  play: '<path d="M8 5.2v13.6L19 12z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.4 15.4 4.6 4.6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  cloud: '<path d="M7 18.5h10.2a3.8 3.8 0 0 0 .5-7.6 5.4 5.4 0 0 0-10.4-1.3A4.5 4.5 0 0 0 7 18.5z"/>',
  brush: '<path d="M19.5 4.5 11 13"/><path d="M10.6 13.4c-2.5-.6-4.6 1.2-4.6 3.6 0 1.1-.8 2-2 2.5 3.8 1.4 8.1.2 8.1-3.4z"/>',
  medal: '<circle cx="12" cy="14.5" r="5.5"/><path d="M8.2 10.4 5.8 3.5h4.1l2.1 5M15.8 10.4l2.4-6.9h-4.1"/><path d="m12 12 .9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3z"/>',
  shield: '<path d="M12 3.2 4.8 6v5.5c0 4.6 3 7.9 7.2 9.3 4.2-1.4 7.2-4.7 7.2-9.3V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>',
  pin: '<path d="M20.5 3.5 3.8 10.4l7.1 2.5 2.6 7.3z"/>',
  flame: '<path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.9-3.3-6.3-4.2-10.2-2.3 1.6-3.2 3.9-3.1 6.2-1.2-.6-1.9-1.8-2-3.1C7 9.2 5.5 11.7 5.5 14.7 5.5 18.4 8.1 21 12 21z"/>',
  headphones: '<path d="M4.5 16v-3.5a7.5 7.5 0 0 1 15 0V16"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.6"/>',
  road: '<path d="M8.5 3.5 4 20.5M15.5 3.5l4.5 17M12 4v2.6M12 10v2.6M12 16v3"/>',
};

function scrims({ top = 0.4, bottom = 0.5, dim = 0 } = {}) {
  return `<defs>
    <linearGradient id="st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02050d" stop-opacity="${top}"/><stop offset="1" stop-color="#02050d" stop-opacity="0"/></linearGradient>
    <linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02050d" stop-opacity="0"/><stop offset="1" stop-color="#02050d" stop-opacity="${bottom}"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="#02050d" opacity="${dim}"/>
    <rect width="${W}" height="150" fill="url(#st)"/><rect y="470" width="${W}" height="${H - 470}" fill="url(#sb)"/>`;
}

// ---------- Map (journey detail) ----------
function mapSvg() {
  const r = rng(7);
  let minor = '';
  for (let i = 0; i < 40; i++) { const x = 170 + r() * 240, y = r() * H, a = r() * 180; minor += `<path d="M${x} ${y} l${Math.cos(a) * 60} ${Math.sin(a) * 60}" />`; }
  let grid = '';
  for (let x = 200; x < 420; x += 17) grid += `<path d="M${x} 0 L${x - 90} ${H}"/>`;
  for (let y = 0; y < H; y += 19) grid += `<path d="M150 ${y} L420 ${y - 40}"/>`;
  return `
  <defs><linearGradient id="water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#05202c"/><stop offset="1" stop-color="#041520"/></linearGradient>
    <linearGradient id="mapTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02050d" stop-opacity="0.55"/><stop offset="1" stop-color="#02050d" stop-opacity="0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="#0a1124"/>
  <path d="M0 0 H232 C214 80 250 130 214 190 C190 232 208 280 180 330 C160 372 156 420 128 470 C104 520 110 600 70 680 C50 730 40 790 20 ${H} H0Z" fill="url(#water)"/>
  <path d="M232 0 C214 80 250 130 214 190 C190 232 208 280 180 330 C160 372 156 420 128 470 C104 520 110 600 70 680 C50 730 40 790 20 ${H}" stroke="#2b7f86" stroke-opacity="0.55" stroke-width="1.5" fill="none"/>
  <g stroke="#121b33" stroke-width="0.9" opacity="0.9">${grid}</g>
  <g stroke="#1b2743" stroke-width="1.4">${minor}</g>
  <path d="M300 60 C330 90 360 90 400 120 L400 230 C360 220 330 200 300 180Z" fill="#0c2330" fill-opacity="0.9"/>
  <path d="M250 520 C290 500 340 520 400 500 L400 640 C340 660 290 620 250 600Z" fill="#0c2330" fill-opacity="0.9"/>
  <path d="M262 -10 C246 80 272 140 240 200 C214 250 232 300 204 350 C184 392 178 430 150 480 C126 530 132 610 94 690 C74 740 66 800 50 ${H + 10}" stroke="#34466b" stroke-width="5" fill="none"/>
  <path d="M400 300 C340 310 300 330 214 342" stroke="#26365a" stroke-width="3.5" fill="none"/>
  <path d="M400 150 C340 160 290 150 250 170" stroke="#26365a" stroke-width="3" fill="none"/>
  ${t(284, 128, 'Pacifica', { size: 12, weight: 600, fill: '#9fb2d4' })}
  ${t(256, 262, 'Montara', { size: 11, weight: 600, fill: '#8a9cc0' })}
  ${t(154, 409, 'Half Moon Bay', { size: 12, weight: 600, fill: '#9fb2d4', anchor: 'end' })}
  ${t(60, 300, 'Pacific Ocean', { size: 11, weight: 500, fill: '#3f8a8f', ls: 1.5 })}
  <rect width="${W}" height="120" fill="url(#mapTop)"/>`;
}
const ROUTE = 'M258 118 C246 170 262 190 238 222 C216 254 230 290 206 330 C190 360 186 385 170 404';

// ---------- Glass ----------
const MATERIAL = {
  clear: { sigma: 7, brightness: 1.08, saturation: 1.25, base: ['#0a1426', 0.22], hi: [0.2, 0.05], edge: [0.62, 0.14, 0.3] },
  frosted: { sigma: 18, brightness: 0.8, saturation: 1.1, base: ['#0a1427', 0.56], hi: [0.07, 0], edge: [0.2, 0.06, 0.1] },
  sheet: { sigma: 24, brightness: 0.75, saturation: 1.05, base: ['#08111f', 0.66], hi: [0.06, 0], edge: [0.22, 0.05, 0.05] },
  mint: { sigma: 8, brightness: 1.1, saturation: 1.3, base: null, hi: [0.45, 0], edge: [0.9, 0.35, 0.5] },
};
const OPAQUE = { clear: '#1a2740', frosted: '#101b2e', sheet: '#0d1727', mint: MINT };

function roundedPath(w, h, r, topOnly, bottomOnly) {
  if (topOnly) return `<path d="M0 ${r} A${r} ${r} 0 0 1 ${r} 0 H${w - r} A${r} ${r} 0 0 1 ${w} ${r} V${h} H0Z"/>`;
  if (bottomOnly) return `<path d="M0 0 H${w} V${h - r} A${r} ${r} 0 0 1 ${w - r} ${h} H${r} A${r} ${r} 0 0 1 0 ${h - r}Z"/>`;
  return `<rect width="${w}" height="${h}" rx="${r}"/>`;
}

async function glass(base, { x, y, w, h, r, kind, topOnly = false, bottomOnly = false, reduce = false }) {
  const m = MATERIAL[kind];
  const r0 = r; if (bottomOnly) r = 0;
  w = Math.min(w, W - x); h = Math.min(h, H - y); // clip surfaces that run off-screen
  const X = Math.round(x * S), Y = Math.round(y * S), PW = Math.round(w * S), PH = Math.round(h * S);
  let layer;
  const tint = kind === 'mint'
    ? `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4ffe8" stop-opacity="${reduce ? 1 : 0.9}"/><stop offset="1" stop-color="#3ee3b1" stop-opacity="${reduce ? 1 : 0.78}"/></linearGradient></defs><rect width="${w}" height="${h}" rx="${r}" fill="url(#m)"/>`
    : reduce ? `<rect width="${w}" height="${h}" rx="${r}" fill="${OPAQUE[kind]}"/>` : `<rect width="${w}" height="${h}" rx="${r}" fill="${m.base[0]}" fill-opacity="${m.base[1]}"/>`;
  const overlay = svg(`<defs>
      <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${m.hi[0]}"/><stop offset="0.5" stop-color="#fff" stop-opacity="${m.hi[1]}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="ed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${m.edge[0] * (reduce ? 1.4 : 1)}"/><stop offset="0.5" stop-color="#fff" stop-opacity="${m.edge[1]}"/><stop offset="1" stop-color="#fff" stop-opacity="${m.edge[2]}"/></linearGradient></defs>
    ${tint}<rect width="${w}" height="${h}" rx="${r}" fill="url(#hi)"/>
    <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${r - 0.5}" fill="none" stroke="url(#ed)" stroke-width="1"/>`, w, h);
  if (reduce) {
    layer = await sharp({ create: { width: PW, height: PH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: overlay }]).png().toBuffer();
  } else {
    const pad = Math.round(m.sigma * S * 2.5);
    const meta = await sharp(base).metadata();
    const L = Math.max(0, X - pad), T = Math.max(0, Y - pad);
    const R = Math.min(meta.width, X + PW + pad), B = Math.min(meta.height, Y + PH + pad);
    const blurred = await sharp(base).extract({ left: L, top: T, width: R - L, height: B - T }).blur(m.sigma * S).modulate({ brightness: m.brightness, saturation: m.saturation }).png().toBuffer();
    layer = await sharp(blurred).extract({ left: X - L, top: Y - T, width: PW, height: PH }).composite([{ input: overlay }]).png().toBuffer();
  }
  const mask = svg(`<g fill="#fff">${roundedPath(w, h, r0, topOnly, bottomOnly)}</g>`, w, h);
  layer = await sharp(layer).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  return { input: layer, left: X, top: Y };
}

async function photo(name, { x, y, w, h, r, focus = 'attention' }) {
  const img = await sharp(asset(name)).resize(Math.round(w * S), Math.round(h * S), { fit: 'cover', position: focus }).png().toBuffer();
  const mask = svg(`<rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>`, w, h);
  let input = await sharp(img).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  const vw = Math.min(w, W - x);
  if (vw < w) input = await sharp(input).extract({ left: 0, top: 0, width: Math.round(vw * S), height: Math.round(h * S) }).png().toBuffer();
  return { input, left: Math.round(x * S), top: Math.round(y * S) };
}

const shadows = list => svg(`<defs><filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10"/></filter></defs>
  <g filter="url(#sh)" fill="#000">${list.map(({ x, y, w, h, r, o = 0.35 }) => `<rect x="${x}" y="${y + 6}" width="${w}" height="${h}" rx="${r}" opacity="${o}"/>`).join('')}</g>`);

async function layer(base, items) { return sharp(base).composite(items).png().toBuffer(); }
async function glasses(base, specs, reduce) {
  const items = [];
  for (const s of specs) items.push(await glass(base, { ...s, reduce }));
  return layer(base, items);
}

const statusBar = (fill = TEXT) => `${t(34, 34, '9:41', { size: 16, weight: 600, fill })}
  <g fill="${fill}"><rect x="302" y="26" width="3" height="5" rx="1"/><rect x="307" y="24" width="3" height="7" rx="1"/><rect x="312" y="22" width="3" height="9" rx="1"/><rect x="317" y="20" width="3" height="11" rx="1"/></g>
  <path d="M327 25.5q7-6 14 0M330 28.5q4-3.5 8 0" stroke="${fill}" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="334" cy="31" r="1.3" fill="${fill}"/>
  <rect x="347" y="20.5" width="24" height="11.5" rx="3.5" fill="none" stroke="${fill}" stroke-opacity="0.5"/><rect x="349" y="22.5" width="17" height="7.5" rx="2" fill="${fill}"/><rect x="372.5" y="24.5" width="1.6" height="4" rx="0.8" fill="${fill}" fill-opacity="0.5"/>`;
const homeIndicator = `<rect x="128" y="831" width="134" height="5" rx="2.5" fill="#fff" opacity="0.9"/>`;

// Native tab bar stand-in: system-owned Liquid Glass pill with the app's real five tabs.
const TAB = { x: 14, y: 758, w: 362, h: 64, r: 32 };
function tabBarOverlay(selected) {
  const tabs = [['Home', I.house], ['Music', I.music], ['Memories', I.photos], ['Statistics', I.chart], ['Settings', I.gear]];
  const cw = (TAB.w - 12) / 5;
  return tabs.map(([label, icon], i) => {
    const cx = TAB.x + 6 + cw * i + cw / 2, on = label === selected, c = on ? MINT : 'rgba(236,244,255,0.86)';
    return `${on ? `<rect x="${cx - cw / 2 + 2}" y="${TAB.y + 6}" width="${cw - 4}" height="${TAB.h - 12}" rx="${(TAB.h - 12) / 2}" fill="#fff" fill-opacity="0.13"/>` : ''}
      ${ico(icon, cx - 12, TAB.y + 12, { color: c, width: on ? 2 : 1.7 })}${t(cx, TAB.y + 51, label, { size: 10.5, weight: on ? 650 : 500, fill: c, anchor: 'middle' })}`;
  }).join('');
}
const circleBtn = (x, y, d = 44) => ({ x, y, w: d, h: d, r: d / 2, kind: 'clear' });

async function sceneBase(variant) {
  let base = await sharp(svg(sceneSvg())).png().toBuffer();
  if (variant !== 'home') base = await sharp(base).blur(14 * S).png().toBuffer(); // calm, heavily blurred scene off Home
  const dims = { home: { top: 0.45, bottom: 0.55, dim: 0 }, memories: { top: 0.5, bottom: 0.6, dim: 0.3 }, settings: { top: 0.5, bottom: 0.6, dim: 0.34 } };
  return layer(base, [{ input: svg(scrims(dims[variant])) }]);
}

// ---------- Screens ----------
async function home({ reduce = false } = {}) {
  let b = await sceneBase('home');
  const tiles = [
    { x: 16, y: 414, label: 'Miles', value: '142.6', unit: 'mi', note: 'this week', icon: I.road },
    { x: 201, y: 414, label: 'Listening', value: '6h 12m', unit: '', note: 'on the road', icon: I.headphones },
    { x: 16, y: 508, label: 'Songs', value: '184', unit: '', note: 'matched', icon: I.music },
    { x: 201, y: 508, label: 'Streak', value: '9', unit: 'days', note: 'in a row', icon: I.flame },
  ].map(tile => ({ ...tile, w: 173, h: 84, r: 22 }));
  const cards = [['cinematic-home-evening-photo-v1.jpg', 'Golden hour hills'], ['theme-autumn-home-road-v1.jpg', 'Autumn back roads'], ['cinematic-atlas-photo-v1.jpg', 'Mountain weekend']].map(([file, title], i) => ({ file, title, x: 16 + i * 162, y: 646, w: 150, h: 100, r: 20 }));
  const dock = { x: 16, y: 272, w: 358, h: 130, r: 40, kind: 'clear' };
  const primary = { x: 26, y: 332, w: 338, h: 60, r: 30, kind: 'mint' };
  b = await layer(b, [{ input: shadows([...tiles, dock].map(g => ({ ...g, o: 0.3 }))) }]);
  b = await glasses(b, [circleBtn(282, 58), circleBtn(334, 58), dock, ...tiles.map(g => ({ ...g, kind: 'frosted' }))], reduce);
  b = await glasses(b, [primary], reduce);
  b = await layer(b, await Promise.all(cards.map(c => photo(c.file, c))));
  b = await glasses(b, cards.map(c => ({ x: c.x, y: c.y + c.h - 34, w: c.w, h: 34, r: c.r, bottomOnly: true, kind: 'frosted' })), reduce);
  b = await layer(b, [{ input: svg(`${statusBar()}
    ${t(16, 76, 'Friday, September 26', { size: 13, weight: 600, fill: TEXT2, ls: 0.2 })}
    ${t(16, 106, 'Good evening', { size: 32, weight: 700 })}
    ${ico(I.sliders, 292, 68)}
    ${t(356, 85, 'PS', { size: 15, weight: 700, anchor: 'middle' })}
    <circle cx="42" cy="302" r="9" fill="${MINT}" fill-opacity="0.18"/><circle cx="42" cy="302" r="4.5" fill="${MINT}"/>
    ${t(62, 299, 'Automatic recording on', { size: 14.5, weight: 650 })}${t(62, 317, 'Watching for your next drive · last drive 2h ago', { size: 12, fill: TEXT2 })}
    ${ico(I.chevronR, 348, 294, { size: 16, color: TEXT3, width: 2 })}
    ${t(182, 368, 'Start a journey', { size: 18, weight: 700, fill: '#03261c', anchor: 'middle' })}${ico(I.chevronR, 266, 351, { color: '#03261c', width: 2.4, size: 22 })}
    ${tiles.map(g => `${ico(g.icon, g.x + 16, g.y + 14, { size: 18, color: TEXT2 })}${t(g.x + 40, g.y + 28, g.label, { size: 13, weight: 600, fill: TEXT2 })}
      ${t(g.x + 16, g.y + 62, g.value, { size: 26, weight: 700 })}${g.unit ? t(g.x + 16 + g.value.length * 13.8 + 4, g.y + 62, g.unit, { size: 14, weight: 600, fill: TEXT2 }) : ''}
      ${t(g.x + 16, g.y + 77, g.note, { size: 11.5, fill: TEXT3 })}`).join('')}
    ${t(16, 630, 'Memories', { size: 20, weight: 700 })}${t(374, 630, 'View all', { size: 14, weight: 600, fill: TEXT2, anchor: 'end' })}
    ${cards.map(c => t(c.x + 12, c.y + c.h - 12, c.title, { size: 12.5, weight: 650 })).join('')}`) }]);
  b = await glasses(b, [{ ...TAB, kind: 'clear' }], reduce);
  return layer(b, [{ input: svg(tabBarOverlay('Home') + homeIndicator) }]);
}

async function journey({ reduce = false } = {}) {
  let b = await sharp(svg(mapSvg())).png().toBuffer();
  b = await layer(b, [{ input: svg(`<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>
    <path d="${ROUTE}" stroke="${MINT}" stroke-width="10" fill="none" opacity="0.45" filter="url(#g)" stroke-linecap="round"/>
    <path d="${ROUTE}" stroke="#032018" stroke-width="7.5" fill="none" stroke-linecap="round"/>
    <path d="${ROUTE}" stroke="${MINT}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="258" cy="118" r="7" fill="#fff" stroke="#032018" stroke-width="3"/>
    <circle cx="170" cy="404" r="9" fill="${MINT}" stroke="#032018" stroke-width="3"/><circle cx="170" cy="404" r="3" fill="#032018"/>
    ${[[252, 186], [222, 262], [196, 348]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="17" fill="#fff"/>`).join('')}`) }]);
  const pins = [['home-story-night-drives-v2.png', 252, 186], ['home-soundtrack-album-v2.png', 222, 262], ['home-story-summer-roads-v2.png', 196, 348]];
  b = await layer(b, await Promise.all(pins.map(([f, x, y]) => photo(f, { x: x - 15, y: y - 15, w: 30, h: 30, r: 15 }))));
  const relive = { x: 254, y: 388, w: 120, h: 46, r: 23, kind: 'mint' };
  const top = { x: 282, y: 56, w: 92, h: 44, r: 22, kind: 'clear' };
  const side = { x: 330, y: 176, w: 44, h: 92, r: 22, kind: 'clear' };
  const sheet = { x: 0, y: 452, w: W, h: H - 452, r: 34, kind: 'sheet', topOnly: true };
  b = await layer(b, [{ input: shadows([relive, top, side, circleBtn(16, 56)].map(g => ({ ...g, o: 0.45 })).concat([{ x: 0, y: 440, w: W, h: 420, r: 34, o: 0.5 }])) }]);
  b = await glasses(b, [circleBtn(16, 56), top, side, relive, sheet], reduce);
  const tracks = [['home-story-night-drives-v2.png', 'Midnight City', 'M83', '4:18 PM'], ['home-soundtrack-album-v2.png', 'Holocene', 'Bon Iver', '4:31 PM'], ['home-story-summer-roads-v2.png', 'Dreams', 'Fleetwood Mac', '4:44 PM']];
  b = await layer(b, await Promise.all(tracks.map(([f], i) => photo(f, { x: 20, y: 736 + i * 52, w: 42, h: 42, r: 9 }))));
  b = await layer(b, [{ input: svg(`${statusBar()}
    ${ico(I.chevronL, 26, 66, { width: 2.2 })}${ico(I.share, 294, 66)}${ico(I.more, 334, 66, { width: 2.2 })}
    ${ico(I.locate, 340, 186, { size: 22 })}<path d="M340 222h24" stroke="#fff" stroke-opacity="0.2"/>${ico(I.layers, 340, 234, { size: 22 })}
    ${ico(I.play, 272, 400, { size: 20, color: '#03261c', fill: '#03261c', width: 1.4 })}${t(298, 417, 'Relive', { size: 16, weight: 700, fill: '#03261c' })}
    <rect x="175" y="462" width="40" height="5" rx="2.5" fill="#fff" opacity="0.35"/>
    ${t(20, 500, 'Pacifica to Half Moon Bay', { size: 22, weight: 700 })}
    ${t(20, 522, 'Saturday, September 20 · 4:12 – 4:58 PM', { size: 13, fill: TEXT2 })}
    ${[['28.4', 'mi', 'DISTANCE'], ['46', 'min', 'DRIVE TIME'], ['11', '', 'SONGS']].map(([v, u, l], i) => {
      const x = 20 + i * 122;
      return `${i ? `<path d="M${x - 14} 548v42" stroke="#fff" stroke-opacity="0.12"/>` : ''}${t(x, 572, v, { size: 24, weight: 700 })}${u ? t(x + v.length * 13 + 4, 572, u, { size: 13, weight: 600, fill: TEXT2 }) : ''}${t(x, 590, l, { size: 10.5, weight: 650, fill: TEXT3, ls: 1 })}`;
    }).join('')}
    <path d="M20 608h350" stroke="#fff" stroke-opacity="0.1"/>
    <circle cx="27" cy="630" r="5" fill="none" stroke="#fff" stroke-width="2"/><path d="M27 637v26" stroke="#fff" stroke-opacity="0.3" stroke-width="2" stroke-dasharray="2 4"/><circle cx="27" cy="670" r="5" fill="${TEXT}"/>
    ${t(44, 635, 'Pacifica', { size: 15, weight: 600 })}${t(370, 635, '4:12 PM', { size: 13, fill: TEXT2, anchor: 'end' })}
    ${t(44, 675, 'Half Moon Bay', { size: 15, weight: 600 })}${t(370, 675, '4:58 PM', { size: 13, fill: TEXT2, anchor: 'end' })}
    ${t(20, 718, 'SOUNDTRACK', { size: 11.5, weight: 700, fill: TEXT3, ls: 1.2 })}${t(370, 718, 'Show all 11', { size: 13, weight: 600, fill: TEXT2, anchor: 'end' })}
    ${tracks.map(([, track, artist, time], i) => `${t(74, 753 + i * 52, track, { size: 15, weight: 600 })}${t(74, 771 + i * 52, artist, { size: 12.5, fill: TEXT2 })}${t(370, 762 + i * 52, time, { size: 12.5, fill: TEXT3, anchor: 'end' })}`).join('')}
    ${homeIndicator}`) }]);
  return b;
}

async function memories({ reduce = false } = {}) {
  let b = await sceneBase('memories');
  const cards = [['cinematic-home-morning-photo-v1.jpg', 'Open road weekend', '3 journeys · 214 mi · Sep 2026'], ['theme-sakura-road-v1.png', 'Spring blossoms', '2 journeys · 48 mi · Apr 2026']].map(([file, title, meta], i) => ({ file, title, meta, x: 16 + i * 272, y: 148, w: 260, h: 192, r: 24 }));
  const routes = [{ x: 16, y: 408, w: 173, h: 84, r: 22, title: 'Coast Highway', meta: '12 drives' }, { x: 201, y: 408, w: 173, h: 84, r: 22, title: 'Skyline loop', meta: '7 drives' }];
  const list = { x: 16, y: 534, w: 358, h: 320, r: 24, kind: 'frosted' };
  const rows = [['cinematic-journey-photo-v1.jpg', 'Pacifica to Half Moon Bay', 'Sat, Sep 20 · 11 songs', '28.4 mi'], ['cinematic-home-afternoon-photo-v1.jpg', 'Morning commute', 'Fri, Sep 19 · 6 songs', '14.2 mi'], ['onboarding-grand-touring-blue-hour.jpg', 'Blue hour to the city', 'Thu, Sep 18 · 9 songs', '22.7 mi'], ['cinematic-home-night-photo-v1.jpg', 'Late drive home', 'Wed, Sep 17 · 4 songs', '9.8 mi']];
  b = await layer(b, [{ input: shadows([...cards, ...routes, list].map(g => ({ ...g, o: 0.3 }))) }]);
  b = await glasses(b, [circleBtn(282, 58), circleBtn(334, 58), ...routes.map(g => ({ ...g, kind: 'frosted' })), list], reduce);
  b = await layer(b, await Promise.all(cards.map(c => photo(c.file, c))));
  b = await glasses(b, cards.map(c => ({ x: c.x + 8, y: c.y + c.h - 64, w: c.w - 16, h: 56, r: 17, kind: 'frosted' })), reduce);
  b = await layer(b, await Promise.all(rows.map(([f], i) => photo(f, { x: 30, y: 548 + i * 76, w: 52, h: 52, r: 12 }))));
  b = await layer(b, [{ input: svg(`${statusBar()}
    ${t(16, 104, 'Memories', { size: 34, weight: 700 })}
    ${ico(I.search, 292, 68)}${ico(I.plus, 344, 68, { width: 2 })}
    ${t(16, 136, 'MEMORIES', { size: 11.5, weight: 700, fill: TEXT3, ls: 1.2 })}
    ${cards.map(c => `${t(c.x + 22, c.y + c.h - 38, c.title, { size: 16, weight: 700 })}${t(c.x + 22, c.y + c.h - 19, c.meta, { size: 12.5, fill: TEXT2 })}`).join('')}
    ${t(16, 372, 'FAVORITE ROUTES', { size: 11.5, weight: 700, fill: TEXT3, ls: 1.2 })}
    ${t(16, 396, 'Roads you return to', { size: 20, weight: 700 })}
    ${routes.map((g, i) => `<path d="${i ? `M${g.x + 18} ${g.y + 40} c10 -22 30 -22 34 -4 s22 14 32 -10` : `M${g.x + 18} ${g.y + 22} c14 4 10 18 24 18 s12 -14 26 -10 s12 14 24 10`}" stroke="#fff" stroke-opacity="0.75" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${t(g.x + 16, g.y + 62, g.title, { size: 14.5, weight: 650 })}${t(g.x + 16, g.y + 78, g.meta, { size: 12, fill: TEXT2 })}`).join('')}
    ${t(16, 522, 'JOURNEY LIBRARY', { size: 11.5, weight: 700, fill: TEXT3, ls: 1.2 })}
    ${rows.map(([, title, meta, miles], i) => `${i ? `<path d="M96 ${534 + i * 76}h264" stroke="#fff" stroke-opacity="0.09"/>` : ''}${t(96, 570 + i * 76, title, { size: 15, weight: 600 })}${t(96, 589 + i * 76, meta, { size: 12.5, fill: TEXT2 })}${t(360, 579 + i * 76, miles, { size: 13, weight: 600, fill: TEXT2, anchor: 'end' })}`).join('')}`) }]);
  b = await glasses(b, [{ ...TAB, kind: 'clear' }], reduce);
  return layer(b, [{ input: svg(tabBarOverlay('Memories') + homeIndicator) }]);
}

async function settings({ reduce = false } = {}) {
  let b = await sceneBase('settings');
  const profile = { x: 16, y: 124, w: 358, h: 84, r: 24, kind: 'frosted' };
  const group = { x: 16, y: 228, w: 358, h: 7 * 54, r: 24, kind: 'frosted' };
  const rows = [['Account & iCloud', I.cloud, ''], ['Appearance', I.brush, 'Aurora Glass'], ['Achievements', I.medal, ''], ['Membership & Support', I.shield, 'Pro'], ['Music & Connections', I.music, 'Apple Music'], ['Recording & Location', I.pin, 'Automatic'], ['Saved Places', I.house, '3']];
  b = await layer(b, [{ input: shadows([profile, group].map(g => ({ ...g, o: 0.3 }))) }]);
  b = await glasses(b, [circleBtn(334, 58), profile, group], reduce);
  b = await layer(b, [{ input: svg(`${statusBar()}
    ${t(16, 104, 'Settings', { size: 34, weight: 700 })}${ico(I.search, 344, 68)}
    <circle cx="60" cy="166" r="26" fill="#fff" fill-opacity="0.14" stroke="#fff" stroke-opacity="0.3"/>${t(60, 172, 'PS', { size: 17, weight: 700, anchor: 'middle' })}
    ${t(100, 158, 'Patrick Stewart', { size: 18, weight: 700 })}${t(100, 177, 'Signed in with Apple', { size: 13, fill: TEXT2 })}
    <circle cx="104" cy="191" r="3.5" fill="${MINT}"/>${t(113, 195, 'iCloud sync up to date', { size: 12, fill: TEXT2 })}
    ${ico(I.chevronR, 344, 155, { size: 18, color: TEXT3, width: 2 })}
    ${rows.map(([label, icon, value], i) => {
      const y = 228 + i * 54;
      return `${i ? `<path d="M74 ${y}h300" stroke="#fff" stroke-opacity="0.09"/>` : ''}<rect x="32" y="${y + 11}" width="32" height="32" rx="9" fill="#fff" fill-opacity="0.12"/>
        ${ico(icon, 38, y + 17, { size: 20, width: 1.6 })}${t(78, y + 33, label, { size: 15.5, weight: 500 })}
        ${value ? t(346, y + 33, value, { size: 14, fill: TEXT2, anchor: 'end' }) : ''}${ico(I.chevronR, 348, y + 19, { size: 16, color: TEXT3, width: 2 })}`;
    }).join('')}
    ${ico(I.shield, 16, 628, { size: 18, color: TEXT2 })}${t(40, 642, 'Private by design', { size: 13.5, weight: 650, fill: TEXT2 })}
    ${t(16, 664, 'Your journeys stay on this iPhone and in your private iCloud.', { size: 12.5, fill: TEXT3 })}`) }]);
  b = await glasses(b, [{ ...TAB, kind: 'clear' }], reduce);
  return layer(b, [{ input: svg(tabBarOverlay('Settings') + homeIndicator) }]);
}

// ---------- Output ----------
const screens = [['home', home], ['journey', journey], ['memories', memories], ['settings', settings]];
const rendered = [];
for (const [name, fn] of screens) {
  const png = await fn();
  await sharp(png).toFile(out(`v4-aurora-glass-${name}.png`));
  rendered.push(png);
  console.log(`v4-aurora-glass-${name}.png`);
}
await sharp(await home({ reduce: true })).toFile(out('v4-aurora-glass-home-reduce-transparency.png'));
console.log('v4-aurora-glass-home-reduce-transparency.png');

// Review board: four screens side by side with material legend.
const tw = W * 1.5, th = H * 1.5, gap = 56, bw = tw * 4 + gap * 5, bh = th + 240;
const thumbs = await Promise.all(rendered.map(async png => {
  const small = await sharp(png).resize(Math.round(tw), Math.round(th)).png().toBuffer();
  return sharp(small).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(tw)}" height="${Math.round(th)}"><rect width="100%" height="100%" rx="64" fill="#fff"/></svg>`), blend: 'dest-in' }]).png().toBuffer();
}));
const labels = ['Home', 'Journey detail', 'Memories', 'Settings'];
const legend = [['Clear glass', 'tab bar · header buttons · map controls'], ['Frosted glass', 'metrics · lists · sheets'], ['Mint', 'one primary action per screen'], ['Crisp content', 'photos · album art · maps']];
const board = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}">
  <rect width="100%" height="100%" fill="#060b16"/>
  <text x="${gap}" y="84" font-family="${FONT}" font-size="44" font-weight="700" fill="${TEXT}">Aurora Glass — matched screens</text>
  <text x="${gap}" y="128" font-family="${FONT}" font-size="22" fill="${TEXT2}">V4 design direction · mockup only · placeholder data</text>
  ${labels.map((l, i) => `<text x="${gap + i * (tw + gap)}" y="200" font-family="${FONT}" font-size="26" font-weight="650" fill="${TEXT}">${l}</text>`).join('')}
  ${legend.map(([a, d], i) => `<circle cx="${bw - gap - 1260 + i * 320}" cy="${120}" r="8" fill="${i === 2 ? MINT : i === 3 ? '#e8b36b' : '#fff'}" fill-opacity="${i === 1 ? 0.45 : 1}"/><text x="${bw - gap - 1242 + i * 320}" y="112" font-family="${FONT}" font-size="20" font-weight="650" fill="${TEXT}">${a}</text><text x="${bw - gap - 1242 + i * 320}" y="138" font-family="${FONT}" font-size="16" fill="${TEXT3}">${d}</text>`).join('')}
</svg>`);
await sharp(board).composite(thumbs.map((input, i) => ({ input, left: Math.round(gap + i * (tw + gap)), top: 220 }))).png().toFile(out('v4-aurora-glass-board.png'));
console.log('v4-aurora-glass-board.png');

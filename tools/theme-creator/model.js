export const roles = [
  ['base', 'Base background', '#09182f', 'Page canvas on every screen, Home background, and map land. Maps to page / chrome.'],
  ['card', 'Card surfaces', '#0b1b33', 'Memory and journey cards, soundtrack panels, metric cards, and recorder panels. Maps to card.'],
  ['raised', 'Controls & navigation', '#213d65', 'Tab bar, back and overflow buttons, icon badges, map water and controls. Maps to inset.'],
  ['border', 'Borders & dividers', '#aab6c6', 'Card outlines, photo frames, pills, tab outlines, internal dividers, and subtle decorative rings. Maps to line, with varied opacity.'],
  ['text', 'Primary text & icons', '#f6f0e2', 'Page titles, main labels, metric values, inactive tab icons, map roads, and photo-overlay titles. Maps to text.'],
  ['muted', 'Secondary text & icons', '#afbaca', 'Descriptions, artists, dates, units, chevrons, metadata, map labels and secondary roads. Maps to muted.'],
  ['accent', 'Highlights & actions', '#d5b257', 'Primary action fills, gold headings, counts, selected tab icons, ready beacon, route line and song-pin outlines. Maps to accent / amber.'],
  ['onAccent', 'Text on action buttons', '#081832', 'Labels and icons inside filled primary actions, including End Journey and Relive this journey. Maps to onAccent.'],
  ['active', 'Active & recording', '#12325a', 'Selected tab pill, recording beacon core and rings, section markers, and map song-pin fills. Maps to active / blue.'],
  ['glow', 'Atmosphere & glow', '#b9a567', 'Ambient page light, card halos, ready/recording beacon glow, and route glow. Uses this color at low opacity.'],
];
export const defaults = Object.fromEntries(roles.map(([key,,color]) => [key, color]));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function normalizeHex(value) { const s = String(value).trim(); const v = s.startsWith('#') ? s : '#' + s; if (/^#[\da-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map(c=>c+c).join('').toLowerCase(); return /^#[\da-f]{6}$/i.test(v) ? v.toLowerCase() : null; }
export function rgb(hex) { return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)); }
export function fromRgb(values) { return '#' + values.map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join(''); }
export function toHsv(hex) { const [r,g,b] = rgb(hex).map(n=>n/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min; let h=0; if(d) h=(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4)*60; return [h,max===0?0:d/max,max]; }
export function fromHsv(h,s,v) { const c=v*s, x=c*(1-Math.abs(h/60%2-1)), m=v-c, i=Math.floor((h%360)/60); return fromRgb([[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][i].map(n=>(n+m)*255)); }
export function validatePalette(value) { if (!value || typeof value !== 'object') throw Error('Choose a JourneyDeck palette JSON file.'); return Object.fromEntries(roles.map(([key])=>{ const color=normalizeHex(value[key]); if(!color) throw Error(`Missing or invalid ${key} color.`); return [key,color]; })); }

// Snapshot of mobile/recorder/src/theme-catalog.ts (2026-09-17).
// The app palette is consolidated into the editor's ten roles.
export const builtinPresets = [
  {
    "id": "dark",
    "name": "Cinematic Dark",
    "palette": {
      "base": "#08070d",
      "card": "#120d1a",
      "raised": "#291735",
      "border": "#49304f",
      "text": "#fff6ed",
      "muted": "#b6a6c1",
      "accent": "#c5a0f4",
      "onAccent": "#201428",
      "active": "#55b9ff",
      "glow": "#c5a0f4"
    }
  },
  {
    "id": "redline",
    "name": "Grand Touring",
    "palette": {
      "base": "#081832",
      "card": "#203a63",
      "raised": "#132d55",
      "border": "#b6bfcc",
      "text": "#f6f0e2",
      "muted": "#b6bfcc",
      "accent": "#d4b15a",
      "onAccent": "#081832",
      "active": "#6fa5f0",
      "glow": "#d4b15a"
    }
  },
  {
    "id": "midnight-canopy",
    "name": "Autumn Drive",
    "palette": {
      "base": "#162f13",
      "card": "#206722",
      "raised": "#590000",
      "border": "#ffd000",
      "text": "#ffffff",
      "muted": "#ffffff",
      "accent": "#ffa600",
      "onAccent": "#000000",
      "active": "#590000",
      "glow": "#ff7600"
    }
  },
  {
    "id": "light",
    "name": "Warm Ivory",
    "palette": {
      "base": "#fffaf0",
      "card": "#fffcf6",
      "raised": "#eee2ef",
      "border": "#d8c5ba",
      "text": "#291d26",
      "muted": "#685461",
      "accent": "#754487",
      "onAccent": "#ffffff",
      "active": "#326d9b",
      "glow": "#754487"
    }
  },
  {
    "id": "sakura",
    "name": "Rosewater",
    "palette": {
      "base": "#fff4f7",
      "card": "#f5dfe7",
      "raised": "#f9e9ee",
      "border": "#c799aa",
      "text": "#38252b",
      "muted": "#6c4c58",
      "accent": "#b52b59",
      "onAccent": "#ffffff",
      "active": "#79566f",
      "glow": "#b52b59"
    }
  }
];

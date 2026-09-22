/** Soft navy frost for stop/review chrome over imagery. Never milky white. */

export const NAVY_FROST = Object.freeze({
  /** Solid navy when Reduce Transparency is on, or when blur is unavailable. */
  solid: '#0B1830',
  /** Soft navy wash over live or still imagery — readable, still see-through. */
  tint: 'rgba(8,24,50,0.52)',
  edge: 'rgba(142,180,232,0.18)',
  ink: '#F4F1EA',
  muted: '#B7C2D6',
  accent: '#8EB4E8',
  /** Skia BackdropBlur radius for stills. Soft, not glassy-white. */
  skiaBlur: 18,
  /** expo-blur intensity for live native backdrops (maps, photographs). */
  blurIntensity: 36,
});

export type NavyFrostMaterial = 'blur' | 'solid';
export type NativeSheetSurface = 'opaque' | 'frost';
export type NativeSheetAnimation = 'slide' | 'none';

export function navyFrostMaterial(input: { reduceTransparency: boolean }): NavyFrostMaterial {
  return input.reduceTransparency ? 'solid' : 'blur';
}

export function navyFrostIsMilky(color: string) {
  const rgb = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    const red = Number(rgb[1]), green = Number(rgb[2]), blue = Number(rgb[3]);
    return red > 210 && green > 210 && blue > 210;
  }
  const hex = color.match(/^#([\da-f]{6})$/i)?.[1];
  if (!hex) return false;
  const red = parseInt(hex.slice(0, 2), 16), green = parseInt(hex.slice(2, 4), 16), blue = parseInt(hex.slice(4, 6), 16);
  return red > 210 && green > 210 && blue > 210;
}

/** Opaque page sheets keep the existing UIKit presentation. Frost sits over imagery. */
export function nativeSheetModalProps(input: {
  surface: NativeSheetSurface;
  reduceMotion: boolean;
  animateChrome: boolean;
}): {
  presentationStyle: 'pageSheet' | 'overFullScreen';
  transparent: boolean;
  animationType: NativeSheetAnimation;
} {
  if (input.surface !== 'frost') {
    return { presentationStyle: 'pageSheet', transparent: false, animationType: 'slide' };
  }
  return {
    presentationStyle: 'overFullScreen',
    transparent: true,
    animationType: input.reduceMotion || !input.animateChrome ? 'none' : 'slide',
  };
}

"""Generate the Aurora Glass app icons from the existing JourneyDeck pulse mark.

The ring-and-pulse symbol is lifted from the Grand Touring dark-appearance icon
(gold on pure black), so its shape, bevel and shading match every other icon.
Its gold is remapped to Aurora mint and set on the theme's midnight sky.

  python scripts/generate-aurora-glass-icon.py

Writes assets/icon-aurora-glass-v1.png (light) and
assets/icon-aurora-glass-dark-v1.png (iOS dark appearance: mark on black).
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'icon-grand-touring-dark-v1.png'
SIZE = 1024

# Aurora Glass palette (src/theme-catalog.ts).
SKY_TOP = np.array([0x0b, 0x1a, 0x33], float)
SKY_BOTTOM = np.array([0x05, 0x0b, 0x18], float)
MINT = np.array([0x5f, 0xf2, 0xc4], float)
SKY_GAIN = 1.9
VIOLET = np.array([0x8a, 0x5c, 0xff], float)
# Mint ramp for the mark, from shadowed bevel to specular highlight.
RAMP = [(0.0, np.array([0x0c, 0x7a, 0x63], float)), (0.35, np.array([0x3f, 0xdc, 0xb0], float)),
        (0.65, np.array([0x7f, 0xf7, 0xd4], float)), (1.0, np.array([0xf0, 0xff, 0xfa], float))]


def mark(source: np.ndarray):
    """Alpha and 0..1 shading of the pulse mark, cut from its black background."""
    peak = source.max(axis=2)
    alpha = np.clip((peak - 18.0) / 70.0, 0.0, 1.0)
    luma = source @ np.array([0.299, 0.587, 0.114])
    inside = alpha > 0.9
    lo, hi = np.percentile(luma[inside], [2, 99.5])
    shade = np.clip((luma - lo) / (hi - lo), 0.0, 1.0) ** 1.2
    # Light from the upper left, as on the other icons: brighten that side of the bevel.
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    light = np.clip(1.15 - (x + y) / (2 * SIZE) * 0.5, 0.0, 1.2)
    shade = np.clip(shade * light, 0.0, 1.0)
    # Soften the cut edge by a fraction of a pixel so the ring stays crisp but not stepped.
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7)), float) / 255
    return alpha, shade


def ramp(shade: np.ndarray) -> np.ndarray:
    out = np.zeros(shade.shape + (3,))
    for (s0, c0), (s1, c1) in zip(RAMP, RAMP[1:]):
        band = (shade >= s0) & (shade <= s1)
        t = ((shade - s0) / (s1 - s0))[band][:, None]
        out[band] = c0 * (1 - t) + c1 * t
    return out


def glow(center, radius, color, strength):
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    d = np.hypot(x - center[0], y - center[1]) / radius
    return np.exp(-d ** 2)[..., None] * color * strength


def sky() -> np.ndarray:
    t = np.linspace(0, 1, SIZE)[:, None, None]
    base = SKY_TOP * (1 - t) + SKY_BOTTOM * t
    base = np.broadcast_to(base, (SIZE, SIZE, 3)).copy()
    # Aurora: a mint curtain across the upper left and a violet haze to the upper right,
    # soft enough to read as light behind glass, like the other icons' corner highlight.
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(float)
    curtain_center = 250 + 90 * np.sin(x / SIZE * np.pi * 1.6 + 0.4)
    curtain = np.exp(-((y - curtain_center) / 120.0) ** 2) * np.clip(1.2 - x / SIZE, 0, 1)
    base += curtain[..., None] * MINT * 0.16
    base += glow((860, 150), 380, VIOLET, 0.20)
    base += glow((150, 120), 300, MINT, 0.10)
    # Lifted so the sky reads on the Home Screen instead of looking black; hues are unchanged.
    return base * SKY_GAIN


def compose(background: np.ndarray, alpha: np.ndarray, color: np.ndarray, halo: float) -> Image.Image:
    halo_mask = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(28)), float) / 255
    out = background + halo_mask[..., None] * MINT * halo
    out = out * (1 - alpha[..., None]) + color * alpha[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')


def main():
    source = np.asarray(Image.open(SOURCE).convert('RGB'), float)
    alpha, shade = mark(source)
    color = ramp(shade)
    compose(sky(), alpha, color, halo=0.22).save(ROOT / 'assets' / 'icon-aurora-glass-v1.png', optimize=True)
    compose(np.zeros((SIZE, SIZE, 3)), alpha, color, halo=0.10).save(ROOT / 'assets' / 'icon-aurora-glass-dark-v1.png', optimize=True)


if __name__ == '__main__':
    main()

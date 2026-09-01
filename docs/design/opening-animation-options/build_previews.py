from __future__ import annotations

import argparse
import math
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
SOURCE_ASSETS = ROOT.parents[2] / "mobile" / "recorder" / "assets"

WIDTH = 480
HEIGHT = 1040
FRAME_COUNT = 50
FRAME_DURATION_MS = 50

FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_SEMIBOLD = Path(r"C:\Windows\Fonts\seguisb.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

COLORS = {
    "white": (247, 244, 252),
    "muted": (195, 185, 205),
    "orange": (255, 132, 66),
    "coral": (255, 82, 103),
    "violet": (175, 83, 255),
    "cyan": (79, 207, 255),
}


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, value))


def ease_out_cubic(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def phase(time_seconds: float, start: float, end: float) -> float:
    return clamp((time_seconds - start) / (end - start))


def fit_background(path: Path, scale: float = 1.0, y_shift: int = 0) -> Image.Image:
    image = Image.open(path).convert("RGB")
    target = ImageOps.fit(image, (round(WIDTH * scale), round(HEIGHT * scale)), method=Image.Resampling.LANCZOS)
    left = max(0, (target.width - WIDTH) // 2)
    top = max(0, (target.height - HEIGHT) // 2 + y_shift)
    top = min(top, max(0, target.height - HEIGHT))
    return target.crop((left, top, left + WIDTH, top + HEIGHT))


@lru_cache(maxsize=1)
def soft_vignette() -> Image.Image:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    for inset in range(0, 116, 4):
        alpha = round(255 * ((116 - inset) / 116) ** 2 * 0.48)
        draw.rounded_rectangle((inset, inset, WIDTH - inset, HEIGHT - inset), radius=120, outline=alpha, width=8)
    vignette = Image.new("RGBA", (WIDTH, HEIGHT), (2, 1, 7, 0))
    vignette.putalpha(mask)
    return vignette


@lru_cache(maxsize=8)
def dark_gradient(top_alpha: int = 76, bottom_alpha: int = 130) -> Image.Image:
    alpha = Image.new("L", (1, HEIGHT))
    alpha.putdata([
        round(top_alpha + (bottom_alpha - top_alpha) * y / (HEIGHT - 1))
        for y in range(HEIGHT)
    ])
    alpha = alpha.resize((WIDTH, HEIGHT))
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (3, 1, 9, 0))
    overlay.putalpha(alpha)
    return overlay


def glow_layer(source: Image.Image, radius: float, opacity: float = 1.0) -> Image.Image:
    glow = source.filter(ImageFilter.GaussianBlur(radius))
    if opacity < 1:
        alpha = glow.getchannel("A").point(lambda value: round(value * opacity))
        glow.putalpha(alpha)
    return glow


def draw_partial_polyline(layer: Image.Image, points: list[tuple[int, int]], progress: float, color: tuple[int, int, int], width: int) -> None:
    if progress <= 0:
        return
    lengths: list[float] = []
    total = 0.0
    for first, second in zip(points, points[1:]):
        segment = math.dist(first, second)
        lengths.append(segment)
        total += segment
    remaining = total * clamp(progress)
    visible = [points[0]]
    for index, length in enumerate(lengths):
        if remaining >= length:
            visible.append(points[index + 1])
            remaining -= length
            continue
        if remaining > 0:
            start = points[index]
            end = points[index + 1]
            amount = remaining / length
            visible.append((round(start[0] + (end[0] - start[0]) * amount), round(start[1] + (end[1] - start[1]) * amount)))
        break
    if len(visible) >= 2:
        ImageDraw.Draw(layer).line(visible, fill=color + (255,), width=width, joint="curve")


def paste_center(base: Image.Image, overlay: Image.Image, center: tuple[int, int], opacity: float = 1.0) -> None:
    if opacity <= 0:
        return
    overlay = overlay.copy()
    if opacity < 1:
        overlay.putalpha(overlay.getchannel("A").point(lambda value: round(value * opacity)))
    base.alpha_composite(overlay, (round(center[0] - overlay.width / 2), round(center[1] - overlay.height / 2)))


def logo_asset(size: int) -> Image.Image:
    icon = Image.open(SOURCE_ASSETS / "icon.png").convert("RGBA")
    return icon.resize((size, size), Image.Resampling.LANCZOS)


def text_layer(text: str, font: ImageFont.FreeTypeFont, fill: tuple[int, int, int, int], tracking: int = 0) -> Image.Image:
    if tracking == 0:
        box = font.getbbox(text)
        image = Image.new("RGBA", (box[2] - box[0] + 8, box[3] - box[1] + 8))
        ImageDraw.Draw(image).text((4 - box[0], 4 - box[1]), text, font=font, fill=fill)
        return image
    widths = [font.getlength(letter) for letter in text]
    width = round(sum(widths) + tracking * max(0, len(text) - 1)) + 8
    box = font.getbbox(text)
    image = Image.new("RGBA", (width, box[3] - box[1] + 8))
    draw = ImageDraw.Draw(image)
    x = 4.0
    for letter, letter_width in zip(text, widths):
        draw.text((x, 4 - box[1]), letter, font=font, fill=fill)
        x += letter_width + tracking
    return image


def brand_lockup(frame: Image.Image, time_seconds: float, center_y: int, start: float, scale_bias: float = 1.0) -> None:
    logo_progress = ease_out_cubic(phase(time_seconds, start, start + 0.42))
    wordmark_progress = ease_out_cubic(phase(time_seconds, start + 0.22, start + 0.67))
    tagline_progress = ease_out_cubic(phase(time_seconds, start + 0.48, start + 0.88))

    watermark = logo_asset(272).convert("RGBA")
    watermark_alpha = round(20 * logo_progress)
    watermark.putalpha(watermark.getchannel("A").point(lambda value: round(value * watermark_alpha / 255)))
    paste_center(frame, watermark, (WIDTH // 2, center_y - 2), 1)

    icon_size = max(1, round((78 + 20 * logo_progress) * scale_bias))
    icon = logo_asset(icon_size)
    icon_shadow = glow_layer(icon, 24, 0.78)
    icon_y = round(center_y - 54 + (1 - logo_progress) * 18)
    paste_center(frame, icon_shadow, (WIDTH // 2, icon_y), logo_progress)
    paste_center(frame, icon, (WIDTH // 2, icon_y), logo_progress)

    journey_font = ImageFont.truetype(FONT_BOLD, round(38 * scale_bias))
    journey = text_layer("Journey", journey_font, COLORS["orange"] + (255,))
    deck = text_layer("Deck", journey_font, COLORS["coral"] + (255,))
    wordmark = Image.new("RGBA", (journey.width + deck.width - 7, max(journey.height, deck.height)))
    wordmark.alpha_composite(journey)
    wordmark.alpha_composite(deck, (journey.width - 7, 0))
    paste_center(frame, glow_layer(wordmark, 18, 0.72), (WIDTH // 2, center_y + 38), wordmark_progress)
    paste_center(frame, wordmark, (WIDTH // 2, center_y + 38), wordmark_progress)

    tagline_font = ImageFont.truetype(FONT_REGULAR, round(17 * scale_bias))
    tagline = text_layer("Your drive, remembered.", tagline_font, COLORS["white"] + (255,), tracking=1)
    paste_center(frame, tagline, (WIDTH // 2, center_y + 88), tagline_progress)

    private_font = ImageFont.truetype(FONT_SEMIBOLD, round(9 * scale_bias))
    private = text_layer("PRIVATE  •  PERSONAL  •  YOURS", private_font, COLORS["muted"] + (255,), tracking=2)
    paste_center(frame, private, (WIDTH // 2, HEIGHT - 58), ease_out_cubic(phase(time_seconds, start + 0.62, start + 1.02)))


def add_noise(frame: Image.Image, frame_index: int, opacity: int = 7) -> None:
    noise = Image.effect_noise((WIDTH, HEIGHT), 18 + frame_index % 5).convert("L")
    noise = ImageEnhance.Contrast(noise).enhance(0.7)
    noise_layer = Image.merge("RGBA", (noise, noise, noise, noise.point(lambda value: opacity)))
    frame.alpha_composite(noise_layer)


def option_one_frame(index: int) -> Image.Image:
    time_seconds = index * FRAME_DURATION_MS / 1000
    background = fit_background(ASSETS / "option-1-road-awakens.png", 1.075 - 0.075 * ease_in_out(time_seconds / 2.5))
    frame = background.convert("RGBA")
    frame.alpha_composite(dark_gradient(92, 142))

    route = Image.new("RGBA", (WIDTH, HEIGHT))
    points = [(244, 1048), (225, 930), (251, 814), (314, 696), (281, 594), (218, 490), (286, 380), (327, 292)]
    reveal = ease_in_out(phase(time_seconds, 0.08, 1.18))
    draw_partial_polyline(route, points, reveal, COLORS["coral"], 4)
    trace_opacity = 1 - ease_in_out(phase(time_seconds, 1.04, 1.6))
    frame.alpha_composite(glow_layer(route, 21, 0.95 * trace_opacity))
    frame.alpha_composite(glow_layer(route, 7, 0.88 * trace_opacity))
    if trace_opacity < 1:
        route.putalpha(route.getchannel("A").point(lambda value: round(value * trace_opacity)))
    frame.alpha_composite(route)
    if reveal > 0 and trace_opacity > 0:
        endpoint_index = min(len(points) - 1, round(reveal * (len(points) - 1)))
        endpoint = points[endpoint_index]
        pulse = 4 + round(8 * (0.5 + 0.5 * math.sin(time_seconds * 8)))
        pulse_layer = Image.new("RGBA", (WIDTH, HEIGHT))
        pulse_draw = ImageDraw.Draw(pulse_layer)
        pulse_draw.ellipse((endpoint[0] - pulse, endpoint[1] - pulse, endpoint[0] + pulse, endpoint[1] + pulse), outline=COLORS["orange"] + (210,), width=3)
        frame.alpha_composite(glow_layer(pulse_layer, 12, 0.9 * trace_opacity))
        pulse_layer.putalpha(pulse_layer.getchannel("A").point(lambda value: round(value * trace_opacity)))
        frame.alpha_composite(pulse_layer)

    brand_lockup(frame, time_seconds, center_y=390, start=1.02)
    frame.alpha_composite(soft_vignette())
    add_noise(frame, index)
    return frame.convert("RGB")


def option_two_frame(index: int) -> Image.Image:
    time_seconds = index * FRAME_DURATION_MS / 1000
    background = fit_background(ASSETS / "option-2-miles-become-memories.png", 1.05 - 0.05 * ease_in_out(time_seconds / 2.5), y_shift=-6)
    frame = background.convert("RGBA")
    frame.alpha_composite(dark_gradient(64, 126))

    pane_specs = [
        ([(61, 590), (205, 612), (205, 838), (60, 843)], 0.06),
        ([(290, 510), (397, 524), (395, 664), (290, 650)], 0.28),
        ([(302, 337), (437, 305), (437, 467), (302, 487)], 0.5),
    ]
    for corners, start in pane_specs:
        pane_progress = ease_out_cubic(phase(time_seconds, start, start + 0.58))
        shimmer = Image.new("RGBA", (WIDTH, HEIGHT))
        draw = ImageDraw.Draw(shimmer)
        alpha = round(150 * pane_progress)
        draw.line(corners + [corners[0]], fill=(255, 126, 114, alpha), width=2, joint="curve")
        gleam_progress = clamp(phase(time_seconds, start + 0.18, start + 0.65))
        top_left, top_right, bottom_right, bottom_left = corners
        gleam_top = (
            round(top_left[0] + (top_right[0] - top_left[0]) * gleam_progress),
            round(top_left[1] + (top_right[1] - top_left[1]) * gleam_progress),
        )
        gleam_bottom = (
            round(bottom_left[0] + (bottom_right[0] - bottom_left[0]) * gleam_progress),
            round(bottom_left[1] + (bottom_right[1] - bottom_left[1]) * gleam_progress),
        )
        draw.line((gleam_top, gleam_bottom), fill=(255, 232, 241, round(78 * pane_progress)), width=3)
        frame.alpha_composite(glow_layer(shimmer, 16, 0.8))
        frame.alpha_composite(shimmer)

    for particle_index in range(12):
        seed = particle_index * 13.7
        x = round(32 + ((seed * 37) % (WIDTH - 64)))
        base_y = HEIGHT - ((seed * 53) % (HEIGHT - 180))
        y = round(base_y - 42 * time_seconds)
        if y < 100:
            y += HEIGHT - 140
        opacity = round(72 * (0.5 + 0.5 * math.sin(time_seconds * 2.7 + seed)))
        radius = 1 + particle_index % 2
        ImageDraw.Draw(frame).ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 174, 142, opacity))

    brand_lockup(frame, time_seconds, center_y=292, start=1.0)
    frame.alpha_composite(soft_vignette())
    add_noise(frame, index)
    return frame.convert("RGB")


def record_motion_highlight(time_seconds: float) -> Image.Image:
    layer = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(layer)
    turn = -360 * time_seconds / 2.5
    record_bounds = (-58, 590, 424, 1016)
    for ring_index in range(9):
        inset = 18 + ring_index * 16
        bounds = (
            record_bounds[0] + inset,
            record_bounds[1] + round(inset * 0.62),
            record_bounds[2] - inset,
            record_bounds[3] - round(inset * 0.62),
        )
        start = turn + ring_index * 16
        color = COLORS["coral"] if ring_index % 2 == 0 else COLORS["violet"]
        draw.arc(bounds, start=start, end=start + 42, fill=color + (105,), width=2)
        draw.arc(bounds, start=start + 180, end=start + 204, fill=(255, 212, 188, 58), width=1)
    return layer


def option_three_frame(index: int) -> Image.Image:
    time_seconds = index * FRAME_DURATION_MS / 1000
    source = fit_background(ASSETS / "option-3-road-meets-soundtrack.png", 1.035, y_shift=4)
    frame = source.convert("RGBA")
    record_highlight = record_motion_highlight(time_seconds)
    frame.alpha_composite(glow_layer(record_highlight, 12, 0.72))
    frame.alpha_composite(record_highlight)
    frame.alpha_composite(dark_gradient(78, 104))

    pulse = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(pulse)
    waveform_y = 510
    progress = ease_in_out(phase(time_seconds, 0.18, 1.08))
    x_start = 74
    x_end = round(x_start + (WIDTH - 148) * progress)
    points: list[tuple[int, int]] = []
    for x in range(x_start, x_end + 1, 4):
        envelope = math.sin(math.pi * (x - x_start) / max(1, WIDTH - 148))
        amplitude = 8 + 19 * envelope
        y = waveform_y + round(math.sin((x - x_start) * 0.19 - time_seconds * 9) * amplitude)
        points.append((x, y))
    if len(points) > 1:
        draw.line(points, fill=COLORS["coral"] + (235,), width=3, joint="curve")
        frame.alpha_composite(glow_layer(pulse, 18, 0.95))
        frame.alpha_composite(glow_layer(pulse, 6, 0.9))
        frame.alpha_composite(pulse)

    brand_lockup(frame, time_seconds, center_y=282, start=0.92)
    frame.alpha_composite(soft_vignette())
    add_noise(frame, index)
    return frame.convert("RGB")


def save_animation(filename: str, frame_builder) -> None:
    frames = [frame_builder(index) for index in range(FRAME_COUNT)]
    frames[0].save(
        ROOT / filename,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        quality=82,
        method=6,
    )
    frames[-1].save(ROOT / filename.replace(".webp", "-poster.png"), optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build JourneyDeck opening-animation previews")
    parser.add_argument("--option", choices=("1", "2", "3", "all"), default="all")
    selected = parser.parse_args().option
    builders = {
        "1": ("option-1-road-awakens.webp", option_one_frame),
        "2": ("option-2-miles-become-memories.webp", option_two_frame),
        "3": ("option-3-road-meets-soundtrack.webp", option_three_frame),
    }
    choices = builders.items() if selected == "all" else [(selected, builders[selected])]
    for _, (filename, builder) in choices:
        save_animation(filename, builder)
    count = len(builders) if selected == "all" else 1
    print(f"Built {count} preview(s): {FRAME_COUNT} frames × {FRAME_DURATION_MS} ms = {FRAME_COUNT * FRAME_DURATION_MS / 1000:.1f} seconds each")

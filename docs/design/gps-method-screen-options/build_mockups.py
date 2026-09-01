from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
APP_ASSETS = ROOT.parents[2] / "mobile" / "recorder" / "assets"

W = 480
H = 1040

FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_SEMIBOLD = Path(r"C:\Windows\Fonts\seguisb.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

WHITE = (249, 246, 252)
MUTED = (177, 167, 184)
DIM = (121, 111, 128)
CORAL = (255, 105, 79)
PINK = (255, 74, 110)
VIOLET = (164, 103, 255)
MINT = (89, 222, 184)
AMBER = (255, 178, 92)


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if weight == "bold" else FONT_SEMIBOLD if weight == "semibold" else FONT_REGULAR
    return ImageFont.truetype(path, size)


def background(name: str, darken: int = 94) -> Image.Image:
    image = Image.open(ASSETS / name).convert("RGB")
    image = ImageOps.fit(image, (W, H), method=Image.Resampling.LANCZOS).convert("RGBA")
    overlay = Image.new("RGBA", (W, H), (3, 1, 8, darken))
    image.alpha_composite(overlay)
    return image


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or draw.textlength(candidate, font=face) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def paragraph(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, face: ImageFont.FreeTypeFont, fill: tuple[int, int, int], max_width: int, line_height: int) -> int:
    x, y = xy
    for line in wrap(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=fill)
        y += line_height
    return y


def tracking_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, face: ImageFont.FreeTypeFont, fill: tuple[int, int, int], spacing: float = 1.4) -> None:
    x, y = xy
    for character in text:
        draw.text((x, y), character, font=face, fill=fill)
        x += draw.textlength(character, font=face) + spacing


def glass(frame: Image.Image, box: tuple[int, int, int, int], radius: int = 24, fill=(15, 9, 23, 220), border=(210, 144, 240, 78), glow=(201, 76, 255, 55)) -> None:
    x1, y1, x2, y2 = box
    aura = Image.new("RGBA", frame.size)
    aura_draw = ImageDraw.Draw(aura)
    aura_draw.rounded_rectangle((x1 - 2, y1 - 2, x2 + 2, y2 + 2), radius=radius + 2, outline=glow, width=5)
    frame.alpha_composite(aura.filter(ImageFilter.GaussianBlur(16)))
    panel = Image.new("RGBA", frame.size)
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(box, radius=radius, fill=fill, outline=border, width=1)
    frame.alpha_composite(panel)


def gradient_button(frame: Image.Image, box: tuple[int, int, int, int], label: str) -> None:
    x1, y1, x2, y2 = box
    gradient = Image.new("RGBA", (x2 - x1, y2 - y1))
    pixels = gradient.load()
    for x in range(gradient.width):
        mix = x / max(1, gradient.width - 1)
        color = tuple(round(CORAL[index] * (1 - mix) + PINK[index] * mix) for index in range(3))
        for y in range(gradient.height):
            pixels[x, y] = color + (255,)
    mask = Image.new("L", gradient.size)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, gradient.width - 1, gradient.height - 1), radius=18, fill=255)
    glow = Image.new("RGBA", frame.size)
    ImageDraw.Draw(glow).rounded_rectangle(box, radius=18, fill=CORAL + (90,))
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))
    frame.paste(gradient, (x1, y1), mask)
    draw = ImageDraw.Draw(frame)
    face = font(15, "bold")
    bounds = draw.textbbox((0, 0), label, font=face)
    draw.text(((x1 + x2 - (bounds[2] - bounds[0])) / 2, (y1 + y2 - (bounds[3] - bounds[1])) / 2 - bounds[1]), label, font=face, fill=WHITE)


def progress_header(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame)
    icon = Image.open(APP_ASSETS / "icon.png").convert("RGBA").resize((30, 30), Image.Resampling.LANCZOS)
    frame.alpha_composite(icon, (28, 28))
    tracking_text(draw, (70, 34), "JOURNEYDECK", font(9, "bold"), (218, 205, 224), 1.2)
    tracking_text(draw, (392, 34), "02 / 04", font(9, "bold"), (180, 157, 196), 1.0)


def title_block(frame: Image.Image, top: int, compact: bool = False) -> None:
    draw = ImageDraw.Draw(frame)
    tracking_text(draw, (28, top), "GPS METHOD", font(9, "bold"), (255, 140, 111), 1.8)
    size = 35 if compact else 38
    draw.text((28, top + 19), "Choose how journeys", font=font(size, "bold"), fill=WHITE)
    draw.text((28, top + 59), "begin.", font=font(size, "bold"), fill=WHITE)
    draw.text((29, top + 109), "You can change this anytime in Settings.", font=font(13), fill=MUTED)


def home_indicator(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((187, 1016, 293, 1021), radius=3, fill=(244, 239, 247, 190))


def auto_icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], color=MINT, scale: float = 1.0) -> None:
    cx, cy = center
    for radius, alpha in ((16, 70), (10, 125)):
        width = max(1, round(2 * scale))
        draw.ellipse((cx - radius * scale, cy - radius * scale, cx + radius * scale, cy + radius * scale), outline=color + (alpha,), width=width)
    radius = round(4 * scale)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=color)


def manual_icon(draw: ImageDraw.ImageDraw, center: tuple[int, int], color=VIOLET, scale: float = 1.0) -> None:
    cx, cy = center
    radius = round(15 * scale)
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color + (170,), width=max(1, round(2 * scale)))
    inner = round(6 * scale)
    draw.ellipse((cx - inner, cy - inner, cx + inner, cy + inner), fill=color)


def check_mark(draw: ImageDraw.ImageDraw, center: tuple[int, int], color: tuple[int, int, int], scale: float = 1.0) -> None:
    cx, cy = center
    draw.line(
        (
            cx - round(5 * scale), cy,
            cx - round(1 * scale), cy + round(4 * scale),
            cx + round(6 * scale), cy - round(5 * scale),
        ),
        fill=color,
        width=max(2, round(2 * scale)),
        joint="curve",
    )


def privacy_mark(draw: ImageDraw.ImageDraw, center: tuple[int, int], color=VIOLET) -> None:
    cx, cy = center
    draw.rounded_rectangle((cx - 6, cy - 2, cx + 6, cy + 8), radius=3, outline=color, width=1)
    draw.arc((cx - 5, cy - 9, cx + 5, cy + 1), start=185, end=355, fill=color, width=2)
    draw.ellipse((cx - 1, cy + 2, cx + 1, cy + 4), fill=color)


def check_row(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, color=MINT, max_width: int = 330) -> int:
    draw.ellipse((x, y + 1, x + 20, y + 21), fill=color + (30,), outline=color + (150,), width=1)
    check_mark(draw, (x + 10, y + 11), (7, 49, 39), 0.65)
    return paragraph(draw, (x + 31, y + 1), text, font(12, "semibold"), (225, 219, 229), max_width, 17)


def caution_row(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, max_width: int = 330) -> int:
    draw.ellipse((x, y + 1, x + 20, y + 21), fill=AMBER + (25,), outline=AMBER + (140,), width=1)
    draw.line((x + 10, y + 6, x + 10, y + 13), fill=(71, 38, 13), width=2)
    draw.ellipse((x + 9, y + 16, x + 11, y + 18), fill=(71, 38, 13))
    return paragraph(draw, (x + 31, y + 1), text, font(12), (203, 194, 208), max_width, 17)


def privacy_pill(draw: ImageDraw.ImageDraw, y: int, text: str = "Route data stays on this iPhone.") -> None:
    draw.rounded_rectangle((28, y, 452, y + 42), radius=14, fill=(41, 26, 52, 210), outline=(166, 112, 212, 90), width=1)
    privacy_mark(draw, (51, y + 21), VIOLET)
    draw.text((67, y + 13), text, font=font(11, "semibold"), fill=(207, 197, 214))


def option_two() -> Image.Image:
    frame = background("option-2-windshield-road.png", 118)
    progress_header(frame)
    title_block(frame, 78, compact=True)
    draw = ImageDraw.Draw(frame)

    glass(frame, (28, 238, 452, 588), 26, fill=(12, 8, 19, 232), border=CORAL + (145,), glow=CORAL + (55,))
    draw.rounded_rectangle((46, 257, 91, 302), radius=14, fill=(63, 31, 37, 230), outline=CORAL + (145,), width=1)
    auto_icon(draw, (68, 279), CORAL, 0.86)
    tracking_text(draw, (108, 258), "SELECTED · HANDS-FREE", font(8, "bold"), MINT, 1.2)
    draw.text((108, 278), "Automatic", font=font(24, "bold"), fill=WHITE)
    draw.rounded_rectangle((387, 258, 432, 283), radius=12, fill=MINT + (28,), outline=MINT + (120,), width=1)
    check_mark(draw, (409, 271), (7, 49, 39), 0.75)
    paragraph(draw, (47, 322), "Starts when driving is detected and stops after you park.", font(13), MUTED, 378, 19)
    tracking_text(draw, (47, 380), "BENEFITS", font(8, "bold"), MINT, 1.3)
    check_row(draw, 47, 400, "No need to open JourneyDeck")
    check_row(draw, 47, 431, "Your complete route is easier to capture")
    tracking_text(draw, (47, 480), "LIMITATIONS", font(8, "bold"), AMBER, 1.3)
    caution_row(draw, 47, 500, "Always Location uses more background battery")
    caution_row(draw, 47, 531, "Detection can occasionally start late")

    glass(frame, (28, 611, 452, 728), 22, fill=(14, 9, 23, 225), border=(142, 105, 190, 100), glow=(132, 76, 225, 38))
    draw.rounded_rectangle((46, 631, 88, 673), radius=13, fill=(39, 24, 62, 230), outline=VIOLET + (135,), width=1)
    manual_icon(draw, (67, 652), VIOLET, 0.76)
    draw.text((106, 631), "Manual", font=font(20, "bold"), fill=(231, 224, 237))
    draw.text((106, 658), "Tap Start and Finish for every journey.", font=font(12), fill=MUTED)
    draw.text((106, 691), "Tap to compare", font=font(10, "semibold"), fill=(186, 143, 241))
    draw.text((421, 650), "›", font=font(24, "bold"), fill=VIOLET)

    privacy_pill(draw, 760, "Automatic needs Always Location. Your routes stay private.")
    gradient_button(frame, (28, 917, 452, 979), "Continue with Automatic")
    home_indicator(frame)
    return frame.convert("RGB")


def option_two_manual() -> Image.Image:
    frame = background("option-2-windshield-road.png", 118)
    progress_header(frame)
    title_block(frame, 78, compact=True)
    draw = ImageDraw.Draw(frame)

    glass(frame, (28, 238, 452, 355), 22, fill=(14, 9, 23, 225), border=(142, 105, 190, 100), glow=(132, 76, 225, 38))
    draw.rounded_rectangle((46, 258, 88, 300), radius=13, fill=(63, 31, 37, 230), outline=CORAL + (135,), width=1)
    auto_icon(draw, (67, 279), CORAL, 0.76)
    draw.text((106, 258), "Automatic", font=font(20, "bold"), fill=(231, 224, 237))
    draw.text((106, 285), "Starts when driving is detected.", font=font(12), fill=MUTED)
    draw.text((106, 318), "Tap to compare", font=font(10, "semibold"), fill=(218, 137, 119))
    draw.text((421, 277), "›", font=font(24, "bold"), fill=CORAL)

    glass(frame, (28, 378, 452, 760), 26, fill=(12, 8, 19, 232), border=VIOLET + (145,), glow=VIOLET + (55,))
    draw.rounded_rectangle((46, 397, 91, 442), radius=14, fill=(39, 24, 62, 230), outline=VIOLET + (145,), width=1)
    manual_icon(draw, (68, 419), VIOLET, 0.86)
    tracking_text(draw, (108, 398), "SELECTED · YOU'RE IN CONTROL", font(8, "bold"), MINT, 1.05)
    draw.text((108, 418), "Manual Recording", font=font(22, "bold"), fill=WHITE)
    draw.rounded_rectangle((387, 398, 432, 423), radius=12, fill=MINT + (28,), outline=MINT + (120,), width=1)
    check_mark(draw, (409, 411), (7, 49, 39), 0.75)
    paragraph(draw, (47, 458), "Tap Start when your journey begins and Finish when you're done.", font(12), MUTED, 375, 18)

    tracking_text(draw, (47, 507), "BENEFITS", font(8, "bold"), MINT, 1.3)
    check_row(draw, 47, 526, "Every journey starts only when you choose", max_width=335)
    check_row(draw, 47, 556, "Lower background battery use", max_width=335)
    check_row(draw, 47, 586, "Apple Music can still add your soundtrack afterward", max_width=335)

    tracking_text(draw, (47, 627), "LIMITATIONS", font(8, "bold"), AMBER, 1.3)
    caution_row(draw, 47, 646, "Nothing before you tap Start can be recovered", max_width=335)
    caution_row(draw, 47, 676, "You must remember to finish the journey", max_width=335)
    caution_row(draw, 47, 706, "Only interact with the controls when it's safe", max_width=335)

    privacy_pill(draw, 782, "Location recording runs only after you tap Start.")
    gradient_button(frame, (28, 917, 452, 979), "Continue with Manual")
    home_indicator(frame)
    return frame.convert("RGB")


if __name__ == "__main__":
    option_two().save(ROOT / "option-2-expanded-choices.png", optimize=True)
    option_two_manual().save(ROOT / "option-2-manual-expanded.png", optimize=True)
    print("Built selected JourneyDeck GPS-method screen mockups")

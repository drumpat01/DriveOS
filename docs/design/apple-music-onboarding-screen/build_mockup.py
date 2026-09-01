from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
GPS_ASSETS = REPO / "docs" / "design" / "gps-method-screen-options" / "assets"
APP_ASSETS = REPO / "mobile" / "recorder" / "assets"

W = 480
H = 1040

FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_SEMIBOLD = Path(r"C:\Windows\Fonts\seguisb.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")

WHITE = (249, 246, 252)
MUTED = (187, 177, 193)
CORAL = (255, 105, 79)
PINK = (255, 55, 104)
MINT = (89, 222, 184)


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if weight == "bold" else FONT_SEMIBOLD if weight == "semibold" else FONT_REGULAR
    return ImageFont.truetype(path, size)


def tracking_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    spacing: float = 1.4,
) -> None:
    x, y = xy
    for character in text:
        draw.text((x, y), character, font=face, fill=fill)
        x += draw.textlength(character, font=face) + spacing


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


def paragraph(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    face: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_height: int,
) -> int:
    x, y = xy
    for line in wrap(draw, text, face, max_width):
        draw.text((x, y), line, font=face, fill=fill)
        y += line_height
    return y


def base_background() -> Image.Image:
    image = Image.open(GPS_ASSETS / "option-2-windshield-road.png").convert("RGB")
    image = ImageOps.fit(image, (W, H), method=Image.Resampling.LANCZOS).convert("RGBA")
    image.alpha_composite(Image.new("RGBA", (W, H), (2, 1, 8, 108)))
    return image


def glass_panel(frame: Image.Image, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    glow = Image.new("RGBA", frame.size)
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (x1 - 2, y1 - 2, x2 + 2, y2 + 2),
        radius=30,
        outline=CORAL + (105,),
        width=5,
    )
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(18)))

    panel = Image.new("RGBA", frame.size)
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(
        box,
        radius=28,
        fill=(11, 7, 18, 236),
        outline=(255, 117, 94, 150),
        width=1,
    )
    frame.alpha_composite(panel)


def progress_header(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame)
    icon = Image.open(APP_ASSETS / "icon.png").convert("RGBA").resize((30, 30), Image.Resampling.LANCZOS)
    frame.alpha_composite(icon, (28, 28))
    tracking_text(draw, (70, 34), "JOURNEYDECK", font(9, "bold"), (218, 205, 224), 1.2)
    tracking_text(draw, (392, 34), "03 / 04", font(9, "bold"), (180, 157, 196), 1.0)


def check_row(draw: ImageDraw.ImageDraw, y: int, text: str) -> None:
    draw.ellipse((52, y, 72, y + 20), fill=MINT + (40,), outline=MINT + (150,), width=1)
    draw.line((58, y + 10, 62, y + 14, 68, y + 6), fill=(10, 60, 46), width=2, joint="curve")
    draw.text((86, y), text, font=font(13, "semibold"), fill=(230, 223, 234))


def connect_button(frame: Image.Image, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    glow = Image.new("RGBA", frame.size)
    ImageDraw.Draw(glow).rounded_rectangle(box, radius=18, fill=PINK + (90,))
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(20)))

    width = x2 - x1
    height = y2 - y1
    gradient = Image.new("RGBA", (width, height))
    pixels = gradient.load()
    for x in range(width):
        mix = x / max(1, width - 1)
        color = tuple(round(CORAL[index] * (1 - mix) + PINK[index] * mix) for index in range(3))
        for y in range(height):
            pixels[x, y] = color + (255,)
    mask = Image.new("L", (width, height))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=18, fill=255)
    frame.paste(gradient, (x1, y1), mask)

    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(box, radius=18, outline=(255, 190, 181, 190), width=1)
    music_icon = Image.open(APP_ASSETS / "apple-music-icon.png").convert("RGBA")
    music_icon = music_icon.resize((31, 31), Image.Resampling.LANCZOS)

    label = "Connect Apple Music"
    face = font(15, "bold")
    label_width = draw.textlength(label, font=face)
    total_width = 31 + 11 + label_width
    start_x = round((x1 + x2 - total_width) / 2)
    frame.alpha_composite(music_icon, (start_x, y1 + 15))
    bounds = draw.textbbox((0, 0), label, font=face)
    text_y = (y1 + y2 - (bounds[3] - bounds[1])) / 2 - bounds[1]
    draw.text((start_x + 42, text_y), label, font=face, fill=WHITE)


def build() -> Image.Image:
    frame = base_background()
    progress_header(frame)
    draw = ImageDraw.Draw(frame)

    tracking_text(draw, (28, 80), "YOUR ROAD SOUNDTRACK", font(9, "bold"), (255, 140, 111), 1.7)
    draw.text((28, 106), "Connect Apple Music.", font=font(36, "bold"), fill=WHITE)
    paragraph(
        draw,
        (29, 157),
        "Bring the songs you played back to every journey.",
        font(14),
        MUTED,
        402,
        20,
    )

    glass_panel(frame, (28, 235, 452, 875))

    # The Apple Music mark is kept intact and receives generous clear space.
    music_icon = Image.open(APP_ASSETS / "apple-music-icon.png").convert("RGBA")
    music_icon = music_icon.resize((82, 82), Image.Resampling.LANCZOS)
    frame.alpha_composite(music_icon, (199, 278))

    draw = ImageDraw.Draw(frame)
    apple_music_label = "Apple Music"
    label_face = font(27, "bold")
    label_width = draw.textlength(apple_music_label, font=label_face)
    draw.text(((W - label_width) / 2, 378), apple_music_label, font=label_face, fill=WHITE)
    tracking_text(draw, (163, 419), "YOUR JOURNEY. YOUR MUSIC.", font(8, "bold"), (255, 132, 111), 1.35)

    paragraph(
        draw,
        (55, 466),
        "JourneyDeck uses your Apple Music listening history to match the songs you played to each journey.",
        font(15),
        (221, 213, 226),
        370,
        22,
    )

    draw.line((51, 549, 429, 549), fill=(160, 119, 177, 55), width=1)
    check_row(draw, 582, "Match songs to the road where you heard them")
    check_row(draw, 621, "Bring back titles, artists, and album artwork")
    check_row(draw, 660, "No microphone required")

    draw.rounded_rectangle(
        (48, 716, 432, 771),
        radius=16,
        fill=(35, 24, 45, 210),
        outline=(175, 123, 199, 70),
        width=1,
    )
    draw.ellipse((65, 733, 77, 745), outline=(190, 139, 229), width=1)
    draw.arc((67, 726, 75, 738), start=180, end=360, fill=(190, 139, 229), width=2)
    draw.text((89, 729), "Private by design", font=font(11, "bold"), fill=(220, 203, 232))
    draw.text((89, 747), "Only soundtrack details needed for your journeys.", font=font(10), fill=(167, 155, 176))

    connect_button(frame, (48, 790, 432, 852))
    draw = ImageDraw.Draw(frame)
    draw.text((139, 894), "Apple will ask for permission next.", font=font(10), fill=(150, 139, 158))
    skip = "Continue without Apple Music"
    skip_face = font(12, "semibold")
    skip_width = draw.textlength(skip, font=skip_face)
    draw.text(((W - skip_width) / 2, 940), skip, font=skip_face, fill=(190, 177, 197))

    draw.rounded_rectangle((187, 1016, 293, 1021), radius=3, fill=(244, 239, 247, 190))
    return frame.convert("RGB")


if __name__ == "__main__":
    build().save(ROOT / "apple-music-connect-screen.png", optimize=True)
    print("Built JourneyDeck Apple Music onboarding mockup")

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
MUTED = (183, 173, 190)
CORAL = (255, 105, 79)
PINK = (255, 55, 104)
VIOLET = (165, 102, 255)
MINT = (89, 222, 184)
AMBER = (255, 184, 92)


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
    image.alpha_composite(Image.new("RGBA", (W, H), (2, 1, 8, 112)))
    return image


def progress_header(frame: Image.Image, variant: str) -> None:
    draw = ImageDraw.Draw(frame)
    icon = Image.open(APP_ASSETS / "icon.png").convert("RGBA").resize((30, 30), Image.Resampling.LANCZOS)
    frame.alpha_composite(icon, (28, 28))
    tracking_text(draw, (70, 34), "JOURNEYDECK", font(9, "bold"), (218, 205, 224), 1.2)
    tracking_text(draw, (380, 34), f"04{variant} / 04", font(9, "bold"), (180, 157, 196), 1.0)


def glass_panel(
    frame: Image.Image,
    box: tuple[int, int, int, int],
    border_color: tuple[int, int, int] = CORAL,
) -> None:
    x1, y1, x2, y2 = box
    glow = Image.new("RGBA", frame.size)
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle(
        (x1 - 2, y1 - 2, x2 + 2, y2 + 2),
        radius=28,
        outline=border_color + (95,),
        width=5,
    )
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(17)))

    panel = Image.new("RGBA", frame.size)
    panel_draw = ImageDraw.Draw(panel)
    panel_draw.rounded_rectangle(
        box,
        radius=26,
        fill=(10, 7, 18, 235),
        outline=border_color + (135,),
        width=1,
    )
    frame.alpha_composite(panel)


def gradient_button(frame: Image.Image, box: tuple[int, int, int, int], label: str) -> None:
    x1, y1, x2, y2 = box
    width = x2 - x1
    height = y2 - y1
    glow = Image.new("RGBA", frame.size)
    ImageDraw.Draw(glow).rounded_rectangle(box, radius=18, fill=PINK + (85,))
    frame.alpha_composite(glow.filter(ImageFilter.GaussianBlur(19)))

    gradient = Image.new("RGBA", (width, height))
    pixels = gradient.load()
    for x in range(width):
        mix = x / max(1, width - 1)
        color = tuple(round(CORAL[i] * (1 - mix) + PINK[i] * mix) for i in range(3))
        for y in range(height):
            pixels[x, y] = color + (255,)
    mask = Image.new("L", (width, height))
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, height - 1), radius=18, fill=255)
    frame.paste(gradient, (x1, y1), mask)

    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle(box, radius=18, outline=(255, 193, 184, 190), width=1)
    face = font(16, "bold")
    label_width = draw.textlength(label, font=face)
    bounds = draw.textbbox((0, 0), label, font=face)
    text_y = (y1 + y2 - (bounds[3] - bounds[1])) / 2 - bounds[1]
    draw.text(((x1 + x2 - label_width) / 2 - 7, text_y), label, font=face, fill=WHITE)
    draw.text((x2 - 44, y1 + 15), "›", font=font(24, "bold"), fill=(255, 240, 242))


def step_row(
    frame: Image.Image,
    number: int,
    y: int,
    label: str,
    detail: str,
    accent: tuple[int, int, int],
    icon: str | None = None,
) -> None:
    draw = ImageDraw.Draw(frame)
    dark_fill = tuple(max(9, round(component * 0.19)) for component in accent)
    draw.ellipse((48, y, 84, y + 36), fill=dark_fill, outline=accent, width=1)
    number_face = font(13, "bold")
    number_text = str(number)
    number_width = draw.textlength(number_text, font=number_face)
    draw.text((66 - number_width / 2, y + 8), number_text, font=number_face, fill=accent)

    tracking_text(draw, (101, y - 1), label.upper(), font(8, "bold"), accent, 1.2)
    paragraph(draw, (101, y + 18), detail, font(13, "semibold"), (231, 224, 235), 305, 18)

    if icon == "music":
        music_icon = Image.open(APP_ASSETS / "apple-music-icon.png").convert("RGBA").resize((25, 25), Image.Resampling.LANCZOS)
        frame.alpha_composite(music_icon, (397, y + 5))


def home_indicator(frame: Image.Image) -> None:
    ImageDraw.Draw(frame).rounded_rectangle((187, 1016, 293, 1021), radius=3, fill=(244, 239, 247, 190))


def automatic_screen() -> Image.Image:
    frame = base_background()
    progress_header(frame, "A")
    draw = ImageDraw.Draw(frame)

    tracking_text(draw, (28, 80), "AUTOMATIC IS READY", font(9, "bold"), MINT, 1.7)
    draw.text((28, 106), "You’re ready. Just drive.", font=font(34, "bold"), fill=WHITE)
    paragraph(
        draw,
        (29, 157),
        "JourneyDeck handles the route while you enjoy the road.",
        font(14),
        MUTED,
        410,
        20,
    )

    glass_panel(frame, (28, 230, 452, 846), MINT)
    draw = ImageDraw.Draw(frame)
    draw.ellipse((181, 267, 299, 385), fill=(17, 43, 43, 215), outline=MINT + (120,), width=2)
    for radius, alpha in ((46, 60), (33, 105), (19, 160)):
        draw.ellipse((240 - radius, 326 - radius, 240 + radius, 326 + radius), outline=MINT + (alpha,), width=2)
    draw.ellipse((233, 319, 247, 333), fill=MINT)
    draw.line((240, 326, 274, 299, 293, 309), fill=(255, 111, 82), width=5, joint="curve")
    draw.ellipse((287, 303, 299, 315), fill=CORAL, outline=WHITE, width=2)

    auto_label = "SIMPLY GET IN AND GO"
    auto_face = font(9, "bold")
    auto_width = sum(draw.textlength(ch, font=auto_face) + 1.4 for ch in auto_label)
    tracking_text(draw, ((W - auto_width) / 2, 407), auto_label, auto_face, MINT, 1.4)

    draw.line((50, 445, 430, 445), fill=(129, 177, 173, 50), width=1)
    step_row(frame, 1, 476, "Get in", "Take your iPhone with you.", MINT)
    step_row(frame, 2, 546, "Drive", "Your journey starts automatically.", MINT)
    step_row(frame, 3, 616, "Press play", "Play Apple Music through your iPhone or CarPlay.", CORAL, "music")
    step_row(frame, 4, 704, "Arrive", "Park and JourneyDeck finishes the journey.", MINT)

    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((48, 784, 432, 824), radius=14, fill=(24, 47, 44, 200), outline=MINT + (75,), width=1)
    draw.ellipse((63, 796, 79, 812), fill=MINT)
    draw.line((68, 804, 71, 807, 76, 800), fill=(8, 58, 45), width=2, joint="curve")
    draw.text((91, 795), "Automatic recording is ready.", font=font(12, "semibold"), fill=(211, 236, 226))

    gradient_button(frame, (28, 917, 452, 979), "Let the Journey Begin")
    home_indicator(frame)
    return frame.convert("RGB")


def manual_screen() -> Image.Image:
    frame = base_background()
    progress_header(frame, "B")
    draw = ImageDraw.Draw(frame)

    tracking_text(draw, (28, 80), "MANUAL IS READY", font(9, "bold"), (204, 148, 255), 1.7)
    draw.text((28, 106), "You’re in the driver’s seat.", font=font(32, "bold"), fill=WHITE)
    paragraph(
        draw,
        (29, 157),
        "Start and finish every journey when you choose.",
        font(14),
        MUTED,
        410,
        20,
    )

    glass_panel(frame, (28, 230, 452, 853), VIOLET)
    draw = ImageDraw.Draw(frame)

    draw.rounded_rectangle((48, 263, 432, 363), radius=22, fill=(30, 18, 43, 230), outline=VIOLET + (105,), width=1)
    tracking_text(draw, (68, 278), "HOME · MANUAL RECORDING", font(8, "bold"), (203, 160, 245), 1.15)
    draw.rounded_rectangle((67, 306, 413, 349), radius=14, fill=CORAL + (32,), outline=CORAL + (145,), width=1)
    draw.ellipse((80, 317, 102, 339), fill=(120, 41, 40), outline=(255, 155, 134), width=1)
    draw.polygon(((89, 323), (89, 333), (97, 328)), fill=WHITE)
    draw.text((118, 316), "Start Your Journey", font=font(15, "bold"), fill=WHITE)
    draw.text((375, 314), "›", font=font(21, "bold"), fill=CORAL)

    step_row(frame, 1, 404, "Open", "Open JourneyDeck after you enter your car.", VIOLET)
    step_row(frame, 2, 480, "Start", "On Home, tap Start Your Journey.", CORAL)
    step_row(frame, 3, 556, "Drive", "Enjoy the road and play your music.", VIOLET, "music")
    step_row(frame, 4, 632, "Finish", "When you arrive, open JourneyDeck and end the journey.", CORAL)

    draw = ImageDraw.Draw(frame)
    draw.rounded_rectangle((48, 729, 432, 822), radius=17, fill=(55, 27, 38, 220), outline=CORAL + (125,), width=1)
    draw.ellipse((65, 746, 91, 772), fill=(62, 42, 21), outline=AMBER, width=1)
    draw.text((75, 747), "!", font=font(15, "bold"), fill=AMBER)
    tracking_text(draw, (105, 746), "ONE LAST THING", font(8, "bold"), AMBER, 1.25)
    paragraph(
        draw,
        (105, 766),
        "Remember to tap Finish Journey when the drive is over.",
        font(12, "semibold"),
        (235, 218, 221),
        295,
        17,
    )

    gradient_button(frame, (28, 917, 452, 979), "Let the Journey Begin")
    home_indicator(frame)
    return frame.convert("RGB")


if __name__ == "__main__":
    automatic_screen().save(ROOT / "screen-4a-automatic.png", optimize=True)
    manual_screen().save(ROOT / "screen-4b-manual.png", optimize=True)
    print("Built JourneyDeck onboarding instruction mockups 4a and 4b")

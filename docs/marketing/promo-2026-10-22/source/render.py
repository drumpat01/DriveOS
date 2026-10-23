#!/usr/bin/env python3
"""
Render a vertical 9:16 (1080x1920) app promo video from a storyboard JSON.

Usage:
  python render.py storyboard.json out.mp4 [--music track.mp3] [--preview preview.png] [--thumb cover.png]

--preview  writes a contact sheet of frames (fast visual check) and skips encoding unless out is given
--thumb    writes the first-hook frame as a PNG cover image
"""
import argparse, json, math, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

W, H, FPS = int(os.environ.get("RENDER_W",1080)), int(os.environ.get("RENDER_H",1920)), 30
CAP_W = int(os.environ.get("CAP_MAX_W", 940))
PHONE_MAX_H = int(os.environ.get("PHONE_MAX_H", 1150))
CARD_MAX_W = int(os.environ.get("CARD_MAX_W", 960))
CARD_MAX_H = int(os.environ.get("CARD_MAX_H", 1100))
CTA_Y = int(os.environ.get("CTA_Y", 620))
TEXT_Y = float(os.environ.get("TEXT_Y", 0.44))
LOGO_MAX = int(os.environ.get("LOGO_MAX", 300))
SKILL = "/root/.claude/skills/synced/d83a4c5b-95df-4c56-8d1a-7bbed435ef4c_cbb757a6-9da6-4578-9df2-9bb84ea6525b/app-promo-video"
FONT_DIR = os.path.join(SKILL, "assets", "fonts")

STYLES = {
    # fast cuts, loud stroked captions, pop-in entries
    "hype":        dict(screen_dur=1.7, text_dur=1.5, trans=0.14, upper=True,  cap_size=86, head_size=118, entry="pop",  caption="stroke"),
    # calm, readable, captions on white cards
    "walkthrough": dict(screen_dur=2.9, text_dur=2.2, trans=0.35, upper=False, cap_size=64, head_size=96,  entry="rise", caption="card"),
    # problem -> solution narrative, big statements
    "story":       dict(screen_dur=2.5, text_dur=2.4, trans=0.30, upper=False, cap_size=72, head_size=104, entry="rise", caption="stroke"),
}

# ---------- helpers ----------
def font(size, weight="Bold"):
    for p in (os.path.join(FONT_DIR, f"Poppins-{weight}.ttf"),
              f"/usr/share/fonts/truetype/google-fonts/Poppins-{weight}.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ease_out_cubic(x): x = clamp(x); return 1 - (1 - x) ** 3
def ease_in_out(x): x = clamp(x); return 3 * x * x - 2 * x * x * x
def ease_out_back(x, s=1.7):
    x = clamp(x); x -= 1
    return x * x * ((s + 1) * x + s) + 1

def fade_alpha(img, a):
    if a >= 0.999: return img
    img = img.copy()
    img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
    return img

def rounded_mask(size, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], r, fill=255)
    return m

def paste_center(canvas, img, cx, cy, scale=1.0, alpha=1.0):
    if scale != 1.0:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    img = fade_alpha(img, alpha)
    canvas.paste(img, (int(cx - img.width / 2), int(cy - img.height / 2)), img)

# ---------- text ----------
KEEP_CASE = set()  # brand names that must never be upper-cased (filled from brand.json)

def tokens_of(text, upper):
    out, acc = [], False
    for w in text.split():
        if upper and w.strip("*.,!?:;").lower() not in KEEP_CASE: w = w.upper()
        start, end = w.startswith("*"), w.endswith("*")
        if start: acc = True
        out.append((w.strip("*"), acc))
        if end: acc = False
    return out

def text_block(text, size, fill, accent, max_w, upper=False, stroke=0, stroke_fill=(0, 0, 0), weight="Bold", gap=1.12):
    """Multi-line centered text. Words wrapped in *asterisks* render in the accent color."""
    f = font(size, weight)
    toks = tokens_of(text, upper)
    space = f.getlength(" ")
    lines, cur, cur_w = [], [], 0
    for word, acc in toks:
        ww = f.getlength(word)
        if cur and cur_w + space + ww > max_w:
            lines.append((cur, cur_w)); cur, cur_w = [], 0
        cur_w += (space if cur else 0) + ww
        cur.append((word, acc, ww))
    if cur: lines.append((cur, cur_w))
    lh = int(size * gap)
    pad = stroke + 6
    bw = int(max((lw for _, lw in lines), default=1)) + pad * 2
    bh = lh * len(lines) + pad * 2 + int(size * 0.25)
    img = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (words, lw) in enumerate(lines):
        x = pad + (bw - 2 * pad - lw) / 2
        y = pad + i * lh
        for word, acc, ww in words:
            d.text((x, y), word, font=f, fill=accent if acc else fill,
                   stroke_width=stroke, stroke_fill=stroke_fill)
            x += ww + space
    return img

def caption_img(text, st, brand):
    s = STYLES[st]
    accent = rgb(brand["colors"]["accent"])
    if s["caption"] == "card":
        lum = 0.299 * accent[0] + 0.587 * accent[1] + 0.114 * accent[2]
        card_acc = tuple(int(c * 0.62) for c in accent) if lum > 150 else accent  # keep accent readable on white
        t = text_block(text, s["cap_size"], (20, 20, 24), card_acc, 860, s["upper"])
        pad = 34
        card = Image.new("RGBA", (t.width + pad * 2, t.height + pad * 2 - 10), (0, 0, 0, 0))
        ImageDraw.Draw(card).rounded_rectangle([0, 0, card.width - 1, card.height - 1], 36, fill=(255, 255, 255, 240))
        card.paste(t, (pad, pad - 4), t)
        return card
    return text_block(text, int(s["cap_size"] * float(os.environ.get("CAP_SCALE", 1))), rgb(brand["colors"].get("text", "#FFFFFF")), accent, CAP_W,
                      s["upper"], stroke=9, stroke_fill=(10, 10, 14))

# ---------- background ----------
def make_background(brand):
    c = brand["colors"]
    top, bot, acc = rgb(c["bg_top"]), rgb(c["bg_bottom"]), rgb(c["accent"])
    bw, bh = W + 240, H + 240
    bg = Image.new("RGB", (bw, bh))
    d = ImageDraw.Draw(bg)
    for y in range(bh):
        t = y / (bh - 1)
        d.line([(0, y), (bw, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    glow = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([bw * 0.55, bh * 0.05, bw * 1.25, bh * 0.45], fill=acc + (90,))
    gd.ellipse([-bw * 0.3, bh * 0.6, bw * 0.45, bh * 1.05], fill=acc + (60,))
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    bg.paste(glow, (0, 0), glow)
    return bg

def bg_frame(bg, T):
    ox = 120 + math.sin(T * 0.35) * 110
    oy = 120 + math.cos(T * 0.27) * 110
    return bg.crop((int(ox), int(oy), int(ox) + W, int(oy) + H))

# ---------- device mockup ----------
def make_device(path, blur=None):
    shot = (path if isinstance(path, Image.Image) else Image.open(path)).convert("RGB")
    for x0, y0, x1, y1 in (blur or []):  # hide private info: boxes as fractions of the screenshot
        box = (int(x0 * shot.width), int(y0 * shot.height), int(x1 * shot.width), int(y1 * shot.height))
        shot.paste(shot.crop(box).filter(ImageFilter.GaussianBlur(28)), box[:2])
    ar = shot.height / shot.width
    if ar >= 1.6:  # phone screenshot -> realistic iPhone
        sh = PHONE_MAX_H; sw = int(sh / ar)
        if sw > 700: sw = 700; sh = int(sw * ar)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        fr, bez, r = 7, 17, 58
        off = fr + bez
        dw, dh = sw + off * 2, sh + off * 2
        body = Image.new("RGBA", (dw, dh), (0, 0, 0, 0))
        metal = Image.new("RGBA", (dw, dh))
        md = ImageDraw.Draw(metal)
        for x in range(dw):  # brushed titanium: bright edges, darker middle
            v = int(95 + 80 * abs(math.cos(math.pi * x / dw)) ** 3)
            md.line([(x, 0), (x, dh)], fill=(v, v + 2, v + 8, 255))
        body.paste(metal, (0, 0), rounded_mask((dw, dh), r + off))
        ImageDraw.Draw(body).rounded_rectangle([fr, fr, dw - fr - 1, dh - fr - 1], r + bez, fill=(8, 8, 10, 255))
        body.paste(shot, (off, off), rounded_mask((sw, sh), r))
        bd = ImageDraw.Draw(body)
        iw, ih = int(sw * 0.29), int(sw * 0.085)  # dynamic island
        bd.rounded_rectangle([dw / 2 - iw / 2, off + sw * 0.028, dw / 2 + iw / 2, off + sw * 0.028 + ih], ih // 2, fill=(0, 0, 0, 255))
        glare = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))  # glass reflection
        ImageDraw.Draw(glare).polygon([(0, 0), (sw * 0.62, 0), (0, sh * 0.42)], fill=(255, 255, 255, 26))
        glare = glare.filter(ImageFilter.GaussianBlur(30))
        gm = Image.new("L", (sw, sh), 0); gm.paste(glare.getchannel("A"), (0, 0), rounded_mask((sw, sh), r))
        glare.putalpha(gm)
        body.alpha_composite(glare, (off, off))
        screen, phone, radius, glare_layer = (off, off, sw, sh), True, r + off, glare
    else:  # tablet / web / cropped shot -> floating card
        scale = min(CARD_MAX_W / shot.width, CARD_MAX_H / shot.height)
        sw, sh = int(shot.width * scale), int(shot.height * scale)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        body = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        body.paste(shot, (0, 0), rounded_mask((sw, sh), 32))
        screen, phone, radius, glare_layer = (0, 0, sw, sh), False, 32, None
    pad = 90
    shadow = Image.new("RGBA", (body.width + pad * 2, body.height + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([pad, pad, pad + body.width, pad + body.height], radius, fill=(0, 0, 0, 125))
    shadow = shadow.filter(ImageFilter.GaussianBlur(34))
    return dict(img=body, screen=screen, phone=phone, radius=radius, shadow=shadow, pad=pad,
                glare=glare_layer, mask=rounded_mask((screen[2], screen[3]), 58 if phone else 32))

def screen_with(dev, frame):
    """Swap a new frame (from a screen recording) into the device's screen."""
    img = dev["img"].copy()
    sx, sy, sw, sh = dev["screen"]
    img.paste(frame if frame.size == (sw, sh) else frame.resize((sw, sh), Image.BILINEAR), (sx, sy), dev["mask"])
    if dev["glare"] is not None: img.alpha_composite(dev["glare"], (sx, sy))
    return img

def extract_clip(video, start, duration, speed, sw, sh, out_dir):
    """Decode one segment of a screen recording into numbered JPEG frames at the screen size."""
    os.makedirs(out_dir, exist_ok=True)
    vf = f"setpts=PTS/{speed},fps={FPS},scale={sw}:{sh}" if speed != 1.0 else f"fps={FPS},scale={sw}:{sh}"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-i", video,
                    "-t", f"{duration * speed + 0.4:.3f}", "-vf", vf, "-q:v", "3",
                    os.path.join(out_dir, "%04d.jpg")], check=True)
    frames = sorted(os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.endswith(".jpg"))
    if not frames: sys.exit(f"No frames extracted from {video} at {start}s")
    return frames

def persp_coeffs(src, dst):
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float)).tolist()

def draw_device(canvas, dev, cx, cy, scale, theta=0.0, rot2d=0.0, override=None):
    """Draw the device at (cx, cy). theta = 3D rotation around the vertical axis in degrees."""
    img = override if override is not None else dev["img"]
    w, h = max(2, int(img.width * scale)), max(2, int(img.height * scale))
    small = img.resize((w, h), Image.BILINEAR)
    th = math.radians(theta)
    if abs(th) < 1e-3:
        layer, minx, miny, maxx = small, -w / 2, -h / 2, w / 2
    else:
        f, depth = 2600.0, (0.10 if dev["phone"] else 0.035) * w
        c, s_ = math.cos(th), math.sin(th)
        def proj(x, y, z):
            X, Z = x * c + z * s_, -x * s_ + z * c
            k = f / (f + Z); return (X * k, y * k)
        hw, hh = w / 2, h / 2
        front = [proj(-hw, -hh, 0), proj(hw, -hh, 0), proj(hw, hh, 0), proj(-hw, hh, 0)]
        rr = dev["radius"] * scale * 0.7
        sides = [[proj(sx, -hh + rr, 0), proj(sx, -hh + rr, depth), proj(sx, hh - rr, depth), proj(sx, hh - rr, 0)] for sx in (-hw, hw)]
        pts = front + [p for sd in sides for p in sd]
        minx, miny = min(p[0] for p in pts), min(p[1] for p in pts)
        maxx, maxy = max(p[0] for p in pts), max(p[1] for p in pts)
        ow, oh = int(maxx - minx) + 2, int(maxy - miny) + 2
        layer = Image.new("RGBA", (ow, oh), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        tone = int(70 + 60 * abs(s_))
        for sd in sides:
            ld.polygon([(x - minx, y - miny) for x, y in sd], fill=(tone, tone + 2, tone + 8, 255))
        dst = [(x - minx, y - miny) for x, y in front]
        warped = small.transform((ow, oh), Image.PERSPECTIVE, persp_coeffs([(0, 0), (w, 0), (w, h), (0, h)], dst), Image.BICUBIC)
        layer.alpha_composite(warped)
    if rot2d:
        layer = layer.rotate(rot2d, Image.BICUBIC, expand=True)
    # soft shadow sized to the projected device
    sh = dev["shadow"]; k = layer.width / max(1, img.width)
    shs = sh.resize((max(2, int(sh.width * k)), max(2, int(sh.height * scale))), Image.BILINEAR)
    ccx = cx + (minx + maxx) / 2
    canvas.paste(shs, (int(ccx - shs.width / 2), int(cy + 34 * scale - shs.height / 2)), shs)
    canvas.paste(layer, (int(ccx - layer.width / 2), int(cy - layer.height / 2)), layer)

# ---------- scenes ----------
PHONE_CY = int(os.environ.get("PHONE_CY", 1110))
TOP_SHADE = Image.new("RGBA", (W, 640), (0, 0, 0, 0))
for _y in range(640):
    ImageDraw.Draw(TOP_SHADE).line([(0, _y), (W, _y)], fill=(4, 8, 20, int(185 * (1 - _y / 640) ** 1.6)))
CAPTION_CY = int(os.environ.get("CAPTION_CY", 330))

def render_screen(sc, t, canvas, style, brand):
    s = STYLES[style]
    d = sc["duration"]; p = t / d
    dev = sc["_dev"]; img = dev["img"]
    d3 = sc["_3d"] and dev["phone"]
    cx, cy, scale, theta, rot2d = W / 2, PHONE_CY, 1.0, 0.0, 0.0
    m = sc.get("motion", "zoom_in")
    if d3:  # gentle 3D sway so the phone always feels physical
        theta = math.sin(t * 1.7 + sc["_phase"]) * 8
    e = t / 0.45
    if m != "spin":
        if s["entry"] == "pop": scale *= 0.82 + 0.18 * ease_out_back(e)
        else: cy += (1 - ease_out_cubic(e)) * 240

    if m == "spin":  # swings in from edge-on with a little overshoot
        e2 = t / 1.0
        theta = theta * clamp(e2) + sc.get("spin_from", -86) * (1 - ease_out_back(e2, 1.15))
        scale *= 0.72 + 0.28 * ease_out_cubic(e2)
        cy += (1 - ease_out_cubic(e2)) * 120
    elif m == "zoom_in": scale *= 1 + 0.09 * ease_in_out(p)
    elif m == "zoom_out": scale *= 1.12 - 0.12 * ease_out_cubic(p)
    elif m == "slide_left": cx += (1 - ease_out_cubic(t / 0.55)) * W * 0.95; scale *= 1 + 0.04 * p
    elif m == "slide_up": cy += (1 - ease_out_cubic(t / 0.55)) * 1000; scale *= 1 + 0.04 * p
    elif m == "tilt":
        if d3: theta += 38 * (1 - ease_out_cubic(t / 0.8))
        else: rot2d = (1 - ease_out_cubic(t / 0.7)) * -9
        scale *= 1 + 0.05 * p
    elif m == "float": cy += math.sin(t * 2.4) * 14; scale *= 1 + 0.03 * p

    if sc.get("focus"):  # zoom toward a point on the screenshot, given as [x, y] fractions
        fx, fy = sc["focus"]
        k = ease_in_out((p - 0.3) / 0.45)
        theta *= (1 - 0.8 * k)
        zoom = 1 + (sc.get("focus_zoom", 1.7) - 1) * k
        scale *= zoom
        sx, sy, sw, sh = dev["screen"]
        px, py = sx + fx * sw - img.width / 2, sy + fy * sh - img.height / 2
        tx, ty = W / 2 - px * scale, PHONE_CY - py * scale
        cx, cy = cx + (tx - cx) * k, cy + (ty - cy) * k

    override = None
    if sc.get("_frames"):
        fp = sc["_frames"][min(int(t * FPS), len(sc["_frames"]) - 1)]
        fr = Image.open(fp).convert("RGB")
        for x0, y0, x1, y1 in (sc.get("blur") or []):
            box = (int(x0 * fr.width), int(y0 * fr.height), int(x1 * fr.width), int(y1 * fr.height))
            fr.paste(fr.crop(box).filter(ImageFilter.GaussianBlur(14)), box[:2])
        override = screen_with(dev, fr)
    draw_device(canvas, dev, cx, cy, scale, theta, rot2d, override)

    if sc.get("_cap") is not None:
        canvas.paste(TOP_SHADE, (0, 0), TOP_SHADE)  # keeps captions readable over busy screens
        ct = (t - 0.08) / 0.32
        if ct > 0:
            if s["entry"] == "pop":
                paste_center(canvas, sc["_cap"], W / 2, CAPTION_CY, 0.8 + 0.2 * ease_out_back(ct), clamp(ct * 3))
            else:
                paste_center(canvas, sc["_cap"], W / 2, CAPTION_CY + (1 - ease_out_cubic(ct)) * 40, 1.0, clamp(ct))

def render_voice(sc, t, canvas, style, brand):
    """Voice-command beat: pulsing gold orb with a live waveform, headline + sub below."""
    acc = rgb(brand["colors"]["accent"])
    ct = t / 0.45
    pop = 0.7 + 0.3 * ease_out_back(ct)
    L = 900
    layer = Image.new("RGBA", (L, L), (0, 0, 0, 0))
    layer.alpha_composite(sc["_glow"])
    ld = ImageDraw.Draw(layer)
    for i in range(3):
        fr = (t * 0.75 + i / 3) % 1
        r = 150 + fr * 280
        ld.ellipse([L / 2 - r, L / 2 - r, L / 2 + r, L / 2 + r], outline=acc + (int(210 * (1 - fr)),), width=6)
    core = sc["_core"]
    cs = 1 + 0.05 * math.sin(t * 6)
    cimg = core.resize((int(core.width * cs), int(core.height * cs)), Image.BILINEAR)
    layer.alpha_composite(cimg, (int(L / 2 - cimg.width / 2), int(L / 2 - cimg.height / 2)))
    navy = rgb(brand["colors"]["bg_bottom"])
    for i in range(7):  # live waveform
        hgt = 18 + 70 * abs(math.sin(t * 9 + i * 1.3)) * (0.5 + 0.5 * math.sin(i / 6 * math.pi))
        x = L / 2 + (i - 3) * 26
        ld.rounded_rectangle([x - 8, L / 2 - hgt / 2, x + 8, L / 2 + hgt / 2], 8, fill=navy + (255,))
    paste_center(canvas, layer, W / 2, 780, pop, clamp(ct * 2))
    head, sub = sc["_head"], sc.get("_sub")
    ht = (t - 0.2) / 0.4
    if ht > 0:
        paste_center(canvas, head, W / 2, 1330 + head.height / 2 - 60 + (1 - ease_out_cubic(ht)) * 40, 1.0, clamp(ht))
        if sub is not None:
            st = (t - 0.45) / 0.4
            if st > 0:
                paste_center(canvas, sub, W / 2, 1330 + head.height - 30 + sub.height / 2, 1.0, clamp(st))

def render_text(sc, t, canvas, style, brand):
    s = STYLES[style]
    ct = t / 0.4
    zoom = 1 + 0.04 * (t / sc["duration"])
    head, sub = sc["_head"], sc.get("_sub")
    total_h = head.height + (sub.height + 30 if sub else 0)
    y0 = H * TEXT_Y - total_h / 2
    if s["entry"] == "pop":
        paste_center(canvas, head, W / 2, y0 + head.height / 2, (0.75 + 0.25 * ease_out_back(ct)) * zoom, clamp(ct * 3))
    else:
        paste_center(canvas, head, W / 2, y0 + head.height / 2 + (1 - ease_out_cubic(ct)) * 50, zoom, clamp(ct))
    if sub:
        st = (t - 0.3) / 0.4
        if st > 0:
            paste_center(canvas, sub, W / 2, y0 + head.height + 30 + sub.height / 2, zoom, clamp(st))

def render_cta(sc, t, canvas, style, brand):
    ct = t / 0.45
    y = CTA_Y
    if sc.get("_logo") is not None:
        paste_center(canvas, sc["_logo"], W / 2, y, 0.7 + 0.3 * ease_out_back(ct), clamp(ct * 2))
        y += sc["_logo"].height / 2 + 90
    else:
        y += 60
    nt = (t - 0.15) / 0.4
    if nt > 0:
        paste_center(canvas, sc["_head"], W / 2, y + sc["_head"].height / 2, 1.0, clamp(nt))
    y += sc["_head"].height + 70
    bt = (t - 0.35) / 0.4
    if bt > 0:
        pulse = 1 + 0.035 * math.sin(max(0, t - 0.8) * 5)
        paste_center(canvas, sc["_btn"], W / 2, y + sc["_btn"].height / 2, (0.85 + 0.15 * ease_out_back(bt)) * pulse, clamp(bt * 2))
        y += sc["_btn"].height + 50
        if sc.get("_sub") is not None:
            paste_center(canvas, sc["_sub"], W / 2, y + sc["_sub"].height / 2, 1.0, clamp(bt))

RENDER = {"screen": render_screen, "clip": render_screen, "voice": render_voice, "hook": render_text, "text": render_text, "cta": render_cta}

# ---------- prep ----------
def prepare(sb, base_dir):
    style = sb.get("style", "walkthrough")
    if style not in STYLES: sys.exit(f"Unknown style '{style}'. Use one of {list(STYLES)}")
    s = STYLES[style]
    brand_path = os.path.join(SKILL, "assets", "brand.json")
    brand = json.load(open(brand_path)) if os.path.exists(brand_path) else {}
    over = sb.get("brand", {})
    brand = {**brand, **{k: v for k, v in over.items() if k != "colors"}}
    brand["colors"] = {**brand.get("colors", {}), **over.get("colors", {})}
    for k, v in {"bg_top": "#1B1F3B", "bg_bottom": "#0B0D1A", "accent": "#FFB020", "text": "#FFFFFF"}.items():
        brand["colors"].setdefault(k, v)
    white, accent = rgb(brand["colors"]["text"]), rgb(brand["colors"]["accent"])
    if brand.get("app_name"): KEEP_CASE.add(brand["app_name"].lower())

    def resolve(p):
        if os.path.isabs(p): return p
        for base in (base_dir, SKILL, os.getcwd()):
            if os.path.exists(os.path.join(base, p)): return os.path.join(base, p)
        return p

    for sc in sb["scenes"]:
        typ = sc.get("type", "screen")
        sc["type"] = typ
        if typ == "screen":
            path = resolve(sc["image"])
            if not os.path.exists(path): sys.exit(f"Missing screenshot: {path}")
            sc["_dev"] = make_device(path, sc.get("blur"))
            sc["_3d"] = sc.get("device3d", sb.get("device3d", True))
            sc["_phase"] = len([x for x in sb["scenes"] if "_dev" in x]) * 1.9
            sc["_cap"] = caption_img(sc["caption"], style, brand) if sc.get("caption") else None
            sc.setdefault("duration", s["screen_dur"])
        elif typ == "clip":
            video = resolve(sc["video"])
            if not os.path.exists(video): sys.exit(f"Missing recording: {video}")
            sc.setdefault("duration", s["screen_dur"])
            probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                    "-show_entries", "stream=width,height", "-of", "csv=p=0", video],
                                   capture_output=True, text=True).stdout.strip().split(",")
            vw, vh = int(probe[0]), int(probe[1])
            ar = vh / vw
            if ar >= 1.6:
                shh = 1150; sww = int(shh / ar)
                if sww > 700: sww = 700; shh = int(sww * ar)
            else:
                k = min(960 / vw, 1100 / vh); sww, shh = int(vw * k), int(vh * k)
            tmp = os.path.join(base_dir, "_clips", f"c{len(sb['scenes'])}_{abs(hash((video, sc.get('start', 0)))) % 99999}")
            frames = extract_clip(video, sc.get("start", 0), sc["duration"], sc.get("speed", 1.0), sww, shh, tmp)
            sc["_frames"] = frames
            sc["_dev"] = make_device(Image.open(frames[0]))
            sc["_cap"] = caption_img(sc["caption"], style, brand) if sc.get("caption") else None
            sc["_3d"] = sc.get("device3d", sb.get("device3d", True))
            sc["_phase"] = len([x for x in sb["scenes"] if "_dev" in x]) * 1.9
        elif typ in ("hook", "text"):
            size = s["head_size"] if typ == "hook" else int(s["head_size"] * 0.88)
            sc["_head"] = text_block(sc["text"], int(size * float(os.environ.get("HEAD_SCALE", 1))), white, accent, CAP_W, s["upper"], stroke=8 if s["caption"] == "stroke" else 0)
            sc["_sub"] = text_block(sc["sub"], int(50 * float(os.environ.get("HEAD_SCALE", 1))), white, accent, CAP_W - 40, weight="Medium") if sc.get("sub") else None
            sc.setdefault("duration", s["text_dur"])
        elif typ == "voice":
            acc3 = rgb(brand["colors"]["accent"])
            glow = Image.new("RGBA", (900, 900), (0, 0, 0, 0))
            ImageDraw.Draw(glow).ellipse([250, 250, 650, 650], fill=acc3 + (120,))
            sc["_glow"] = glow.filter(ImageFilter.GaussianBlur(70))
            core = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
            cd = ImageDraw.Draw(core)
            for i in range(130, 0, -2):  # radial gradient: lighter center
                k = i / 130
                col = tuple(int(c + (255 - c) * 0.35 * (1 - k)) for c in acc3)
                cd.ellipse([130 - i, 130 - i, 130 + i, 130 + i], fill=col + (255,))
            sc["_core"] = core
            sc["_head"] = text_block(sc["text"], int(s["head_size"] * 0.8), white, accent, 940, s["upper"], stroke=8 if s["caption"] == "stroke" else 0)
            sc["_sub"] = text_block(sc["sub"], 50, white, accent, 900, weight="Medium") if sc.get("sub") else None
            sc.setdefault("duration", s["text_dur"] + 0.4)
        elif typ == "cta":
            logo = brand.get("logo")
            sc["_logo"] = None
            if logo and os.path.exists(resolve(logo)):
                li = Image.open(resolve(logo)).convert("RGBA")
                li.thumbnail((LOGO_MAX, LOGO_MAX), Image.LANCZOS)
                sq = Image.new("RGBA", li.size, (0, 0, 0, 0)); sq.paste(li, (0, 0), rounded_mask(li.size, int(li.width * 0.22)))
                sc["_logo"] = sq
            sc["_head"] = text_block(sc.get("text") or brand.get("app_name", "Get the app"), int(104 * float(os.environ.get("HEAD_SCALE", 1))), white, accent, CAP_W)
            label = sc.get("button") or brand.get("cta", "Download free")
            bt = text_block(label, 58, (255, 255, 255) if sum(accent) < 450 else (15, 15, 18), accent, 800, weight="Bold")
            btn = Image.new("RGBA", (bt.width + 110, bt.height + 40), (0, 0, 0, 0))
            ImageDraw.Draw(btn).rounded_rectangle([0, 0, btn.width - 1, btn.height - 1], btn.height // 2, fill=accent + (255,))
            btn.paste(bt, (55, 16), bt)
            sc["_btn"] = btn
            sub = sc.get("sub") or brand.get("cta_sub")
            sc["_sub"] = text_block(sub, int(46 * float(os.environ.get("HEAD_SCALE", 1))), white, accent, CAP_W - 40, weight="Medium") if sub else None
            sc.setdefault("duration", 2.6)
        else:
            sys.exit(f"Unknown scene type '{typ}'")
    return style, brand

def timeline(sb, style):
    tr = sb.get("transition", STYLES[style]["trans"])
    starts, t = [], 0.0
    for sc in sb["scenes"]:
        starts.append(t); t += sc["duration"] - tr
    return starts, t + tr, tr

def frame_at(T, sb, starts, tr, bg, style, brand):
    active = [(i, sc) for i, sc in enumerate(sb["scenes"]) if starts[i] <= T < starts[i] + sc["duration"]]
    if not active: active = [(len(sb["scenes"]) - 1, sb["scenes"][-1])]
    base = bg_frame(bg, T)
    imgs = []
    for i, sc in active[-2:]:
        c = base.copy()
        RENDER[sc["type"]](sc, T - starts[i], c, style, brand)
        imgs.append((i, c))
    if len(imgs) == 1: return imgs[0][1]
    (_, a), (j, b) = imgs
    return Image.blend(a, b, clamp((T - starts[j]) / max(tr, 1e-3)))

# ---------- main ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("storyboard"); ap.add_argument("out", nargs="?")
    ap.add_argument("--music"); ap.add_argument("--preview"); ap.add_argument("--thumb")
    a = ap.parse_args()
    sb = json.load(open(a.storyboard))
    style, brand = prepare(sb, os.path.dirname(os.path.abspath(a.storyboard)))
    starts, total, tr = timeline(sb, style)
    bg = make_background(brand)
    print(f"style={style} scenes={len(sb['scenes'])} duration={total:.1f}s")

    if a.thumb:
        frame_at(starts[0] + min(0.9, sb["scenes"][0]["duration"] * 0.6), sb, starts, tr, bg, style, brand).save(a.thumb)
    if a.preview:
        times = []
        for i, sc in enumerate(sb["scenes"]):
            times.append(starts[i] + sc["duration"] * 0.7)
        cols = min(4, len(times)); rows = math.ceil(len(times) / cols)
        tw, th = W // 4, H // 4
        sheet = Image.new("RGB", (cols * tw + (cols + 1) * 12, rows * th + (rows + 1) * 12), (240, 240, 240))
        for k, T in enumerate(times):
            fr = frame_at(T, sb, starts, tr, bg, style, brand).resize((tw, th), Image.LANCZOS)
            sheet.paste(fr, (12 + (k % cols) * (tw + 12), 12 + (k // cols) * (th + 12)))
        sheet.save(a.preview); print("preview ->", a.preview)
    if not a.out: return

    audio = ["-i", a.music] if a.music else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
    af = ["-af", f"atrim=0:{total:.3f},loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=in:d=0.05,afade=t=out:st={max(0, total - 1.5):.2f}:d=1.5"] if a.music else []
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", *audio, "-map", "0:v", "-map", "1:a", *af,
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-t", f"{total:.3f}", "-movflags", "+faststart", a.out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = int(round(total * FPS))
    for f in range(n):
        proc.stdin.write(frame_at(f / FPS, sb, starts, tr, bg, style, brand).tobytes())
        if f % 90 == 0: print(f"  frame {f}/{n}", flush=True)
    proc.stdin.close(); proc.wait()
    if proc.returncode: sys.exit("ffmpeg failed")
    print("video ->", a.out)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Generate Google Play Store feature graphic (1024×500) for Sangria Cricket Club.
Output: feature-graphic.png in project root.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1024, 500
PROJECT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO_PATH = os.path.join(PROJECT, 'public', 'scc-logo.jpg')
OUT_PATH = os.path.join(PROJECT, 'feature-graphic.png')

# ── Colors (matching app theme) ───────────────────────────────────────────────
BG_DEEP   = (5, 8, 14)         # #05080e
BG_MID    = (10, 16, 25)       # #0a1019
GREEN1    = (16, 185, 129)     # emerald-500
GREEN2    = (20, 184, 166)     # teal-500
AMBER     = (251, 191, 36)     # amber-400
WHITE     = (255, 255, 255)
GRAY_MID  = (156, 163, 175)
GREEN_TXT = (52, 211, 153)

def ease(v): return v

def gradient_bg():
    """Create dark bento-style background with subtle radial green glows."""
    img = Image.new('RGB', (W, H), BG_DEEP)
    px = img.load()
    for y in range(H):
        for x in range(W):
            # Base gradient top-to-bottom
            t = y / H
            base = tuple(int(BG_MID[i] * (1 - t) + BG_DEEP[i] * t) for i in range(3))

            # Radial glow #1: top-left emerald
            dx1, dy1 = x - 100, y - 50
            d1 = (dx1*dx1 + dy1*dy1) ** 0.5
            g1 = max(0, 1 - d1 / 650)
            g1 = g1 * g1 * 0.35

            # Radial glow #2: bottom-right teal
            dx2, dy2 = x - 900, y - 450
            d2 = (dx2*dx2 + dy2*dy2) ** 0.5
            g2 = max(0, 1 - d2 / 550)
            g2 = g2 * g2 * 0.22

            # Amber accent top-right
            dx3, dy3 = x - 950, y - 80
            d3 = (dx3*dx3 + dy3*dy3) ** 0.5
            g3 = max(0, 1 - d3 / 200)
            g3 = g3 * g3 * 0.08

            r = min(255, int(base[0] + GREEN1[0] * g1 + GREEN2[0] * g2 + AMBER[0] * g3))
            g = min(255, int(base[1] + GREEN1[1] * g1 + GREEN2[1] * g2 + AMBER[1] * g3))
            b = min(255, int(base[2] + GREEN1[2] * g1 + GREEN2[2] * g2 + AMBER[2] * g3))
            px[x, y] = (r, g, b)
    return img

def try_font(candidates, size):
    for f in candidates:
        try:
            return ImageFont.truetype(f, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()

# ── Build it ──────────────────────────────────────────────────────────────────
print("[1/5] Building gradient background…")
img = gradient_bg()

# ── Subtle cricket pitch line pattern (horizontal faint lines) ────────────────
print("[2/5] Adding subtle line pattern…")
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for y in range(0, H, 60):
    od.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)
for x in range(0, W, 60):
    od.line([(x, 0), (x, H)], fill=(255, 255, 255, 6), width=1)
img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

# ── Decorative glowing circle on the right (stadium feel) ─────────────────────
print("[3/5] Drawing accent ring…")
ring = Image.new('RGBA', (W, H), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
cx, cy = W - 160, H // 2
for i, alpha in enumerate([12, 20, 30, 50, 80]):
    r = 180 - i * 8
    rd.ellipse([cx - r, cy - r, cx + r, cy + r],
               outline=(16, 185, 129, alpha), width=2)
ring = ring.filter(ImageFilter.GaussianBlur(radius=1.5))
img = Image.alpha_composite(img.convert('RGBA'), ring).convert('RGB')

# ── Logo (left side) with soft glow ───────────────────────────────────────────
print("[4/5] Placing logo with glow…")
logo = Image.open(LOGO_PATH).convert('RGBA')
LOGO_SIZE = 280
logo = logo.resize((LOGO_SIZE, LOGO_SIZE), Image.LANCZOS)

# Round the corners
mask = Image.new('L', (LOGO_SIZE, LOGO_SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, LOGO_SIZE, LOGO_SIZE], radius=48, fill=255)
logo.putalpha(mask)

# Soft glow behind logo
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
logo_x, logo_y = 70, (H - LOGO_SIZE) // 2
for i in range(8):
    pad = (8 - i) * 8
    alpha = 18 - i * 2
    gd.rounded_rectangle(
        [logo_x - pad, logo_y - pad, logo_x + LOGO_SIZE + pad, logo_y + LOGO_SIZE + pad],
        radius=48 + pad, fill=(16, 185, 129, max(0, alpha)),
    )
glow = glow.filter(ImageFilter.GaussianBlur(radius=25))
img = Image.alpha_composite(img.convert('RGBA'), glow).convert('RGBA')
img.paste(logo, (logo_x, logo_y), logo)

# ── Text block (right of logo) ────────────────────────────────────────────────
print("[5/5] Typography…")
draw = ImageDraw.Draw(img)

# Font candidates (prefer SF Pro, fall back to system fonts)
font_black = try_font([
    '/System/Library/Fonts/SFNS.ttf',
    '/System/Library/Fonts/Supplemental/Arial Black.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf',
], 72)
font_medium = try_font([
    '/System/Library/Fonts/SFNS.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
], 28)
font_small = try_font([
    '/System/Library/Fonts/SFNS.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
], 16)

TEXT_X = 70 + LOGO_SIZE + 50   # 400

# Small uppercase label
label = "EST · 2024"
draw.text((TEXT_X, 130), label, font=font_small, fill=GREEN_TXT)

# Main title — "Sangria" on one line
title1 = "Sangria"
draw.text((TEXT_X, 158), title1, font=font_black, fill=WHITE)

# Subtitle "Cricket Club"
title2 = "Cricket Club"
draw.text((TEXT_X, 235), title2, font=font_black, fill=WHITE)

# Tagline
tagline = "Manage members · matches · finances"
draw.text((TEXT_X, 325), tagline, font=font_medium, fill=GRAY_MID)

# Accent line under tagline
draw.line([(TEXT_X, 375), (TEXT_X + 180, 375)],
          fill=GREEN1, width=3)

# Hashtag-style accent
accent = "# C H A M P I O N S   P L A Y   H E R E"
draw.text((TEXT_X, 395), accent, font=font_small, fill=(52, 211, 153))

# ── Save ──────────────────────────────────────────────────────────────────────
img.convert('RGB').save(OUT_PATH, 'PNG', optimize=True)
print(f"\n✅ Saved: {OUT_PATH}  ({W}×{H})")
print(f"   Size: {os.path.getsize(OUT_PATH) / 1024:.1f} KB")

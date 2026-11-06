# Regenerates build/icon.png, icon-256.png and icon.ico. Run from the repo root:  python3 tools/make_icon.py  (needs Pillow)
"""Generate the personal-growth app icon: a seedling sprouting from soil, glowing sunrise behind."""
import math
from PIL import Image, ImageDraw, ImageFilter

SS = 2          # supersample factor
S = 1024 * SS   # canvas size
k = SS


def P(x, y):
    return (x * k, y * k)


def bez(p0, p1, p2, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y))
    return pts


def leaf(base, tip, width):
    """Lens-shaped leaf from base to tip, bulging by `width` on both sides."""
    bx, by = base
    tx, ty = tip
    mx, my = (bx + tx) / 2, (by + ty) / 2
    dx, dy = tx - bx, ty - by
    ln = math.hypot(dx, dy)
    nx, ny = -dy / ln, dx / ln
    c1 = (mx + nx * width * 2, my + ny * width * 2)
    c2 = (mx - nx * width * 2, my - ny * width * 2)
    return bez(base, c1, tip) + bez(tip, c2, base)[1:]


img = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# --- background tile with soft vertical gradient ---------------------------------
bg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
top, bot = (30, 36, 46), (15, 17, 22)
for y in range(S):
    t = y / S
    gd.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((40 * k, 40 * k, (1024 - 40) * k, (1024 - 40) * k), radius=220 * k, fill=255)
bg.paste(grad, (0, 0), mask)
img = Image.alpha_composite(img, bg)

# --- sunrise glow behind the plant -----------------------------------------------
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gdw = ImageDraw.Draw(glow)
gdw.ellipse(P(512 - 330, 470 - 330) + P(512 + 330, 470 + 330), fill=(157, 183, 255, 46))
gdw.ellipse(P(512 - 215, 470 - 215) + P(512 + 215, 470 + 215), fill=(157, 183, 255, 34))
glow = glow.filter(ImageFilter.GaussianBlur(28 * k))
glow_masked = Image.new("RGBA", (S, S), (0, 0, 0, 0))
glow_masked.paste(glow, (0, 0), mask)
img = Image.alpha_composite(img, glow_masked)

d = ImageDraw.Draw(img)

# --- soil mound -------------------------------------------------------------------
d.ellipse(P(262, 760) + P(762, 900), fill=(44, 49, 60, 255))
d.ellipse(P(262, 760) + P(762, 900), outline=(58, 64, 77, 255), width=6 * k)

# --- stem (slight curve) ----------------------------------------------------------
stem = bez((512, 820), (500, 650), (522, 470), n=60)
for (x, y) in stem:
    r = 17 * k * (1 - 0.18 * (820 - y) / 350)
    d.ellipse((x * k - r, y * k - r, x * k + r, y * k + r), fill=(95, 211, 154, 255))

# --- leaves -----------------------------------------------------------------------
left = leaf((506, 640), (296, 470), 62)
d.polygon([(x * k, y * k) for x, y in left], fill=(95, 211, 154, 255))
right = leaf((516, 540), (760, 290), 82)
d.polygon([(x * k, y * k) for x, y in right], fill=(142, 230, 184, 255))
top_leaf = leaf((522, 480), (560, 300), 34)
d.polygon([(x * k, y * k) for x, y in top_leaf], fill=(173, 240, 205, 255))

# leaf veins
d.line([P(506, 640), P(350, 507)], fill=(60, 160, 115, 255), width=7 * k)
d.line([P(516, 540), P(690, 354)], fill=(80, 180, 135, 255), width=8 * k)

# --- small rising sparkles (growth) ----------------------------------------------
for (x, y, r) in [(300, 330, 9), (730, 560, 7), (640, 190, 6)]:
    d.ellipse(P(x - r, y - r) + P(x + r, y + r), fill=(157, 183, 255, 220))

img = img.resize((1024, 1024), Image.LANCZOS)
img.save("build/icon.png")
img.resize((256, 256), Image.LANCZOS).save("build/icon-256.png")
img.save("build/icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("icon written")

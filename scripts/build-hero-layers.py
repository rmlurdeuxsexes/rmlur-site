"""Cut the interactive layers out of the homepage MPC photo.

    python3 scripts/build-hero-layers.py

Reads  assets/hero-mpc-2000xl-readymag.png (1412x1136, the Readymag hero)
Writes assets/hero/hero-base.png   photo with the VOL fader cap removed
                                   (slot + tick marks rebuilt behind it)
       assets/hero/fader-cap.png   the cap on its own
       assets/hero/jog-wheel.png   the jog wheel disc with an elliptical alpha
       data/hero-map.json          every control's box, in % of the photo,
                                   for home.js

Everything is measured from the pixels, not eyeballed, so the overlays sit
exactly on the photo. Re-run it if the hero photo ever changes.
"""
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets/hero-mpc-2000xl-readymag.png'
OUT = ROOT / 'assets/hero'

im = Image.open(SRC).convert('RGBA')
W, H = im.size
px = np.asarray(im).astype(int)
lum = px[..., :3].mean(-1)


def pct(box):
    x0, y0, x1, y1 = box
    return {'left': round(x0 / W * 100, 4), 'top': round(y0 / H * 100, 4),
            'width': round((x1 - x0) / W * 100, 4), 'height': round((y1 - y0) / H * 100, 4)}


# ── 16 drum pads: the dark rubber squares inside the DRUMS panel ──
def dark_blobs(x_from, thresh=85, min_px=5000):
    m = (lum < thresh) & (px[..., 3] > 200)
    seen = np.zeros_like(m)
    blobs = []
    for y in range(0, H, 3):
        for x in range(x_from, W, 3):
            if not m[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)]); seen[y, x] = True; ys = []; xs = []
            while q:
                cy, cx = q.popleft(); ys.append(cy); xs.append(cx)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if len(ys) > min_px:
                blobs.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1))
    return blobs

pads = [b for b in dark_blobs(780) if b[1] > 350]          # skip the oval sticker up top
assert len(pads) == 16, f'expected 16 pads, found {len(pads)}'
rows = sorted({round(b[1] / 40) for b in pads})
grid = sorted(pads, key=lambda b: (round(b[1] / 40), b[0]))  # top row first, left→right
# Hardware numbering: PAD 1–4 is the bottom row, PAD 13–16 the top row.
pad_map = {}
for i, b in enumerate(grid):
    row_from_top, col = divmod(i, 4)
    pad_no = (3 - row_from_top) * 4 + col + 1
    pad_map[f'pad-{pad_no}'] = pct(b)

# ── VOL fader: the cap is the wide dark block on the narrow slot ──
CAP = (99, 716, 173, 765)           # x0, y0, x1, y1 (exclusive) incl. 1px antialias
SLOT = (136, 701, 145, 876)         # the dark slot the cap rides in
TICK_PERIOD = 57                    # 4 tick spacings (~14.3px each) — rows below the cap line up
cap_cols = lum[CAP[1] + 2:CAP[3] - 3, :][:, CAP[0]:CAP[2]] < 120
assert cap_cols.mean() > 0.7, 'fader cap not where expected — photo changed?'

base = im.copy()
b = np.asarray(base).copy()
pad_x0, pad_x1 = CAP[0] - 2, CAP[2] + 2
for y in range(CAP[1] - 1, CAP[3] + 2):
    b[y, pad_x0:pad_x1] = px[y + TICK_PERIOD, pad_x0:pad_x1]
base = Image.fromarray(b.astype('uint8'), 'RGBA')

cap = im.crop(CAP)

# ── Jog wheel: near-circular dark disc in the middle ──
CX, CY, RX, RY = 505.0, 508.0, 88.5, 86.0
INSET = 5                            # keep the outer rim from the base photo
wb = (int(CX - RX), int(CY - RY), int(CX + RX) + 1, int(CY + RY) + 1)
wheel = im.crop(wb)
mask = Image.new('L', (wheel.width * 4, wheel.height * 4), 0)
ImageDraw.Draw(mask).ellipse(((INSET) * 4, (INSET) * 4,
                              (wheel.width - INSET) * 4, (wheel.height - INSET) * 4), fill=255)
mask = mask.resize(wheel.size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
wheel.putalpha(mask)

OUT.mkdir(parents=True, exist_ok=True)
base.save(OUT / 'hero-base.png', optimize=True)
cap.save(OUT / 'fader-cap.png', optimize=True)
wheel.save(OUT / 'jog-wheel.png', optimize=True)

hero_map = {
    'image': {'width': W, 'height': H},
    'pads': pad_map,
    'fader': {
        'cap': pct(CAP),
        # range of the cap's top edge (in % of photo height): its middle rides
        # the slot from end to end, like the real fader
        'travelTop': round((SLOT[1] - 20) / H * 100, 4),
        'travelBottom': round((SLOT[3] - (CAP[3] - CAP[1]) + 20) / H * 100, 4),
    },
    'wheel': {**pct(wb), 'cx': round(CX / W * 100, 4), 'cy': round(CY / H * 100, 4)},
}
(ROOT / 'data/hero-map.json').write_text(json.dumps(hero_map, indent=2) + '\n')
print('pads', len(pad_map), 'cap', CAP, 'wheel', wb)

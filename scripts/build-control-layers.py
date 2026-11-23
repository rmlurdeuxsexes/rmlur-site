"""Cut the knob caps out of the homepage MPC photo and record every hardware
button's box, so home.js can make the whole machine touchable.

    python3 scripts/build-control-layers.py

Reads  assets/hero/hero-base.png        (written by build-hero-layers.py)
Writes assets/hero/hero-base.png        same photo with the knobs' printed
                                        indicator lines erased
       data/hero-map.json               adds "knobs" and "buttons" (in % of
                                        the photo); every other key is kept

Knob centres came from a Hough circle fit on the photo; indicator endpoints
and button boxes were measured on 2-4x zoomed crops with a pixel grid.
Re-run if hero-base.png ever changes. Needs opencv-python + numpy.
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / 'assets/hero/hero-base.png'
MAP = ROOT / 'data/hero-map.json'

im = Image.open(BASE).convert('RGBA')
W, H = im.size


def pct_box(x0, y0, x1, y1):
    return {'left': round(x0 / W * 100, 4), 'top': round(y0 / H * 100, 4),
            'width': round((x1 - x0) / W * 100, 4), 'height': round((y1 - y0) / H * 100, 4)}


# ── knobs ──
# Only the indicator line turns on a real pot; the cap, its lighting and the
# skirt stay put. So the printed indicator is erased from hero-base.png
# (inpainted along its measured endpoints) and home.js draws a new line on top
# that rotates about the cap centre. Re-running is harmless: inpainting an
# already-clean cap changes nothing visible.
# (id, label, cap centre x/y, indicator length, angle now (0 = 12 o'clock, cw),
#  indicator colour, printed-line endpoints to erase, hit-area radius)
KNOBS = [
    ('rec-gain', 'REC GAIN', 1106, 218, 17, 102, '#908680', ((1098, 215), (1125, 221)), 31),
    ('main-volume', 'MAIN VOLUME', 1235, 215, 18, -38, '#898582', ((1220, 196), (1242, 217)), 31),
]
import cv2
import numpy as np
bgr = cv2.cvtColor(np.asarray(im.convert('RGB')), cv2.COLOR_RGB2BGR)
for *_, (p0, p1), _r in KNOBS:
    m = np.zeros(bgr.shape[:2], np.uint8)
    cv2.line(m, p0, p1, 255, 10, cv2.LINE_AA)
    bgr = cv2.inpaint(bgr, ((m > 40) * 255).astype(np.uint8), 7, cv2.INPAINT_NS)
clean = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).convert('RGBA')
clean.putalpha(im.getchannel('A'))
clean.save(BASE)
im = clean
knobs = []
for kid, label, cx, cy, ln, ang, col, _line, hit in KNOBS:
    knobs.append({'id': kid, 'label': label, 'cx': round(cx / W * 100, 4), 'cy': round(cy / H * 100, 4),
                  'len': round(ln / H * 100, 4), 'thick': round(6 / W * 100, 4), 'color': col,
                  'angle': ang, 'min': -135, 'max': 135, **pct_box(cx - hit, cy - hit + 8, cx + hit, cy + hit + 8)})

# ── buttons: (id, label, x0, y0, x1, y1) in photo pixels ──
BUTTONS = [
    ('full-level', 'FULL LEVEL', 824, 238, 870, 262), ('16-levels', '16 LEVELS', 910, 238, 957, 261),
    ('next-seq', 'NEXT SEQ', 824, 321, 871, 343), ('track-mute', 'TRACK MUTE', 911, 321, 957, 342),
    ('pad-bank-a', 'PAD BANK A', 998, 320, 1044, 341), ('pad-bank-b', 'PAD BANK B', 1085, 319, 1130, 340),
    ('pad-bank-c', 'PAD BANK C', 1172, 316, 1217, 338), ('pad-bank-d', 'PAD BANK D', 1258, 316, 1303, 338),
    ('f1', 'F1', 250, 300, 288, 319), ('f2', 'F2', 306, 300, 344, 319), ('f3', 'F3', 362, 300, 400, 319),
    ('f4', 'F4', 417, 300, 457, 319), ('f5', 'F5', 473, 300, 513, 319), ('f6', 'F6', 530, 300, 570, 319),
    ('screen', 'MAIN SCREEN', 414, 370, 462, 392), ('open-window', 'OPEN WINDOW', 545, 368, 595, 391),
    ('key-7', '7', 117, 380, 156, 401), ('key-8', '8', 200, 380, 239, 401), ('key-9', '9', 283, 380, 322, 401),
    ('key-4', '4', 117, 426, 156, 447), ('key-5', '5', 200, 426, 239, 447), ('key-6', '6', 283, 426, 322, 447),
    ('key-1', '1', 117, 474, 156, 495), ('key-2', '2', 200, 474, 239, 495), ('key-3', '3', 283, 474, 322, 495),
    ('shift', 'SHIFT', 117, 522, 157, 542), ('key-0', '0', 200, 521, 239, 541), ('enter', 'ENTER', 284, 520, 324, 541),
    ('after', 'AFTER', 112, 625, 162, 648), ('tap-tempo', 'TAP TEMPO', 275, 610, 335, 655),
    ('undo-seq', 'UNDO SEQ', 240, 707, 288, 731), ('erase', 'ERASE', 321, 707, 369, 731),
    ('cursor-left', 'CURSOR LEFT', 451, 639, 482, 719), ('cursor-right', 'CURSOR RIGHT', 533, 639, 564, 719),
    ('cursor-up', 'CURSOR UP', 482, 639, 533, 676), ('cursor-down', 'CURSOR DOWN', 482, 676, 533, 719),
    ('step-back', 'STEP <', 240, 775, 289, 800), ('step-fwd', 'STEP >', 321, 775, 370, 800),
    ('go-to', 'GO TO', 402, 775, 451, 800), ('bar-back', 'BAR <<', 484, 775, 533, 800),
    ('bar-fwd', 'BAR >>', 565, 775, 615, 800),
    ('rec', 'REC', 237, 852, 294, 895), ('overdub', 'OVERDUB', 319, 852, 375, 895),
    ('stop', 'STOP', 398, 852, 455, 895), ('play', 'PLAY', 480, 852, 537, 895),
    ('play-start', 'PLAY START', 561, 852, 619, 895),
]
buttons = [{'id': b, 'label': l, **pct_box(x0, y0, x1, y1)} for b, l, x0, y0, x1, y1 in BUTTONS]

m = json.loads(MAP.read_text())
m['knobs'] = knobs
m['buttons'] = buttons
MAP.write_text(json.dumps(m, indent=2) + '\n')
print(f'{len(knobs)} knobs, {len(buttons)} buttons -> {MAP.relative_to(ROOT)}')

"""Shared image-matching helpers for per-version prices (yuyu-tei, Card Rush) — #78.
A shop listing photo and Bandai's official image are compared as a whole card
(24x24 difference hash incl. frame) plus a coarse 5x7 colour layout."""
import time
from urllib.request import Request, urlopen
from PIL import Image, ImageChops

UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

def get(url, binary=False, tries=3):
    for _ in range(tries):
        try:
            data = urlopen(Request(url, headers=UA), timeout=30).read()
            return data if binary else data.decode('utf-8', 'ignore')
        except Exception:
            time.sleep(2)
    return None

def fetch_img(url, path):
    import os
    if os.path.exists(path) and os.path.getsize(path) > 500: return True
    data = get(url, binary=True)
    if data and len(data) > 500:
        open(path, 'wb').write(data); return True
    return False

def card_region(im):
    """Card Rush pads photos onto a white square: crop to the card itself."""
    bg = Image.new('RGB', im.size, (255, 255, 255))
    box = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > 18 else 0).getbbox()
    return im.crop(box) if box else im

def feat(p, crop=False):
    im = Image.open(p).convert('RGB')
    if crop: im = card_region(im)
    im = im.resize((100, 140))
    g = list(im.convert('L').resize((25, 24)).getdata())
    return [g[r * 25 + c] > g[r * 25 + c + 1] for r in range(24) for c in range(24)], list(im.resize((5, 7)).getdata())

def cost(a, b):
    hd = sum(x != y for x, y in zip(a[0], b[0]))
    cd = sum(abs(p[i] - q[i]) for p, q in zip(a[1], b[1]) for i in range(3)) / (35 * 3)
    return hd / 576 * 100 + cd * 0.6

def warmth(p):
    px = list(Image.open(p).convert('RGB').resize((50, 70)).getdata())
    r, g, b = (sum(q[i] for q in px) / len(px) for i in range(3))
    return (r + g) / 2 - b   # gold foil is yellow (warm), silver neutral/blue

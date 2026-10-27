"""Turn Canva's golden-beer glass cutouts into recolorable app illustrations.

Each source is a transparent PNG exported from the Canva design
"BrewMaster beer glass illustrations" (pages 9-15). Outputs, on a shared 3:4
canvas with a common baseline, in public/beers/:
  <glass>.webp       the glass with the beer replaced by neutral grey shading
  <glass>-beer.webp  an alpha mask of the beer, tinted in CSS (multiply)

Needs Pillow and numpy:
  python3 scripts/beer-art.py --src-dir <folder of pint.png, pilsner.png, ...> --outdir public/beers
  python3 scripts/beer-art.py --outdir public/beers --preview --preview-out sheet.png
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

# Glass height as a share of the canvas, so tall and squat glasses sit together naturally.
GLASSES = {
    "pint": 0.82,
    "pilsner": 0.93,
    "weizen": 0.93,
    "tulip": 0.80,
    "snifter": 0.72,
    "mug": 0.76,
    "wine": 0.90,
}
CANVAS = (480, 640)
BASELINE = 0.965  # glass foot sits at this fraction of the canvas height


def hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    c = mx - mn
    sat = np.where(mx > 0, c / np.maximum(mx, 1e-6), 0)
    safe = np.maximum(c, 1e-6)
    hue = np.where(
        mx == r,
        ((g - b) / safe) % 6,
        np.where(mx == g, (b - r) / safe + 2, (r - g) / safe + 4),
    )
    hue = np.where(c > 0, hue * 60, 0)
    return hue, sat, mx


def grow(mask, seed):
    """Connected component of `mask` containing `seed` (4-connectivity)."""
    h, w = mask.shape
    out = np.zeros_like(mask)
    q = deque([seed])
    out[seed] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def process(src, name, height_frac, outdir, hue_range, min_sat):
    im = Image.open(src).convert("RGBA")
    a = np.asarray(im).astype(np.float32) / 255
    alpha = a[..., 3]
    ys, xs = np.where(alpha > 0.04)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    a = a[y0:y1, x0:x1]
    rgb, alpha = a[..., :3], a[..., 3]
    hue, sat, val = hsv(rgb)
    beer = (
        (alpha > 0.6)
        & (sat > min_sat)
        & (val > 0.2)
        & (hue >= hue_range[0])
        & (hue <= hue_range[1])
    )
    # Seed from the densest beer row/column so the main body wins over stray specks.
    rows, cols = np.where(beer)
    cy, cx = int(np.median(rows)), int(np.median(cols))
    if not beer[cy, cx]:
        d = (rows - cy) ** 2 + (cols - cx) ** 2
        k = int(d.argmin())
        cy, cx = int(rows[k]), int(cols[k])
    body = grow(beer, (cy, cx))
    # Fill each row between the outermost beer pixels: catches highlights and bubbles.
    region = np.zeros_like(body)
    for y in np.where(body.any(1))[0]:
        xs_row = np.where(body[y])[0]
        region[y, xs_row.min() : xs_row.max() + 1] = True
    # Beer seen elsewhere (e.g. through a thick glass base) takes the same color.
    region = (region | beer) & (alpha > 0.5)
    soft = (
        np.asarray(
            Image.fromarray((region * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(1.2)
            )
        ).astype(np.float32)
        / 255
    ) * (alpha > 0.5)
    lum = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    ref = np.percentile(lum[body], 85)
    grey = np.clip(lum / ref, 0, 1)
    neutral = rgb * (1 - soft[..., None]) + grey[..., None] * soft[..., None]
    tint = np.clip((sat - 0.2) / 0.3, 0, 1) * soft
    tint = (
        np.asarray(
            Image.fromarray((tint * 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(0.8)
            )
        ).astype(np.float32)
        / 255
    )

    art = Image.fromarray((np.dstack([neutral, alpha]) * 255).round().astype(np.uint8))
    mask = Image.fromarray(
        (np.dstack([np.zeros_like(rgb), tint]) * 255).round().astype(np.uint8)
    )
    cw, ch = CANVAS
    h, w = alpha.shape
    scale = min(ch * height_frac / h, cw * 0.94 / w)
    size = (max(1, round(w * scale)), max(1, round(h * scale)))
    left = (cw - size[0]) // 2
    top = round(ch * BASELINE) - size[1]
    for layer, suffix in ((art, ""), (mask, "-beer")):
        canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        canvas.paste(layer.resize(size, Image.LANCZOS), (left, top))
        canvas.save(f"{outdir}/{name}{suffix}.webp", quality=90, method=6)
    print(
        f"{name}: crop {w}x{h} -> {size}, beer {region.mean():.1%} of glass box, "
        f"lum ref {ref:.2f}"
    )


def preview(names, outdir, path):
    """Contact sheet: each glass tinted at several SRM chart colors on the app's card color."""
    colors = ["FFD878", "F8A600", "DE7C00", "B54C00", "7B1A00", "36080A"]
    cw, ch = CANVAS
    sheet = Image.new("RGB", (cw // 2 * len(colors), ch // 2 * len(names)), "#fffcf3")
    for row, name in enumerate(names):
        art = Image.open(f"{outdir}/{name}.webp").convert("RGBA")
        mask = Image.open(f"{outdir}/{name}-beer.webp").split()[3]
        base = np.asarray(art).astype(np.float32) / 255
        m = np.asarray(mask).astype(np.float32)[..., None] / 255
        for col, hexc in enumerate(colors):
            c = np.array([int(hexc[i : i + 2], 16) for i in (0, 2, 4)]) / 255
            rgb = base[..., :3] * (1 - m) + base[..., :3] * c * m
            img = Image.fromarray(
                (np.dstack([rgb, base[..., 3]]) * 255).astype(np.uint8)
            ).resize((cw // 2, ch // 2), Image.LANCZOS)
            sheet.paste(img, (col * cw // 2, row * ch // 2), img)
    sheet.save(path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--src-dir", help="folder with <glass>.png Canva exports")
    p.add_argument("--outdir", required=True)
    p.add_argument("--hue", type=float, nargs=2, default=(15, 65))
    p.add_argument(
        "--min-sat",
        type=float,
        default=0.5,
        help="beer is much more saturated than foam (foam stays below ~0.35)",
    )
    p.add_argument("--preview", action="store_true")
    p.add_argument("--preview-out", default="beer-glasses-preview.png")
    args = p.parse_args()
    if args.preview:
        preview(list(GLASSES), args.outdir, args.preview_out)
    else:
        for name, height in GLASSES.items():
            process(
                f"{args.src_dir}/{name}.png",
                name,
                height,
                args.outdir,
                args.hue,
                args.min_sat,
            )

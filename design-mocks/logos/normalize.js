/* Normalises supplier logo files into uniform tiles for the brand wall.
 *
 * What arrives is never a consistent set: some brands hand over a clean
 * transparent wordmark, others only have a square social avatar with the mark
 * floating in a field of padding. Dropped into a row as-is they read as a
 * sticker sheet — eight different sizes, paddings and grounds.
 *
 * So each file is trimmed to its actual mark, keyed away from its corner
 * colour, then re-centred on a transparent canvas. Optical sizing, not
 * bounding-box sizing — a long wordmark and a compact badge look the same
 * weight only if the wordmark is allowed to run wider.
 *
 * node design-mocks/logos/normalize.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, '..', '..', 'src', 'assets', 'brands');

// width is the share of the tile the mark is allowed to fill. Wordmarks take
// more, badges and square marks take less, so they balance by eye.
const BRANDS = [
  { slug: 'clearpro',      fill: 0.86 },
  { slug: 'f1-auto-films', fill: 0.60 },
  { slug: 'kisho',         fill: 0.74 },
  { slug: 'menzerna',      fill: 0.84 },
  { slug: 'rupes',         fill: 0.70 },
  { slug: 'sonax',         fill: 0.78 },
  // The supplied Meguiar's badge has transparency around an opaque black
  // shield. Knock that internal ground out so the lettering remains a mark.
  { slug: 'meguiars',      fill: 0.62, knockout: true },
  { slug: 'microtex',      fill: 0.74 },
];

const PY = `
import sys, os
from PIL import Image

src, out, fill = sys.argv[1], sys.argv[2], float(sys.argv[3])
knockout = len(sys.argv) > 4 and sys.argv[4] == 'knockout'
TW, TH, PAD = 720, 400, 26          # tile at 2x; 360x200 css px

im = Image.open(src).convert('RGBA')

def corner_bg(img):
    """A social avatar's ground is whatever fills its corners."""
    w, h = img.size
    s = 6
    px = []
    for cx, cy in ((0,0), (w-s,0), (0,h-s), (w-s,h-s)):
        px += list(img.crop((cx, cy, cx+s, cy+s)).getdata())
    px = [p for p in px if p[3] > 200]
    if not px:
        return None
    avg = tuple(sum(c[i] for c in px)//len(px) for i in range(3))
    # Only treat it as a baked ground if the corners actually agree.
    spread = max(max(abs(c[i]-avg[i]) for i in range(3)) for c in px)
    return avg if spread < 26 else None

alpha = im.getchannel('A')
has_alpha = alpha.getextrema()[0] < 250

if has_alpha:
    if knockout:
        rgb = im.convert('RGB')
        original_alpha = list(alpha.getdata())
        mask = Image.new('L', im.size, 0)
        mask.putdata([
            round(a * max(0, min(1, (max(p) - 20) / 80)))
            for p, a in zip(rgb.getdata(), original_alpha)
        ])
        im.putalpha(mask)
        alpha = mask
    bbox = alpha.getbbox()
else:
    bg = corner_bg(im) or (255, 255, 255)
    # Turn distance from the corner ground into a soft alpha edge. This keeps
    # anti-aliasing while removing JPEG noise and the rectangular background.
    rgb = im.convert('RGB')
    mask = Image.new('L', im.size, 0)
    mask.putdata([
        max(0, min(255, round((max(abs(p[i]-bg[i]) for i in range(3)) - 8) * 255 / 42)))
        for p in rgb.getdata()
    ])
    im.putalpha(mask)
    bbox = mask.getbbox()

if bbox:
    im = im.crop(bbox)

# Fit the trimmed mark into its share of the tile.
avail_w, avail_h = (TW - PAD*2) * fill, TH - PAD*2
scale = min(avail_w / im.width, avail_h / im.height)
im = im.resize((max(1, round(im.width*scale)), max(1, round(im.height*scale))),
               Image.LANCZOS)

# Keep the exact extracted alpha silhouette while unifying the visible colour.
mark = Image.new('RGBA', im.size, (255, 255, 255, 0))
mark.putalpha(im.getchannel('A'))
im = mark
tile = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
tile.alpha_composite(im, ((TW-im.width)//2, (TH-im.height)//2))
tile.save(out, 'PNG', optimize=True)
print(f"{os.path.basename(out)}  transparent  mark={im.width}x{im.height}")
`;

fs.mkdirSync(OUT, { recursive: true });

let made = 0;
for (const { slug, fill } of BRANDS) {
  const src = ['.png', '.jpg', '.jpeg', '.svg']
    .map(e => path.join(SRC, slug + e))
    .find(fs.existsSync);
  if (!src) { console.log(`${slug.padEnd(15)} no file in logos/src — falls back to type`); continue; }
  const out = path.join(OUT, slug + '.png');
  process.stdout.write(slug.padEnd(15));
  const args = ['-c', PY, src, out, String(fill)];
  if (BRANDS.find(b => b.slug === slug).knockout) args.push('knockout');
  process.stdout.write(execFileSync('python3', args));
  made++;
}
console.log(`\n${made}/${BRANDS.length} transparent logos normalised into src/assets/brands/`);

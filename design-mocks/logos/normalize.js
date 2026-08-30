/* Normalises supplier logo files into uniform tiles for the brand wall.
 *
 * What arrives is never a consistent set: some brands hand over a clean
 * transparent wordmark, others only have a square social avatar with the mark
 * floating in a field of padding. Dropped into a row as-is they read as a
 * sticker sheet — eight different sizes, paddings and grounds.
 *
 * So each file is trimmed to its actual mark, then re-centred on a tile of one
 * size with the ground the mark was drawn for: white behind dark marks, the
 * brand's own ground behind marks drawn to sit on colour (RUPES white-on-red,
 * F1 chrome-on-black). Optical sizing, not bounding-box sizing — a long
 * wordmark and a compact badge look the same weight only if the wordmark is
 * allowed to run wider.
 *
 * node design-mocks/logos/normalize.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const OUT = path.join(__dirname, 'build');

// width is the share of the tile the mark is allowed to fill. Wordmarks take
// more, badges and square marks take less, so they balance by eye.
const BRANDS = [
  { slug: 'clearpro',      fill: 0.86 },
  { slug: 'f1-auto-films', fill: 0.60 },
  { slug: 'kisho',         fill: 0.74 },
  { slug: 'menzerna',      fill: 0.84 },
  // RUPES only exists here as a white wordmark reversed out of red. Left as
  // supplied it is the one red block in a wall of white cards, so it is flipped
  // back to the red-on-white lockup the brand also uses.
  { slug: 'rupes',         fill: 0.70, flatten: true },
  { slug: 'sonax',         fill: 0.78 },
  { slug: 'meguiars',      fill: 0.62 },
  { slug: 'microtex',      fill: 0.74 },
];

const PY = `
import sys, os
from PIL import Image

src, out, fill = sys.argv[1], sys.argv[2], float(sys.argv[3])
flatten = len(sys.argv) > 4 and sys.argv[4] == 'flatten'
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
    ground = (255, 255, 255)
    bbox = alpha.getbbox()
else:
    bg = corner_bg(im) or (255, 255, 255)
    ground = bg
    # Trim the avatar's padding: keep pixels that differ from the ground.
    rgb = im.convert('RGB')
    diff = Image.new('L', im.size, 0)
    diff.putdata([255 if max(abs(p[i]-bg[i]) for i in range(3)) > 24 else 0
                  for p in rgb.getdata()])
    bbox = diff.getbbox()

if bbox:
    im = im.crop(bbox)

if flatten and not has_alpha:
    # Reversed-out mark: key the ground to transparent, then repaint the mark
    # in the ground's own colour so it reads on white.
    bg = ground
    px = []
    for r, g, b, a in im.convert('RGBA').getdata():
        near = max(abs(r-bg[0]), abs(g-bg[1]), abs(b-bg[2])) < 60
        px.append((bg[0], bg[1], bg[2], 0 if near else 255))
    flat = Image.new('RGBA', im.size)
    flat.putdata(px)
    im = flat
    ground = (255, 255, 255)

# Fit the trimmed mark into its share of the tile.
avail_w, avail_h = (TW - PAD*2) * fill, TH - PAD*2
scale = min(avail_w / im.width, avail_h / im.height)
im = im.resize((max(1, round(im.width*scale)), max(1, round(im.height*scale))),
               Image.LANCZOS)

tile = Image.new('RGBA', (TW, TH), ground + (255,))
tile.alpha_composite(im, ((TW-im.width)//2, (TH-im.height)//2))
tile.convert('RGB').save(out, 'PNG', optimize=True)
print(f"{os.path.basename(out)}  ground=rgb{ground}  mark={im.width}x{im.height}")
`;

fs.rmSync(OUT, { recursive: true, force: true });
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
  if (BRANDS.find(b => b.slug === slug).flatten) args.push('flatten');
  process.stdout.write(execFileSync('python3', args));
  made++;
}
console.log(`\n${made}/${BRANDS.length} logos normalised into logos/build/`);

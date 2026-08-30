/* Builds assets.json: every placeholder the six mocks reference, as a data URI
   drawn from this repo's own files. Regenerate with `node design-mocks/assets.js`. */
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');

const MIME = { '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png',
               '.mp4':'video/mp4', '.woff2':'font/woff2' };

function uri(rel) {
  const p = path.join(R, rel);
  const ext = path.extname(p);
  if (!MIME[ext]) throw new Error('unknown type: ' + rel);
  return `data:${MIME[ext]};base64,${fs.readFileSync(p).toString('base64')}`;
}

const map = {
  // Fonts — the repo's own faces, no external host.
  fontDisplay:     'public/fonts/benzin-extrabold.woff2',
  fontDisplayMed:  'public/fonts/benzin-medium.woff2',
  fontBody:        'public/fonts/gilmer-regular.woff2',
  fontBodyMed:     'public/fonts/gilmer-medium.woff2',
  fontBodyBold:    'public/fonts/gilmer-bold.woff2',

  // Brand marks.
  logoOw:   'public/branding/hakum-lw-ow.png',
  logoBlue: 'public/branding/hakum-lw-blue.png',
  markOw:   'public/branding/hakum-mark-ow.png',

  // Hero.
  heroVideo:  'src/assets/hero/desktop-hero.mp4',
  heroPoster: 'public/media/hero/hakum-precision-poster.webp',

  // Services.
  ppf:            'src/assets/services/paint-protection-film.webp',
  tint:           'src/assets/services/ceramic-tint.webp',
  ceramic:        'src/assets/services/ceramic-coating.webp',
  ceramicGallery: 'src/assets/services/ceramic-coating-gallery.webp',
  premium:        'src/assets/services/ceramic-premium.webp',
  platinum:       'src/assets/services/ceramic-platinum.webp',
  detailing:      'src/assets/services/detailing.webp',
  interior:       'src/assets/services/interior-detailing.webp',
  glass:          'src/assets/services/glass-detailing.webp',
  carwash:        'src/assets/services/carwash.webp',
  about:          'src/assets/about/about-hkm-21.webp',
};

// Product brand marks, normalised into uniform tiles by logos/normalize.js.
// A brand with no file simply has no key here, and the build reports it.
const LOGOS = {
  logoClearpro: 'clearpro',  logoF1:       'f1-auto-films',
  logoKisho:    'kisho',     logoMenzerna: 'menzerna',
  logoRupes:    'rupes',     logoSonax:    'sonax',
  logoMeguiars: 'meguiars',  logoMicrotex: 'microtex',
};
for (const [key, slug] of Object.entries(LOGOS)) {
  map[key] = 'design-mocks/logos/build/' + slug + '.png';
}

// Stills pulled from the real install sequence, at the four stages the
// captions name: align, form, form, seal, protected.
['001','046','090','135','181'].forEach((n, i) => {
  map['ppf' + (i + 1)] = 'public/ppf-frames/desktop/ppf_' + n + '.webp';
});

const assets = {};
for (const [k, rel] of Object.entries(map)) assets[k] = uri(rel);

// Mock E scrubs the sequence itself. Every second frame keeps the motion
// smooth at ~90 steps while halving what the page has to carry.
const frames = [];
for (let n = 1; n <= 181; n += 2) {
  frames.push(uri('public/ppf-frames/desktop/ppf_' + String(n).padStart(3, '0') + '.webp'));
}
assets.__FRAMES__ = frames;

const out = path.join(__dirname, 'assets.json');
fs.writeFileSync(out, JSON.stringify(assets));
console.log(`assets.json  ${Object.keys(assets).length - 1} assets + ${frames.length} frames  ${(fs.statSync(out).size / 1048576).toFixed(1)} MB`);

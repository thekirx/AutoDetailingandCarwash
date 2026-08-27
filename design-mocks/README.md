# Design mocks

Six standalone marketing-site prototypes for the public Hakum site, built for an
owner review. Each is a single self-contained HTML page holding a homepage plus
one service detail page, switched by hash route.

These are prototypes for choosing a direction — not shipping code. Whichever one
wins gets rebuilt as React routes against the live catalog.

## The six

| Mock | Idea | Ground | Detail page | Signature |
| --- | --- | --- | --- | --- |
| A — The Measured Finish | Sells on specification: thickness, coverage, warranty years | Navy | PPF | Measurement rail tracking your position |
| B — Sketch, built out | The client sketch followed box for box | Navy | Nano tint | The reference card treatment |
| C — Hakum Amplified | Current identity kept intact, pushed harder | Paper | Ceramic | Draggable real before/after |
| D — What Does My Car Need | Answers "which service do I actually need?" | Paper | PPF tiers | Three-question advisor |
| E — Between Your Paint | Shows the work rather than describing it | Navy | PPF | Scroll-scrubbed 46-frame canvas |
| F — Know Before You Go | Treats the site as a tool, mobile first | Paper | Nano tint | Live branch queue + bay times |

## Shared design system

All six use **one** token block, `--hk-*`, declared identically at the top of
every file. Local names alias onto it, so no mock can drift.

| Token | Value | Source |
| --- | --- | --- |
| `--hk-paper` | `#F1F1ED` | `--color-surface-page` |
| `--hk-white` | `#FFFFFF` | `--color-white` |
| `--hk-navy` | `#020A31` | `--color-surface-cinematic` |
| `--hk-navy-2` | `#08133F` | derived |
| `--hk-navy-3` | `#0D1B52` | derived |
| `--hk-rule-dark` | `#16255C` | derived |
| `--hk-blue` | `#052699` | `--color-brand-primary` |
| `--hk-blue-hover` | `#0A32B8` | `--color-brand-primary-hover` |
| `--hk-blue-active` | `#031D78` | `--color-brand-primary-active` |
| `--hk-blue-soft` | `#E8EDFF` | `--color-brand-primary-soft` |
| `--hk-blue-mid` | `#2D59D3` | from the shipping radial gradient |
| `--hk-accent` | `#9DB4FF` | brand blue lifted for dark grounds |
| `--hk-ink` | `#333333` | `--color-text-primary` |
| `--hk-rule` | `#DCDCD5` | derived |

**Type is Benzin display (skewed italic caps) + Gilmer body in all six, and
nothing else.** No third family, no external font host — both faces are the
repo's own `.woff2` files, inlined.

The one deliberate exception: mock F adds six semantic status colours (open /
busy / coming soon). "Open" and "busy" cannot both be brand blue and stay
distinguishable. Status is also carried in text and a dot, never colour alone.

## Layout

- `v1/*.src.html`, `v2/*.src.html` — authored sources. Asset placeholders
  (`__A_name__`) are substituted at build time so sources stay small.
- `build.js` — injects assets, writes the self-contained page.
- `check.js` — unresolved placeholders, forbidden tags, tag balance.
- `shot.js` — full-page screenshot via the repo's puppeteer.
- `test-advisor.js` — drives mock D's recommender through three scenarios.
- `test-seq.js` — proves mock E's frames actually scrub and chapters fire.

## Building

The build needs an `assets.json` mapping placeholder names to data URIs,
generated from this repo's own images, fonts, hero video, and PPF frames —
`src/assets/`, `public/branding/`, `public/fonts/`, `public/ppf-frames/`,
`public/media/`.

```
node design-mocks/build.js v2/d-advisor.src.html d.html
```

## Placeholders still to replace

- **Customer reviews** in all six are placeholder copy, marked in the UI.
- **Origin story** in mock B is drafted from existing positioning, not supplied copy.
- **Queue and slot times** in mock F are sample data, marked in the UI. In a real
  build this reads the live queue the app already exposes.
- **Product brand names** (ClearPro, F1 Auto Films, Kisho, Menzerna, Rupes,
  Sonax, Meguiar's, Microtex) are set in type, not logo artwork. Supplying the
  approved logo files and confirming licensing turns them into the real marks.

## Note on encoding

The published pages carry no `<head>`, so there is nowhere to declare a charset.
All non-ASCII is written as HTML entities (`&ntilde;`, `&mdash;`) and CSS escapes
(`\2014`) so the pages render correctly regardless of how the host guesses.

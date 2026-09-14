/* Builds customer-app.html: a self-contained before/after mock of the four
   customer app surfaces Kirk scoped on 2026-09-15 — home, queue, book, blog.

   Self-contained means self-contained: every font and image is inlined as a
   data URI so the file opens from Finder with no dev server. Absolute
   /fonts/... paths fall back to system fonts when opened as a file, which is
   what made an earlier mock look wrong.

   Regenerate with `node design-mocks/webapp/build-customer-app.js`. */
const fs = require('fs')
const path = require('path')

const R = path.join(__dirname, '..', '..')
const MIME = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' }

function uri(rel) {
  const p = path.join(R, rel)
  const ext = path.extname(p)
  if (!MIME[ext]) throw new Error('unknown type: ' + rel)
  if (!fs.existsSync(p)) throw new Error('missing asset: ' + rel)
  return `data:${MIME[ext]};base64,${fs.readFileSync(p).toString('base64')}`
}

const A = {
  display: uri('public/fonts/benzin-extrabold.woff2'),
  displayMed: uri('public/fonts/benzin-medium.woff2'),
  body: uri('public/fonts/gilmer-regular.woff2'),
  bodyMed: uri('public/fonts/gilmer-medium.woff2'),
  bodyBold: uri('public/fonts/gilmer-bold.woff2'),
  logoBlue: uri('public/branding/hakum-lw-blue.png'),
  logoOw: uri('public/branding/hakum-lw-ow.png'),
  hero: uri('src/assets/hero/bredesign-hero-poster.webp'),
  carwash: uri('src/assets/services/carwash.webp'),
  interior: uri('src/assets/services/interior-detailing.webp'),
  ceramic: uri('src/assets/services/ceramic.webp'),
}

/* ---------------------------------------------------------------- icons ---
   lucide paths, inlined so the mock needs no icon font or script. */
const I = {
  calendar: '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M12 14v4M10 16h4"/>',
  car: '<path d="M19 17h2l-1.5-5.5a2 2 0 0 0-2-1.5h-11a2 2 0 0 0-2 1.5L3 17h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
  radio: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M19.1 4.9a10 10 0 0 1 0 14.2"/><circle cx="12" cy="12" r="2"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9h4"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
}
const ico = (d, s = 18) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

/* ------------------------------------------------------------ fragments ---
   `v` is 'now' or 'new'. Only the pieces that genuinely differ branch on it;
   everything else is shared so the comparison is about treatment, not content. */

const dock = (active) =>
  `<nav class="dock">${[
    ['home', 'Home', I.home],
    ['book', 'Book', I.calendar],
    ['queue', 'Queue', I.radio],
    ['blog', 'Blog', I.news],
    ['more', 'More', I.more],
  ]
    .map(
      ([id, label, d]) =>
        `<span class="dock-tab${id === active ? ' is-on' : ''}">${ico(d, 20)}<span>${label}</span></span>`,
    )
    .join('')}</nav>`

/* The four wash stops are WASH_VISIT_STEPS verbatim — Queued, Washing,
   Checking, Payment. The app already renders a labelled rail; what changes is
   how much it is allowed to lead. */
const STOPS = ['Queued', 'Washing', 'Checking', 'Payment']
const rail = (at = 1) => `
  <div class="rail">
    <div class="rail-track"><div class="rail-fill" style="--p:${(at / (STOPS.length - 1)) * 100}%"></div></div>
    <ol class="rail-steps">
      ${STOPS.map(
        (s, i) =>
          `<li class="rail-step${i < at ? ' is-done' : ''}${i === at ? ' is-now' : ''}"><span class="rail-dot"></span><span>${s}</span></li>`,
      ).join('')}
    </ol>
  </div>`

const eyebrow = (t) => `<p class="eyebrow">${t}</p>`

/* ----------------------------------------------------------------- HOME --- */
function home(v) {
  const isNew = v === 'new'
  const heroInner = `
    <div class="hero-bar">
      <div class="hero-copy">
        <img class="logo" src="${isNew ? A.logoOw : A.logoBlue}" alt="Hakum Auto Care">
        <div class="greet-row">
          <p class="greet">Good afternoon,</p>
          <p class="weather"><span class="weather-t">31°</span> Bacoor</p>
        </div>
        <h1>Kirk</h1>
        <p class="hero-sub">ABC 1234 is washing.</p>
      </div>
      <div class="icon-row">
        <span class="icon-btn">${ico(I.bell, 18)}</span>
        <span class="avatar">KO</span>
      </div>
    </div>`

  const ticket = `
    <article class="card${isNew ? ' card-lift' : ''}">
      <div class="card-row">
        <div class="min0">
          ${eyebrow('Active visit')}
          <h2 class="title">Premium Car Wash</h2>
          <p class="meta">Bacoor · <span class="plate">ABC 1234</span> · Toyota Vios</p>
        </div>
        <div class="card-end">
          <span class="badge badge-info">Washing</span>
          <p class="q">W-014<span>Ticket</span></p>
        </div>
      </div>
      ${rail(1)}
      <span class="btn btn-ghost btn-block">${ico(I.radio, 16)} View live queue</span>
    </article>`

  return `
    <div class="app${isNew ? ' is-new' : ''}">
      <header class="hero${isNew ? ' hero-photo' : ''}">${isNew ? `<img class="hero-img" src="${A.hero}" alt="">` : ''}${heroInner}</header>
      <div class="scroll${isNew ? ' scroll-seam' : ''}">
        ${ticket}
        <div class="tiles">
          ${[
            [I.calendar, 'Book a service', 'Schedule your visit'],
            [I.car, 'My cars', '2 saved'],
            [I.clock, 'Events', 'Meets and promos'],
          ]
            .map(
              ([d, t, s]) =>
                `<span class="tile"><span class="tile-ico">${ico(d, 18)}</span><strong>${t}</strong><em>${s}</em></span>`,
            )
            .join('')}
        </div>
        <span class="card">
          ${eyebrow('Loyalty')}
          <h2 class="title">Loyalty program</h2>
          <p class="meta"><span class="num">6</span>/<span class="num">10</span> stamps</p>
          <div class="stamps">${Array.from({ length: 10 }, (_, i) => `<span class="stamp${i < 6 ? ' is-on' : ''}${i === 9 ? ' is-gift' : ''}"></span>`).join('')}</div>
        </span>
        <section class="sect">
          <div class="sect-head">${eyebrow('Live queue')}<span class="sect-note">Bacoor ${ico(I.chev, 14)}</span></div>
          <div class="stats">
            ${[
              ['4', 'Waiting'],
              ['3', 'In wash'],
              ['1', 'Checking'],
            ]
              .map(([n, l]) => `<span class="stat"><b class="num">${n}</b><em>${l}</em></span>`)
              .join('')}
          </div>
        </section>
      </div>
      ${dock('home')}
    </div>`
}

/* ---------------------------------------------------------------- QUEUE --- */
function queue(v) {
  const isNew = v === 'new'
  return `
    <div class="app${isNew ? ' is-new' : ''}">
      ${
        isNew
          ? `<header class="hero hero-photo hero-sm"><img class="hero-img" src="${A.hero}" alt="">
              <div class="hero-bar"><div class="hero-copy">
                <p class="live"><span class="live-dot"></span>Live</p>
                <h1>Live queue</h1><p class="hero-sub">Updated 2:41 PM</p>
              </div></div></header>`
          : `<header class="top"><span class="back">${ico(I.chev, 20)}</span><div><h1>Live queue</h1><p>Real-time view of the current queue.</p></div></header>`
      }
      <div class="scroll${isNew ? ' scroll-seam' : ''}">
        <span class="row${isNew ? ' card-lift' : ''}">
          <span class="row-ico">${ico(I.pin)}</span>
          <span class="row-body"><strong>Bacoor</strong><em>Molino Blvd, Bacoor, Cavite</em>
          <span class="select">Hakum Auto Care Bacoor ${ico(I.chev, 14)}</span></span>
        </span>
        ${isNew ? '' : '<div class="livebar"><span class="live"><span class="live-dot"></span>Live</span><span>Updated 2:41 PM</span></div>'}
        <section class="sect">
          ${isNew ? `<div class="sect-head">${eyebrow('On the floor')}</div>` : ''}
          <div class="stats">
            ${[
              ['4', 'Waiting'],
              ['3', 'In wash'],
              ['1', 'Checking'],
            ]
              .map(([n, l]) => `<span class="stat"><b class="num">${n}</b><em>${l}</em></span>`)
              .join('')}
          </div>
        </section>
        <section class="sect">
          <div class="sect-head">${eyebrow('Your cars')}<span class="sect-note">Bacoor</span></div>
          <article class="card">
            <div class="card-row">
              <div class="min0">${eyebrow('W-014')}<h3 class="title sm"><span class="plate">ABC 1234</span></h3>
              <p class="meta">Premium Car Wash · Toyota Vios</p></div>
              <span class="badge badge-info">Washing</span>
            </div>
            ${rail(1)}
          </article>
        </section>
        <section class="sect">
          <div class="sect-head">${eyebrow('Other branches')}</div>
          ${[
            ['Batangas', '2 waiting · 2 in wash', '5'],
            ['Imus', '0 waiting · 1 in wash', '1'],
          ]
            .map(
              ([n, s, t]) =>
                `<span class="row"><span class="row-ico">${ico(I.pin)}</span><span class="row-body"><strong>${n}</strong><em>${s}</em></span><b class="num">${t}</b><span class="row-chev">${ico(I.chev, 16)}</span></span>`,
            )
            .join('')}
        </section>
      </div>
      ${dock('queue')}
    </div>`
}

/* ----------------------------------------------------------------- BOOK --- */
function book(v) {
  const isNew = v === 'new'
  const svc = [
    ['Premium Car Wash', 'Exterior wash and finish', '₱450', A.carwash],
    ['Interior Detailing', 'Deep cabin care', '₱2,500', A.interior],
    ['Ceramic Coating', 'Gloss and protection', '₱18,000', A.ceramic],
  ]
  return `
    <div class="app${isNew ? ' is-new' : ''}">
      ${
        isNew
          ? `<header class="hero hero-photo hero-sm"><img class="hero-img" src="${A.hero}" alt="">
             <div class="hero-bar"><div class="hero-copy"><p class="live"><span class="live-dot"></span>Book</p>
             <h1>Book a visit</h1><p class="hero-sub">Three steps. Two minutes.</p></div></div></header>`
          : `<header class="top"><span class="back">${ico(I.chev, 20)}</span><div><h1>Book</h1><p>Schedule your visit.</p></div></header>`
      }
      <div class="scroll${isNew ? ' scroll-seam' : ''}">
        <span class="row${isNew ? ' card-lift' : ''}">
          <span class="row-ico">${ico(I.pin)}</span>
          <span class="row-body"><strong>Bacoor</strong><em>Molino Blvd, Bacoor, Cavite</em>
          <span class="select">Hakum Auto Care Bacoor ${ico(I.chev, 14)}</span></span>
        </span>

        <div class="sect-head">${isNew ? `<span class="step-n">01</span>` : ''}${eyebrow('Select a service')}</div>
        <div class="svc-list">
          ${svc
            .map(
              ([t, s, p, img], i) => `
            <span class="svc${i === 0 ? ' is-on' : ''}">
              ${isNew ? `<img class="svc-img" src="${img}" alt="">` : ''}
              <span class="svc-body"><strong>${t}</strong><em>${s}</em></span>
              <span class="price num">${p}</span>
            </span>`,
            )
            .join('')}
        </div>

        <div class="sect-head">${isNew ? `<span class="step-n">02</span>` : ''}${eyebrow('Your car')}</div>
        <div class="card">
          <label class="field"><span>Plate number</span><span class="input"><span class="plate">ABC 1234</span></span>
          <em class="hint">Letters and numbers only.</em></label>
          <label class="field"><span>Vehicle size</span><span class="input">Sedan ${ico(I.chev, 14)}</span></label>
        </div>

        <div class="sect-head">${isNew ? `<span class="step-n">03</span>` : ''}${eyebrow('Date and time')}</div>
        <div class="days">
          ${[
            ['Mon', '15'],
            ['Tue', '16'],
            ['Wed', '17'],
            ['Thu', '18'],
          ]
            .map(
              ([d, n], i) =>
                `<span class="day${i === 1 ? ' is-on' : ''}"><em>${d}</em><b class="num">${n}</b></span>`,
            )
            .join('')}
        </div>
        <label class="field"><span>Time</span><span class="input">10:30 AM ${ico(I.chev, 14)}</span></label>
        <span class="btn btn-fill btn-block">Request booking</span>
      </div>
      ${dock('book')}
    </div>`
}

/* ----------------------------------------------------------------- BLOG --- */
function blog(v) {
  const isNew = v === 'new'
  const posts = [
    ['How often should you really wash your car?', 'Dust, rain and road salt do not wait for your schedule. Here is the honest cadence.', 'Sep 12, 2026', '4', A.carwash],
    ['Ceramic coating vs wax, settled', 'One lasts a season. One lasts years. The difference is chemistry, not marketing.', 'Sep 5, 2026', '6', A.ceramic],
    ['What we find under your floor mats', 'Notes from the interior bay, and what they say about how you drive.', 'Aug 28, 2026', '3', A.interior],
  ]
  return `
    <div class="app${isNew ? ' is-new' : ''}">
      ${
        isNew
          ? `<header class="hero hero-photo hero-sm"><img class="hero-img" src="${A.hero}" alt="">
             <div class="hero-bar"><div class="hero-copy"><p class="live"><span class="live-dot"></span>Blog</p>
             <h1>From the bay</h1><p class="hero-sub">Tips, stories, and everything automotive.</p></div></div></header>`
          : `<header class="top"><span class="back">${ico(I.chev, 20)}</span><div><h1>Blog</h1><p>Tips, stories, and everything automotive.</p></div></header>`
      }
      <div class="scroll${isNew ? ' scroll-seam' : ''}">
        ${posts
          .map(
            ([t, e, d, m, img], i) => `
          <span class="post${isNew && i === 0 ? ' post-lead' : ''}">
            <img class="post-cover" src="${img}" alt="">
            <span class="post-body">
              ${isNew && i === 0 ? eyebrow('Latest') : ''}
              <h3>${t}</h3><p>${e}</p>
              <span class="post-meta"><span>${d} · <span class="num">${m}</span> min read</span>${ico(I.chev, 16)}</span>
            </span>
          </span>`,
          )
          .join('')}
      </div>
      ${dock('blog')}
    </div>`
}

const SCREENS = {
  home: {
    label: 'Home',
    title: 'Home / Account',
    lede: 'The screen a waiting customer opens most. Today it opens on a flat blue-grey rectangle and five cards of equal weight, so nothing answers the only question they came with — where is my car.',
    moves: [
      'Hero carries the site still behind the greeting, so the app opens on photography like every marketing page does.',
      'The live ticket lifts over the hero seam — one card outranks the screen instead of five cards tying.',
      'Plate and ticket number set in Benzin italic with tabular figures.',
      'Section labels take the marketing eyebrow rule.',
      'Status becomes a bordered pill with a dot, so it reads without relying on colour.',
    ],
  },
  queue: {
    label: 'Queue',
    title: 'Live queue',
    lede: 'Counts are already live and already correct. What is missing is the sense that they are live — the numbers sit in body weight at the same size as the labels around them.',
    moves: [
      'The live pulse moves into the hero, where it reads as the state of the page rather than a caption.',
      'Counts set in the display face at scale, tabular so they do not jitter as they update.',
      'Your car gets the four-stop rail in full, not a hairline bar.',
      'Other branches keep the row treatment but gain the display figure on the end.',
    ],
  },
  book: {
    label: 'Book',
    title: 'Book a visit',
    lede: 'The form is one long scroll of equally-weighted fields. It works, but nothing tells you how far in you are or how much is left.',
    moves: [
      'Grouped into 01 Service / 02 Your car / 03 Date and time, numbered in the display face.',
      'Service rows carry the real service photograph, which is also how the marketing site sells them.',
      'Prices in the display face with tabular figures.',
      'Plate input renders in the plate treatment as you type it.',
    ],
  },
  blog: {
    label: 'Blog',
    title: 'Blog',
    lede: 'A flat list of equal cards. The newest post is the one worth reading first, and nothing says so.',
    moves: [
      'The latest post leads at full width with its cover carrying the card.',
      'Hero matches the other three surfaces so the tab bar does not switch visual languages.',
      'Read time set as a display figure.',
    ],
  },
}

const boards = Object.entries(SCREENS)
  .map(
    ([id, s]) => `
<section class="board" data-board="${id}">
  <header class="board-head">
    <h2>${s.title}</h2>
    <p>${s.lede}</p>
  </header>
  <div class="pair">
    <figure class="col">
      <figcaption><span class="tag tag-now">Now</span> on main today</figcaption>
      <div class="phone">${{ home, queue, book, blog }[id]('now')}</div>
    </figure>
    <figure class="col">
      <figcaption><span class="tag tag-new">Proposed</span> CSS on the same components</figcaption>
      <div class="phone">${{ home, queue, book, blog }[id]('new')}</div>
    </figure>
  </div>
  <ul class="moves">${s.moves.map((m) => `<li>${m}</li>`).join('')}</ul>
</section>`,
  )
  .join('')

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hakum customer app — elevation mock</title>
<style>
@font-face{font-family:Benzin;src:url(${A.display}) format('woff2');font-weight:800;font-display:swap}
@font-face{font-family:Benzin;src:url(${A.displayMed}) format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.body}) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.bodyMed}) format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.bodyBold}) format('woff2');font-weight:800;font-display:swap}

:root{--navy:#020a31;--navy2:#071343;--blue:#052699;--paper:#f1f1ed;--ink:#020a31;--steel:#5c6578;--line:rgba(5,38,153,.1)}
*{box-sizing:border-box}
body{margin:0;background:var(--navy);color:#f1f1ed;font:400 15px/1.6 Gilmer,system-ui,sans-serif;-webkit-font-smoothing:antialiased}

/* ---------- mock chrome ---------- */
.wrap{max-width:1180px;margin:0 auto;padding:0 20px 80px}
.masthead{padding:48px 0 26px}
.masthead h1{margin:0;font:800 clamp(1.9rem,4.4vw,3rem)/.98 Benzin,sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:-.01em}
.masthead .sub{margin:12px 0 0;max-width:62ch;color:#95a0cc}
.scope{margin:22px 0 0;padding:16px 18px;border:1px solid #3d51a0;border-radius:12px;background:#050d2e}
.scope b{display:block;font:800 10px/1 Gilmer,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#95a0cc;margin-bottom:9px}
.scope p{margin:0 0 6px;font-size:13.5px;color:#cdd5f0}
.scope p:last-child{margin-bottom:0}
.scope code{font:500 12.5px/1 ui-monospace,monospace;color:#9db4ff}

nav.pills{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;gap:8px;margin:26px 0 8px;padding:12px 0;background:linear-gradient(180deg,var(--navy) 72%,transparent)}
.pill{padding:9px 16px;border:1px solid #3d51a0;border-radius:999px;background:transparent;color:#cdd5f0;font:800 11px/1 Gilmer,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
.pill:hover{border-color:#5a6bc0}
.pill[aria-current=true]{background:#2d59d3;border-color:#2d59d3;color:#fff}

.board{padding:34px 0 10px;border-top:1px solid #1b2a63}
.board:first-of-type{border-top:0}
.board-head h2{margin:0;font:800 clamp(1.4rem,2.6vw,2rem)/1 Benzin,sans-serif;font-style:italic;text-transform:uppercase}
.board-head p{margin:10px 0 0;max-width:72ch;color:#95a0cc;font-size:14.5px}

/* Before and after on the SAME row — two panes stack on narrow screens and
   push the two things being compared apart, which defeats the point. */
.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin:26px 0 0;align-items:start}
.col{margin:0;min-width:0}
figcaption{display:flex;align-items:center;gap:9px;margin:0 0 12px;font-size:12.5px;color:#95a0cc}
.tag{padding:4px 9px;border-radius:5px;font:800 9.5px/1 Gilmer,sans-serif;letter-spacing:.13em;text-transform:uppercase}
.tag-now{background:#1b2a63;color:#cdd5f0}
.tag-new{background:#2d59d3;color:#fff}
.phone{width:375px;max-width:100%;height:706px;margin:0 auto;overflow:hidden;border:1px solid #3d51a0;border-radius:26px;background:#f1f1ed;box-shadow:0 26px 60px -22px rgba(2,10,49,.9)}
.moves{margin:22px 0 0;padding:0 0 0 20px;color:#cdd5f0;font-size:13.8px}
.moves li{margin:0 0 7px}
.moves li::marker{color:#9db4ff}
@media(max-width:860px){.pair{grid-template-columns:1fr}.phone{height:640px}}

/* ---------- the app replica ---------- */
.app{height:100%;display:flex;flex-direction:column;background:#f1f1ed;color:var(--ink);font-family:Gilmer,sans-serif;overflow:hidden}
.app.is-new{--shadow:0 16px 38px -14px rgba(5,38,153,.42)}
.scroll{flex:1;min-height:0;overflow-y:auto;padding:14px 16px 90px;display:flex;flex-direction:column;gap:12px;scrollbar-width:thin}
/* A grid here distributes its rows and clips the taller cards; a column
   stack sizes every child to its own content and scrolls past the rest. */
.scroll > *{flex:none}
.scroll::-webkit-scrollbar{width:5px}.scroll::-webkit-scrollbar-thumb{background:#c9cede;border-radius:9px}
.scroll-seam{margin-top:-34px;position:relative;z-index:2;padding-top:0}

/* hero */
.hero{position:relative;padding:16px 16px 12px;color:var(--ink)}
.hero-photo{padding-bottom:46px;color:#fff;background:var(--navy)}
.hero-photo.hero-sm{padding-bottom:50px}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.62;object-position:50% 38%}
.hero-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,10,49,.34),rgba(2,10,49,.72) 58%,rgba(2,10,49,.96))}
.hero-bar{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.hero-copy{min-width:0}
.logo{display:block;width:118px;height:auto;margin:0 0 10px}
.greet-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.greet{margin:0;font-size:.95rem;font-weight:500;color:var(--steel)}
.hero-photo .greet{color:#b9c4e8}
.weather{margin:0;font-size:.88rem;font-weight:800;white-space:nowrap}
.weather-t{font-variant-numeric:tabular-nums;letter-spacing:-.03em}
.hero h1{margin:2px 0 0;font-size:clamp(1.55rem,6vw,1.9rem);font-weight:800;letter-spacing:-.025em;line-height:1.15}
/* The loudest brand signal the app currently throws away. */
.is-new .hero h1{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:-.01em;line-height:1}
.hero-sub{margin:6px 0 0;max-width:30ch;font-size:.88rem;line-height:1.45;color:var(--steel)}
.hero-photo .hero-sub{color:#b9c4e8}
.icon-row{display:flex;gap:7px;padding-top:2px}
.icon-btn,.avatar{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);font:800 12px/1 Gilmer,sans-serif}
.hero-photo .icon-btn,.hero-photo .avatar{border-color:rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:#fff}
.live{display:inline-flex;align-items:center;gap:7px;margin:0;font:800 10px/1 Gilmer,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#9db4ff}
.live-dot{width:7px;height:7px;border-radius:999px;background:#54df93;box-shadow:0 0 0 3px rgba(84,223,147,.25)}

/* plain top bar (now) */
.top{display:flex;align-items:center;gap:10px;padding:16px 16px 10px}
.back{display:grid;place-items:center;width:34px;height:34px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);flex:none}
.top h1{margin:0;font-size:1.25rem;font-weight:800;letter-spacing:-.02em}
.top p{margin:2px 0 0;font-size:.82rem;color:var(--steel)}

/* cards */
.card,.row,.post,.svc,.tile{background:#fff;border:1px solid var(--line);border-radius:16px}
.card{padding:15px;box-shadow:0 14px 36px rgba(5,38,153,.1)}
.is-new .card{border-radius:18px}
.card-lift{box-shadow:var(--shadow);border-color:rgba(5,38,153,.2)}
.is-new .card-lift{border-width:1.5px}
.card-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.card-end{display:grid;justify-items:end;gap:6px;flex:none}
.min0{min-width:0}
.title{margin:3px 0 0;font-size:1.15rem;font-weight:800;letter-spacing:-.02em;line-height:1.2}
.title.sm{font-size:1.02rem}
.is-new .title{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:-.005em}
.meta{margin:5px 0 0;font-size:.8rem;line-height:1.45;color:var(--steel)}

/* eyebrow — the marketing rule motif the app never picked up */
.eyebrow{margin:0;font-size:.66rem;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--steel)}
.is-new .eyebrow{display:flex;align-items:center;gap:8px;color:#3a53b8}
.is-new .eyebrow::before{content:'';width:16px;height:2px;background:#2d59d3;flex:none}

/* plate + figures in the display face */
.plate{font-weight:800;letter-spacing:.06em}
.is-new .plate{font-family:Benzin,sans-serif;font-style:italic;letter-spacing:.02em}
.num{font-variant-numeric:tabular-nums}
.is-new .num{font-family:Benzin,sans-serif;font-style:italic;letter-spacing:-.01em}
.q{margin:0;font-size:1.5rem;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1;text-align:right;white-space:nowrap}
.is-new .q{font-family:Benzin,sans-serif;font-style:italic;font-size:1.62rem}
.q span{display:block;margin-top:5px;font:800 .62rem/1 Gilmer,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--steel);font-style:normal}

/* status pill — bordered + dot so it reads without colour */
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;font-size:.66rem;font-weight:800;white-space:nowrap;background:#e8edff;color:var(--steel);border:1px solid transparent}
.badge::before{content:'';width:6px;height:6px;border-radius:999px;background:currentColor}
.is-new .badge{background:transparent;border-color:#2d59d3;color:#1f3fae}

/* four-stop rail */
.rail{margin:14px 0 0}
.rail-track{height:4px;border-radius:999px;background:#e2e6f3;overflow:hidden}
.is-new .rail-track{height:5px}
.rail-fill{height:100%;width:var(--p);border-radius:999px;background:#052699}
.is-new .rail-fill{background:linear-gradient(90deg,#2d59d3,#052699)}
.rail-steps{display:grid;grid-template-columns:repeat(4,1fr);margin:9px 0 0;padding:0;list-style:none}
.rail-step{display:grid;justify-items:center;gap:5px;font-size:.6rem;font-weight:500;color:var(--steel);text-align:center}
.rail-dot{width:8px;height:8px;border-radius:999px;background:#c9cede}
.is-new .rail-dot{width:9px;height:9px}
.rail-step.is-done .rail-dot{background:#052699}
.rail-step.is-now .rail-dot{background:#052699;box-shadow:0 0 0 4px rgba(5,38,153,.16)}
.rail-step.is-now{color:var(--ink);font-weight:800}
.is-new .rail-step.is-now{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:.02em}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 15px;border-radius:12px;font-size:.82rem;font-weight:800}
.btn-block{width:100%;margin-top:12px}
.btn-ghost{border:1px solid var(--line);background:#fff;color:var(--blue)}
.btn-fill{background:var(--blue);color:#fff}
.is-new .btn{border-radius:11px;letter-spacing:.04em;text-transform:uppercase;font-size:.75rem}

/* tiles */
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.tile{display:grid;gap:4px;padding:12px 10px}
.tile-ico{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#e8edff;color:var(--blue)}
.tile strong{font-size:.76rem;font-weight:800;line-height:1.25}
.tile em{font-size:.66rem;font-style:normal;color:var(--steel)}

/* stamps */
.stamps{display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin-top:11px}
.stamp{height:22px;border-radius:6px;background:#eceffa;border:1px solid var(--line)}
.stamp.is-on{background:#052699;border-color:#052699}
.stamp.is-gift{background:#e8edff;border:1.5px dashed #2d59d3}

/* sections, stats, rows */
.sect{display:grid;gap:10px}
.sect-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.sect-note{display:inline-flex;align-items:center;gap:4px;font-size:.72rem;font-weight:800;color:var(--blue)}
.step-n{font:800 .95rem/1 Benzin,sans-serif;font-style:italic;color:#2d59d3;margin-right:2px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.stat{display:grid;gap:3px;padding:13px 11px;border-radius:14px;background:#fff;border:1px solid var(--line)}
.stat b{font-size:1.45rem;line-height:1;font-weight:800}
.is-new .stat b{font-size:1.75rem}
.stat em{font-size:.64rem;font-style:normal;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--steel)}
.row{display:flex;align-items:center;gap:11px;padding:13px}
.row-ico{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#e8edff;color:var(--blue);flex:none}
.row-body{min-width:0;flex:1;display:grid;gap:2px}
.row-body strong{font-size:.9rem;font-weight:800}
.is-new .row-body strong{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase}
.row-body em{font-size:.74rem;font-style:normal;color:var(--steel)}
.row-chev{color:var(--steel)}
.select{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;font-size:.78rem;font-weight:500;background:#f7f8fc}
.is-new .select{border-color:#5a6bc0}
.livebar{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;color:var(--steel)}

/* book */
.svc-list{display:grid;gap:9px}
.svc{display:flex;align-items:center;gap:11px;padding:11px}
.svc.is-on{border-color:#2d59d3;box-shadow:0 0 0 1px #2d59d3 inset}
.svc-img{width:56px;height:44px;border-radius:9px;object-fit:cover;flex:none}
.svc-body{flex:1;min-width:0;display:grid;gap:2px}
.svc-body strong{font-size:.86rem;font-weight:800}
.is-new .svc-body strong{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase}
.svc-body em{font-size:.72rem;font-style:normal;color:var(--steel)}
.price{font-size:.92rem;font-weight:800;white-space:nowrap}
.is-new .price{font-size:1rem}
.field{display:grid;gap:5px;margin-top:10px}
.field > span:first-child{font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--steel)}
.input{display:flex;align-items:center;justify-content:space-between;padding:11px;border:1px solid var(--line);border-radius:10px;background:#f7f8fc;font-size:.86rem;font-weight:500}
.is-new .input{border-color:#5a6bc0;background:#fff}
.hint{font-size:.68rem;font-style:normal;color:var(--steel)}
.days{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.day{display:grid;justify-items:center;gap:3px;padding:10px 6px;border:1px solid var(--line);border-radius:12px;background:#fff}
.day em{font-size:.64rem;font-style:normal;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--steel)}
.day b{font-size:1.1rem;font-weight:800}
.day.is-on{border-color:#2d59d3;background:#052699;color:#fff}
.day.is-on em{color:#cfe0ff}

/* blog */
.post{display:grid;overflow:hidden}
.post-cover{width:100%;height:112px;object-fit:cover}
.post-lead .post-cover{height:168px}
.post-body{display:grid;gap:6px;padding:13px}
.post-body h3{margin:0;font-size:.95rem;font-weight:800;line-height:1.3}
.is-new .post-body h3{font-family:Benzin,sans-serif;font-style:italic;text-transform:uppercase;letter-spacing:-.005em;line-height:1.12}
.is-new .post-lead .post-body h3{font-size:1.18rem}
.post-body p{margin:0;font-size:.78rem;line-height:1.5;color:var(--steel)}
.post-meta{display:flex;align-items:center;justify-content:space-between;font-size:.7rem;font-weight:800;color:var(--steel)}

/* dock */
.dock{position:relative;z-index:3;display:grid;grid-template-columns:repeat(5,1fr);gap:2px;padding:9px 8px calc(9px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--line);background:rgba(255,255,255,.96);backdrop-filter:blur(12px)}
.dock-tab{display:grid;justify-items:center;gap:3px;font-size:.6rem;font-weight:800;color:var(--steel)}
.dock-tab.is-on{color:var(--blue)}
.is-new .dock{margin:10px;border:1px solid var(--line);border-radius:18px;box-shadow:0 14px 34px -12px rgba(5,38,49,.3)}
</style></head><body>
<div class="wrap">
  <header class="masthead">
    <h1>Customer app — elevation</h1>
    <p class="sub">Four surfaces, before and after. The proposal is the six moves approved on 2026-09-07, applied to what is on <code style="font-size:13px">main</code> today: display type where the brand is loudest, photography behind the greeting, one card that outranks the screen, and figures set in the display face.</p>
    <div class="scope">
      <b>Scope</b>
      <p><strong>Frontend only.</strong> No backend, no schema, no new fetches. Every number, label and step shown here already exists in the payload the app receives now — the four rail stops are <code>WASH_VISIT_STEPS</code> verbatim, the three counts are <code>QueueStats</code>, the stamp track is <code>StampTrack</code>.</p>
      <p><strong>Where it lands:</strong> <code>src/styles-customer-app.css</code> (2,214 lines today) plus small JSX edits where an element needs a wrapper to style. No new components, fields, data or screens.</p>
      <p><strong>Not touched:</strong> loyalty detail, more/settings, sign-in and sign-up, the ops console, and anything server-side. <code>/account</code>'s mobile clipping bug is a separate fix against main and is not addressed here.</p>
    </div>
  </header>
  <nav class="pills" id="pills">
    <button class="pill" data-go="all" aria-current="true">All</button>
    ${Object.entries(SCREENS).map(([id, s]) => `<button class="pill" data-go="${id}">${s.label}</button>`).join('')}
  </nav>
  ${boards}
</div>
<script>
/* Board switcher, not #anchors: anchors point at hidden sections once a filter
   is on, and a file opened from Finder has no query string to read. */
(function () {
  var pills = [].slice.call(document.querySelectorAll('.pill'))
  var boards = [].slice.call(document.querySelectorAll('.board'))
  function show(go) {
    boards.forEach(function (b) { b.hidden = go !== 'all' && b.dataset.board !== go })
    pills.forEach(function (p) { p.setAttribute('aria-current', String(p.dataset.go === go)) })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  pills.forEach(function (p) { p.addEventListener('click', function () { show(p.dataset.go) }) })
})()
</script>
</body></html>`

const out = path.join(__dirname, 'customer-app.html')
fs.writeFileSync(out, html)
console.log('wrote %s (%s KB)', path.relative(R, out), (Buffer.byteLength(html) / 1024).toFixed(0))

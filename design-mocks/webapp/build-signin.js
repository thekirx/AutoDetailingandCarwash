/* Builds signin.html: the mobile /signin fix, before and two afters.

   Self-contained — every font and image inlined as a data URI so it opens
   straight from Finder. Regenerate with:
     node design-mocks/webapp/build-signin.js */
const fs = require('fs')
const path = require('path')

const R = path.join(__dirname, '..', '..')
const MIME = { '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' }

function uri(rel) {
  const p = path.join(R, rel)
  if (!fs.existsSync(p)) throw new Error('missing asset: ' + rel)
  return `data:${MIME[path.extname(p)]};base64,${fs.readFileSync(p).toString('base64')}`
}

const A = {
  display: uri('public/fonts/benzin-extrabold.woff2'),
  body: uri('public/fonts/gilmer-regular.woff2'),
  bodyMed: uri('public/fonts/gilmer-medium.woff2'),
  bodyBold: uri('public/fonts/gilmer-bold.woff2'),
  markOw: uri('public/branding/hakum-lw-ow.png'),
  hero: uri('src/assets/hero/bredesign-hero-poster.webp'),
}

const ico = (d, s = 16) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const I = {
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  car: '<path d="M19 17h2l-1.5-5.5a2 2 0 0 0-2-1.5h-11a2 2 0 0 0-2 1.5L3 17h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
}

/* The form is identical in all three — only its ground and its lift change, so
   the comparison is about the treatment and not about the fields. */
const form = () => `
  <div class="f-head"><h2>Sign in</h2><p class="f-sub">Welcome back to Hakum Auto Care</p></div>
  <label class="f"><span>Mobile number</span><span class="in"><em>09XXXXXXXXX</em></span></label>
  <a class="f-link">Use email or plate instead</a>
  <label class="f"><span>Password</span><span class="in">${ico(I.eye, 17)}</span></label>
  <a class="f-link f-right">Forgot password?</a>
  <span class="f-btn">Sign in</span>
  <p class="f-demo-h">Demo customer</p>
  <span class="f-demo"><b>Demo customer</b><em>Ready password — no invite needed</em><i>demo.customer@hakumautocare.com</i></span>`

const bullets = () => `
  <ul class="bul">
    <li><span>${ico(I.spark)}</span>Track visits, plates, and service history</li>
    <li><span>${ico(I.car)}</span>See active bookings and live queue load</li>
    <li><span>${ico(I.pin)}</span>Find your nearest Hakum branch</li>
  </ul>`

/* ------------------------------------------------------------------ now --- */
const now = () => `
  <div class="s s-now">
    <header class="head">
      <img class="mark" src="${A.markOw}" alt="Hakum">
      <h1>Give your car the pampering it deserves.</h1>
      <p class="lede">Expert detailing, precision car care, and the shine that turns heads.</p>
    </header>
    <div class="panel"><div class="card">${form()}</div></div>
  </div>`

/* ------------------------------------------------------------------- A ---
   Continuity: the header is the same photographic block the app opens on, and
   the form lifts over its seam the way the live ticket does on /account. */
const optA = () => `
  <div class="s s-a">
    <header class="head head-photo">
      <img class="mark" src="${A.markOw}" alt="Hakum">
      <h1>Give your car the pampering it deserves.</h1>
      <p class="lede">Expert detailing, precision car care, and the shine that turns heads.</p>
    </header>
    <div class="panel panel-seam"><div class="card">${form()}</div></div>
  </div>`

/* ------------------------------------------------------------------- B ---
   Drama: the still fills the screen the way the desktop rail does, and the
   form floats on it translucent. Closer to the desktop page, further from the
   app you land in. */
const optB = () => `
  <div class="s s-b">
    <img class="bleed" src="${A.hero}" alt="">
    <div class="bleed-veil"></div>
    <header class="head">
      <img class="mark" src="${A.markOw}" alt="Hakum">
      <h1>Give your car the pampering it deserves.</h1>
      <p class="lede">Expert detailing, precision car care, and the shine that turns heads.</p>
      ${bullets()}
    </header>
    <div class="panel"><div class="card card-glass">${form()}</div></div>
  </div>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mobile sign-in — the fix</title>
<style>
@font-face{font-family:Benzin;src:url(${A.display}) format('woff2');font-weight:800;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.body}) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.bodyMed}) format('woff2');font-weight:500;font-display:swap}
@font-face{font-family:Gilmer;src:url(${A.bodyBold}) format('woff2');font-weight:800;font-display:swap}
*{box-sizing:border-box}
body{margin:0;background:#020a31;color:#f1f1ed;font:400 15px/1.6 Gilmer,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:0 20px 90px}
.masthead{padding:46px 0 8px}
.masthead h1{margin:0;font:800 clamp(1.8rem,4.2vw,2.8rem)/1 Benzin,sans-serif;font-style:italic;text-transform:uppercase}
.masthead .sub{margin:12px 0 0;max-width:66ch;color:#95a0cc}
.scope{margin:22px 0 0;padding:16px 18px;border:1px solid #3d51a0;border-radius:12px;background:#050d2e}
.scope b{display:block;font:800 10px/1 Gilmer,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#95a0cc;margin-bottom:9px}
.scope p{margin:0 0 7px;font-size:13.5px;color:#cdd5f0}.scope p:last-child{margin-bottom:0}
.scope code{font:500 12.5px/1 ui-monospace,monospace;color:#9db4ff}
.bug{border-color:#8a5a2b;background:#2a1a08}
.bug b{color:#f0b866}

.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin:34px 0 0;align-items:start}
@media(max-width:940px){.row{grid-template-columns:1fr}}
.col{margin:0;min-width:0}
figcaption{display:flex;align-items:center;gap:9px;margin:0 0 6px;font-size:12.5px;color:#95a0cc}
.tag{padding:4px 9px;border-radius:5px;font:800 9.5px/1 Gilmer,sans-serif;letter-spacing:.13em;text-transform:uppercase}
.t-now{background:#5c2020;color:#ffd7d7}.t-a{background:#2d59d3;color:#fff}.t-b{background:#1b6b4a;color:#dcffe9}
.why{margin:0 0 12px;font-size:12.8px;line-height:1.55;color:#cdd5f0;min-height:3.4em}
.ph{width:100%;max-width:390px;height:780px;margin:0 auto;overflow-y:auto;overflow-x:hidden;border:1px solid #3d51a0;border-radius:26px;box-shadow:0 26px 60px -22px rgba(2,10,49,.9);scrollbar-width:thin}
.ph::-webkit-scrollbar{width:5px}.ph::-webkit-scrollbar-thumb{background:#2a3a78;border-radius:9px}

/* ---------- the three screens ---------- */
.s{position:relative;min-height:100%;display:flex;flex-direction:column;font-family:Gilmer,sans-serif;color:#f1f4ff}
.s-now,.s-a{background:radial-gradient(ellipse 90% 45% at 100% -8%,rgba(59,123,255,.28),transparent 60%),#060c24}
.head{position:relative;z-index:2;padding:22px 20px 18px}
.mark{display:block;width:74px;height:auto;margin:0 0 16px}
.head h1{margin:0;font:800 clamp(1.85rem,8vw,2.3rem)/1.02 Benzin,sans-serif;font-style:italic;letter-spacing:-.025em;text-transform:uppercase}
.lede{margin:10px 0 0;font-size:.9rem;line-height:1.5;color:#8e98bd}
.panel{position:relative;z-index:2;padding:4px 20px 26px}
.card{padding:18px 17px 20px;border:1px solid rgba(255,255,255,.08);border-radius:20px;background:#0c1535}

/* A — photographic header + the app's own seam lift */
.head-photo{color:#fff;background:linear-gradient(180deg,rgba(2,10,49,.34),rgba(2,10,49,.72) 58%,rgba(2,10,49,.96)),url(${A.hero}) 50% 38%/cover no-repeat,#020a31;padding-bottom:50px}
.head-photo h1,.head-photo .lede{text-shadow:0 2px 18px rgba(2,10,49,.9)}
.head-photo .lede{color:#d3dbf5}
.panel-seam{margin-top:-34px}
.panel-seam .card{border-color:rgba(255,255,255,.14);box-shadow:0 18px 40px -14px rgba(2,6,28,.75)}

/* B — full-bleed still */
.s-b{background:#020a31}
.bleed{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 38%}
.bleed-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,10,49,.5),rgba(2,10,49,.82) 46%,rgba(2,10,49,.96))}
.card-glass{border-color:rgba(255,255,255,.2);background:rgba(8,16,44,.76);backdrop-filter:blur(16px)}
.bul{margin:16px 0 0;padding:0;list-style:none;display:grid;gap:9px}
.bul li{display:flex;align-items:center;gap:10px;font-size:.8rem;color:#dbe2fa}
.bul span{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:rgba(255,255,255,.14);color:#fff;flex:none}

/* ---------- the form ---------- */
.f-head h2{margin:0;font:800 1.5rem/1 Benzin,sans-serif;font-style:italic;text-transform:uppercase}
.f-sub{margin:7px 0 16px;font-size:.85rem;color:#8e98bd}
.f{display:grid;gap:6px;margin:0 0 10px}
.f>span:first-child{font-size:.68rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:#8e98bd}
.in{display:flex;align-items:center;justify-content:flex-end;min-height:46px;padding:0 13px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:rgba(255,255,255,.04);color:#8e98bd}
.in em{flex:1;font-style:normal;font-size:.92rem;color:#6f7aa6}
.f-link{display:block;margin:0 0 12px;font-size:.82rem;font-weight:800;color:#6f9dff}
.f-right{text-align:right}
.f-btn{display:grid;place-items:center;min-height:46px;margin:4px 0 0;border-radius:999px;background:#e9eefc;color:#052699;font-size:.8rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
.f-demo-h{margin:18px 0 8px;font-size:.62rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#6f7aa6}
.f-demo{display:grid;gap:3px;padding:11px 12px;border:1px solid rgba(255,255,255,.14);border-radius:13px;background:rgba(255,255,255,.04)}
.f-demo b{font-size:.84rem}
.f-demo em,.f-demo i{font-style:normal;font-size:.7rem;color:#8e98bd;overflow-wrap:anywhere}
</style></head><body>
<div class="wrap">
  <header class="masthead">
    <h1>Mobile sign-in</h1>
    <p class="sub">The phone version of <code style="font-size:13px">/signin</code> against two ways of fixing it. Desktop is not touched by any of this.</p>
    <div class="scope bug">
      <b>What is actually wrong</b>
      <p>The hero still <em>is</em> loaded on mobile — <code>--hakum-auth-img</code> is set on the root element, so the phone downloads all 97 kB of it. Then <code>.hakum-auth--app .hakum-auth-brand</code> sets <code>background: transparent</code> and throws it away. Computed <code>background-image</code> on that element at 375px is literally <code>none</code>.</p>
      <p>So the phone pays for a photograph and is shown a flat navy wall. The three value bullets are <code>display:none</code> there too, which is the rest of the reason the screen has nothing in it.</p>
      <p>It also now reads worse than it used to: after signing in you land on an app header that <em>does</em> carry that still, so the one jump a customer makes is flat wall → photograph.</p>
    </div>
    <div class="scope">
      <b>Scope</b>
      <p><strong>Frontend only, and CSS only.</strong> Both options are rules inside the existing <code>@media (max-width: 899px)</code> block in <code>src/styles-customer-app.css</code>. No markup change — the photo, the wordmark and the bullets are all already in <code>HakumAuthShell.jsx</code>; two of the three are just being hidden.</p>
      <p><strong>Not touched:</strong> the desktop split, the form fields, the demo chip, sign-up, set-password, and the ops login that shares this shell on <code>variant="default"</code>.</p>
    </div>
  </header>

  <div class="row">
    <figure class="col">
      <figcaption><span class="tag t-now">Now</span> on main today</figcaption>
      <p class="why">Flat <code>#060c24</code> with a blue glow. The photograph is downloaded and discarded; the bullets are hidden. Nothing on the screen is Hakum except the headline.</p>
      <div class="ph">${now()}</div>
    </figure>
    <figure class="col">
      <figcaption><span class="tag t-a">Option A</span> continuous with the app</figcaption>
      <p class="why">The header becomes the same photographic block <code>/account</code> opens on, and the form lifts over its seam exactly like the live-ticket card does. Signing in stops being a visual jump.</p>
      <div class="ph">${optA()}</div>
    </figure>
    <figure class="col">
      <figcaption><span class="tag t-b">Option B</span> continuous with desktop</figcaption>
      <p class="why">The still fills the screen the way the desktop rail does, form floating on it translucent, and the three bullets come back. More dramatic, but it is its own thing rather than a lead-in to the app.</p>
      <div class="ph">${optB()}</div>
    </figure>
  </div>
</div>
</body></html>`

const out = path.join(__dirname, 'signin.html')
fs.writeFileSync(out, html)
console.log('wrote %s (%s KB)', path.relative(R, out), (Buffer.byteLength(html) / 1024).toFixed(0))

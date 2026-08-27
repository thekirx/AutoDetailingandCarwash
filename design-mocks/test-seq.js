const puppeteer = require('/Users/kiro/Desktop/AutoDetailingandCarwash/node_modules/puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file://' + path.resolve(__dirname, 'mock-e.html'), { waitUntil: 'networkidle0' });

  // Wait for the preloader to finish.
  await p.waitForFunction(() => {
    const l = document.getElementById('seqLoad');
    return l && l.style.display === 'none';
  }, { timeout: 60000 }).catch(() => console.log('!! preloader never completed'));

  const trackH = await p.evaluate(() => document.getElementById('seqTrack').offsetHeight);
  console.log('track height:', trackH + 'px  (viewport 900)');

  const samples = await p.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const track = document.getElementById('seqTrack');
    const cv = document.getElementById('seqCanvas');
    const top = track.getBoundingClientRect().top + scrollY;
    const total = track.offsetHeight - innerHeight;
    const out = [];
    for (const frac of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      window.scrollTo(0, top + total * frac);
      await wait(220);
      // Hash a slice of canvas pixels to prove the frame actually changed.
      const c = document.createElement('canvas'); c.width = 40; c.height = 24;
      c.getContext('2d').drawImage(cv, 0, 0, 40, 24);
      const d = c.getContext('2d').getImageData(0, 0, 40, 24).data;
      let h = 0; for (let i = 0; i < d.length; i += 17) h = (h * 31 + d[i]) >>> 0;
      const on = [...document.querySelectorAll('.chapter')].findIndex(e => e.classList.contains('on'));
      const rails = [...document.querySelectorAll('.seq-rail i')].filter(e => e.classList.contains('fill')).length;
      out.push({ frac, hash: h, chapter: on, rails });
    }
    return out;
  });
  console.log('\nfrac   canvasHash    chapter  railsFilled');
  samples.forEach(s => console.log(
    String(s.frac).padEnd(6), String(s.hash).padStart(11), '   ',
    String(s.chapter).padStart(2), '        ', s.rails));
  const uniq = new Set(samples.map(s => s.hash)).size;
  console.log('\ndistinct frames rendered:', uniq, 'of', samples.length);
  console.log(errs.length ? 'ERRORS: ' + errs.join('; ') : 'no page errors');
  await b.close();
})();

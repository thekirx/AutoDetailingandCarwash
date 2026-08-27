const puppeteer = require('/Users/kiro/Desktop/AutoDetailingandCarwash/node_modules/puppeteer');
const path = require('path');
(async () => {
  const [file, outBase, widthArg, hash] = process.argv.slice(2);
  const width = Number(widthArg) || 1440;
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(file) + (hash || ''), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));
  // Reveal-on-scroll needs a pass down the page before a full-height capture.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 400));
  });
  const stats = await page.evaluate(() => {
    const all = document.querySelectorAll('.reveal');
    const done = document.querySelectorAll('.reveal.in');
    // Capture the settled end-state: the reveal is a scroll effect, and a
    // full-page shot should show what the visitor ends up seeing.
    all.forEach(el => el.classList.add('in'));
    return { total: all.length, revealedByScroll: done.length };
  });
  await new Promise(r => setTimeout(r, 500));
  const h = await page.evaluate(() => document.body.scrollHeight);
  console.log(`reveals: ${stats.revealedByScroll}/${stats.total} fired on scroll`);
  await page.screenshot({ path: `${outBase}.png`, fullPage: true });
  console.log(`${path.basename(outBase)}.png  ${width}px wide, ${h}px tall`);
  if (errors.length) console.log('CONSOLE ERRORS:\n  ' + errors.join('\n  '));
  else console.log('no console errors');
  await browser.close();
})();

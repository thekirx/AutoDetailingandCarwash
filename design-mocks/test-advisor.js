const puppeteer = require('/Users/kiro/Desktop/AutoDetailingandCarwash/node_modules/puppeteer');
const path = require('path');
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox'] });
  const scenarios = [
    ['new','open','long',   'new car, open parking, keeping it'],
    ['worn','garage','short','worn paint, garaged, selling soon'],
    ['used','mixed','mid',   'few years old, mixed parking, 3-5 yrs'],
  ];
  for (const [age, park, hold, label] of scenarios) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.setViewport({ width: 1280, height: 900 });
    await p.goto('file://' + path.resolve(__dirname, 'mock-d.html'), { waitUntil: 'networkidle0' });
    const r = await p.evaluate(async ({age,park,hold}) => {
      const wait = ms => new Promise(r=>setTimeout(r,ms));
      const pick = (n,v) => { const el=document.querySelector(`input[name="${n}"][value="${v}"]`);
        el.checked = true; el.dispatchEvent(new Event('change',{bubbles:true})); };
      const next = document.getElementById('wiz-next');
      const disabledBefore = next.disabled;
      pick('age',age); await wait(30);
      const enabledAfter = !next.disabled;
      next.click(); await wait(30);
      pick('park',park); await wait(30); next.click(); await wait(30);
      pick('hold',hold); await wait(30); next.click(); await wait(120);
      const res = document.getElementById('wiz-result');
      return { disabledBefore, enabledAfter, resultShown: !res.hidden,
               title: document.getElementById('res-title').textContent,
               items: [...document.querySelectorAll('#res-stack li')].map(li => ({
                 rank: li.querySelector('.rank').textContent,
                 t: li.querySelector('h4').textContent })),
               live: document.getElementById('wiz-live').textContent };
    }, {age,park,hold});
    console.log('\n■ ' + label);
    console.log('  gate: disabled before pick=' + r.disabledBefore + ', enabled after=' + r.enabledAfter);
    console.log('  result shown: ' + r.resultShown + '  |  "' + r.title + '"');
    r.items.forEach(i => console.log('    [' + i.rank + '] ' + i.t));
    if (errs.length) console.log('  PAGE ERRORS: ' + errs.join('; '));
    await p.close();
  }
  await b.close();
})();

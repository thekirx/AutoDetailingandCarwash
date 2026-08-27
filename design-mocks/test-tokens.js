const puppeteer = require('/Users/kiro/Desktop/AutoDetailingandCarwash/node_modules/puppeteer');
const path = require('path');
const EXPECT = {
  '--hk-paper':'#F1F1ED','--hk-paper-2':'#E7E7E1','--hk-white':'#FFFFFF',
  '--hk-navy':'#020A31','--hk-navy-2':'#08133F','--hk-navy-3':'#0D1B52',
  '--hk-rule-dark':'#16255C','--hk-blue':'#052699','--hk-blue-hover':'#0A32B8',
  '--hk-blue-active':'#031D78','--hk-blue-soft':'#E8EDFF','--hk-blue-mid':'#2D59D3',
  '--hk-accent':'#9DB4FF','--hk-ink':'#333333','--hk-ink-2':'#5A5A5A',
  '--hk-ink-3':'#84847E','--hk-rule':'#DCDCD5','--hk-on-navy':'#7E8AB8',
  '--hk-on-navy-dim':'#6E79A8',
};
(async () => {
  const b = await puppeteer.launch({ args: ['--no-sandbox'] });
  let bad = 0;
  for (const f of ['mock-a','mock-b','mock-c','mock-d','mock-e','mock-f']) {
    const p = await b.newPage();
    await p.goto('file://' + path.resolve(__dirname, f + '.html'), { waitUntil: 'networkidle0' });
    const got = await p.evaluate(names => {
      const cs = getComputedStyle(document.documentElement);
      const out = {};
      names.forEach(n => out[n] = cs.getPropertyValue(n).trim());
      // Also confirm nothing on the page resolves a colour to nothing.
      const broken = [...document.querySelectorAll('*')].filter(e => {
        const c = getComputedStyle(e);
        return c.color === '' || c.backgroundColor === '';
      }).length;
      return { out, broken };
    }, Object.keys(EXPECT));
    const wrong = Object.entries(EXPECT)
      .filter(([k, v]) => got.out[k].toUpperCase() !== v.toUpperCase())
      .map(([k, v]) => `${k}: got "${got.out[k]}" want ${v}`);
    bad += wrong.length;
    console.log(f.padEnd(9), wrong.length ? 'MISMATCH' : 'all 19 tokens correct',
                wrong.length ? '\n   ' + wrong.join('\n   ') : '');
    await p.close();
  }
  console.log(bad ? `\n${bad} token mismatches` : '\nAll six mocks resolve an identical palette.');
  await b.close();
})();

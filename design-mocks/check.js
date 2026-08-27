const fs = require('fs');
const file = process.argv[2];
const h = fs.readFileSync(file, 'utf8');
console.log('--- ' + file.split('/').pop() + ' ---');
console.log('unresolved placeholders:', (h.match(/__A_[A-Za-z0-9]+__/g) || []).length);
console.log('size MB:', (h.length / 1048576).toFixed(2));
['<!DOCTYPE', '<html', '<head>', '<body'].forEach(f => { if (h.includes(f)) console.log('FORBIDDEN TAG:', f); });
console.log('title:', (h.match(/<title>(.*?)<\/title>/) || [])[1]);
const tags = ['div','section','main','a','p','ul','li','figure','nav','header','footer','span','strong','blockquote','h1','h2','h3'];
let bad = 0;
for (const t of tags) {
  const o = (h.match(new RegExp('<' + t + '[ >]', 'g')) || []).length;
  const c = (h.match(new RegExp('</' + t + '>', 'g')) || []).length;
  if (o !== c) { console.log('UNBALANCED', t, 'open', o, 'close', c); bad++; }
}
console.log(bad ? 'TAG ISSUES: ' + bad : 'tags balanced');

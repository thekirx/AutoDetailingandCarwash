const fs = require('fs');
const path = require('path');
const S = __dirname;
const assets = JSON.parse(fs.readFileSync(path.join(S, 'assets.json'), 'utf8'));
const src = process.argv[2];
const out = process.argv[3];
let html = fs.readFileSync(path.join(S, src), 'utf8');
// The frame sequence injects as one JSON array rather than a single URI.
if (html.includes('__A_FRAMES_JSON__')) {
  html = html.replace(/__A_FRAMES_JSON__/g, JSON.stringify(assets.__FRAMES__ || []));
}
const missing = new Set();
html = html.replace(/__A_([A-Za-z0-9]+)__/g, (m, key) => {
  if (!assets[key]) { missing.add(key); return m; }
  return assets[key];
});
if (missing.size) { console.error('MISSING ASSETS:', [...missing].join(', ')); process.exit(1); }
fs.writeFileSync(path.join(S, out), html);
console.log(`${out}  ${(html.length/1048576).toFixed(2)} MB`);

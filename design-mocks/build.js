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

/* A large asset used twice — mock B plays the hero clip again in its gallery —
   would otherwise be carried twice as base64. Keep the first copy inline and
   point later ones at it, so the page ships each byte once. */
const seen = new Map();
let n = 0, saved = 0;
const parts = [];
let i = 0;
for (;;) {
  const at = html.indexOf('src="data:', i);
  if (at < 0) { parts.push(html.slice(i)); break; }
  const from = at + 5;                 // start of the quoted value
  const to = html.indexOf('"', from + 1);
  const uri = html.slice(from + 1, to);
  parts.push(html.slice(i, at));
  if (uri.length < 500000) {
    parts.push(html.slice(at, to + 1));
  } else if (!seen.has(uri)) {
    seen.set(uri, n);
    parts.push(`data-src-def="${n++}" `, html.slice(at, to + 1));
  } else {
    saved += uri.length;
    parts.push(`data-src-ref="${seen.get(uri)}"`);
  }
  i = to + 1;
}
html = parts.join('');
if (saved) {
  html += `\n<script>\n(function(){var d={};\ndocument.querySelectorAll('[data-src-def]').forEach(function(e){d[e.dataset.srcDef]=e.getAttribute('src');});\ndocument.querySelectorAll('[data-src-ref]').forEach(function(e){e.setAttribute('src',d[e.dataset.srcRef]);var v=e.closest('video');if(v)v.load();});\n})();\n</script>\n`;
  console.log(`  deduped ${(saved/1048576).toFixed(2)} MB of repeated assets`);
}

fs.writeFileSync(path.join(S, out), html);
console.log(`${out}  ${(html.length/1048576).toFixed(2)} MB`);

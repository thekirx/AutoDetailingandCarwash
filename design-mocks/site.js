/* Wraps the built mocks into a deployable static site.
 *
 * The mocks are authored headless because they were made to be published as
 * Artifacts, where the host supplies the document skeleton. Hosting them
 * ourselves means supplying it here instead — without a charset the entities
 * are the only reason the copy survives, and without a viewport tag every
 * mobile-first layout would render at desktop width on a phone.
 *
 * Run after build.js:  node design-mocks/site.js
 */
const fs = require('fs');
const path = require('path');
const S = __dirname;
const OUT = path.join(S, 'site');

// The index links out to the Artifact copies. Hosted, it should link to its
// neighbours instead.
const ARTIFACTS = {
  'abab33d9-3e24-4664-bba2-5ca80c357465': 'a',
  'cfed0ded-35ae-420c-959f-11d39edbeda0': 'b',
  'eca9ee24-2dc4-423d-b108-d312f83fb089': 'c',
  'ed6c519f-c813-4b5b-a0fa-5332c4ffee09': 'd',
  '0d743e14-c6a3-4b5f-ad50-3f570ab68986': 'e',
  'e808d700-e0b9-4bbc-b135-78760f275d3b': 'f',
};

const PAGES = [
  ['index', 'index', 'Six prototypes of the Hakum public site, for owner review.'],
  ['a', 'a', 'Mock A — sells on specification: thickness, coverage, warranty years.'],
  ['b', 'b', 'Mock B — the client sketch followed box for box.'],
  ['c', 'c', 'Mock C — the current identity kept intact and pushed harder.'],
  ['d', 'd', 'Mock D — a three-question advisor for choosing a service.'],
  ['e', 'e', 'Mock E — a real PPF install scrubbed frame by frame on scroll.'],
  ['f', 'f', 'Mock F — mobile-first booking with live branch status.'],
];

const assets = JSON.parse(fs.readFileSync(path.join(S, 'assets.json'), 'utf8'));
const icon = assets.markOw;

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// Clear the generated pages but keep .vercel — it holds the link to the
// hosting project, and losing it makes the next deploy create a new one.
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f === '.vercel') continue;
  fs.rmSync(path.join(OUT, f), { recursive: true, force: true });
}

for (const [src, slug, description] of PAGES) {
  let body = fs.readFileSync(path.join(S, `mock-${src}.html`), 'utf8');

  const title = (body.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
  if (!title) { console.error(`no <title> in mock-${src}.html`); process.exit(1); }
  body = body.replace(/<title>[\s\S]*?<\/title>\s*/, '');

  for (const [id, letter] of Object.entries(ARTIFACTS)) {
    body = body.split(`https://claude.ai/code/artifact/${id}`).join(`./${letter}.html`);
  }

  // These are unapproved prototypes carrying placeholder reviews and sample
  // queue figures. They should not turn up in search results.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#020A31">
<title>${title}</title>
<link rel="icon" href="${icon}">
</head>
<body>
${body}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, `${slug}.html`), html);
  console.log(`site/${slug}.html  ${(html.length / 1048576).toFixed(2)} MB  ${title}`);
}

// Static output, no framework, no build step — Vercel serves the folder as is.
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({
  cleanUrls: true,
  headers: [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ],
  }],
}, null, 2) + '\n');

const total = fs.readdirSync(OUT)
  .reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`\nsite/  ${(total / 1048576).toFixed(1)} MB total, ready to deploy`);

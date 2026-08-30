/* Regenerates assets.json, then builds and checks all six mocks.
   node design-mocks/all.js */
const { execFileSync } = require('child_process');
const path = require('path');
const S = __dirname;
const MOCKS = [
  ['v1/a-measured-finish', 'a'], ['v1/b-sketch-built-out', 'b'],
  ['v1/c-hakum-amplified', 'c'], ['v2/d-advisor', 'd'],
  ['v2/e-sequence', 'e'], ['v2/f-know-before-you-go', 'f'],
  ['index', 'index'],
];
const run = (script, args) =>
  process.stdout.write(execFileSync('node', [path.join(S, script), ...args]));

run('assets.js', []);
for (const [src, id] of MOCKS) run('build.js', [src + '.src.html', `mock-${id}.html`]);
for (const [, id] of MOCKS) run('check.js', [path.join(S, `mock-${id}.html`)]);
run('site.js', []);   // wraps the built mocks into design-mocks/site/ for hosting

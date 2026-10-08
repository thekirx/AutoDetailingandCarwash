/**
 * Seam: design-token consistency (Slice E).
 *
 * BUG-059: the floor money panel hardcoded `#052699` and `#b9b9b0` inline. The
 * first is `--color-brand-primary` (and also `--status-paid`), so a brand
 * change would have left the chart and the share bars showing last season's
 * navy; the second had no token at all, meaning the prior-period series had no
 * owner in the design system.
 *
 * These assertions are about the *system*, not about one file: any raw hex in
 * an ops surface must either be a third-party brand mark (the Google Maps and
 * Waze glyphs, which must stay literal) or be reachable from a token.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const tokens = read('src/design-tokens.css')
const styles = read('src/styles.css')

/** Every hex literal defined in the token files. */
function tokenHexes(src) {
  return new Set(
    [...src.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()),
  )
}
const tokenPalette = new Set([...tokenHexes(tokens), ...tokenHexes(styles)])

/** Third-party marks that are legitimately literal and must not be tokenised. */
const ALLOWED_LITERAL = new Set([
  '#ea4335', // Google Maps pin
  '#33ccff', // Waze
])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(jsx?|mjs)$/.test(entry)) out.push(full)
  }
  return out
}

test('the prior-period chart series has a token', () => {
  assert.match(
    tokens,
    /--color-chart-prior:\s*#b9b9b0/,
    'the floor money comparison series must be a named token, not an inline hex',
  )
})

test('the floor money panel references tokens instead of repeating hexes', () => {
  const src = read('src/pages/FloorMoneyPanel.jsx')
  const hexes = [...stripComments(src).matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase())
  assert.deepEqual(hexes, [], `FloorMoneyPanel must not hardcode colours: ${hexes.join(', ')}`)
  assert.match(src, /var\(--color-brand-primary\)/)
  assert.match(src, /var\(--color-chart-prior\)/)
})

/**
 * Known offenders, one per hardcoded occurrence, as of 2026-10-08 (BUG-060).
 * Most are the brand navy `#052699` (= --color-brand-primary) and the cinematic
 * surface `#020a31` (= --color-surface-cinematic) repeated in finance/planning
 * modules. Rewriting 31 literals across 15 files is a visual change that needs
 * a per-file look, so it is tracked rather than blind-edited. The point of this
 * list is that the count may only go DOWN: adding a new one fails the build.
 */
const KNOWN_TOKEN_DUPLICATES = [
  'src/components/PPFVisualizer.jsx: #ccff00',
  'src/lib/detailingCompletion.js: #c4a35a',
  'src/lib/financeData.js: #0f172a',
  'src/lib/financeData.js: #475569',
  'src/lib/financeData.js: #020a31',
  'src/lib/financeData.js: #e2e8f0',
  'src/lib/financeData.js: #f8fafc',
  'src/lib/opsForms.js: #ffffff',
  'src/lib/opsRoadmap.js: #e0f2fe',
  'src/lib/opsRoadmap.js: #10b981',
  'src/lib/opsRoadmap.js: #f1f5f9',
  'src/lib/opsRoadmap.js: #64748b',
  'src/lib/opsRoadmap.js: #0f172a',
  'src/lib/opsRoadmap.js: #e8edff',
  'src/lib/opsRoadmap.js: #052699',
  'src/lib/opsRoadmap.js: #031d78',
  'src/lib/plannerBoard.js: #052699',
  'src/lib/plannerBoard.js: #020a31',
  'src/lib/plannerBoard.js: #c4a35a',
  'src/lib/plannerBoard.js: #334155',
  'src/lib/plannerBoard.js: #64748b',
  'src/pages/finance/FinanceDailySheetsTab.jsx: #052699',
  'src/pages/finance/FinanceDailySheetsTab.jsx: #052699',
  'src/pages/finance/FinanceDailySheetsTab.jsx: #052699',
  'src/pages/finance/FinanceHomeTab.jsx: #052699',
  'src/pages/finance/FinanceHomeTab.jsx: #020a31',
  'src/pages/finance/FinancePLTab.jsx: #b91c1c',
  'src/pages/finance/FinanceReportsTab.jsx: #94a3b8',
  'src/pages/finance/FinanceSalesSummary.jsx: #052699',
  'src/pages/planning/PlanningFormsSmartPanel.jsx: #38bdf8',
  'src/pages/pos/PosTodayPanel.jsx: #052699',
  'src/pages/pos/PosTodayPanel.jsx: #b9b9b0',
  'src/pages/pos/PosTodayPanel.jsx: #052699',
]

function tokenDuplicateOffenders() {
  const offenders = []
  for (const file of walk(join(root, 'src'))) {
    const rel = relative(root, file).split('\\').join('/')
    const src = stripComments(readFileSync(file, 'utf8'))
    for (const m of src.matchAll(/#[0-9a-f]{6}\b/gi)) {
      const hex = m[0].toLowerCase()
      if (ALLOWED_LITERAL.has(hex)) continue
      if (!tokenPalette.has(hex)) continue // not a colour the system knows about
      offenders.push(`${rel}: ${hex}`)
    }
  }
  return offenders
}

test('no NEW inline colour duplicates a token (BUG-060 baseline)', () => {
  const offenders = tokenDuplicateOffenders()
  const fresh = offenders.filter((o) => !KNOWN_TOKEN_DUPLICATES.includes(o))
  assert.deepEqual(
    fresh,
    [],
    `these repeat a tokenised colour inline; use the token so a brand change propagates: ${fresh.join(', ')}`,
  )
  // Removing one is progress, not a failure: shrink the baseline with the fix.
  assert.ok(
    offenders.length <= KNOWN_TOKEN_DUPLICATES.length,
    `expected at most ${KNOWN_TOKEN_DUPLICATES.length} known duplicates, found ${offenders.length}`,
  )
})

test('the baseline list still matches reality', () => {
  // A baseline that silently goes stale is worse than none: delete an entry from
  // KNOWN_TOKEN_DUPLICATES only when the literal is actually gone.
  const actual = tokenDuplicateOffenders()
  const missing = KNOWN_TOKEN_DUPLICATES.filter((o) => !actual.includes(o))
  assert.deepEqual(
    missing,
    [],
    `these are listed as known duplicates but no longer occur — remove them from the baseline: ${missing.join(', ')}`,
  )
})

test('every token referenced by the floor money panel actually exists', () => {
  const src = read('src/pages/FloorMoneyPanel.jsx')
  // ChartContainer emits `--color-<dataKey>` from chartConfig at runtime, so
  // those two are generated rather than declared and must not be looked up here.
  const chartKeys = new Set(
    [...src.matchAll(/dataKey="([^"]+)"[^>]*fill="var\(--color-[^)]+\)"/g)].map((m) => m[1]),
  )
  const referenced = [...src.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1])
  assert.ok(referenced.length > 0, 'the panel must reference CSS variables')
  for (const name of new Set(referenced)) {
    const key = name.replace('--color-', '')
    if (chartKeys.has(key)) {
      assert.match(
        src,
        new RegExp(`${key}:\\s*\\{[^}]*color:\\s*'var\\(--[a-z0-9-]+\\)'`),
        `${name} is generated from chartConfig, so chartConfig.${key}.color must itself be a token reference`,
      )
      continue
    }
    assert.match(
      `${tokens}\n${styles}`,
      new RegExp(`${name}\\s*:`),
      `${name} is used by FloorMoneyPanel but never defined`,
    )
  }
})

test('the token files stay internally consistent', () => {
  // Shape lock the previous test file already covered, kept here so this file
  // stands alone as the design-system contract.
  assert.match(tokens, /--shape-interactive:/)
  assert.match(tokens, /--shape-card:/)
  assert.match(tokens, /--status-queued:/)
  assert.match(tokens, /--capp-navy:\s*var\(--color-brand-primary\)/)
  assert.match(styles, /--primary:\s*var\(--color-brand-primary\)/)
  assert.doesNotMatch(styles, /@fontsource-variable\/geist/)
  assert.match(styles, /--font-sans:\s*var\(--font-ops\)/)

  // No token may be defined twice with different values: the later one silently
  // wins and the two call sites stop agreeing.
  const seen = new Map()
  const clashes = []
  for (const m of tokens.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const [, name, value] = m
    if (seen.has(name) && seen.get(name) !== value.trim()) {
      clashes.push(`${name}: ${seen.get(name)} vs ${value.trim()}`)
    }
    seen.set(name, value.trim())
  }
  assert.deepEqual(clashes, [], `conflicting token definitions: ${clashes.join('; ')}`)
})
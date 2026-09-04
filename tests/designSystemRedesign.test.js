import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

test('CommandShell mounts CommandMenu and breadcrumbs', () => {
  const layout = read('src/layouts/OperationsLayout.jsx')
  assert.match(layout, /CommandMenu/)
  assert.match(layout, /aria-label="Breadcrumb"/)
  assert.match(layout, /⌘K|Open command menu/)
})

test('CommandShell sidebar uses approved blue lockup + OW mark', () => {
  const layout = read('src/layouts/OperationsLayout.jsx')
  const css = read('src/styles.css')
  assert.match(layout, /CommandRailBrand/)
  assert.match(layout, /hakum-lw-blue\.png/)
  assert.match(layout, /hakum-mark-ow\.png/)
  assert.match(layout, /aria-label="Hakum Auto Care home"/)
  assert.match(css, /\.command-rail-logo/)
  assert.match(css, /transform:\s*scale\(1\.55\)/)
  assert.match(css, /\.command-rail-who-name/)
})

test('FloorAppShell uses tablet rail + ResponsiveSheet more menu (no phone-on-bay)', () => {
  const layout = read('src/layouts/OperationsLayout.jsx')
  const css = read('src/styles.css')
  assert.match(layout, /floor-rail-aside/)
  assert.match(layout, /ResponsiveSheet/)
  assert.match(layout, /md:hidden/)
  assert.doesNotMatch(css, /width: min\(100%, 430px\)/)
  assert.match(css, /\.floor-rail-item/)
})

test('design system docs exist for foundations and role/page guides', () => {
  assert.ok(fs.existsSync(path.join(root, 'docs/design-system/README.md')))
  assert.ok(fs.existsSync(path.join(root, 'docs/design-system/01-foundations.md')))
  assert.ok(fs.existsSync(path.join(root, 'docs/guides/roles/team-lead.md')))
  assert.ok(fs.existsSync(path.join(root, 'docs/guides/pages/pos.md')))
  assert.ok(fs.existsSync(path.join(root, 'docs/guides/pages/customer-app.md')))
})

test('Phase 4: status token pairs + floor/capp touch targets', () => {
  const tokens = read('src/design-tokens.css')
  const css = read('src/styles.css')
  const capp = read('src/styles-customer-app.css')
  for (const key of ['queued', 'washing', 'detailing', 'ready', 'paid', 'void', 'late', 'absent']) {
    assert.match(tokens, new RegExp(`--status-${key}:`))
    assert.match(tokens, new RegExp(`--status-${key}-soft:`))
  }
  assert.match(css, /--floor-touch:\s*3rem/)
  assert.match(css, /\.floor-dock-item\s*\{[^}]*min-height:\s*3\.5rem/s)
  assert.match(css, /\.floor-dock\s*\{[^}]*safe-area-inset-bottom/s)
  assert.match(capp, /safe-area-inset-top/)
  assert.match(capp, /\.capp-dock/)
  assert.doesNotMatch(css, /@fontsource-variable\/geist/)
})

test('ops CSS has no html:not(.dark) light-rewrite layer', () => {
  const css = read('src/styles.css')
  assert.doesNotMatch(css, /html:not\(\.dark\)/)
  assert.match(css, /\.floor-control\s*\{[^}]*background:\s*#ffffff/s)
})

test('queue table uses StatusBadge; ASA grants use matrix editor', () => {
  const queue = read('src/pages/OperationsPages.jsx')
  assert.match(queue, /StatusBadge/)
  assert.doesNotMatch(queue, /statusTone|queue-status-pill/)
  const badge = read('src/components/ops/StatusBadge.jsx')
  for (const key of ['confirmed', 'in_progress', 'final_checking', 'for_payment', 'redo']) {
    assert.match(badge, new RegExp(`${key}:`))
  }
  const grants = read('src/components/AssistantGrantsEditor.jsx')
  assert.match(grants, /grants-matrix/)
  assert.match(grants, /ASSISTANT_GRANT_GROUPS/)
  const loading = read('src/components/LoadingScreen.jsx')
  assert.match(loading, /--color-surface-cinematic/)
  assert.doesNotMatch(loading, /#090d12/)
})

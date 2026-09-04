import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Seam: theme-safe contrast for ServiceKindPicker under Admin CommandShell
 * and FloorApp. Forms are light-first; dark uses .dark overrides.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const picker = readFileSync(join(root, 'src/components/ServiceKindPicker.jsx'), 'utf8')

describe('ServiceKindPicker contrast (CommandShell + FloorShell)', () => {
  it('floor form controls are light-first with dark overrides', () => {
    assert.match(styles, /\.floor-control\s*\{[^}]*background:\s*#ffffff/s)
    assert.match(styles, /\.floor-kind-tab-active\s*\{[^}]*color:\s*#052699/s)
    assert.match(styles, /\.floor-picker-list\s*\{[^}]*background:\s*#ffffff/s)
    assert.match(styles, /\.dark \.floor-picker-list\s*\{[^}]*background:\s*#0f172a/s)
    assert.doesNotMatch(styles, /html:not\(\.dark\)[^\n]*\.floor-control/)
  })

  it('list rows use theme-safe classes (not dark-on-dark slate-800)', () => {
    assert.match(picker, /floor-picker-item/)
    assert.match(styles, /\.floor-picker-item\b/)
    assert.doesNotMatch(picker, /text-slate-800/)
    assert.doesNotMatch(picker, /dark:text-slate-100/)
    assert.doesNotMatch(picker, /text-slate-/)
  })
})

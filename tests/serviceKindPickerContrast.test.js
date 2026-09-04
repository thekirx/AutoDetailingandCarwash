import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Seam: theme-safe contrast for ServiceKindPicker under Admin CommandShell
 * (uses .command-shell, not .floor-shell) and FloorApp (.floor-shell).
 * Dark-on-dark list rows + washed tabs were unreadable on /operations/queue/new.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const styles = readFileSync(join(root, 'src/styles.css'), 'utf8')
const picker = readFileSync(join(root, 'src/components/ServiceKindPicker.jsx'), 'utf8')

const opsShell = String.raw`html:not\(\.dark\)\s+:is\(\.floor-shell,\s*\.command-shell\)`

describe('ServiceKindPicker contrast (CommandShell + FloorShell)', () => {
  it('light form overrides apply under both ops shells', () => {
    assert.match(styles, new RegExp(`${opsShell}\\s+\\.floor-control\\b`))
    assert.match(styles, new RegExp(`${opsShell}\\s+\\.floor-kind-tab-active\\b`))
    assert.match(styles, new RegExp(`${opsShell}\\s+\\.floor-picker-list\\b`))
    assert.match(styles, /\.floor-picker-list\s*\{[^}]*background:\s*#0f172a/)
    assert.match(styles, new RegExp(`${opsShell}\\s+\\.floor-picker-list\\s*\\{[^}]*background:\\s*#ffffff`))
  })

  it('list rows use theme-safe classes (not dark-on-dark slate-800)', () => {
    assert.match(picker, /floor-picker-item/)
    assert.match(styles, /\.floor-picker-item\b/)
    assert.doesNotMatch(picker, /text-slate-800/)
    assert.doesNotMatch(picker, /dark:text-slate-100/)
  })
})

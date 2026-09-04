import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ops = path.join(root, 'src', 'components', 'ops')

test('ops kit exports required design-system components', () => {
  const required = [
    'OpsStatTile.jsx',
    'StatusBadge.jsx',
    'OpsPageShell.jsx',
    'FilterBar.jsx',
    'DataTable.jsx',
    'ConfirmDialog.jsx',
    'ResponsiveSheet.jsx',
    'CommandMenu.jsx',
    'OpsErrorState.jsx',
    'OpsSkeleton.jsx',
    'OpsEmptyState.jsx',
  ]
  for (const file of required) {
    assert.ok(fs.existsSync(path.join(ops, file)), `missing ${file}`)
  }
  assert.equal(fs.existsSync(path.join(root, 'src', 'layouts', 'AdminLayout.jsx')), false)
})

test('StatusBadge maps core workflow statuses', () => {
  const src = fs.readFileSync(path.join(ops, 'StatusBadge.jsx'), 'utf8')
  for (const key of ['queued', 'washing', 'detailing', 'ready', 'paid', 'void', 'late', 'absent']) {
    assert.match(src, new RegExp(`${key}:`))
  }
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canEditDailySheet } from '../src/lib/dailySheet.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const strip = (rel) => {
  const s = readFileSync(join(root, rel), 'utf8')
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}
const sql = strip('supabase/migrations/20261001090000_daily_sheet.sql')
const posPage = strip('src/pages/PosPage.jsx')
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))

describe('the daily sheet is a manual Branch Admin task, and stays visible', () => {
  it('is created in exactly one place: the save path', () => {
    const inserts = sql.match(/insert into public\.daily_sheets/gi) || []
    assert.equal(inserts.length, 1, 'a second writer would create sheets outside the BA close')
  })

  it('has no scheduled job that would file it automatically', () => {
    // If this ever changes, BUG-065's owner action changes with it.
    const paths = (vercel.crons || []).map((c) => c.path)
    assert.deepEqual(
      paths.filter((p) => /daily|sheet/i.test(p)),
      [],
      `a cron now files daily sheets automatically: ${paths.join(', ')}`,
    )
  })

  it('is reachable from a plainly labeled POS tab for a Branch Admin', () => {
    assert.equal(canEditDailySheet({ role: 'admin' }), true, 'Branch Admin must be able to file it')
    assert.match(
      posPage,
      /\{ id: 'sheet', label: 'Daily sheet'/,
      'the Daily sheet tab must stay plainly labeled and visible to a BA',
    )
    assert.match(posPage, /\{ id: 'history', label: 'Sheet history'/, 'Sheet history must stay reachable')
  })

  it('opens the sheet from the Today panel rather than hiding the step', () => {
    assert.match(posPage, /onOpenSheet=\{canSheet \? \(\) => setShellTab\('sheet'\) : undefined\}/)
  })

  it('autosaves an edit, so typing once is enough to create the draft', () => {
    const panel = strip('src/pages/pos/DailySheetPanel.jsx')
    assert.match(panel, /if \(!editable \|\| !dirty\) return undefined/, 'autosave must not fire when nothing changed')
    assert.match(panel, /\}, 1500\)/, 'the 1.5 s debounce that creates the draft is the documented behaviour')
  })
})
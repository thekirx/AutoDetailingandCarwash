import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { it } from 'node:test'
const folder = new URL('../supabase/migrations/', import.meta.url)
it('widens the kinds and preserves every existing role branch, adding custom like detailing', () => {
  const file = readdirSync(folder).find(f => f.endsWith('_ops_forms_custom_kind.sql'))
  assert.ok(file, 'custom kind migration exists')
  const sql = readFileSync(new URL(file, folder), 'utf8')
  assert.match(sql,/begin;/i)
  assert.match(sql,/commit;/i)
  assert.match(sql,/drop constraint if exists ops_forms_kind_check/)
  const kinds = sql.match(/check \(kind in \(([\s\S]*?)\)\)/)[1].match(/'[^']+'/g)
  assert.deepEqual(kinds.sort(),["'complaint'","'event'","'equipment_repair'","'cash_advance'","'detailing'","'custom'"].sort())
  assert.match(sql,/create or replace function public.can_submit_ops_form/)
  const branches = text => new Map([...text.matchAll(/when '([^']+)' then ([\s\S]*?)(?=\s+when |\s+else false)/g)].map(m => [m[1],m[2].replace(/\s+/g,' ').trim()]))
  const current = branches(sql)
  const previous = branches(readFileSync(new URL('20261009150000_planner_rls_match_app.sql',folder),'utf8'))
  for(const [kind,branch] of previous) assert.equal(current.get(kind),branch)
  assert.equal(current.get('custom'),current.get('detailing'))
  assert.match(sql,/revoke all on function public.can_submit_ops_form\(text\) from public, anon/)
})
it('includes template editor controls and accessible wizard markup', () => {
  const panel = readFileSync(new URL('../src/pages/planning/PlanningFormsSmartPanel.jsx',import.meta.url),'utf8')
  for(const text of ['Start from a template','Use this template','Show as steps','New custom form']) assert.ok(panel.includes(text),text)
  const renderer = readFileSync(new URL('../src/components/BrandedOpsForm.jsx',import.meta.url),'utf8')
  assert.match(renderer,/role="progressbar"/)
  assert.match(renderer,/Check and send/)
})

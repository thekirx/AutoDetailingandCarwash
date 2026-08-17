/**
 * PostgREST: events ↔ ops_forms has two FKs (events.form_id and ops_forms.event_id).
 * Embedding must hint the column or Content / Events pages fail with
 * "more than one relationship was found for 'events' and 'ops_forms'".
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const EVENT_PAGES = [
  'src/pages/ContentAdminPage.jsx',
  'src/pages/EventsPage.jsx',
  'src/pages/EventSharePage.jsx',
  'src/pages/CustomerEventsPage.jsx',
  'src/pages/planning/PlanningPart6Panels.jsx',
]

describe('events → ops_forms embed disambiguation', () => {
  it('hints form_id (or events_form_id_fkey) on every events select that embeds ops_forms', () => {
    for (const file of EVENT_PAGES) {
      const src = read(file)
      const selects = [...src.matchAll(/\.from\(\s*['"]events['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)]
      const withForms = selects.filter((m) => m[2].includes('ops_forms'))
      assert.ok(withForms.length > 0, `${file} should select events with ops_forms`)
      for (const m of withForms) {
        const sel = m[2]
        assert.match(
          sel,
          /ops_forms!(form_id|events_form_id_fkey)\s*\(/,
          `${file}: ambiguous ops_forms embed — use ops_forms!form_id(...)`,
        )
        assert.doesNotMatch(
          sel,
          /(?:^|[^!])ops_forms\s*\(/,
          `${file}: bare ops_forms( embed is ambiguous`,
        )
      }
    }
  })
})

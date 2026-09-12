import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'

const source = readFileSync(join(process.cwd(), 'src/pages/OperationsPages.jsx'), 'utf8')

describe('Team Lead and Crew Floor Board revisions', () => {
  it('uses the approved Floor layout for both roles and names the failed-QA lane clearly', () => {
    assert.match(source, /\[ROLES\.TEAM_LEAD, ROLES\.STAFF\]\.includes\(profile\?\.role\)/)
    assert.match(source, /Services Failed QA/)
    assert.match(source, /failedQaTickets\.map/)
  })

  it('does not restore Detailing controls on the Floor Board', () => {
    assert.doesNotMatch(source, /aria-label="Service family"/)
  })
})

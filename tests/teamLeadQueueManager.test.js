import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(join(root, 'src/pages/TeamLeadQueuePage.jsx'), 'utf8')
const ops = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
const layout = readFileSync(join(root, 'src/layouts/OperationsLayout.jsx'), 'utf8')
const css = readFileSync(join(root, 'src/styles.css'), 'utf8')

describe('Team Lead Queue Manager mobile port', () => {
  it('wires the dedicated page for team_lead on /operations/queue', () => {
    assert.match(ops, /profile\?\.role === 'team_lead'/)
    assert.match(ops, /TeamLeadQueuePage/)
    assert.match(ops, /OperationsQueueBoardPage/)
    assert.match(page, /Queue Manager/)
    assert.match(page, /Manage your service queue for cars/)
    assert.match(page, /Add Car/)
    assert.match(page, /Vehicle History Search/)
    assert.doesNotMatch(page, /Motorcycle/)
  })

  it('uses Hakum branding and mobile status tiles', () => {
    assert.match(layout, /Hakum Auto Care/)
    assert.match(css, /\.qmgr-status-grid/)
    assert.match(css, /\.qmgr-add-btn/)
    assert.match(page, /Final Check/)
    assert.match(page, /completedTotalMinor/)
  })
})

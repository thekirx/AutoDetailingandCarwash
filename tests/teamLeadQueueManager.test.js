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
    assert.match(page, /Queue/)
    assert.match(page, /Add/)
    assert.match(page, /Plate history/)
    assert.doesNotMatch(page, /Motorcycle/)
  })

  it('uses Hakum branding and mobile status tiles', () => {
    assert.match(layout, /Hakum Auto Care/)
    assert.match(layout, /hakum-mark-ow\.png/)
    assert.match(css, /\.qmgr-status-grid/)
    assert.match(css, /\.qmgr-add-btn/)
    assert.match(page, /Final Check/)
    assert.match(page, /completedTotalMinor/)
  })

  it('drops redundant LIVE and car chrome', () => {
    assert.doesNotMatch(layout, /floor-live-pill/)
    assert.doesNotMatch(page, /floor-live-pill/)
    assert.doesNotMatch(page, /CarFront/)
    assert.doesNotMatch(page, /qmgr-cars-pill/)
  })

  it('fits queue board in one viewport (list scrolls, chrome fixed)', () => {
    assert.match(css, /\.floor-main:has\(\.qmgr\)/)
    assert.match(css, /\.qmgr-list[\s\S]*overflow-y:\s*auto/)
    assert.match(css, /\.qmgr-status-grid[\s\S]*grid-template-columns:\s*repeat\(3/)
    assert.match(page, /qmgr-toolbar/)
    assert.match(page, /qmgr-history/)
    assert.doesNotMatch(page, /Showing cars/)
    assert.doesNotMatch(page, /Manage your service queue for cars/)
  })

  it('clears Dynamic Island / status bar with safe-area insets on floor chrome', () => {
    assert.match(layout, /floor-topbar/)
    assert.match(css, /\.floor-topbar\s*\{[^}]*safe-area-inset-top/s)
    assert.match(css, /\.floor-topbar\s*\{[^}]*safe-area-inset-left/s)
    assert.match(css, /\.floor-topbar\s*\{[^}]*safe-area-inset-right/s)
    assert.match(css, /\.floor-dock\s*\{[^}]*safe-area-inset-bottom/s)
    assert.match(css, /\.ops-inset-topbar\s*\{[^}]*safe-area-inset-top/s)
    assert.match(css, /\.qmgr-filter\s*\{[^}]*min-width:\s*0/s)
    assert.match(css, /\.qmgr-filter select\s*\{[^}]*width:\s*100%/s)
  })
})

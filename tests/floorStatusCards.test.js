import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { operationsQueueHref, parseQueueLaneParam } from '../src/queue/queueLogic.js'
import { isDemoLoginEnabled } from '../src/lib/demoLogin.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const page = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
const envProd = readFileSync(join(root, '.env.production'), 'utf8')

describe('Floor status cards → queue lanes', () => {
  it('parses lane query and builds queue hrefs', () => {
    assert.equal(parseQueueLaneParam('waiting'), 'waiting')
    assert.equal(parseQueueLaneParam('in_progress'), 'in_progress')
    assert.equal(parseQueueLaneParam('final_checking'), 'final_checking')
    assert.equal(parseQueueLaneParam('redo'), 'redo')
    assert.equal(parseQueueLaneParam('for_payment'), null)
    assert.equal(parseQueueLaneParam('all'), null)
    assert.equal(operationsQueueHref({ lane: 'waiting', branch: 'bacoor' }), '/operations/queue?lane=waiting&branch=bacoor')
    assert.equal(operationsQueueHref({ lane: 'total' }), '/operations/queue')
    assert.equal(operationsQueueHref({ branch: 'all' }), '/operations/queue')
  })

  it('dashboard status MetricCards link into the queue board', () => {
    assert.match(page, /operationsQueueHref\(\{ lane: 'waiting'/)
    assert.match(page, /operationsQueueHref\(\{ lane: 'in_progress'/)
    assert.match(page, /operationsQueueHref\(\{ lane: 'final_checking'/)
    assert.match(page, /floor-metric-card-link/)
    assert.match(page, /Jump to waiting lane/)
  })

  it('queue board exposes clickable status chips and lane focus', () => {
    assert.match(page, /floor-status-chips/)
    assert.match(page, /setLaneFilter/)
    assert.match(page, /queue-lane-focused/)
    assert.match(page, /parseQueueLaneParam/)
    assert.match(page, /useSearchParams/)
  })
})

describe('Vercel demo login visibility', () => {
  it('production env enables demo chips at build time', () => {
    assert.match(envProd, /VITE_ENABLE_DEMO_LOGIN=true/)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: 'true', hostname: 'hakumautocare.com' }), true)
    assert.equal(isDemoLoginEnabled({ dev: false, flag: '', hostname: 'app.vercel.app' }), true)
  })
})

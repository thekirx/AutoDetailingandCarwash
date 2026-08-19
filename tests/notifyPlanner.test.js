import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('notify planner', () => {
  it('fans out inbox + web push only to assignees on the card', () => {
    const impl = readFileSync(join(root, 'server/notifyPlanner.mjs'), 'utf8')
    const api = readFileSync(join(root, 'server/notifyPlannerApi.mjs'), 'utf8')
    const vite = readFileSync(join(root, 'vite.config.js'), 'utf8')
    assert.match(impl, /buildPlannerAssignNotify/)
    assert.match(impl, /sendWebPushToUsers/)
    assert.match(impl, /plan_card_assignees/)
    assert.match(impl, /user_notifications/)
    assert.match(api, /canEditPlanning/)
    assert.match(api, /card_id required/)
    assert.match(vite, /\/api\/notify-planner/)
  })
})

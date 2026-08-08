import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildLifecycleSms, resolveVisitMilestone, LIFECYCLE_KINDS } from '../server/lifecycleSms.mjs'
import { getAdminOverrideTargets, getOpsBoardStatuses } from '../src/queue/queueLogic.js'

describe('lifecycle sms', () => {
  it('has a message template for every lifecycle kind', () => {
    for (const kind of LIFECYCLE_KINDS) {
      const msg = buildLifecycleSms(kind, { appUrl: 'https://hakum.example' })
      assert.ok(msg && msg.length > 20, `template missing for ${kind}`)
    }
    assert.equal(buildLifecycleSms('nope'), null)
  })

  it('welcome message includes the app URL when provided', () => {
    assert.match(buildLifecycleSms('welcome_app', { appUrl: 'https://hakum.example' }), /https:\/\/hakum\.example/)
    assert.doesNotMatch(buildLifecycleSms('welcome_app'), /undefined/)
  })

  it('fires the 4th and 10th visit milestones, repeating each 10-visit cycle', () => {
    assert.equal(resolveVisitMilestone(1), null)
    assert.equal(resolveVisitMilestone(4)?.kind, 'visit_milestone_4')
    assert.equal(resolveVisitMilestone(9), null)
    assert.equal(resolveVisitMilestone(10)?.kind, 'visit_milestone_10')
    // second loyalty cycle re-arms with a distinct dedupe key
    assert.equal(resolveVisitMilestone(14)?.kind, 'visit_milestone_4')
    assert.notEqual(resolveVisitMilestone(14)?.dedupeKey, resolveVisitMilestone(4)?.dedupeKey)
    assert.equal(resolveVisitMilestone(20)?.kind, 'visit_milestone_10')
    // garbage in, null out
    assert.equal(resolveVisitMilestone(0), null)
    assert.equal(resolveVisitMilestone('x'), null)
  })
})

describe('role-based queue lanes and overrides', () => {
  it('team lead never sees for_payment; branch admin does; SA also sees redo', () => {
    assert.deepEqual(getOpsBoardStatuses({ role: 'team_lead' }), ['waiting', 'in_progress', 'final_checking'])
    assert.deepEqual(getOpsBoardStatuses({ role: 'admin' }), ['waiting', 'in_progress', 'final_checking', 'for_payment'])
    assert.deepEqual(getOpsBoardStatuses({ role: 'BossMich' }), [
      'waiting',
      'in_progress',
      'final_checking',
      'for_payment',
      'redo',
    ])
  })

  it('admin override targets exclude the current status and closed tickets', () => {
    assert.deepEqual(getAdminOverrideTargets('for_payment'), ['waiting', 'in_progress', 'final_checking'])
    assert.deepEqual(getAdminOverrideTargets('in_progress'), ['waiting', 'final_checking'])
    assert.deepEqual(getAdminOverrideTargets('completed'), [])
    assert.deepEqual(getAdminOverrideTargets(''), [])
  })
})

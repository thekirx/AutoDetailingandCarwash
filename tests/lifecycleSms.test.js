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

  it('texts the visit rewards once, at 6, 12, 18, 24, and 30', () => {
    assert.equal(resolveVisitMilestone(1), null)
    assert.equal(resolveVisitMilestone(4), null)
    assert.equal(resolveVisitMilestone(6)?.kind, 'visit_reward_6')
    assert.equal(resolveVisitMilestone(12)?.kind, 'visit_reward_12')
    assert.equal(resolveVisitMilestone(18)?.kind, 'visit_reward_18')
    assert.equal(resolveVisitMilestone(24)?.kind, 'visit_reward_24')
    assert.equal(resolveVisitMilestone(30)?.kind, 'visit_reward_30')
    assert.equal(resolveVisitMilestone(36), null)
    assert.match(buildLifecycleSms('visit_reward_6'), /Free car freshener/)
    assert.match(buildLifecycleSms('visit_reward_30'), /15% off/)
    assert.equal(resolveVisitMilestone(0), null)
    assert.equal(resolveVisitMilestone('x'), null)
  })
})

describe('role-based queue lanes and overrides', () => {
  it('team lead sees failed QA but never for_payment; branch admin sees payment', () => {
    assert.deepEqual(getOpsBoardStatuses({ role: 'team_lead' }), ['waiting', 'in_progress', 'final_checking', 'redo'])
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
    assert.deepEqual(getAdminOverrideTargets('in_progress'), ['waiting'])
    assert.deepEqual(getAdminOverrideTargets('final_checking'), ['waiting', 'in_progress'])
    assert.deepEqual(getAdminOverrideTargets('waiting'), [])
    assert.deepEqual(getAdminOverrideTargets('completed'), [])
    assert.deepEqual(getAdminOverrideTargets(''), [])
  })
})

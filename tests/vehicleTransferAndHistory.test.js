import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXISTING_HISTORY_MESSAGE,
  HISTORY_ATTACH_WARNING,
  phoneVariants,
  sameHandset,
  handsetMatchPattern,
  historySignupFlags,
  readHistoryAccountNotices,
  clearHistoryAccountNoticeFlags,
  garagePlatePlan,
  plateInsertRecovery,
  transferBranchRefusal,
  maintenanceOwnerPatch,
  transferRefusal,
  canTransferVehicle,
} from '../src/lib/vehicleTransfer.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('signup tells a walk-in they already have history', () => {
  it('uses one sentence when prior visits exist', () => {
    assert.equal(EXISTING_HISTORY_MESSAGE, 'You have existing history with us.')
  })

  it('matches the phone spellings the queue stores', () => {
    const variants = phoneVariants('09625294043')
    assert.ok(variants.includes('09625294043'))
    assert.ok(variants.includes('639625294043'))
  })

  it('treats spaces and a leading plus as the same handset', () => {
    assert.equal(sameHandset('0917 123 4567', '09171234567'), true)
    assert.equal(sameHandset('+63 917 123 4567', '09171234567'), true)
    assert.equal(sameHandset('09170000000', '09171234567'), false)
    assert.match(handsetMatchPattern('09171234567'), /9\\D\*1\\D\*7/)
  })

  it('does not call a failed attach "no history"', () => {
    assert.deepEqual(historySignupFlags({ count: 2 }), {
      existing_history: true,
      history_warning: '',
    })
    assert.deepEqual(historySignupFlags({ error: new Error('db') }), {
      existing_history: false,
      history_warning: HISTORY_ATTACH_WARNING,
    })
    assert.equal(historySignupFlags({ count: 0 }).existing_history, false)
  })

  it('reads account banners without clearing storage during the read', () => {
    const store = new Map()
    const storage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      removeItem: (k) => store.delete(k),
      setItem: (k, v) => store.set(k, v),
    }
    storage.setItem('hakum-existing-history', '1')
    const first = readHistoryAccountNotices({ storage })
    assert.equal(first.existingHistory, true)
    assert.equal(storage.getItem('hakum-existing-history'), '1')
    const second = readHistoryAccountNotices({ storage })
    assert.equal(second.existingHistory, true)
    clearHistoryAccountNoticeFlags(storage)
    assert.equal(storage.getItem('hakum-existing-history'), null)
    assert.equal(readHistoryAccountNotices({ locationState: { existingHistory: true } }).existingHistory, true)
  })
})

describe('only SA, ASA and Branch Admin can move a car, and only to an account', () => {
  it('allows those three roles', () => {
    assert.equal(canTransferVehicle({ role: 'BossMich' }), true)
    assert.equal(canTransferVehicle({ role: 'assistant_super_admin' }), true)
    assert.equal(canTransferVehicle({ role: 'admin' }), true)
    assert.equal(canTransferVehicle({ role: 'team_lead' }), false)
    assert.equal(canTransferVehicle({ role: 'staff' }), false)
  })

  it('refuses a person who has no Hakum account', () => {
    assert.match(
      transferRefusal({ vehicle: { id: 'v', customer_id: 'old' }, toCustomer: null, toHasAuth: false }),
      /Hakum account/,
    )
  })

  it('refuses when the new owner already has this car', () => {
    assert.match(
      transferRefusal({
        vehicle: { id: 'v', customer_id: 'same' },
        toCustomer: { id: 'same', is_archived: false },
        toHasAuth: true,
      }),
      /already owns/,
    )
  })

  it('allows a real account that does not own the car yet', () => {
    assert.equal(
      transferRefusal({
        vehicle: { id: 'v', customer_id: 'old' },
        toCustomer: { id: 'new', is_archived: false },
        toHasAuth: true,
      }),
      '',
    )
  })
})

describe('the signup path claims walk-in visits instead of leaving a second history', () => {
  it('customer signup calls claimWalkInHistory and reports a failed attach', () => {
    const src = readFileSync(join(root, 'server/customerSignup.mjs'), 'utf8')
    assert.match(src, /claimWalkInHistory/)
    assert.match(src, /historySignupFlags/)
    assert.doesNotMatch(src, /if \(error\) return 0/)
    const page = readFileSync(join(root, 'src/pages/CustomerSignUpPage.jsx'), 'utf8')
    const account = readFileSync(join(root, 'src/pages/CustomerAccountPage.jsx'), 'utf8')
    assert.match(page, /history_warning/)
    assert.match(account, /HISTORY_ATTACH_WARNING/)
  })

  it('claims one unowned plate and does not treat a unique clash as success', () => {
    assert.deepEqual(
      garagePlatePlan({
        rows: [
          { id: 'a', customer_id: null },
          { id: 'b', customer_id: null },
        ],
        customerId: 'me',
      }),
      { action: 'claim', id: 'a', archiveIds: ['b'] },
    )
    assert.equal(
      garagePlatePlan({
        rows: [{ id: 'a', customer_id: 'other' }],
        customerId: 'me',
      }).action,
      'refuse',
    )
    assert.equal(
      garagePlatePlan({ rows: [], customerId: 'me' }).action,
      'insert',
    )
    const raced = plateInsertRecovery(
      { code: '23505', message: 'duplicate' },
      [{ id: 'a', customer_id: null }],
      'me',
    )
    assert.equal(raced.action, 'claim')
    assert.equal(plateInsertRecovery({ code: '22000', message: 'nope' }, [], 'me').action, 'throw')
  })
})

describe('a transfer moves maintenance with the car and stays inside the branch', () => {
  it('copies the buyer onto the maintenance row', () => {
    assert.deepEqual(
      maintenanceOwnerPatch({ id: 'buyer', full_name: 'Ana Cruz', phone: '09170000000' }),
      { customer_id: 'buyer', customer_name: 'Ana Cruz', customer_phone: '09170000000' },
    )
  })

  it('lets SA and ASA move any car, and a Branch Admin only a car seen at their branch', () => {
    assert.equal(transferBranchRefusal({ role: 'BossMich', branchSlugs: ['bacoor'], visitBranches: ['batangas'] }), '')
    assert.equal(transferBranchRefusal({ role: 'assistant_super_admin', branchSlugs: ['bacoor'], visitBranches: ['batangas'] }), '')
    assert.equal(transferBranchRefusal({ role: 'admin', branchSlugs: ['bacoor'], visitBranches: ['bacoor'] }), '')
    assert.equal(transferBranchRefusal({ role: 'admin', branchSlugs: ['bacoor'], visitBranches: [] }), '')
    assert.match(
      transferBranchRefusal({ role: 'admin', branchSlugs: ['bacoor'], visitBranches: ['batangas'] }),
      /your branch/,
    )
  })

  it('the transfer API updates maintenance and restores the car when the audit write fails', () => {
    const src = readFileSync(join(root, 'server/vehicleTransferApi.mjs'), 'utf8')
    assert.match(src, /vehicle_maintenance_schedules/)
    assert.match(src, /maintenanceOwnerPatch/)
    assert.match(src, /transferBranchRefusal/)
    assert.match(src, /auditErr/)
  })
})

import assert from 'node:assert/strict'
import { getBranchScope, canOverrideQueueBranches } from '../src/queue/queueLogic.js'

// Admin assigned to a branch must not override scope (Super Admin only).
assert.equal(canOverrideQueueBranches({ role: 'admin', branch_slug: 'bacoor' }), false)
assert.equal(getBranchScope({ role: 'admin', branch_slug: 'bacoor' }), 'bacoor')
assert.equal(getBranchScope({ role: 'BossMich', branch_slug: null }), null)
assert.equal(canOverrideQueueBranches({ role: 'BossMich' }), true)

console.log('posBranchScope.adminLocked: ok')

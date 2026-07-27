import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { safeAuthReturnPath } from '../src/auth/authRedirect.js'

describe('safeAuthReturnPath', () => {
  it('blocks access-denied and auth pages so Back to login cannot bounce into a session loop', () => {
    assert.equal(safeAuthReturnPath('/operations/access-denied'), null)
    assert.equal(safeAuthReturnPath('/operations/login'), null)
    assert.equal(safeAuthReturnPath('/signin'), null)
    assert.equal(safeAuthReturnPath('/operations/queue'), '/operations/queue')
    assert.equal(safeAuthReturnPath('/operations/dashboard?x=1'), '/operations/dashboard')
    assert.equal(safeAuthReturnPath(undefined, { fallback: '/operations/console' }), '/operations/console')
  })
})

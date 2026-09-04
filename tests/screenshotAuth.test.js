import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOpsAuthedUrl } from '../scripts/screenshotAuth.mjs'

describe('isOpsAuthedUrl', () => {
  it('rejects login wall even under /operations', () => {
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/login'), false)
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/login?next=/operations/console'), false)
  })

  it('accepts real ops destinations', () => {
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/console'), true)
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/finance?tab=pl'), true)
  })

  it('rejects denial pages', () => {
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/access-denied'), false)
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/operations/forbidden'), false)
  })

  it('rejects non-ops paths', () => {
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/home'), false)
    assert.equal(isOpsAuthedUrl('http://127.0.0.1:4173/login'), false)
  })
})

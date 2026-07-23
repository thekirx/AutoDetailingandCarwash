import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { assertAcceptedTerms } from '../server/customerSignup.mjs'

describe('customer signup terms', () => {
  it('requires accepted_terms true', () => {
    assert.throws(() => assertAcceptedTerms({}), /Terms of Service/)
    assert.throws(() => assertAcceptedTerms({ accepted_terms: false }), /Terms of Service/)
    assert.doesNotThrow(() => assertAcceptedTerms({ accepted_terms: true }))
  })
})

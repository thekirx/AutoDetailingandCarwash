import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertAcceptedTerms } from '../server/customerSignup.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('customer signup terms', () => {
  it('requires accepted_terms true', () => {
    assert.throws(() => assertAcceptedTerms({}), /Terms of Service/)
    assert.throws(() => assertAcceptedTerms({ accepted_terms: false }), /Terms of Service/)
    assert.doesNotThrow(() => assertAcceptedTerms({ accepted_terms: true }))
  })

  it('signup API validates the wizard draft and can claim a Team Lead account', () => {
    const src = readFileSync(join(root, 'server/customerSignup.mjs'), 'utf8')
    assert.match(src, /validateOnboardingDraft/)
    assert.match(src, /claimTeamLeadAccount/)
    assert.match(src, /date_of_birth/)
    assert.match(src, /upsertGaragePlate/)
  })

  it('signup page is a stepped wizard with birthday perk note', () => {
    const jsx = readFileSync(join(root, 'src/pages/CustomerSignUpPage.jsx'), 'utf8')
    assert.match(jsx, /ONBOARDING_STEPS/)
    assert.match(jsx, /mergeTeamLeadPrefill/)
    assert.match(jsx, /free carwash/)
    assert.match(jsx, /date_of_birth/)
  })

  it('sign-in is phone + password first, with Team Lead finish-setup', () => {
    const jsx = readFileSync(join(root, 'src/pages/CustomerSignInPage.jsx'), 'utf8')
    assert.match(jsx, /idMode/)
    assert.match(jsx, /Mobile number/)
    assert.match(jsx, /activateSignupHref/)
  })
})

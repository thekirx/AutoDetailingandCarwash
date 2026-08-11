import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ONBOARDING_STEPS,
  emptyOnboardingDraft,
  mergeTeamLeadPrefill,
  publicOnboardingPrefill,
  validateOnboardingDraft,
  validateOnboardingField,
  validateOnboardingStep,
} from '../src/lib/customerOnboarding.js'

const valid = {
  ...emptyOnboardingDraft(),
  phone: '09171234567',
  full_name: 'Ana Cruz',
  plate: 'ABC 1234',
  date_of_birth: '1994-08-11',
  password: 'hakumhakum',
  confirm: 'hakumhakum',
  accepted_terms: true,
}

describe('first-account wizard validation', () => {
  it('has four branded steps', () => {
    assert.deepEqual(ONBOARDING_STEPS.map((s) => s.id), ['phone', 'profile', 'birthday', 'security'])
  })

  it('accepts a complete draft and rejects bad fields', () => {
    assert.equal(validateOnboardingDraft(valid).ok, true)
    assert.match(validateOnboardingField('phone', '123'), /09/)
    assert.match(validateOnboardingField('full_name', '12'), /letters|full name/i)
    assert.match(validateOnboardingField('plate', '12'), /plate/i)
    assert.match(validateOnboardingField('date_of_birth', '2099-01-01'), /future/)
    assert.match(validateOnboardingField('email', 'nope'), /email/)
    assert.equal(validateOnboardingField('email', ''), '')
    assert.match(validateOnboardingField('password', 'short'), /8/)
    assert.match(validateOnboardingField('confirm', 'x', { password: 'yyyyyyyy' }), /match/)
    assert.match(validateOnboardingField('accepted_terms', false), /Terms/)
  })

  it('validates one step at a time', () => {
    assert.equal(validateOnboardingStep('phone', { phone: '09171234567' }).ok, true)
    assert.equal(validateOnboardingStep('profile', { full_name: 'Ana', plate: 'ABC1234' }).ok, true)
    assert.equal(validateOnboardingStep('birthday', { date_of_birth: '' }).ok, false)
    assert.equal(validateOnboardingStep('security', valid).ok, true)
  })
})

describe('Team Lead prefill', () => {
  it('fills empty wizard fields and skips synthetic email', () => {
    const merged = mergeTeamLeadPrefill(emptyOnboardingDraft(), {
      full_name: 'Ana Cruz',
      plate: 'XYZ 999',
      phone: '09170001111',
      email: 'c09170001111@customers.hakumautocare.com',
    })
    assert.equal(merged.source, 'team_lead')
    assert.equal(merged.full_name, 'Ana Cruz')
    assert.equal(merged.plate, 'XYZ 999')
    assert.equal(merged.email, '')
  })

  it('does not overwrite what the customer already typed', () => {
    const merged = mergeTeamLeadPrefill(
      { ...emptyOnboardingDraft(), full_name: 'My Name' },
      { full_name: 'Shop Name', plate: 'AAA111' },
    )
    assert.equal(merged.full_name, 'My Name')
    assert.equal(merged.plate, 'AAA111')
  })

  it('public prefill strips synthetic email', () => {
    const pub = publicOnboardingPrefill({
      full_name: 'Ana',
      plate: 'ABC123',
      email: 'c09@customers.hakumautocare.com',
    })
    assert.equal(pub.email, '')
    assert.equal(pub.full_name, 'Ana')
  })
})

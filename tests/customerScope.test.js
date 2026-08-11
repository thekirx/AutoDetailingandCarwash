import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveBookingCustomerId } from '../server/publicBookCustomer.mjs'
import { CUSTOMER_ACTIVE_VISIT_STATUSES } from '../src/lib/customerPortalActive.js'
import { publicAuthLookupPayload } from '../server/customerAuthPublic.mjs'
import { authCreateUserIdForCrm, buildProvisionInviteMessage } from '../server/provisionSms.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Public book customer_id (CUST-C2)', () => {
  it('links only when JWT maps to customers.role=customer', () => {
    assert.equal(
      resolveBookingCustomerId({ authUid: 'u1', customerRole: 'customer' }),
      'u1',
    )
  })

  it('never links guest or non-customer JWT (phone match must not matter)', () => {
    assert.equal(resolveBookingCustomerId({ authUid: null, customerRole: null }), null)
    assert.equal(resolveBookingCustomerId({ authUid: 'u1', customerRole: 'admin' }), null)
    assert.equal(resolveBookingCustomerId({ authUid: 'u1', customerRole: undefined }), null)
  })
})

describe('Customer portal active visits (CUST-H4)', () => {
  it('includes pending and confirmed (public book inserts pending)', () => {
    assert.ok(CUSTOMER_ACTIVE_VISIT_STATUSES.includes('pending'))
    assert.ok(CUSTOMER_ACTIVE_VISIT_STATUSES.includes('confirmed'))
    assert.ok(CUSTOMER_ACTIVE_VISIT_STATUSES.includes('waiting'))
  })
})

describe('Auth lookup anti-enumeration (CUST-H1)', () => {
  it('strips login_email for email and phone', () => {
    assert.equal(
      publicAuthLookupPayload({
        status: 'ready',
        kind: 'phone',
        login_email: 'c0917@customers.hakumautocare.com',
      }).login_email,
      undefined,
    )
    assert.equal(
      publicAuthLookupPayload({
        status: 'ready',
        kind: 'email',
        login_email: 'you@x.com',
      }).login_email,
      undefined,
    )
  })

  it('exposes Team Lead prefill while the account still needs a password or invite', () => {
    const pending = publicAuthLookupPayload({
      status: 'needs_password',
      kind: 'phone',
      login_email: 'secret@x.com',
      prefill: { full_name: 'Ana', plate: 'ABC123', email: 'c09@customers.hakumautocare.com' },
    })
    assert.equal(pending.login_email, undefined)
    assert.equal(pending.source, 'team_lead')
    assert.equal(pending.prefill.full_name, 'Ana')
    assert.equal(pending.prefill.email, '')

    const invite = publicAuthLookupPayload({
      status: 'needs_invite',
      kind: 'phone',
      login_email: 'secret@x.com',
      prefill: { full_name: 'Ana', plate: 'ABC123' },
    })
    assert.equal(invite.source, 'team_lead')
    assert.equal(invite.prefill.full_name, 'Ana')

    const ready = publicAuthLookupPayload({
      status: 'ready',
      kind: 'phone',
      prefill: { full_name: 'Ana', plate: 'ABC123' },
    })
    assert.equal(ready.prefill, undefined)
  })

  it('keeps login_email for plate when ready/needs_password', () => {
    assert.equal(
      publicAuthLookupPayload({
        status: 'ready',
        kind: 'plate',
        login_email: 'c0917@customers.hakumautocare.com',
      }).login_email,
      'c0917@customers.hakumautocare.com',
    )
  })
})

describe('Provision identity + SMS (CUST-C3 / CUST-H10)', () => {
  it('passes CRM id into Auth createUser when walk-in row exists', () => {
    assert.equal(authCreateUserIdForCrm('crm-uuid'), 'crm-uuid')
    assert.equal(authCreateUserIdForCrm(null), undefined)
  })

  it('SMS invite never embeds recovery URLs', () => {
    const withEmail = buildProvisionInviteMessage({
      firstName: 'Ana',
      phone: '09171234567',
      email: 'ana@x.com',
    })
    const phoneOnly = buildProvisionInviteMessage({
      firstName: 'Ana',
      phone: '09171234567',
      email: null,
    })
    assert.equal(/https?:\/\//i.test(withEmail), false)
    assert.equal(/https?:\/\//i.test(phoneOnly), false)
    assert.match(withEmail, /Forgot password/)
  })
})

describe('Public queue does not Realtime-subscribe bookings (CUST-C1)', () => {
  it('PublicQueuePage polls views — no bookings Realtime channel', () => {
    const src = readFileSync(join(root, 'src/pages/PublicQueuePage.jsx'), 'utf8')
    assert.equal(src.includes("table: 'bookings'"), false)
    assert.equal(src.includes(".on('postgres_changes'"), false)
    assert.ok(src.includes('PUBLIC_QUEUE_POLL_MS'))
  })
})

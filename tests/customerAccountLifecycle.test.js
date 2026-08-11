import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  activateSignupHref,
  resolveClaimPath,
  resolveCustomerAuthIntent,
} from '../src/lib/customerAccountLifecycle.js'
import { phoneLoginEmail, phoneLoginEmailAliases } from '../src/lib/customerAuth.js'
import { publicAuthLookupPayload } from '../server/customerAuthPublic.mjs'
import { signInCustomerWithPassword } from '../server/customerSignIn.mjs'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('claim path (Team Lead visit → same customer_id)', () => {
  it('new phone creates a brand-new account', () => {
    assert.equal(resolveClaimPath({ customer: null, authUser: null }), 'create')
  })

  it('CRM walk-in without Auth attaches login to that row', () => {
    assert.equal(resolveClaimPath({ customer: { id: 'crm-1' }, authUser: null }), 'attach_auth')
  })

  it('Auth with must_set_password activates in place', () => {
    assert.equal(
      resolveClaimPath({
        customer: { id: 'crm-1' },
        authUser: { id: 'crm-1', user_metadata: { must_set_password: true } },
      }),
      'activate',
    )
  })

  it('already-ready account is blocked from a second signup', () => {
    assert.equal(
      resolveClaimPath({
        customer: { id: 'crm-1' },
        authUser: { id: 'crm-1', user_metadata: {} },
      }),
      'exists',
    )
  })
})

describe('sign-in intent matrix', () => {
  it('phone without password on an unactivated visit → activate', () => {
    for (const status of ['needs_password', 'needs_invite']) {
      const intent = resolveCustomerAuthIntent({ status, passwordProvided: false, flow: 'signin' })
      assert.equal(intent.action, 'activate', status)
      assert.match(intent.message, /history/)
    }
  })

  it('ready + password → signin; ready without password asks for it', () => {
    assert.equal(
      resolveCustomerAuthIntent({ status: 'ready', passwordProvided: true, flow: 'signin' }).action,
      'signin',
    )
    assert.equal(
      resolveCustomerAuthIntent({ status: 'ready', passwordProvided: false, flow: 'signin' }).action,
      'need_password',
    )
  })

  it('unknown phone without password offers signup', () => {
    const intent = resolveCustomerAuthIntent({ status: 'unknown', passwordProvided: false, flow: 'signin' })
    assert.equal(intent.action, 'offer_signup')
  })

  it('unknown phone with password still attempts signin (server confirms)', () => {
    assert.equal(
      resolveCustomerAuthIntent({ status: 'unknown', passwordProvided: true, flow: 'signin' }).action,
      'signin',
    )
  })
})

describe('signup intent matrix', () => {
  it('unactivated Team Lead rows activate; ready is blocked; unknown creates', () => {
    assert.equal(
      resolveCustomerAuthIntent({ status: 'needs_password', flow: 'signup' }).action,
      'activate',
    )
    assert.equal(
      resolveCustomerAuthIntent({ status: 'needs_invite', flow: 'signup' }).action,
      'activate',
    )
    assert.equal(resolveCustomerAuthIntent({ status: 'ready', flow: 'signup' }).action, 'block_exists')
    assert.equal(resolveCustomerAuthIntent({ status: 'unknown', flow: 'signup' }).action, 'create')
  })
})

describe('server sign-in router (no Auth network)', () => {
  it('refuses password grant on unactivated visits', async () => {
    const out = await signInCustomerWithPassword({
      status: 'needs_password',
      authEmail: 'hidden@x.com',
      password: 'anything1',
    })
    assert.equal(out.ok, false)
    assert.equal(out.status, 409)
    assert.equal(out.body.activate, true)
    assert.equal(out.body.access_token, undefined)
  })

  it('offers signup when the phone is unknown', async () => {
    const out = await signInCustomerWithPassword({
      status: 'unknown',
      authEmail: null,
      password: '',
    })
    assert.equal(out.status, 404)
    assert.equal(out.body.offer_signup, true)
  })

  it('does not leak a login email on activate', async () => {
    const out = await signInCustomerWithPassword({
      status: 'needs_invite',
      authEmail: 'secret@x.com',
      password: '',
    })
    assert.equal(JSON.stringify(out.body).includes('secret@x.com'), false)
  })
})

describe('phone login email unification', () => {
  it('09, +63, and 63 all resolve to the same Auth email', () => {
    const expected = 'c09171234567@customers.hakumautocare.com'
    assert.equal(phoneLoginEmail('0917-123-4567'), expected)
    assert.equal(phoneLoginEmail('+63 917 123 4567'), expected)
    assert.equal(phoneLoginEmail('639171234567'), expected)
    assert.equal(phoneLoginEmail('9171234567'), expected)
  })

  it('keeps historical 63 synthetic emails as aliases', () => {
    const aliases = phoneLoginEmailAliases('+63 917 123 4567')
    assert.ok(aliases.includes('c09171234567@customers.hakumautocare.com'))
    assert.ok(aliases.includes('c639171234567@customers.hakumautocare.com'))
  })
})

describe('public lookup + activate href', () => {
  it('exposes Team Lead prefill for needs_invite without login_email', () => {
    const pub = publicAuthLookupPayload({
      status: 'needs_invite',
      kind: 'phone',
      login_email: 'secret@x.com',
      prefill: { full_name: 'Ana', plate: 'ABC123', email: 'c09@customers.hakumautocare.com' },
    })
    assert.equal(pub.login_email, undefined)
    assert.equal(pub.source, 'team_lead')
    assert.equal(pub.prefill.full_name, 'Ana')
    assert.equal(pub.prefill.email, '')
  })

  it('builds a phone-scoped signup href', () => {
    assert.equal(activateSignupHref('0917 123 4567'), '/signup?phone=0917%20123%204567')
    assert.equal(activateSignupHref(''), '/signup')
  })
})

describe('QA: pages wire activate, not a dead invite wall', () => {
  it('sign-in treats needs_invite as activate', () => {
    const src = readFileSync(join(root, 'src/pages/CustomerSignInPage.jsx'), 'utf8')
    assert.match(src, /Activate your Hakum account/)
    assert.match(src, /action: 'signin'/)
    assert.doesNotMatch(src, /Account invite pending/)
    assert.doesNotMatch(src, /disabled=\{submitting \|\| setupStatus === 'needs_invite'\}/)
  })

  it('signup does not block needs_invite', () => {
    const src = readFileSync(join(root, 'src/pages/CustomerSignUpPage.jsx'), 'utf8')
    assert.match(src, /resolveCustomerAuthIntent/)
    assert.doesNotMatch(src, /shop has not issued your login/)
  })

  it('claim attaches Auth when CRM has no user', () => {
    const src = readFileSync(join(root, 'server/customerSignup.mjs'), 'utf8')
    assert.match(src, /attachAuthToCrmRow/)
    assert.match(src, /resolveClaimPath/)
    assert.match(src, /id: existing\.id/)
  })

  it('Team Lead invite metadata marks the account unactivated', () => {
    const src = readFileSync(join(root, 'server/provisionCustomer.mjs'), 'utf8')
    assert.match(src, /must_set_password: true/)
  })
})

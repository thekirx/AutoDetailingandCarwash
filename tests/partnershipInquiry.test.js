import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

import {
  normalizePartnershipInquiry,
  submitPartnershipInquiry,
  validatePartnershipInquiry,
} from '../src/lib/partnershipInquiry.js'

describe('partnership inquiry frontend boundary', () => {
  it('uses clear customer-facing partnership and submission copy', async () => {
    const source = await readFile(new URL('../src/components/public/home/PartnershipSection.jsx', import.meta.url), 'utf8')

    assert.match(source, /Partner with Hakum\./)
    assert.match(source, /Interested in opening a branch or working with us\? Tell us about your location and idea\./)
    assert.match(source, /status === 'submitting' \? 'Sending…' : 'Send inquiry'/)
    assert.doesNotMatch(source, /Inquire for partnership|Checking…/)
  })

  it('normalizes customer-entered values without inventing fields', () => {
    assert.deepEqual(normalizePartnershipInquiry({
      name: '  Kirk  ', email: ' HELLO@EXAMPLE.COM ', contactNumber: ' 0917 123 4567 ',
      city: ' Bacoor ', message: ' Let us talk. ', ignored: 'not transmitted',
    }), {
      name: 'Kirk', email: 'hello@example.com', contactNumber: '0917 123 4567',
      city: 'Bacoor', message: 'Let us talk.',
    })
  })

  it('returns field-specific validation errors', () => {
    assert.deepEqual(validatePartnershipInquiry({ email: 'not-an-email' }), {
      name: 'Name is required.',
      email: 'Enter a valid email address.',
      contactNumber: 'Contact number is required.',
      city: 'City is required.',
      message: 'Message is required.',
    })
    assert.deepEqual(validatePartnershipInquiry({
      name: 'Kirk', email: 'hello@example.com', contactNumber: '0917', city: 'Bacoor', message: 'Hello',
    }), {})
  })

  it('always returns an unavailable result without a backend destination', async () => {
    assert.deepEqual(await submitPartnershipInquiry({ name: 'Kirk' }), {
      ok: false,
      code: 'unavailable',
      message: 'Online partnership inquiries are not available yet. Please contact Hakum Auto Care directly for now.',
    })
  })
})

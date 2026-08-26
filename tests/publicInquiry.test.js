import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { parsePublicFormGuard, validatePublicFormGuard } from '../src/lib/publicFormGuard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const server = readFileSync(join(root, 'server/publicInquiry.mjs'), 'utf8')
const contact = readFileSync(join(root, 'src/pages/ContactPage.jsx'), 'utf8')
const complaints = readFileSync(join(root, 'src/pages/ComplaintsPage.jsx'), 'utf8')
const partnership = readFileSync(join(root, 'src/lib/partnershipInquiry.js'), 'utf8')
const apiClient = readFileSync(join(root, 'src/lib/publicInquiryApi.js'), 'utf8')

describe('public inquiry API seam', () => {
  it('server rate-limits and guards honeypot / min delay', () => {
    assert.match(server, /rateLimit\(\{ key: `public-inquiry:/)
    assert.match(server, /function guardError/)
    assert.match(server, /honeypot/)
    assert.match(server, /elapsedMs/)
    assert.match(server, /builders\[/)
  })

  it('complaints and partnership post through shared API client; contact is channels-only', () => {
    assert.match(apiClient, /export async function submitPublicInquiry/)
    assert.match(complaints, /submitPublicInquiry/)
    assert.doesNotMatch(complaints, /from\('complaints'\)\.insert/)
    assert.match(partnership, /submitPublicInquiry\('partnership'/)
    assert.doesNotMatch(partnership, /from\('partnership_inquiries'\)/)
    assert.doesNotMatch(contact, /submitPublicInquiry|postPublicInquiry|from\('contact_inquiries'\)\.insert/)
    assert.match(contact, /Talk to Hakum|Contact us/)
  })

  it('parsePublicFormGuard reads API body field names', () => {
    const guard = parsePublicFormGuard({ form_opened_at: 1000, company_website: 'spam' })
    assert.equal(guard.openedAt, 1000)
    assert.equal(guard.honeypot, 'spam')
    assert.equal(validatePublicFormGuard(guard), 'Unable to submit right now.')
  })
})

describe('public inquiry migration', () => {
  it('revokes direct anon insert and adds geofence trigger', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260820160000_public_inquiry_api_geofence.sql'),
      'utf8',
    )
    assert.match(sql, /revoke insert on public\.contact_inquiries from anon, authenticated/)
    assert.match(sql, /revoke insert on public\.complaints from anon, authenticated/)
    assert.match(sql, /revoke insert on public\.partnership_inquiries from anon, authenticated/)
    assert.match(sql, /enforce_staff_attendance_geofence/)
    assert.match(sql, /staff_attendance_geofence/)
  })
})

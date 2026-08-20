import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/lib/partnershipInquiry.js'), 'utf8')

describe('partnership inquiry frontend boundary', () => {
  it('normalizes site type, email, and contact fields in source', () => {
    assert.match(src, /siteType/)
    assert.match(src, /\.toLowerCase\(\)/)
    assert.match(src, /SITE_TYPE_VALUES/)
  })

  it('returns field-specific validation errors', () => {
    assert.match(src, /Name is required/)
    assert.match(src, /Enter a valid email address/)
    assert.match(src, /Site location is required/)
  })

  /* anon lost direct INSERT on partnership_inquiries (migration
     public_inquiry_api_geofence), so the browser must not reach the table
     itself — submissions go through the service-role API. */
  it('submits through the public inquiry API, never straight to the table', () => {
    assert.match(src, /submitPublicInquiry\('partnership'/)
    assert.match(src, /from '\.\/publicInquiryApi'/)
    assert.doesNotMatch(src, /from\('partnership_inquiries'\)/)
    assert.doesNotMatch(src, /from '\.\/supabase'/)
  })
})

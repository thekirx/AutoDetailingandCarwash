import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('homepage wash SKU seed + inquiry status filters', () => {
  it('seeds Glass, Engine, and inactive Mobile into services', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260820180000_homepage_wash_sku_seed.sql'),
      'utf8',
    )
    assert.match(sql, /glass-detailing/)
    assert.match(sql, /engine-wash/)
    assert.match(sql, /mobile-detailing/)
    assert.match(sql, /is_active = case/)
    assert.match(sql, /'addon'/)
  })

  it('Inquiries page filters by status chips', () => {
    const page = readFileSync(join(root, 'src/pages/InquiriesPage.jsx'), 'utf8')
    assert.match(page, /inquiries-status-filters/)
    assert.match(page, /statusFilter/)
    assert.match(page, /PARTNERSHIP_STATUSES/)
    assert.match(page, /CONTACT_STATUSES/)
    assert.match(page, /COMPLAINT_STATUSES/)
  })
})

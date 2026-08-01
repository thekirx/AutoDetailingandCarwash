import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canStaffUpdateBookingStatus } from '../server/bookingStatusAccess.mjs'
import { createPublicFormGuard, validatePublicFormGuard } from '../src/lib/publicFormGuard.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('ASA booking-status queue_all honesty', () => {
  it('denies floor status update when queue_all is false', () => {
    const asa = {
      role: 'assistant_super_admin',
      permission_grants: { queue_all: false },
    }
    assert.equal(
      canStaffUpdateBookingStatus(asa, { branch: 'bacoor' }, { nextStatus: 'in_progress' }),
      false,
    )
  })

  it('allows floor status update when queue_all defaults true', () => {
    assert.equal(
      canStaffUpdateBookingStatus(
        { role: 'assistant_super_admin', permission_grants: {} },
        { branch: 'bacoor' },
        { nextStatus: 'in_progress' },
      ),
      true,
    )
  })
})

describe('Public form guard (CUST-H9 friction)', () => {
  it('rejects honeypot fill', () => {
    assert.ok(validatePublicFormGuard({ openedAt: Date.now() - 5000, honeypot: 'http://spam' }))
  })

  it('rejects too-fast submit', () => {
    assert.ok(validatePublicFormGuard({ openedAt: Date.now(), honeypot: '' }, { minMs: 2000 }))
  })

  it('allows human-paced empty honeypot', () => {
    assert.equal(
      validatePublicFormGuard({ openedAt: Date.now() - 3000, honeypot: '' }, { minMs: 2000 }),
      null,
    )
  })

  it('createPublicFormGuard seeds openedAt', () => {
    const g = createPublicFormGuard()
    assert.ok(g.openedAt > 0)
    assert.equal(g.honeypot, '')
  })
})

describe('ASA finance RLS migration present', () => {
  it('splits expenses select vs write with finance grants', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260801150000_asa_finance_grant_rls.sql'),
      'utf8',
    )
    assert.match(sql, /asa_has_grant\('finance_view'\)/)
    assert.match(sql, /asa_has_grant\('finance_write'\)/)
    assert.match(sql, /expenses_select/)
    assert.match(sql, /expenses_write/)
  })
})

/**
 * Michi C12 — staff save own phone from Account settings.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('staff own phone', () => {
  it('RPC cleans and stores phone for the signed-in staff row', () => {
    const sql = read('supabase/migrations/20261019160000_save_own_staff_phone.sql')
    assert.match(sql, /save_own_staff_phone/)
    assert.match(sql, /security definer/)
    assert.match(sql, /staff_profiles/)
    assert.match(sql, /auth\.uid\(\)/)
    assert.match(sql, /10–16 digits|10-16/)
  })

  it('UserSettingsModal calls save_own_staff_phone for staff', () => {
    const modal = read('src/components/UserSettingsModal.jsx')
    assert.match(modal, /save_own_staff_phone/)
    assert.match(modal, /Update phone/)
    assert.doesNotMatch(modal, /if \(!isCustomer\) return/)
  })
})

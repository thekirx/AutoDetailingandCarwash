import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { BIRTHDAY_CODE_MISMATCH, BIRTHDAY_CODE_REQUIRED } from '../src/lib/birthdayPerk.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

describe('birthday code', () => {
  it('gates the perk on a typed code and hides that code from staff selects', async () => {
    const sql = await readFile(resolve(root, 'supabase/migrations/20261019100000_birthday_perk_code.sql'), 'utf8')
    const pos = await readFile(resolve(root, 'src/pages/PosPage.jsx'), 'utf8')
    const card = await readFile(resolve(root, 'src/components/ops/DaylightQueueCard.jsx'), 'utf8')
    const greetings = await readFile(resolve(root, 'server/birthdayGreetings.mjs'), 'utf8')

    assert.match(sql, /Birthday is locked after the first save/)
    assert.match(sql, new RegExp(BIRTHDAY_CODE_REQUIRED.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(sql, new RegExp(BIRTHDAY_CODE_MISMATCH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(sql, /birthday_code_matches/)
    assert.match(sql, /revoke select on public\.customer_birthday_perks from authenticated/)
    const grant = sql.match(/grant select \(([\s\S]*?)\) on public\.customer_birthday_perks/)
    assert.ok(grant)
    assert.doesNotMatch(grant[1], /\bcode\b/)
    assert.match(pos, /select\('id, perk_year, status, expires_at'\)/)
    assert.match(pos, /birthday_code_matches/)
    assert.match(card, /Happy birthday — ask for their code/)
    assert.doesNotMatch(card, /perk\.code|ticket\.code/)
    assert.match(greetings, /birthday_queue_start/)
    assert.match(greetings, /setUTCDate\(d\.getUTCDate\(\) \+ 7\)|birthdayPerkExpiresAt/)
  })
})

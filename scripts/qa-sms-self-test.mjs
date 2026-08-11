/**
 * One-shot QA: send a self-test SMS to a known customer phone.
 * Usage: node scripts/qa-sms-self-test.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { adminDb, sendLifecycleSms } from '../server/lifecycleSms.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const k = line.slice(0, i)
    const v = line.slice(i + 1)
    if (!process.env[k]) process.env[k] = v
  }
}

const CUSTOMER_ID = '9ff519ae-ef5c-4834-a740-cc6f26e0a40f'
const PHONE = '09625294043'

const db = adminDb()
const result = await sendLifecycleSms(db, {
  kind: 'self_test',
  eventType: `self_test_qa_${Date.now()}`,
  customerId: CUSTOMER_ID,
  phone: PHONE,
  ignoreShopToggle: true,
})

console.log(JSON.stringify({
  phone: PHONE,
  ok: result.ok,
  status: result.status,
  path: result.path || null,
  messageId: result.messageId || null,
  provider: String(result.providerResponse || '').slice(0, 180),
}, null, 2))

if (!result.ok && result.status !== 'duplicate') process.exitCode = 1

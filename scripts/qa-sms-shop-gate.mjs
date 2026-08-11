/**
 * Prove shop SMS is ON and a send reaches BusyBee through the real gate
 * (ignoreShopToggle left false).
 */
import { readFileSync, existsSync } from 'node:fs'
import { smsNotificationsEnabledFromSetting } from '../src/lib/smsNotificationsToggle.js'
import { adminDb, sendLifecycleSms } from '../server/lifecycleSms.mjs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    if (!process.env[line.slice(0, i)]) process.env[line.slice(0, i)] = line.slice(i + 1)
  }
}

const CUSTOMER_ID = '9ff519ae-ef5c-4834-a740-cc6f26e0a40f'
const PHONE = '09625294043'
const db = adminDb()

const { data, error } = await db.from('app_settings').select('value').eq('key', 'sms_notifications').maybeSingle()
if (error) throw error
const shopOn = smsNotificationsEnabledFromSetting(data?.value)
if (!shopOn) {
  console.error(JSON.stringify({ ok: false, reason: 'shop_sms_off', value: data?.value }))
  process.exit(1)
}

const result = await sendLifecycleSms(db, {
  kind: 'self_test',
  eventType: `self_test_shop_gate_${Date.now()}`,
  customerId: CUSTOMER_ID,
  phone: PHONE,
})

console.log(JSON.stringify({
  shopOn,
  setting: data?.value,
  phone: PHONE,
  ok: result.ok,
  status: result.status,
  messageId: result.messageId || null,
  path: result.path || null,
}, null, 2))

if (!result.ok || result.status !== 'sent') process.exit(1)

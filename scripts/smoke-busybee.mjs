/**
 * Live BusyBee probe — requires .env credentials.
 * Does not send SMS unless SEND_TEST_SMS=1 and TEST_SMS_PHONE is set.
 */
import { readFileSync, existsSync } from 'node:fs'
import { busybeeBalance, busybeeSendSms, normalizePhMobile } from '../server/busybee.mjs'

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

console.log('normalize', normalizePhMobile('09171234567'))
const bal = await busybeeBalance().catch((e) => ({ ok: false, error: e.message }))
console.log('balance', JSON.stringify(bal).slice(0, 400))

if (process.env.SEND_TEST_SMS === '1' && process.env.TEST_SMS_PHONE) {
  const sent = await busybeeSendSms({
    phone: process.env.TEST_SMS_PHONE,
    message: 'Hakum Auto Care test SMS — BusyBee integration check.',
  })
  console.log('send', sent)
  process.exit(sent.ok ? 0 : 1)
}

process.exit(0)

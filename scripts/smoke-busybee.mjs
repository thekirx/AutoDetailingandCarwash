/**
 * Live BusyBee probe — requires .env credentials.
 * Balance always; send only when SEND_TEST_SMS=1 and TEST_SMS_PHONE is set.
 *
 * ErrorCode 0 = BrandTxt accepted submit.
 * Handset proof = MessageStatus Status=DELIVRD (may lag) and/or recipient confirmation.
 * Never send MobileNumbers as 09… — use 63… (normalizePhMobile). 09… can return FAILED.
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

function creditsOf(bal) {
  const raw = bal?.json?.Data?.[0]?.Credits ?? bal?.json?.data?.[0]?.credits ?? null
  if (raw == null || raw === '') return null
  const n = Number(String(raw).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

async function messageStatus(messageId) {
  const apiKey = process.env.BUSYBEE_API_KEY
  const clientId = process.env.BUSYBEE_CLIENT_ID
  const base = (process.env.BUSYBEE_API_BASE_URL || 'https://app.brandtxt.io').replace(/\/$/, '')
  const q = new URLSearchParams({ ApiKey: apiKey, ClientId: clientId, MessageId: messageId })
  const res = await fetch(`${base}/api/v2/MessageStatus?${q}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  const json = await res.json().catch(() => null)
  return {
    errorCode: json?.ErrorCode,
    status: json?.Data?.Status || null,
    doneDate: json?.Data?.DoneDate || null,
    mobile: json?.Data?.MobileNumber || null,
  }
}

console.log('normalize', normalizePhMobile('09625294043'), normalizePhMobile('639625294043'))
const before = await busybeeBalance().catch((e) => ({ ok: false, error: e.message }))
console.log('balance_before', { ok: before.ok, credits: creditsOf(before), errorCode: before.json?.ErrorCode })

if (process.env.SEND_TEST_SMS !== '1' || !process.env.TEST_SMS_PHONE) {
  console.log('skip_send', 'set SEND_TEST_SMS=1 TEST_SMS_PHONE=09… to send')
  process.exit(before.ok ? 0 : 1)
}

const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
const sent = await busybeeSendSms({
  phone: process.env.TEST_SMS_PHONE,
  message: `Hakum Auto Care handset check ${stamp}. If you receive this, reply YES.`,
})
console.log('send', {
  ok: sent.ok,
  status: sent.status,
  messageId: sent.messageId,
  path: sent.path,
  mobile: normalizePhMobile(process.env.TEST_SMS_PHONE),
  providerResponse: String(sent.providerResponse || '').slice(0, 400),
})

await new Promise((r) => setTimeout(r, 2500))
const after = await busybeeBalance().catch((e) => ({ ok: false, error: e.message }))
const c0 = creditsOf(before)
const c1 = creditsOf(after)
const delta = c0 != null && c1 != null ? Number((c1 - c0).toFixed(6)) : null
console.log('balance_after', { ok: after.ok, credits: c1, creditDelta: delta })

let dlr = null
if (sent.messageId) {
  for (let i = 0; i < 12; i++) {
    dlr = await messageStatus(sent.messageId)
    console.log('dlr_poll', i, dlr)
    const s = String(dlr.status || '').toUpperCase()
    if (s === 'DELIVRD' || s === 'FAILED' || s === 'REJECTD' || s === 'EXPIRED') break
    await new Promise((r) => setTimeout(r, 5000))
  }
}

if (!sent.ok) process.exit(1)

const delivered = String(dlr?.status || '').toUpperCase() === 'DELIVRD'
const failed = String(dlr?.status || '').toUpperCase() === 'FAILED'
console.log(JSON.stringify({
  ok: delivered,
  apiAccepted: true,
  creditDelta: delta,
  messageId: sent.messageId,
  dlrStatus: dlr?.status || null,
  note: delivered
    ? 'BrandTxt reports DELIVRD — check phone Inbox + Spam for sender HAKUM / unknown number.'
    : failed
      ? 'BrandTxt reports FAILED — carrier rejected. Confirm number and ask BrandTxt.'
      : 'No DELIVRD yet. Wait and re-poll MessageStatus, or ask BrandTxt with MessageId.',
}, null, 2))
process.exit(delivered ? 0 : failed ? 5 : 4)

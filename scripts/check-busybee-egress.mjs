/**
 * Diagnose BusyBee egress for customer reminder SMS.
 * Prints public IP + Balance/SendSMS ErrorCode so BrandTxt whitelist gaps are obvious.
 *
 * node scripts/check-busybee-egress.mjs
 * SEND_TEST_SMS=1 TEST_SMS_PHONE=09625294043 node scripts/check-busybee-egress.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { busybeeBalance, busybeeSendSms, busybeeErrorKind, normalizePhMobile } from '../server/busybee.mjs'

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

async function publicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(15000) })
    const json = await res.json()
    return String(json.ip || '')
  } catch (err) {
    return `error:${err.message}`
  }
}

const ip = await publicIp()
const bal = await busybeeBalance().catch((e) => ({ ok: false, error: e.message, json: null }))
const balKind = busybeeErrorKind(bal.json || bal.error || '')

const report = {
  egressIp: ip,
  balanceOk: Boolean(bal.ok),
  balanceErrorCode: bal.json?.ErrorCode ?? null,
  balanceErrorKind: balKind,
  knownWhitelistNote:
    'BrandTxt must allow this egressIp. Office IP drifts — re-check before live. Vercel needs Static IPs whitelisted separately.',
  historicallyDocumentedOfficeIp: '180.190.249.189',
}

if (process.env.SEND_TEST_SMS === '1' && process.env.TEST_SMS_PHONE) {
  const phone = process.env.TEST_SMS_PHONE
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const sent = await busybeeSendSms({
    phone,
    message: `Hakum Auto Care reminder path check ${stamp}. Outbound only — no reply needed.`,
  })
  report.send = {
    ok: sent.ok,
    mobile: normalizePhMobile(phone),
    messageId: sent.messageId || null,
    errorCode: sent.errorCode ?? null,
    errorKind: sent.errorKind || busybeeErrorKind(sent.providerResponse || ''),
    path: sent.path || null,
  }
  report.ok = Boolean(sent.ok)
  if (sent.errorKind === 'unauthorized_ip' || balKind === 'unauthorized_ip') {
    report.blocker =
      `Unauthorized IP — ask BrandTxt to whitelist ${ip} (and Vercel static egress for production).`
  }
} else {
  report.send = 'skipped — set SEND_TEST_SMS=1 TEST_SMS_PHONE=09…'
  report.ok = Boolean(bal.ok)
  if (balKind === 'unauthorized_ip') {
    report.blocker = `Unauthorized IP — ask BrandTxt to whitelist ${ip} before customer reminders can send.`
  }
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)

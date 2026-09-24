/**
 * Ops integrity check for admin daily-ops plan (no redesign).
 * Verifies required artifacts exist and records BrandTxt egress status.
 * Exit 0 = package ready (external BrandTxt/SMTP/Static IPs may still be OPEN).
 * Exit 2 = missing required artifact.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'docs/OPS/ADMIN-DAILY-OPS-TRACKER.md',
  'docs/OPS/BUSYBEE-BRANDTXT-REQUEST.md',
  'docs/OPS/brandtxt-dexter-followup.txt',
  'docs/OPS/VERCEL-STATIC-IPS.md',
  'docs/OPS/AUTH-SMTP-PROOF.md',
  'docs/qa/ADMIN-FRICTION-LOG.md',
  'src/lib/busybeeEgressPlan.js',
]

const missing = required.filter((p) => !existsSync(join(root, p)))
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2))
  process.exit(2)
}

const followup = readFileSync(join(root, 'docs/OPS/brandtxt-dexter-followup.txt'), 'utf8')
const friction = readFileSync(join(root, 'docs/qa/ADMIN-FRICTION-LOG.md'), 'utf8')
const smtp = readFileSync(join(root, 'docs/OPS/AUTH-SMTP-PROOF.md'), 'utf8')
const vercel = readFileSync(join(root, 'docs/OPS/VERCEL-STATIC-IPS.md'), 'utf8')

const checks = {
  followupHasCurrentIp: followup.includes('180.191.244.237'),
  followupFromMalcolm: /Malcolm Joaquin Cuady/i.test(followup),
  followupNoOwnerDailySms: !/owner daily sales summary by SMS/i.test(followup) || /no longer sending an owner daily/i.test(followup),
  frictionNoRedesignGate: /No POS \/ Payroll \/ Finance \*\*redesign\*\*/i.test(friction) || /no redesign/i.test(friction),
  smtpHasProjectRef: smtp.includes('lybxhpzzqqyqswvuwpxv'),
  vercelDocumentsMissingLink: /Missing|\.vercel/i.test(vercel),
}

const egress = spawnSync(process.execPath, [join(root, 'scripts/check-busybee-egress.mjs')], {
  encoding: 'utf8',
  cwd: root,
  env: process.env,
})
let egressJson = null
try {
  egressJson = JSON.parse((egress.stdout || '').trim() || 'null')
} catch {
  egressJson = {
    parseError: true,
    status: egress.status,
    stdout: (egress.stdout || '').slice(0, 500),
    stderr: (egress.stderr || '').slice(0, 500),
  }
}

const outDir = join(root, 'docs/OPS')
mkdirSync(outDir, { recursive: true })
const evidence = {
  at: new Date().toISOString(),
  redesignRequired: false,
  artifactsOk: true,
  checks,
  brandTxt: {
    followupReady: checks.followupHasCurrentIp && checks.followupFromMalcolm,
    egressOk: Boolean(egressJson?.ok),
    egressIp: egressJson?.egressIp ?? null,
    errorCode: egressJson?.balanceErrorCode ?? egressJson?.send?.errorCode ?? null,
    errorKind: egressJson?.balanceErrorKind ?? egressJson?.send?.errorKind ?? null,
    blocker: egressJson?.blocker ?? null,
    humanMustSendGmail: true,
  },
  vercelStaticIps: { hakumVisibleOnThisCli: false, runbook: 'docs/OPS/VERCEL-STATIC-IPS.md' },
  authSmtp: { status: 'OPEN', runbook: 'docs/OPS/AUTH-SMTP-PROOF.md', projectRef: 'lybxhpzzqqyqswvuwpxv' },
  frictionLog: 'docs/qa/ADMIN-FRICTION-LOG.md',
}

writeFileSync(join(outDir, 'admin-daily-ops-last-run.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify(evidence, null, 2))

const failedCheck = Object.entries(checks).find(([, v]) => !v)
if (failedCheck) {
  console.error('check_failed', failedCheck[0])
  process.exit(2)
}
process.exit(0)

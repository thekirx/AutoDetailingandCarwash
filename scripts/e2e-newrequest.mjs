/**
 * Master E2E for newrequest Parts 1–9.
 * Runs unit tests → part e2e → integrity → audit checks → build.
 * Updates E2E_CHECKLIST.md Status boxes to [x] on full pass.
 *
 * node scripts/e2e-newrequest.mjs
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const STEPS = [
  { id: '1.1', label: 'permissions.test', cmd: ['node', '--test', 'tests/permissions.test.js'] },
  { id: '1.2', label: 'permissions.marketingSales', cmd: ['node', '--test', 'tests/permissions.marketingSales.test.js'] },
  { id: '1.3', label: 'demoAccounts.test', cmd: ['node', '--test', 'tests/demoAccounts.test.js'] },
  { id: '2.1', label: 'posSale.test', cmd: ['node', '--test', 'tests/posSale.test.js'] },
  { id: '2.2', label: 'posBranchScope.test', cmd: ['node', '--test', 'tests/posBranchScope.test.js'] },
  { id: '3.1', label: 'queueLogic.test', cmd: ['node', '--test', 'tests/queueLogic.test.js'] },
  { id: '4.1', label: 'crewUsername.test', cmd: ['node', '--test', 'tests/crewUsername.test.js'] },
  { id: '5.1', label: 'financePart5.test', cmd: ['node', '--test', 'tests/financePart5.test.js'] },
  { id: '6.1', label: 'planningPart6.test', cmd: ['node', '--test', 'tests/planningPart6.test.js'] },
  { id: '7.1', label: 'crmPart7.test', cmd: ['node', '--test', 'tests/crmPart7.test.js'] },
  { id: '8.1', label: 'part8.test', cmd: ['node', '--test', 'tests/part8.test.js'] },
  { id: '9.2', label: 'session.test', cmd: ['node', '--test', 'tests/session.test.js'] },
  { id: '1.4', label: 'e2e-rbac-part1', cmd: ['node', 'scripts/e2e-rbac-part1.mjs'] },
  { id: '1.5', label: 'e2e-rbac-matrix', cmd: ['node', 'scripts/e2e-rbac-matrix.mjs'] },
  { id: '2.3', label: 'e2e-pos-part2', cmd: ['node', 'scripts/e2e-pos-part2.mjs'] },
  { id: '3.2', label: 'e2e-queue-part3', cmd: ['node', 'scripts/e2e-queue-part3.mjs'] },
  { id: '4.2', label: 'e2e-part4-crew-tasks', cmd: ['node', 'scripts/e2e-part4-crew-tasks.mjs'] },
  { id: '5.2', label: 'e2e-part5-finance', cmd: ['node', 'scripts/e2e-part5-finance.mjs'] },
  { id: '6.2', label: 'e2e-part6-planning', cmd: ['node', 'scripts/e2e-part6-planning.mjs'] },
  { id: '7.2', label: 'e2e-part7-crm-bookings', cmd: ['node', 'scripts/e2e-part7-crm-bookings.mjs'] },
  { id: '8.2', label: 'e2e-part8', cmd: ['node', 'scripts/e2e-part8.mjs'] },
  { id: '9.1', label: 'e2e-readiness', cmd: ['node', 'scripts/e2e-readiness.mjs'] },
  { id: '9.6', label: 'e2e-data-integrity', cmd: ['node', 'scripts/e2e-data-integrity.mjs'] },
  { id: '9.3a', label: 'check-audit-security', cmd: ['node', 'scripts/check-audit-security.mjs'] },
  { id: '9.3b', label: 'check-audit-p2', cmd: ['node', 'scripts/check-audit-p2.mjs'] },
  { id: '9.4', label: 'check-session', cmd: ['node', 'scripts/check-session.mjs'] },
  { id: '0.2', label: 'npm run build', cmd: isWin ? ['npm.cmd', 'run', 'build'] : ['npm', 'run', 'build'] },
]

function run(step) {
  console.log(`\n━━━ [${step.id}] ${step.label} ━━━`)
  const [bin, ...args] = step.cmd
  const r = spawnSync(bin, args, {
    cwd: root,
    encoding: 'utf8',
    shell: isWin,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  const code = r.status ?? 1
  if (code !== 0) {
    console.error(`\nFAIL [${step.id}] ${step.label} exit=${code}`)
    process.exit(code)
  }
  console.log(`PASS [${step.id}] ${step.label}`)
  return true
}

const started = new Date().toISOString()
console.log(`e2e-newrequest start ${started}`)
console.log(`steps: ${STEPS.length}`)

for (const step of STEPS) run(step)

const finished = new Date().toISOString()
console.log(`\n━━━ ALL ${STEPS.length} STEPS PASS ━━━`)
console.log(`finished ${finished}`)

// Mark checklist boxes [x] and stamp last run
const checklistPath = join(root, 'E2E_CHECKLIST.md')
if (existsSync(checklistPath)) {
  let md = readFileSync(checklistPath, 'utf8')
  md = md.replace(/\| \[ \] \|/g, '| [x] |')
  md = md.replace(/Last full run:.*$/m, `Last full run: **${finished}** (orchestrator exit 0)`)
  writeFileSync(checklistPath, md)
  console.log('Updated E2E_CHECKLIST.md → all Status [x]')
}

console.log('e2e-newrequest: PASS')

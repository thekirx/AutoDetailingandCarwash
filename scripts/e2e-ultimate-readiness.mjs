/**
 * Ultimate readiness orchestrator.
 * Unit suite → critical live e2e → one build → shared preview → UI P0 → responsive.
 * Writes docs/qa/last-run.json and stamps ULTIMATE-READINESS.md.
 *
 * Opt-in live SMS DLR: SEND_LIVE_SMS=1
 * Skip UI/responsive: SKIP_UI=1 SKIP_RESPONSIVE=1
 * Reuse running preview: BASE_URL=http://127.0.0.1:4173
 *
 * npm run test:readiness
 */
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'
const skipUi = process.env.SKIP_UI === '1'
const skipResponsive = process.env.SKIP_RESPONSIVE === '1'
const sendLiveSms = process.env.SEND_LIVE_SMS === '1'
const needPreview = !skipUi || !skipResponsive

const STEPS = [
  { id: 'U', label: 'npm test (unit)', cmd: isWin ? ['npm.cmd', 'test'] : ['npm', 'test'], critical: true },
  { id: 'L1', label: 'e2e-attendance', cmd: ['node', 'scripts/e2e-attendance.mjs'], critical: true },
  { id: 'L2', label: 'e2e-payroll', cmd: isWin ? ['npm.cmd', 'run', 'e2e:payroll'] : ['npm', 'run', 'e2e:payroll'], critical: true },
  { id: 'L3', label: 'e2e-readiness', cmd: ['node', 'scripts/e2e-readiness.mjs'], critical: true },
  { id: 'L4', label: 'e2e-queue-part3', cmd: ['node', 'scripts/e2e-queue-part3.mjs'], critical: true },
  { id: 'L5', label: 'e2e-pos-part2', cmd: ['node', 'scripts/e2e-pos-part2.mjs'], critical: true },
  { id: 'L6', label: 'smoke-busybee (balance only)', cmd: ['node', 'scripts/smoke-busybee.mjs'], critical: false },
  {
    id: 'L7',
    label: 'e2e-real-customer-status-sms',
    cmd: ['node', 'scripts/e2e-real-customer-status-sms.mjs'],
    critical: false,
    onlyIf: () => sendLiveSms,
  },
  {
    id: 'L8',
    label: 'e2e-ops-cutover',
    cmd: isWin ? ['npm.cmd', 'run', 'e2e:cutover'] : ['npm', 'run', 'e2e:cutover'],
    critical: true,
  },
  {
    id: 'L9',
    label: 'e2e-shift-close-money (BUG-007 RPC)',
    cmd: ['node', 'scripts/e2e-shift-close-money.mjs'],
    critical: true,
  },
  {
    id: 'B',
    label: 'npm run build',
    cmd: isWin ? ['npm.cmd', 'run', 'build'] : ['npm', 'run', 'build'],
    critical: true,
  },
]

const results = []

function run(step) {
  if (step.onlyIf && !step.onlyIf()) {
    console.log(`\n━━━ [${step.id}] ${step.label} SKIPPED ━━━`)
    results.push({ id: step.id, label: step.label, ok: true, skipped: true })
    return true
  }
  console.log(`\n━━━ [${step.id}] ${step.label} ━━━`)
  const [bin, ...args] = step.cmd
  const r = spawnSync(bin, args, {
    cwd: root,
    encoding: 'utf8',
    shell: isWin,
    env: {
      ...process.env,
      // After build, reuse preview from UI step if BASE_URL set by caller
    },
    maxBuffer: 30 * 1024 * 1024,
  })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  const code = r.status ?? 1
  const ok = code === 0
  if (!ok && !step.critical) {
    results.push({ id: step.id, label: step.label, ok: true, softFail: true, code, skipped: false })
    console.warn(`SOFT-FAIL [${step.id}] ${step.label} exit=${code} (non-critical)`)
    return true
  }
  results.push({ id: step.id, label: step.label, ok, code, skipped: false })
  if (!ok) {
    console.error(`\nFAIL [${step.id}] ${step.label} exit=${code}`)
    return false
  }
  console.log(`PASS [${step.id}] ${step.label}`)
  return true
}

async function startSharedPreview() {
  if (process.env.BASE_URL) {
    return { base: process.env.BASE_URL.replace(/\/$/, ''), stop: async () => {} }
  }
  // Dev server required for /api/* customer auth middleware
  const port = process.env.DEV_PORT || process.env.PREVIEW_PORT || '5173'
  const base = `http://127.0.0.1:${port}`
  const preview = spawn(
    isWin ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', port],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: isWin, env: process.env },
  )
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 500))
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) })
      if (res.ok || res.status === 404) {
        return {
          base,
          stop: async () => {
            preview.kill('SIGTERM')
          },
        }
      }
    } catch {
      /* wait */
    }
  }
  preview.kill()
  throw new Error('shared vite dev failed to start')
}

const started = new Date().toISOString()
console.log(`e2e-ultimate-readiness start ${started}`)

let aborted = false
for (const step of STEPS) {
  const cont = run(step)
  if (!cont) {
    aborted = true
    break
  }
}

let preview = null
if (!aborted && needPreview) {
  try {
    preview = await startSharedPreview()
    process.env.BASE_URL = preview.base
    console.log('shared preview', preview.base)

    if (!skipUi) {
      const cont = run({ id: 'UI', label: 'e2e-ui-p0', cmd: ['node', 'scripts/e2e-ui-p0.mjs'], critical: true })
      if (!cont) aborted = true
      if (!aborted) {
        const money = run({
          id: 'UI2',
          label: 'e2e-ui-money (BUG-007)',
          cmd: ['node', 'scripts/e2e-ui-money.mjs'],
          critical: true,
        })
        if (!money) aborted = true
      }
    } else {
      results.push({ id: 'UI', label: 'e2e-ui-p0', ok: true, skipped: true })
      results.push({ id: 'UI2', label: 'e2e-ui-money (BUG-007)', ok: true, skipped: true })
    }

    if (!aborted && !skipResponsive) {
      const cont = run({
        id: 'R',
        label: 'responsive-validation',
        cmd: ['node', 'scripts/responsive-validation.mjs'],
        critical: true,
      })
      if (!cont) aborted = true
    } else if (skipResponsive) {
      results.push({ id: 'R', label: 'responsive-validation', ok: true, skipped: true })
    }
  } catch (err) {
    results.push({ id: 'PREVIEW', label: 'shared preview', ok: false, code: 1, skipped: false })
    console.error('PREVIEW FAIL', err?.message || err)
    aborted = true
  } finally {
    if (preview?.stop) await preview.stop().catch(() => null)
  }
}

const finished = new Date().toISOString()
const failed = results.filter((r) => !r.ok && !r.skipped)
const passed = results.filter((r) => r.ok)
const summary = {
  ok: !aborted && failed.length === 0,
  started,
  finished,
  passed: passed.length,
  failed: failed.length,
  skipped: results.filter((r) => r.skipped).length,
  sendLiveSms,
  skipUi,
  skipResponsive,
  steps: results,
}

const qaDir = join(root, 'docs', 'qa')
writeFileSync(join(qaDir, 'last-run.json'), JSON.stringify(summary, null, 2))

// Living results log — always know the latest outcome
const resultsPath = join(qaDir, 'RESULTS.md')
const stepLines = results
  .map((r) => {
    const mark = r.skipped ? 'SKIP' : r.ok ? 'PASS' : `FAIL(${r.code})`
    return `| ${r.id} | ${r.label} | ${mark} |`
  })
  .join('\n')
const latestBlock = `## Latest orchestrator

| Field | Value |
|-------|-------|
| Finished | ${finished} |
| Overall | **${summary.ok ? 'PASS' : 'FAIL'}** |
| Passed / failed / skipped | ${summary.passed} / ${summary.failed} / ${summary.skipped} |
| SEND_LIVE_SMS | ${sendLiveSms ? '1' : '0'} |

| ID | Step | Result |
|----|------|--------|
${stepLines}

See also [\`last-run.json\`](./last-run.json) · [\`readiness-dashboard.html\`](./readiness-dashboard.html).
`
if (existsSync(resultsPath)) {
  let rm = readFileSync(resultsPath, 'utf8')
  if (/## Latest orchestrator[\s\S]*?(?=\n---\n)/.test(rm)) {
    rm = rm.replace(/## Latest orchestrator[\s\S]*?(?=\n---\n)/, `${latestBlock}\n`)
  } else {
    rm = `${latestBlock}\n\n---\n\n${rm}`
  }
  // prepend campaign log row
  const logRow = `| ${finished} | \`npm run test:readiness\` | ${summary.ok ? 0 : 1} | passed=${summary.passed} failed=${summary.failed} skipped=${summary.skipped} |`
  if (/## Campaign log[\s\S]*?\n\|[^\n]+\n\|[-| ]+\n/.test(rm)) {
    rm = rm.replace(
      /(## Campaign log[\s\S]*?\n\|[^\n]+\n\|[-| ]+\n)/,
      `$1${logRow}\n`,
    )
  }
  writeFileSync(resultsPath, rm)
} else {
  writeFileSync(resultsPath, `# Hakum QA — Living Results Log\n\n${latestBlock}\n`)
}

// Stamp checklist header
const checklistPath = join(qaDir, 'ULTIMATE-READINESS.md')
if (existsSync(checklistPath)) {
  let md = readFileSync(checklistPath, 'utf8')
  md = md.replace(
    /Last readiness run:.*$/m,
    `Last readiness run: **${finished}** (ok=${summary.ok} passed=${summary.passed} failed=${summary.failed})`,
  )
  // Mark gates that ran green (conservative: only 0.1/0.2/0.3 when full ok)
  if (summary.ok) {
    md = md.replace(/\| 0\.1 \| Unit suite \|.*\| \[ \] \|/, '| 0.1 | Unit suite | `npm test` | [x] |')
    md = md.replace(/\| 0\.2 \| Production build \|.*\| \[ \] \|/, '| 0.2 | Production build | `npm run build` | [x] |')
    md = md.replace(
      /\| 0\.3 \| Ultimate orchestrator \|.*\| \[ \] \|/,
      '| 0.3 | Ultimate orchestrator | `npm run test:readiness` | [x] |',
    )
  }
  writeFileSync(checklistPath, md)
}

// Simple dashboard
const dash = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Hakum readiness</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 2rem; background: #0b1220; color: #e8eefc; }
    h1 { font-weight: 650; }
    .ok { color: #5dde9a; } .bad { color: #ff7b7b; } .skip { color: #9aa7c0; }
    table { border-collapse: collapse; width: 100%; max-width: 920px; }
    th, td { border-bottom: 1px solid #24304a; padding: 0.55rem 0.4rem; text-align: left; }
    .meta { color: #9aa7c0; margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>Hakum ultimate readiness</h1>
  <p class="meta">${finished} · overall <strong class="${summary.ok ? 'ok' : 'bad'}">${summary.ok ? 'PASS' : 'FAIL'}</strong>
  · ${summary.passed} passed · ${summary.failed} failed · ${summary.skipped} skipped</p>
  <table>
    <thead><tr><th>ID</th><th>Step</th><th>Result</th></tr></thead>
    <tbody>
      ${results
        .map((r) => {
          const cls = r.skipped ? 'skip' : r.ok ? 'ok' : 'bad'
          const label = r.skipped ? 'SKIP' : r.ok ? 'PASS' : `FAIL (${r.code})`
          return `<tr><td>${r.id}</td><td>${r.label}</td><td class="${cls}">${label}</td></tr>`
        })
        .join('\n')}
    </tbody>
  </table>
</body>
</html>
`
writeFileSync(join(qaDir, 'readiness-dashboard.html'), dash)

console.log(`\n━━━ ultimate readiness ${summary.ok ? 'PASS' : 'FAIL'} ━━━`)
console.log(JSON.stringify({ ok: summary.ok, passed: summary.passed, failed: summary.failed, skipped: summary.skipped }, null, 2))
process.exit(summary.ok ? 0 : 1)

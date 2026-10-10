import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

/**
 * BUG-083 established that the auth boundary has to be checked from both sides:
 * RLS (BUG-079/080), the client's fetch headers, and now the /api/* handlers.
 *
 * scripts/audit-api-auth.mjs does the third one. This test exists so it cannot
 * quietly stop working, and — more importantly — so the audit is proven ABLE to
 * fail. An audit that only ever prints "OK" is indistinguishable from one whose
 * patterns no longer match the code, which is how the first four versions of my
 * detectors this session all produced confident false positives.
 *
 * The second block runs the audit against a deliberately broken copy of the
 * repo and requires it to FAIL. If that block is ever removed, the audit is
 * decoration.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const script = join(root, 'scripts', 'audit-api-auth.mjs')

function runAudit() {
  try {
    const stdout = execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8' })
    return { code: 0, stdout }
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout || ''}${err.stderr || ''}` }
  }
}

describe('the /api/* auth audit passes on the real tree', () => {
  it('exits 0 with every control passing', () => {
    const { code, stdout } = runAudit()
    assert.equal(code, 0, `audit failed on the current tree:\n${stdout}`)
    assert.doesNotMatch(stdout, /control FAIL/, 'a control failed — the detector does not match this codebase')
    assert.doesNotMatch(stdout, /^STALE/m, 'the public/delegated lists name handlers that no longer exist')
  })

  it('covers every request handler in api/ and server/', () => {
    // A silently narrowed glob would make the audit pass by scanning nothing.
    const { stdout } = runAudit()
    const scanned = Number(/handlers scanned: (\d+)/.exec(stdout)?.[1])
    const onDisk = ['api', 'server'].reduce((n, dir) => {
      let count = 0
      for (const f of readdirSync(join(root, dir))) {
        if (!/\.(js|mjs)$/.test(f)) continue
        if (/export\s+(?:async\s+)?function\s+handle\w*Request\b/.test(readFileSync(join(root, dir, f), 'utf8'))) count++
      }
      return n + count
    }, 0)
    assert.equal(scanned, onDisk, `audit scanned ${scanned} handlers but ${onDisk} exist on disk`)
  })
})

describe('the audit is able to fail', () => {
  // Runs against a COPY so the working tree is never mutated. A harness that
  // mutates src/ in place is exactly how a leaked mutation becomes tomorrow's
  // baseline.
  it('fails when a handler is reachable with no authentication and no exemption', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'api-auth-'))
    try {
      for (const dir of ['api', 'server', 'scripts']) {
        const src = join(root, dir)
        const dst = join(tmp, dir)
        rmSync(dst, { recursive: true, force: true })
        execFileSync(process.execPath, [
          '-e',
          `require('fs').cpSync(${JSON.stringify(src)}, ${JSON.stringify(dst)}, { recursive: true })`,
        ])
      }

      // A handler in the exact shape the audit is supposed to catch: it takes a
      // POST, uses the service role, and never looks at who is calling.
      writeFileSync(
        join(tmp, 'server', 'zzBrokenHandler.mjs'),
        `import { json } from './httpUtil.mjs'
export async function handleZzzBrokenRequest(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  const admin = adminClient()
  const { data } = await admin.from('staff_profiles').select('*')
  return json(res, 200, { staff: data })
}
function adminClient() { return null }
`,
        'utf8',
      )

      let result
      try {
        const stdout = execFileSync(process.execPath, [join(tmp, 'scripts', 'audit-api-auth.mjs')], {
          cwd: tmp,
          encoding: 'utf8',
        })
        result = { code: 0, stdout }
      } catch (err) {
        result = { code: err.status ?? 1, stdout: `${err.stdout || ''}${err.stderr || ''}` }
      }

      assert.notEqual(result.code, 0, 'the audit passed a tree containing an unauthenticated handler:\n' + result.stdout)
      assert.match(result.stdout, /handleZzzBrokenRequest/, 'the audit must name the offending handler')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('refuses to print a verdict when its own controls fail', () => {
    // If the repo's auth patterns change, the detector must go quiet rather than
    // report a clean result it did not actually earn.
    const tmp = mkdtempSync(join(tmpdir(), 'api-auth-ctl-'))
    try {
      for (const dir of ['api', 'server', 'scripts']) {
        execFileSync(process.execPath, [
          '-e',
          `require('fs').cpSync(${JSON.stringify(join(root, dir))}, ${JSON.stringify(join(tmp, dir))}, { recursive: true })`,
        ])
      }
      // Rename the handler the control depends on, so the control cannot find it.
      const path = join(tmp, 'server', 'customerHistoryApi.mjs')
      writeFileSync(path, readFileSync(path, 'utf8').replace('handleCustomerHistoryRequest', 'handleRenamedAway'), 'utf8')

      let result
      try {
        const stdout = execFileSync(process.execPath, [join(tmp, 'scripts', 'audit-api-auth.mjs')], {
          cwd: tmp,
          encoding: 'utf8',
        })
        result = { code: 0, stdout }
      } catch (err) {
        result = { code: err.status ?? 1, stdout: `${err.stdout || ''}${err.stderr || ''}` }
      }
      assert.notEqual(result.code, 0, 'the audit reported a verdict with a broken control')
      assert.match(result.stdout, /control FAIL/, 'the failing control must be named')
      assert.doesNotMatch(result.stdout, /OK — every/, 'no verdict may be printed when a control fails')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
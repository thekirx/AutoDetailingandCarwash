import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const scriptsDir = join(root, 'scripts')

const probeFiles = readdirSync(scriptsDir).filter((f) => /^probe-.*\.mjs$/.test(f))

/** Comments stripped: a probe documents the bugs it guards against, and prose
 *  about a defect must never satisfy the guard for the defect. */
function codeOf(file) {
  return readFileSync(join(scriptsDir, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('every read-only probe reports what it actually read', () => {
  it('finds the probes at all', () => {
    assert.ok(probeFiles.length >= 10, `expected the probe set, found ${probeFiles.length}`)
  })

  it('never hands readOrFail a fabricated result object', () => {
    // Three separate probes in this repo shipped this exact bug and every one
    // printed a clean "0 affected" for tables holding thousands of rows. A
    // fabricated `{ data: null }` makes readOrFail return null whatever the
    // database says, so a live data-loss bug renders as a blank.
    const offenders = probeFiles.filter((f) => /readOrFail\([^)]*\{\s*data:\s*null/.test(codeOf(f)))
    assert.deepEqual(offenders, [], `probes fabricate a result into readOrFail: ${offenders.join(', ')}`)
  })

  it('readOrFail throws on error rather than counting a broken read as empty', () => {
    for (const f of probeFiles) {
      const src = codeOf(f)
      if (!/function readOrFail/.test(src)) continue
      assert.match(
        src,
        /function readOrFail\([\s\S]{0,240}?throw new Error/,
        `${f} defines readOrFail but it does not throw on error`,
      )
    }
  })

  it('never reads a head-mode count off data', () => {
    // head:true returns no rows, so `res.data` is null and a count taken from it
    // silently reports 0.
    const offenders = probeFiles.filter((f) => /readOrFail\([^)]*\)\s*\?\s*\.\s*count/.test(codeOf(f)))
    assert.deepEqual(offenders, [], `probes read .count off head-mode data: ${offenders.join(', ')}`)
  })

  it('keeps its probes read-only', () => {
    const writes = probeFiles.filter((f) =>
      /\.(insert|update|delete|upsert)\s*\(/.test(codeOf(f)) && !/rpc\(/.test(codeOf(f)),
    )
    assert.deepEqual(writes, [], `probes write to the database: ${writes.join(', ')}`)
  })
})
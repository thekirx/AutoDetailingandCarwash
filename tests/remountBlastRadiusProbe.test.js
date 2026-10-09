import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const rawSrc = readFileSync(join(root, 'scripts', 'probe-remount-blast-radius.mjs'), 'utf8')
// Strip comments first. The probe documents this exact bug in its header, so a
// naive scan matches the write-up of the defect instead of the defect — the same
// reason a commented-out SQL constraint is not a constraint.
const src = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('remount blast-radius probe cannot report a clean bill of health', () => {
  /**
   * This guard exists because the first version of this probe was a tautology.
   * It called `readOrFail(label, { data: null, error })`, so every read returned
   * null and the probe printed "0 customers affected" for loyalty_ledger,
   * customer_memberships AND birthday perks — while those tables actually held
   * 14, 0 and 1 rows. A probe that can only ever print zero is worse than no
   * probe: it converts a live data-loss bug into a reassuring blank.
   */
  it('never hands readOrFail a fabricated result object', () => {
    const fabricated = src.match(/readOrFail\([^)]*\{\s*data:\s*null/g) || []
    assert.deepEqual(
      fabricated,
      [],
      `readOrFail received a fabricated { data: null } result — it must receive the actual response object, or every read yields null:\n${fabricated.join('\n')}`,
    )
  })

  it('reads the row count off the response, not off head-mode data', () => {
    // head:true returns no rows, so `res.data` is null and a count read from it
    // silently reports 0.
    assert.ok(
      /head:\s*true\s*\)[\s\S]{0,200}?customersRes\.count|\.count\s*\?\?\s*0/.test(src),
      'the probe must read `.count` off the result object for head-mode queries',
    )
    assert.ok(
      !/readOrFail\([^)]*\)\s*\?\s*\.\s*count/.test(src),
      'reading `.count` off readOrFail() returns undefined in head mode and reports 0',
    )
  })

  it('counts distinct owners rather than echoing a hardcoded number', () => {
    assert.ok(
      /new Set\(rows\.map\(\(r\)\s*=>\s*r\.customer_id\)\)\.size/.test(src),
      'the probe must derive distinct owners from the rows it actually read',
    )
  })

  it('fails loudly when a read errors rather than counting it as zero', () => {
    assert.ok(
      /function readOrFail\(label,\s*res\)\s*\{[\s\S]{0,200}?throw new Error/.test(src),
      'readOrFail must throw on error so a broken read is never rendered as an empty result',
    )
  })
})
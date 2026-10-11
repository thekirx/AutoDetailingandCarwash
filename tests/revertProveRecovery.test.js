import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The revert-prove harness mutates real source files to prove each guard bites.
 * When it is killed mid-mutation, the file stays mutated and the tree is wrong
 * with nothing recording that it is wrong.
 *
 * That is not hypothetical. The full unfiltered gate was terminated at its
 * 50-minute ceiling with `20261010170000` on disk carrying `overShortMinor`
 * forced to `null` — the kind of break that reads as a real defect in a money
 * calculation, in a file that had been fine an hour earlier.
 *
 * A `finally` cannot help: a killed process does not run one. So the originals
 * are written down *before* each mutation, and recovery runs at startup and on
 * demand. This drives that path end to end against a scratch file.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const HARNESS = join(root, 'scripts', 'revert-prove-db-audit.mjs')
const BACKUP_DIR = join(root, '.git', 'revert-prove-orig')
const PROBE = 'tmp-recover-probe.txt'

const recover = () => execFileSync(process.execPath, [HARNESS, '--recover'], { cwd: root, encoding: 'utf8' })

/** Leave the repo exactly as a killed run would: a mutated file plus its backup. */
function simulateInterruptedRun() {
  mkdirSync(BACKUP_DIR, { recursive: true })
  writeFileSync(join(BACKUP_DIR, PROBE.replace(/[\\/]/g, '__')), 'ORIGINAL CONTENT\n', 'utf8')
  writeFileSync(join(BACKUP_DIR, 'manifest.txt'), `${PROBE}\n`, 'utf8')
  writeFileSync(join(root, PROBE), 'MUTATED CONTENT\n', 'utf8')
}

describe('a killed revert-prove run is recoverable', () => {
  it('restores a file left mutated, and says which file', () => {
    try {
      simulateInterruptedRun()
      assert.equal(readFileSync(join(root, PROBE), 'utf8'), 'MUTATED CONTENT\n', 'the simulation did not leave a mutated file')

      const out = recover()

      assert.equal(readFileSync(join(root, PROBE), 'utf8'), 'ORIGINAL CONTENT\n', 'the probe was not restored')
      assert.match(out, /interrupted mid-mutation/, 'recovery must announce itself; a silent repair leaves no evidence it ran')
      assert.match(out, new RegExp(PROBE.replace(/\./g, '\\.')), 'recovery must name the file it repaired')
      assert.equal(existsSync(BACKUP_DIR), false, 'the backup directory should be cleaned up after recovery')
    } finally {
      rmSync(join(root, PROBE), { force: true })
      rmSync(BACKUP_DIR, { recursive: true, force: true })
    }
  })

  it('is a no-op, and says so, when nothing was interrupted', () => {
    const out = recover()
    assert.match(out, /nothing to recover/, 'a clean tree must not be reported as a repair')
  })

  it('stashes before mutating and unstashes on every path that restores', () => {
    // Ordering is the whole mechanism: a stash written after the mutation
    // records the mutated bytes as "original", which recovers to exactly the
    // break it was meant to repair. Source shape is the only place to see it.
    const src = readFileSync(HARNESS, 'utf8')
    const mutate = src.indexOf("writeText(abs, original.replace(m.from, m.to), 'mutate')")
    const stashCall = src.indexOf('stash(relPath, abs, original)')
    assert.ok(mutate > 0 && stashCall > 0, 'the harness no longer stashes before mutating')
    assert.ok(stashCall < mutate, 'the backup must be written BEFORE the mutation is applied')

    // Every `writeText(abs, original, 'restore')` must be followed by an unstash.
    const restores = [...src.matchAll(/writeText\(abs, original, 'restore'\)/g)]
    assert.ok(restores.length >= 3, `expected several restore paths, found ${restores.length}`)
    for (const r of restores) {
      const after = src.slice(r.index, r.index + 220)
      assert.match(after, /unstash\(relPath\)/, 'a restore path does not clear its backup, so the next run would "recover" a good tree into a broken one')
    }
  })
})
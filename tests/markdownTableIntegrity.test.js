import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * A markdown table is split on every unescaped `|` BEFORE inline parsing, so a
 * literal pipe in a prose cell -- including one inside a code span or inside
 * **bold** -- silently shatters the row into extra columns. Nothing errors; the
 * row just renders wrong.
 *
 * These rows are long and heavily formatted, so this is a live failure mode
 * rather than a theoretical one, and it has bitten twice while writing BUGS.md.
 * The fix is to escape as `\|`, which is invisible in the source and easy to
 * forget.
 *
 * The invariant is TABLE-RELATIVE: every row in a table must carry the same
 * number of unescaped pipes as that table's own header. Hardcoding a column
 * count per file is the trap -- the first version of this check reported all 109
 * rows of REMAINING-WORK as broken, because that file also contains 2-, 3-, 4-
 * and 5-column tables and the check demanded 8 pipes from all of them.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const BACKSLASH = String.fromCharCode(92)
const PIPE = String.fromCharCode(124)

const DOCS = ['docs/qa/BUGS.md', 'docs/qa/REMAINING-WORK-2026-10.md']

/** Unescaped pipe count. `\|` is an escaped pipe and does not split the row. */
function unescapedPipes(line) {
  let n = 0
  for (let i = 0; i < line.length; i++) {
    if (line[i] === PIPE && line[i - 1] !== BACKSLASH) n++
  }
  return n
}

/** True for a `|---|---|` separator line. */
function isSeparator(line) {
  return /^\s*\|(?:\s*:?-{2,}:?\s*\|)+\s*$/.test(line)
}

/**
 * Every malformed row in a markdown document, as `line: reason` strings.
 * A table block is a header line followed by a separator line; body rows follow.
 */
function findBrokenRows(markdown) {
  const lines = markdown.split(/\r?\n/)
  const broken = []

  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('|') || !isSeparator(lines[i + 1])) continue
    const expected = unescapedPipes(lines[i])
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j++) {
      const got = unescapedPipes(lines[j])
      if (got !== expected) {
        broken.push(`line ${j + 1}: ${got} unescaped pipes, header has ${expected}`)
      }
    }
  }
  return broken
}

describe('markdown tables are not shattered by unescaped pipes', () => {
  it('the detector catches a row that an unescaped pipe has split', () => {
    // A detector that cannot fail is worse than no detector: it reports the
    // register as clean because it never looked, not because it looked.
    const broken = findBrokenRows(
      ['| a | b |', '|---|---|', '| one | two | three |', '| ok | fine |'].join('\n'),
    )
    assert.equal(broken.length, 1, 'the split row was not detected')
    assert.match(broken[0], /line 3/)
  })

  it('an escaped pipe does not count as a split', () => {
    // The whole remedy for this bug is `\|`. If the detector counted escaped
    // pipes it would report the FIXED row as broken and train us to unescape.
    assert.deepEqual(
      findBrokenRows(['| a | b |', '|---|---|', '| `x \\| y` | two |', '| ok | fine |'].join('\n')),
      [],
    )
  })

  it('it reads column counts per table, not per file', () => {
    // REMAINING-WORK mixes 2-, 3-, 4- and 5-column tables. Demanding one global
    // count is how the first version of this check called all 109 rows broken.
    const mixed = [
      '| two | cols |',
      '|---|---|',
      '| a | b |',
      '',
      '| four | column | table | here |',
      '|---|---|---|---|',
      '| a | b | c | d |',
    ].join('\n')
    assert.deepEqual(findBrokenRows(mixed), [])
  })

  it('it does not mistake prose containing pipes for a table', () => {
    assert.deepEqual(findBrokenRows('run `a | b` in the shell\nnot a table | at all'), [])
  })

  for (const doc of DOCS) {
    it(`${doc} has no shattered rows`, () => {
      const broken = findBrokenRows(readFileSync(join(root, doc), 'utf8'))
      assert.deepEqual(broken, [], `\n${broken.join('\n')}\n`)
    })
  }
})
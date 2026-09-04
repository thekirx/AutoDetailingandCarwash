import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cssPath = path.join(root, 'src', 'styles.css')

test('styles.css defines .floor-control exactly once (no drifted duplicate ops CSS)', () => {
  const css = fs.readFileSync(cssPath, 'utf8')
  const matches = css.match(/(?:^|\n)\.floor-control\s*\{/g) || []
  assert.equal(matches.length, 1, `expected 1 .floor-control block, got ${matches.length}`)
})

test('styles.css stays under 9000 lines after ops CSS dedupe', () => {
  const lines = fs.readFileSync(cssPath, 'utf8').split(/\r?\n/).length
  assert.ok(lines < 9000, `styles.css has ${lines} lines; dedupe target < 9000`)
})

test('end-of-shift wizard rail CSS retained after dedupe', () => {
  const css = fs.readFileSync(cssPath, 'utf8')
  assert.match(css, /\.hakum-shift-steps\s*\{/)
})

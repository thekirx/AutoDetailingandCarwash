import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

/* Supplier sample photos (client-approved 17 Oct 2026): every film in the
   catalog has exactly one photo, named by its tint code, and the photo map
   points each film at its own file. Read as text: Node can't import .webp. */
const config = JSON.parse(readFileSync(new URL('../src/data/tintFinderConfig.json', import.meta.url)))
const source = readFileSync(new URL('../src/lib/tintFilmPhotos.js', import.meta.url), 'utf8')
const imports = Object.fromEntries([...source.matchAll(/^import (\w+) from '\.\.\/assets\/tint-finder\/films\/([\w]+)\.webp'/gm)].map(([, name, file]) => [name, file]))
const map = Object.fromEntries([...source.matchAll(/^\s+'?([\w ]+?)'?: (\w+),$/gm)].map(([, key, name]) => [key, imports[name]]))

const codeFor = { 'Clear Bluish': 'C70' }

test('every catalog film maps to its own supplier photo', () => {
  const films = Object.keys(config.films)
  assert.equal(films.length, 12)
  assert.deepEqual(Object.keys(map).sort(), films.sort())
  for (const key of films) assert.equal(map[key], codeFor[key] || key, `${key} must use the photo named after its tint code`)
  assert.equal(new Set(Object.values(map)).size, 12, 'no two films share a photo')
})

test('every mapped photo file exists', () => {
  for (const file of Object.values(map)) {
    assert.ok(existsSync(new URL(`../src/assets/tint-finder/films/${file}.webp`, import.meta.url)), `${file}.webp is missing`)
  }
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

const projectFile = (path) => new URL(`../${path}`, import.meta.url)

describe('PPF cinematic section', () => {
  it('uses the protected final frame for reduced motion', async () => {
    const sequence = await readFile(projectFile('src/components/public/home/PpfInstallSequence.jsx'), 'utf8')

    assert.match(sequence, /paint\(FRAME_COUNT - 1\)/)
    assert.match(sequence, /prefers-reduced-motion/)
  })

  it('keeps every chapter in the document without disruptive live announcements', async () => {
    const section = await readFile(projectFile('src/components/public/home/HomeServiceSections.jsx'), 'utf8')

    assert.match(section, /ppfInformation\.chapters\.map/)
    assert.match(section, /chapter\.heading/)
    assert.match(section, /chapter\.copy/)
    assert.doesNotMatch(section, /aria-live=/)
    assert.doesNotMatch(section, /aria-hidden=\{story\.activeChapter/)
  })
})

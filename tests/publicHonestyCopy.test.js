import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Public honesty copy', () => {
  it('coming-soon branch CTA does not invent a waitlist', () => {
    const src = readFileSync(join(root, 'src/components/public/bredesign/BdEventsBranches.jsx'), 'utf8')
    assert.equal(/Join the waitlist/i.test(src), false)
    assert.match(src, /Ask about opening/)
    assert.match(src, /to=\{comingSoon \? '\/contact'/)
  })

  it('legal pages do not promise a contact form that does not exist', () => {
    const src = readFileSync(join(root, 'src/pages/LegalPages.jsx'), 'utf8')
    assert.equal(/contact form/i.test(src), false)
    assert.match(src, /\/contact/)
  })
})

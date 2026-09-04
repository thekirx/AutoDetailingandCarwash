import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('design tokens: shape lock + status + capp aliases + no Geist font-sans', () => {
  const tokens = fs.readFileSync(path.join(root, 'src', 'design-tokens.css'), 'utf8')
  const styles = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8')
  assert.match(tokens, /--shape-interactive:/)
  assert.match(tokens, /--shape-card:/)
  assert.match(tokens, /--status-queued:/)
  assert.match(tokens, /--capp-navy:\s*var\(--color-brand-primary\)/)
  assert.doesNotMatch(styles, /@fontsource-variable\/geist/)
  assert.match(styles, /--font-sans:\s*var\(--font-ops\)/)
  assert.match(styles, /--primary:\s*var\(--color-brand-primary\)/)
})

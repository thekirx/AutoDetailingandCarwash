/**
 * Guard: booking/floor lanes must use theme tokens (not hardcoded dark navy).
 * Fails if #0d1726 returns on .floor-lane / .floor-ticket (light-mode contrast bug).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

describe('bookings board contrast tokens', () => {
  it('floor-lane and floor-ticket use CSS variables, not #0d1726', () => {
    const css = readFileSync(path.join(root, 'src/styles.css'), 'utf8')
    assert.match(css, /\.floor-lane\s*\{[^}]*background:\s*var\(--muted\)/s)
    assert.match(css, /\.floor-ticket\s*\{[^}]*background:\s*var\(--card\)/s)
    assert.match(css, /\.floor-ticket\s*\{[^}]*color:\s*var\(--card-foreground\)/s)
    // Hardcoded navy must not remain as lane/ticket fill (light-mode contrast bug)
    const laneFills = [...css.matchAll(/\.floor-lane[^{]*\{([^}]+)\}/g)].map((m) => m[1])
    for (const block of laneFills) {
      if (/background\s*:/.test(block)) assert.doesNotMatch(block, /#0d1726/i)
    }
  })

  it('outline buttons set text-foreground for readable labels', () => {
    const btn = readFileSync(path.join(root, 'src/components/ui/button.jsx'), 'utf8')
    assert.match(btn, /outline:[\s\S]*text-foreground/)
  })

  it('booking board avoids slate-on-navy utility classes', () => {
    const page = readFileSync(path.join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    assert.doesNotMatch(page, /text-slate-400/)
    assert.doesNotMatch(page, /bg-\[#0d1726\]/)
    assert.match(page, /text-muted-foreground/)
    assert.match(page, /text-foreground/)
  })
})

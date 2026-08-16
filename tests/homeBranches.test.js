import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildHomeBranchCards, countActiveHomeBranches } from '../src/lib/homeBranches.js'

describe('homepage branch cards', () => {
  it('preserves production branch destinations and appends non-link Dasmariñas', () => {
    const cards = buildHomeBranchCards([
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', address: 'RFC Mall' },
      { slug: 'batangas', name: 'Hakum Auto Care Batangas', address: 'Batangas City' },
    ])

    assert.deepEqual(cards.map(({ name, href, isComingSoon }) => ({ name, href, isComingSoon })), [
      { name: 'Bacoor', href: '/queue/bacoor', isComingSoon: false },
      { name: 'Batangas', href: '/queue/batangas', isComingSoon: false },
      { name: 'Dasmariñas', href: null, isComingSoon: true },
    ])
    assert.equal(cards[2].status, 'Coming Soon')
    assert.equal(countActiveHomeBranches(cards), 2)
  })

  it('keeps production fallbacks when no branch rows are available', () => {
    const cards = buildHomeBranchCards([])
    assert.deepEqual(cards.map(({ name }) => name), ['Bacoor', 'Batangas', 'Dasmariñas'])
    assert.equal(countActiveHomeBranches(cards), 2)
  })
})

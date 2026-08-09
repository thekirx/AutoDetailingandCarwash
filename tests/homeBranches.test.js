import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildHomeBranchCards,
  countActiveHomeBranches,
} from '../src/lib/homeBranches.js'

describe('preferred homepage branch cards', () => {
  it('keeps live branches active and appends Dasmariñas without a destination', () => {
    const cards = buildHomeBranchCards([
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', address: 'RFC Mall, Cavite' },
    ])

    assert.deepEqual(cards, [
      {
        slug: 'bacoor',
        name: 'Bacoor',
        address: 'RFC Mall, Cavite',
        href: '/queue/bacoor',
        isComingSoon: false,
        status: 'Active',
      },
      {
        slug: 'dasmarinas-coming-soon',
        name: 'Dasmariñas',
        address: 'Dasmariñas, Cavite',
        href: null,
        isComingSoon: true,
        status: 'Coming Soon',
      },
    ])
    assert.equal(countActiveHomeBranches(cards), 1)
  })

  it('uses Bacoor and Batangas fallbacks before the coming-soon card', () => {
    const cards = buildHomeBranchCards([])

    assert.deepEqual(cards.map((card) => card.name), ['Bacoor', 'Batangas', 'Dasmariñas'])
    assert.deepEqual(cards.map((card) => card.href), ['/branches', '/branches', null])
    assert.equal(countActiveHomeBranches(cards), 2)
    assert.equal(cards.at(-1).status, 'Coming Soon')
  })
})

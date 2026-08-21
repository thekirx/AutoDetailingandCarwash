import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildHomeBranchCards, comingSoonHomeCopy, countActiveHomeBranches } from '../src/lib/homeBranches.js'

describe('homepage branch cards', () => {
  it('uses coming_soon rows from the branch table instead of inventing a city', () => {
    const cards = buildHomeBranchCards([
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', address: 'RFC Mall' },
      { slug: 'dasmarinas', name: 'Hakum Auto Care Dasmariñas', address: 'Dasmariñas, Cavite', coming_soon: true },
    ])

    assert.deepEqual(cards.map(({ name, href, isComingSoon }) => ({ name, href, isComingSoon })), [
      { name: 'Bacoor', href: '/queue/bacoor', isComingSoon: false },
      { name: 'Dasmariñas', href: null, isComingSoon: true },
    ])
    assert.equal(comingSoonHomeCopy(cards), 'with Dasmariñas coming soon')
    assert.equal(countActiveHomeBranches(cards), 1)
  })

  it('does not append a fake Dasmariñas when every loaded site is already active', () => {
    const cards = buildHomeBranchCards([
      { slug: 'bacoor', name: 'Hakum Auto Care Bacoor', address: 'RFC Mall' },
      { slug: 'batangas', name: 'Hakum Auto Care Batangas', address: 'Batangas City' },
    ])
    assert.deepEqual(cards.map(({ name, isComingSoon }) => ({ name, isComingSoon })), [
      { name: 'Bacoor', isComingSoon: false },
      { name: 'Batangas', isComingSoon: false },
    ])
    assert.equal(comingSoonHomeCopy(cards), '')
  })

  it('keeps production fallbacks when no branch rows are available', () => {
    const cards = buildHomeBranchCards([])
    assert.deepEqual(cards.map(({ name }) => name), ['Bacoor', 'Batangas', 'Dasmariñas'])
    assert.equal(countActiveHomeBranches(cards), 2)
  })
})

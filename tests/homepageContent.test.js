import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { PPF_FILM_BRAND, PPF_PACKAGES } from '../src/data/ppfPackages.js'
import {
  buildPpfPackageCards,
  loadHomepageContent,
  mapBlogToHybridCard,
  mapEventToHybridCard,
} from '../src/lib/homepageContent.js'

function queryResultByTable(results) {
  return {
    from(table) {
      if (!(table in results)) throw new Error(`Unexpected production table: ${table}`)
      const chain = {
        select() { return chain },
        eq() { return chain },
        order() { return chain },
        limit() { return Promise.resolve(results[table]) },
      }
      return chain
    },
  }
}

describe('homepage production content adapters', () => {
  it('links the PPF package overview to the approved film partner', () => {
    assert.deepEqual(PPF_FILM_BRAND, {
      name: 'ClearPro',
      url: 'https://www.clearpro.com/',
    })
  })

  it('derives static package cards from the production PPF package model', () => {
    const cards = buildPpfPackageCards(PPF_PACKAGES)

    assert.deepEqual(cards.map(({ id, title, thickness }) => ({ id, title, thickness })), [
      { id: 'basic', title: 'Basic Protection', thickness: '7.5 mil premium-grade PPF' },
      { id: 'premium', title: 'Premium Protection', thickness: '7.5 mil premium-grade PPF' },
      { id: 'platinum', title: 'Platinum Protection', thickness: '8.5 mil premium-grade PPF' },
    ])
    assert.deepEqual(Object.keys(cards[0]).sort(), [
      'bookingState',
      'coverageType',
      'ctaLabel',
      'description',
      'id',
      'number',
      'recommendedLabel',
      'thickness',
      'title',
      'warrantySummary',
    ].sort())
    assert.equal(cards[0].warrantySummary, '5-year PPF warranty for manufacturer defects only')
    assert.equal(cards[1].recommendedLabel, 'Most Popular')
    assert.equal(cards[2].bookingState.packageId, 'platinum')
    assert.equal(cards[2].ctaLabel, 'Book Platinum Protection')
  })

  it('maps production Blog and Event rows to existing internal routes', () => {
    assert.deepEqual(mapBlogToHybridCard({
      id: 'post-1', title: 'Gloss that lasts', slug: 'gloss-that-lasts', excerpt: 'Care notes',
      cover_url: 'https://example.com/blog.webp', published_at: '2026-08-15T08:00:00Z',
    }), {
      id: 'post-1', kind: 'post', title: 'Gloss that lasts', excerpt: 'Care notes',
      mediaUrl: 'https://example.com/blog.webp', href: '/blog/gloss-that-lasts', platform: 'Hakum Blog',
      ctaLabel: 'Read post', date: '2026-08-15T08:00:00Z',
    })
    assert.deepEqual(mapEventToHybridCard({
      id: 'event-1', title: 'Bacoor meet', slug: 'bacoor-meet', description: 'Cars and coffee',
      banner_url: 'https://example.com/event.webp', starts_at: '2026-09-01T02:00:00Z', branch: 'bacoor',
    }), {
      id: 'event-1', kind: 'event', title: 'Bacoor meet', excerpt: 'Cars and coffee',
      mediaUrl: 'https://example.com/event.webp', href: '/events/bacoor-meet', platform: 'Bacoor',
      ctaLabel: 'Event details', date: '2026-09-01T02:00:00Z',
    })
  })

  it('loads homepage cards from production blogs and events without throwing on empty data', async () => {
    const content = await loadHomepageContent(queryResultByTable({
      blogs: { data: [{ id: 'post-1', title: 'Post', slug: 'post', published_at: '2026-08-15T08:00:00Z' }], error: null },
      events: { data: [], error: null },
    }))

    assert.equal(content.post.status, 'ready')
    assert.equal(content.post.item.href, '/blog/post')
    assert.deepEqual(content.event, { status: 'empty', item: null, error: null })
  })

  it('returns isolated error states when production content queries fail', async () => {
    const blogError = new Error('blog unavailable')
    const eventError = new Error('events unavailable')
    const content = await loadHomepageContent(queryResultByTable({
      blogs: { data: null, error: blogError },
      events: { data: null, error: eventError },
    }))

    assert.deepEqual(content.post, { status: 'error', item: null, error: blogError })
    assert.deepEqual(content.event, { status: 'error', item: null, error: eventError })
  })
})

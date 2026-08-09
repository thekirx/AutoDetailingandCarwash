import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  mapEventToHybridCard,
  mapPostToHybridCard,
  selectLatestPublishedPost,
  selectNextPublishedEvent,
} from '../src/lib/publicContent.js'
import {
  ceramicPackages,
  HOME_SECTION_IDS,
  ppfInformation,
} from '../src/data/publicHomeContent.js'

describe('preferred homepage composition', () => {
  it('stays in the approved order', () => {
    assert.deepEqual(HOME_SECTION_IDS, [
      'hero',
      'ceramic',
      'ppf-information',
      'ppf-packages',
      'nano-ceramic-tint',
      'media-gallery',
      'latest-post',
      'events',
      'partnership',
      'queue',
      'branches',
    ])
  })

  it('offers only the approved Premium and Platinum ceramic tiers', () => {
    assert.deepEqual(ceramicPackages.map((item) => item.title), ['PREMIUM', 'PLATINUM'])
  })

  it('uses safe PPF messaging and the four approved product qualities', () => {
    assert.equal(ppfInformation.title, 'Protection engineered for every drive.')
    assert.deepEqual(
      ppfInformation.features.map((feature) => feature.title),
      ['Clarity', 'Stretch', 'Adhesion', 'Warranty'],
    )
  })
})

describe('public managed content', () => {
  it('selects the newest published post and excludes non-public states', () => {
    const rows = [
      { id: 'draft', status: 'draft', published_at: '2026-08-09T12:00:00Z' },
      { id: 'older', status: 'published', published_at: '2026-08-01T12:00:00Z' },
      { id: 'archived', status: 'archived', published_at: '2026-08-09T13:00:00Z' },
      { id: 'newer', status: 'published', published_at: '2026-08-08T12:00:00Z' },
    ]

    assert.equal(selectLatestPublishedPost(rows)?.id, 'newer')
  })

  it('returns null when no post is publicly visible', () => {
    assert.equal(selectLatestPublishedPost([{ id: 'draft', status: 'draft' }]), null)
    assert.equal(selectLatestPublishedPost(null), null)
  })

  it('selects the next future published event and excludes archived events', () => {
    const rows = [
      { id: 'past', status: 'published', starts_at: '2026-08-01T12:00:00Z' },
      { id: 'later', status: 'published', starts_at: '2026-08-15T12:00:00Z' },
      { id: 'next', status: 'published', starts_at: '2026-08-12T12:00:00Z' },
      { id: 'archived', status: 'archived', starts_at: '2026-08-11T12:00:00Z' },
    ]

    assert.equal(
      selectNextPublishedEvent(rows, new Date('2026-08-09T12:00:00Z'))?.id,
      'next',
    )
  })

  it('maps a post into the shared hybrid-card contract', () => {
    assert.deepEqual(
      mapPostToHybridCard({
        id: 'post-1',
        title: 'Deep gloss',
        excerpt: 'Lasting protection.',
        media_url: '/post.webp',
        source_url: 'https://instagram.com/p/example',
        platform: 'instagram',
        cta_label: 'View original post',
        published_at: '2026-08-08T12:00:00Z',
      }),
      {
        id: 'post-1',
        kind: 'post',
        title: 'Deep gloss',
        excerpt: 'Lasting protection.',
        mediaUrl: '/post.webp',
        href: 'https://instagram.com/p/example',
        platform: 'instagram',
        ctaLabel: 'View original post',
        date: '2026-08-08T12:00:00Z',
      },
    )
  })

  it('maps an event into the shared hybrid-card contract', () => {
    assert.deepEqual(
      mapEventToHybridCard({
        id: 'event-1',
        title: 'Hakum Meet',
        description: 'A community night.',
        banner_url: '/event.webp',
        slug: 'hakum-meet-event-1',
        platform: 'facebook',
        cta_label: 'Event details',
        starts_at: '2026-08-12T12:00:00Z',
      }),
      {
        id: 'event-1',
        kind: 'event',
        title: 'Hakum Meet',
        excerpt: 'A community night.',
        mediaUrl: '/event.webp',
        href: '/events/hakum-meet-event-1',
        platform: 'facebook',
        ctaLabel: 'Event details',
        date: '2026-08-12T12:00:00Z',
      },
    )
  })

  it('removes unsafe external links and invalid dates from Post cards', () => {
    assert.deepEqual(
      mapPostToHybridCard({
        id: 'unsafe-post',
        title: 'Unsafe link',
        source_url: 'javascript:alert(1)',
        published_at: 'not-a-date',
      }),
      {
        id: 'unsafe-post',
        kind: 'post',
        title: 'Unsafe link',
        excerpt: '',
        mediaUrl: '',
        href: '',
        platform: 'external',
        ctaLabel: 'View original post',
        date: null,
      },
    )
  })

  it('falls back to the Events page when an Event has no safe destination', () => {
    const card = mapEventToHybridCard({
      id: 'unsafe-event',
      title: 'Unsafe event',
      registration_url: 'data:text/html,unsafe',
      starts_at: 'not-a-date',
    })

    assert.equal(card.href, '/events')
    assert.equal(card.date, null)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  attachContentMeta,
  emptyBlock,
  estimateReadingStats,
  extractContentMeta,
  normalizeBlocks,
  resolveVideoEmbed,
  slugifyContentTitle,
} from '../src/lib/contentBlocks.js'
import { mergeBlogPostsWithGuides } from '../src/lib/seoLocalGuides.js'
import { allowRoute, canManageSiteContent, getOperationsNav, ROLES } from '../src/auth/permissions.js'

describe('contentBlocks', () => {
  it('normalizes cta form buttons and video embeds', () => {
    const blocks = normalizeBlocks([
      { type: 'cta', label: 'RSVP', form_id: 'abc', url: '' },
      { type: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
      { type: 'list', itemsText: 'One\nTwo' },
    ])
    assert.equal(blocks[0].type, 'cta')
    assert.equal(blocks[0].form_id, 'abc')
    assert.equal(resolveVideoEmbed(blocks[1].url)?.kind, 'iframe')
    assert.deepEqual(blocks[2].items, ['One', 'Two'])
  })

  it('normalizes WordPress-style gallery, callout, and image layout blocks', () => {
    const blocks = normalizeBlocks([
      {
        type: 'image',
        url: 'https://example.com/photo.webp',
        alt: 'Detailing bay',
        layout: 'wide',
        aspect: '16:9',
      },
      {
        type: 'gallery',
        columns: 3,
        caption: 'Before & After',
        images: [
          { url: 'https://example.com/1.webp', alt: 'Before', caption: 'Swirl marks' },
          { url: 'https://example.com/2.webp', alt: 'After', caption: 'Mirror finish' },
        ],
      },
      {
        type: 'callout',
        tone: 'summary',
        title: 'Quick Answer',
        text: '9H ceramic coating protects clear coat from UV and acid rain.',
      },
    ])
    assert.equal(blocks[0].layout, 'wide')
    assert.equal(blocks[0].aspect, '16:9')
    assert.equal(blocks[1].type, 'gallery')
    assert.equal(blocks[1].columns, 3)
    assert.equal(blocks[1].images.length, 2)
    assert.equal(blocks[2].type, 'callout')
    assert.equal(blocks[2].tone, 'summary')
  })

  it('persists and extracts post metadata on content_blocks without schema drift', () => {
    const blocks = attachContentMeta(
      [{ type: 'paragraph', text: 'Ceramic coating in Bacoor, Cavite.' }],
      {
        category: 'Regional Authority Guide',
        region: 'Bacoor, Cavite',
        ai_summary: 'Molino Blvd detailing studio.',
        read_minutes: 5,
        featured: true,
      },
    )
    const meta = extractContentMeta(blocks)
    assert.equal(meta.category, 'Regional Authority Guide')
    assert.equal(meta.region, 'Bacoor, Cavite')
    assert.equal(meta.ai_summary, 'Molino Blvd detailing studio.')
    assert.equal(meta.read_minutes, 5)
    assert.equal(meta.featured, true)

    const stats = estimateReadingStats(blocks, 'Short excerpt here')
    assert.ok(stats.words >= 5)
    assert.ok(stats.minutes >= 1)
  })

  it('slugifies titles and empty blocks', () => {
    assert.match(slugifyContentTitle('Ceramic Coating!'), /^ceramic-coating/)
    assert.equal(emptyBlock('heading').type, 'heading')
    assert.equal(emptyBlock('cta').label, 'Learn more')
    assert.equal(emptyBlock('gallery').type, 'gallery')
    assert.equal(emptyBlock('callout').type, 'callout')
  })

  it('allows overriding or archiving built-in SEO guides from CMS rows', () => {
    const mergedWithArchive = mergeBlogPostsWithGuides([
      {
        id: 'db-1',
        slug: 'best-carwash-auto-detailing-bacoor-cavite',
        title: 'Archived Guide',
        status: 'archived',
        is_published: false,
      },
    ])
    assert.equal(
      mergedWithArchive.some((p) => p.slug === 'best-carwash-auto-detailing-bacoor-cavite'),
      false,
    )
  })
})

describe('site content permissions', () => {
  it('SA, ASA (including Lucy & Robert), and Marketing can manage content; staff cannot', () => {
    assert.equal(canManageSiteContent({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canManageSiteContent({ role: ROLES.ASSISTANT_SUPER_ADMIN }), true)
    assert.equal(canManageSiteContent({ role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Lucy', permission_grants: { content: false } }), true)
    assert.equal(canManageSiteContent({ role: ROLES.ASSISTANT_SUPER_ADMIN, full_name: 'Robert', permission_grants: { content: false } }), true)
    assert.equal(canManageSiteContent({ role: ROLES.MARKETING }), true)
    assert.equal(canManageSiteContent({ role: ROLES.STAFF }), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'content'), true)
    assert.equal(allowRoute({ role: ROLES.MARKETING }, 'content'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'content'), false)
    assert.ok(getOperationsNav({ role: ROLES.SUPER_ADMIN }).some((i) => i.to === '/operations/content'))
    assert.ok(getOperationsNav({ role: ROLES.MARKETING }).some((i) => i.to === '/operations/content'))
  })
})

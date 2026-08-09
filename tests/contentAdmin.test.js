import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canTransitionContentStatus,
  contentMediaPath,
  normalizeEventInput,
  normalizePostInput,
  validateContentMedia,
} from '../src/lib/contentAdmin.js'

describe('content editor input', () => {
  it('normalizes a Post into the database write contract', () => {
    assert.deepEqual(
      normalizePostInput({
        title: '  Deep gloss  ',
        excerpt: '  Lasting protection. ',
        sourceUrl: ' https://instagram.com/p/example ',
        mediaUrl: ' https://cdn.example.com/post.webp ',
        platform: 'instagram',
        ctaLabel: ' View original post ',
        status: 'published',
      }),
      {
        value: {
          title: 'Deep gloss',
          excerpt: 'Lasting protection.',
          source_url: 'https://instagram.com/p/example',
          media_url: 'https://cdn.example.com/post.webp',
          platform: 'instagram',
          cta_label: 'View original post',
          status: 'published',
          published_at: null,
        },
        errors: {},
      },
    )
  })

  it('rejects unsafe Post URLs and a blank title', () => {
    const result = normalizePostInput({
      title: ' ',
      sourceUrl: 'javascript:alert(1)',
      mediaUrl: 'data:text/html,unsafe',
    })

    assert.deepEqual(result.errors, {
      title: 'Title is required.',
      sourceUrl: 'Use a valid http or https link.',
      mediaUrl: 'Use a valid http or https media link.',
    })
  })

  it('normalizes an Event while preserving existing Events fields', () => {
    assert.deepEqual(
      normalizeEventInput({
        title: ' Hakum Meet ',
        description: ' Community night ',
        branch: ' bacoor ',
        startsAt: '2026-08-20T18:00',
        endsAt: '2026-08-20T21:00',
        status: 'draft',
        locationText: ' RFC Mall ',
        sourceUrl: '',
        registrationUrl: 'https://example.com/register',
        platform: 'facebook',
        ctaLabel: ' Register ',
      }),
      {
        value: {
          title: 'Hakum Meet',
          description: 'Community night',
          branch: 'bacoor',
          starts_at: '2026-08-20T10:00:00.000Z',
          ends_at: '2026-08-20T13:00:00.000Z',
          status: 'draft',
          is_published: false,
          location_text: 'RFC Mall',
          source_url: null,
          registration_url: 'https://example.com/register',
          platform: 'facebook',
          cta_label: 'Register',
          banner_url: null,
        },
        errors: {},
      },
    )
  })

  it('normalizes an Event media override into the existing banner field', () => {
    const result = normalizeEventInput({
      title: 'Media event',
      startsAt: '2026-08-20T18:00',
      mediaUrl: 'https://cdn.example.com/event.webp',
    })

    assert.equal(result.value.banner_url, 'https://cdn.example.com/event.webp')
    assert.deepEqual(result.errors, {})
  })
})

describe('content status transitions', () => {
  it('allows publishing, unpublishing, archiving, and restoring', () => {
    assert.equal(canTransitionContentStatus('draft', 'published'), true)
    assert.equal(canTransitionContentStatus('published', 'draft'), true)
    assert.equal(canTransitionContentStatus('published', 'archived'), true)
    assert.equal(canTransitionContentStatus('archived', 'draft'), true)
  })

  it('does not publish an archived record directly', () => {
    assert.equal(canTransitionContentStatus('archived', 'published'), false)
  })
})

describe('content media', () => {
  it('creates a bucket-safe deterministic path', () => {
    assert.equal(
      contentMediaPath('posts', 'user-123', 'My New Post (Final).WEBP', 'asset-456'),
      'posts/user-123/asset-456-my-new-post-final.webp',
    )
  })

  it('accepts supported media and rejects oversized or executable files', () => {
    assert.deepEqual(validateContentMedia({ type: 'image/webp', size: 2_000_000 }), {})
    assert.deepEqual(validateContentMedia({ type: 'application/javascript', size: 1_000 }), {
      file: 'Upload a JPG, PNG, WebP, GIF, MP4, or WebM file.',
    })
    assert.deepEqual(validateContentMedia({ type: 'video/mp4', size: 21 * 1024 * 1024 }), {
      file: 'Media must be 20 MB or smaller.',
    })
  })
})

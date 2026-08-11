import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  emptyBlock,
  normalizeBlocks,
  resolveVideoEmbed,
  slugifyContentTitle,
} from '../src/lib/contentBlocks.js'
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

  it('slugifies titles and empty blocks', () => {
    assert.match(slugifyContentTitle('Ceramic Coating!'), /^ceramic-coating/)
    assert.equal(emptyBlock('heading').type, 'heading')
    assert.equal(emptyBlock('cta').label, 'Learn more')
  })
})

describe('site content permissions', () => {
  it('SA and ASA can manage content; staff cannot', () => {
    assert.equal(canManageSiteContent({ role: ROLES.SUPER_ADMIN }), true)
    assert.equal(canManageSiteContent({ role: ROLES.ASSISTANT_SUPER_ADMIN }), true)
    assert.equal(canManageSiteContent({ role: ROLES.STAFF }), false)
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'content'), true)
    assert.equal(allowRoute({ role: ROLES.ADMIN }, 'content'), false)
    assert.ok(getOperationsNav({ role: ROLES.SUPER_ADMIN }).some((i) => i.to === '/operations/content'))
  })
})

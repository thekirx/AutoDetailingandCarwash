import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { customerAccountTabId, getCustomerAccountTabs } from '../src/lib/customerAccountNav.js'

describe('customer account bottom nav', () => {
  it('keeps Blog and Events as visible tabs', () => {
    const tabs = getCustomerAccountTabs('/queue/bacoor')
    assert.deepEqual(tabs.map((t) => t.label), ['Home', 'Blog', 'Events', 'Queue'])
    assert.equal(tabs.find((t) => t.id === 'blog').to, '/account/blog')
    assert.equal(tabs.find((t) => t.id === 'events').to, '/account/events')
  })

  it('maps account routes to the active tab', () => {
    assert.equal(customerAccountTabId('/account'), 'home')
    assert.equal(customerAccountTabId('/account/blog'), 'blog')
    assert.equal(customerAccountTabId('/account/events'), 'events')
    assert.equal(customerAccountTabId('/queue/bacoor'), 'queue')
  })
})

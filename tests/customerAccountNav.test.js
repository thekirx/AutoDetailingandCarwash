import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { customerAccountTabId, getCustomerAccountTabs } from '../src/lib/customerAccountNav.js'

describe('customer account bottom nav', () => {
  it('keeps Blog, Events, and in-app Queue as visible tabs', () => {
    const tabs = getCustomerAccountTabs()
    assert.deepEqual(tabs.map((t) => t.label), ['Home', 'Blog', 'Events', 'Queue'])
    assert.equal(tabs.find((t) => t.id === 'blog').to, '/account/blog')
    assert.equal(tabs.find((t) => t.id === 'events').to, '/account/events')
    assert.equal(tabs.find((t) => t.id === 'queue').to, '/account/queue')
  })

  it('maps account routes to the active tab', () => {
    assert.equal(customerAccountTabId('/account'), 'home')
    assert.equal(customerAccountTabId('/account/blog'), 'blog')
    assert.equal(customerAccountTabId('/account/events'), 'events')
    assert.equal(customerAccountTabId('/account/queue'), 'queue')
    assert.equal(customerAccountTabId('/queue/bacoor'), 'queue')
  })
})

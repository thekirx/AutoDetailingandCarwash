import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { customerAccountTabId, getCustomerAccountTabs } from '../src/lib/customerAccountNav.js'

describe('customer account bottom nav', () => {
  it('ships the five-tab dock: Home, Book, Queue, Blog, More', () => {
    const tabs = getCustomerAccountTabs()
    assert.deepEqual(tabs.map((t) => t.label), ['Home', 'Book', 'Queue', 'Blog', 'More'])
    assert.equal(tabs.find((t) => t.id === 'book').to, '/account/book')
    assert.equal(tabs.find((t) => t.id === 'queue').to, '/account/queue')
    assert.equal(tabs.find((t) => t.id === 'blog').to, '/account/blog')
    assert.equal(tabs.find((t) => t.id === 'more').to, '/account/more')
  })

  it('maps account routes to the active tab (events + loyalty live under More)', () => {
    assert.equal(customerAccountTabId('/account'), 'home')
    assert.equal(customerAccountTabId('/account/book'), 'book')
    assert.equal(customerAccountTabId('/account/blog'), 'blog')
    assert.equal(customerAccountTabId('/account/events'), 'more')
    assert.equal(customerAccountTabId('/account/loyalty'), 'more')
    assert.equal(customerAccountTabId('/account/more'), 'more')
    assert.equal(customerAccountTabId('/account/queue'), 'queue')
    assert.equal(customerAccountTabId('/queue/bacoor'), 'queue')
  })
})

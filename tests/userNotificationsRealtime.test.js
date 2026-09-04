import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  __resetUserNotificationRealtimeForTests,
  __userNotificationRealtimeDebug,
  subscribeUserNotificationRealtime,
} from '../src/lib/userNotificationsRealtime.js'

afterEach(() => {
  __resetUserNotificationRealtimeForTests()
})

function makeClientThatThrowsAfterSubscribe() {
  let subscribed = false
  let onCalls = 0
  let subscribeCalls = 0
  let removeCalls = 0
  const channel = {
    on(type) {
      if (subscribed) {
        throw new Error(`cannot add \`${type}\` callbacks for realtime:user-notifications-bell:u1 after \`subscribe()\`.`)
      }
      onCalls += 1
      return this
    },
    subscribe() {
      subscribed = true
      subscribeCalls += 1
      return this
    },
  }
  return {
    channel() {
      return channel
    },
    removeChannel() {
      subscribed = false
      removeCalls += 1
    },
    stats: () => ({ onCalls, subscribeCalls, removeCalls, subscribed }),
  }
}

describe('subscribeUserNotificationRealtime', () => {
  it('registers postgres_changes once when two hooks subscribe (bell + settings)', () => {
    const client = makeClientThatThrowsAfterSubscribe()
    const a = subscribeUserNotificationRealtime('u1', () => {}, client)
    const b = subscribeUserNotificationRealtime('u1', () => {}, client)
    assert.equal(client.stats().onCalls, 1)
    assert.equal(client.stats().subscribeCalls, 1)
    assert.equal(__userNotificationRealtimeDebug().listenerCount, 2)
    a()
    assert.equal(__userNotificationRealtimeDebug().hasChannel, true)
    b()
    assert.equal(__userNotificationRealtimeDebug().hasChannel, false)
    assert.equal(client.stats().removeCalls, 1)
  })

  it('does not throw when a second subscriber joins an already-subscribed channel', () => {
    const client = makeClientThatThrowsAfterSubscribe()
    subscribeUserNotificationRealtime('u1', () => {}, client)
    assert.doesNotThrow(() => subscribeUserNotificationRealtime('u1', () => {}, client))
    assert.equal(client.stats().onCalls, 1)
  })
})

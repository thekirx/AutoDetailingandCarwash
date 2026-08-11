import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { smsNotificationsEnabledFromSetting } from '../src/lib/smsNotificationsToggle.js'

describe('shop SMS toggle', () => {
  it('treats a missing setting as on', () => {
    assert.equal(smsNotificationsEnabledFromSetting(null), true)
    assert.equal(smsNotificationsEnabledFromSetting(undefined), true)
  })

  it('reads enabled=false as off and enabled=true as on', () => {
    assert.equal(smsNotificationsEnabledFromSetting({ enabled: false }), false)
    assert.equal(smsNotificationsEnabledFromSetting({ enabled: true }), true)
    assert.equal(smsNotificationsEnabledFromSetting({}), true)
  })
})

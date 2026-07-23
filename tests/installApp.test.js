import assert from 'node:assert/strict'
import {
  DISMISS_KEY,
  getInstallSteps,
} from '../src/lib/installApp.js'

assert.equal(typeof DISMISS_KEY, 'string')
assert.match(DISMISS_KEY, /^hakum-pwa/)

for (const platform of ['ios', 'android', 'desktop', 'installed']) {
  const copy = getInstallSteps(platform)
  assert.equal(copy.platform, platform)
  assert.ok(copy.title.length > 4, `${platform} title`)
  assert.ok(copy.lead.length > 10, `${platform} lead`)
  if (platform === 'installed') {
    assert.equal(copy.steps.length, 0)
  } else {
    assert.ok(copy.steps.length >= 3, `${platform} steps`)
    assert.ok(copy.steps.every((s) => typeof s === 'string' && s.length > 8))
  }
}

// iOS must mention Share / Home Screen (platform-correct UX)
const ios = getInstallSteps('ios')
assert.ok(ios.steps.some((s) => /Share/i.test(s)))
assert.ok(ios.steps.some((s) => /Home Screen/i.test(s)))

const android = getInstallSteps('android')
assert.ok(android.steps.some((s) => /Chrome/i.test(s)))
assert.ok(android.steps.some((s) => /Install|Home/i.test(s)))

const desktop = getInstallSteps('desktop')
assert.ok(desktop.steps.some((s) => /Chrome|Edge/i.test(s)))

console.log('installApp.getInstallSteps: ok')

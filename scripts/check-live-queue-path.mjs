import assert from 'node:assert/strict'
import { liveQueuePath } from '../src/lib/liveQueuePath.js'

assert.equal(liveQueuePath(''), '/queue')
assert.equal(liveQueuePath(null), '/queue')
assert.equal(liveQueuePath('imus'), '/queue/imus')
assert.equal(liveQueuePath(' cavite '), '/queue/cavite')
assert.equal(liveQueuePath('a/b'), '/queue/a%2Fb')
console.log('check-live-queue-path: ok')

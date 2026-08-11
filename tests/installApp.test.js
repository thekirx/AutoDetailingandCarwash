import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { iosPushBlocked } from '../src/lib/installApp.js'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'

describe('ios push gate', () => {
  it('blocks real iOS Safari tabs only', () => {
    assert.equal(iosPushBlocked({ ua: IPHONE_SAFARI, standalone: false, hasChrome: false }), true)
    assert.equal(iosPushBlocked({ ua: IPHONE_SAFARI, standalone: true, hasChrome: false }), false)
  })

  it('lets Chrome DevTools iPhone mode enable push', () => {
    assert.equal(iosPushBlocked({ ua: IPHONE_SAFARI, standalone: false, hasChrome: true }), false)
  })

  it('does not block desktop Chrome', () => {
    assert.equal(
      iosPushBlocked({
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0',
        standalone: false,
        hasChrome: true,
      }),
      false,
    )
  })

  it('blocks iOS Chrome/Firefox/Edge tabs (WebKit has no web push)', () => {
    const crios =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1'
    const fxios =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15'
    assert.equal(iosPushBlocked({ ua: crios, standalone: false, hasChrome: false }), true)
    assert.equal(iosPushBlocked({ ua: fxios, standalone: false, hasChrome: false }), true)
  })

  it('allows Android Chrome and Firefox', () => {
    assert.equal(
      iosPushBlocked({
        ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        standalone: false,
        hasChrome: true,
      }),
      false,
    )
    assert.equal(
      iosPushBlocked({
        ua: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
        standalone: false,
        hasChrome: false,
      }),
      false,
    )
  })
})

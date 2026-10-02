import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { printAsPdf } from '../src/lib/financeData.js'

/** Browsers return null from window.open when "noopener" is requested, so the print window could never be written. */
function fakeBrowser() {
  const calls = { written: '', features: null }
  globalThis.window = {
    open(_url, _name, features) {
      calls.features = features
      if (/noopener/i.test(String(features || ''))) return null
      return { opener: {}, document: { write: (html) => { calls.written += html }, close() {} } }
    },
  }
  globalThis.alert = () => { calls.alerted = true }
  return calls
}

describe('printAsPdf', () => {
  afterEach(() => {
    delete globalThis.window
    delete globalThis.alert
  })

  it('opens a print window it can write the escaped table into', () => {
    const calls = fakeBrowser()
    printAsPdf([{ item: '<Cash>', amount: '₱1,000.00' }], [{ label: 'Item', key: 'item' }, { label: 'Amount', key: 'amount' }], 'Close of day', 'Bacoor')
    assert.equal(calls.alerted, undefined, 'must not report a blocked pop-up')
    assert.match(calls.written, /<h1>Close of day<\/h1>/)
    assert.match(calls.written, /&lt;Cash&gt;/)
    assert.match(calls.written, /₱1,000\.00/)
  })
})

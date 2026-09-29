/**
 * public/push-sw.js in a stubbed service-worker scope: push shows the notification with its url,
 * click lands on that url via navigate → postMessage → openWindow.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { inflateSync } from 'node:zlib'

const src = readFileSync(new URL('../public/push-sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://hakum.test'

function loadSw(windows = []) {
  const listeners = {}
  const calls = { opened: [], shown: [] }
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { listeners[type] = fn },
    registration: { showNotification: async (title, opts) => { calls.shown.push({ title, ...opts }) } },
  }
  const clients = {
    matchAll: async () => windows,
    openWindow: async (url) => { calls.opened.push(url) },
  }
  new Function('self', 'clients', src)(self, clients)
  return { listeners, calls }
}

function win(url, { navigate = true, navigateThrows = false } = {}) {
  const w = { url, navigated: [], messages: [], focused: 0, focus: async () => { w.focused += 1 } }
  if (navigate) {
    w.navigate = async (to) => {
      if (navigateThrows) throw new TypeError('not controlled')
      w.navigated.push(to)
    }
  }
  w.postMessage = (msg) => w.messages.push(msg)
  return w
}

async function click(listeners, url) {
  let done
  const notification = { data: { url }, closed: false, close() { this.closed = true } }
  listeners.notificationclick({ notification, waitUntil: (p) => { done = p } })
  await done
  return notification
}

describe('push-sw.js', () => {
  it('push shows title/body and keeps the landing url on the notification', async () => {
    const { listeners, calls } = loadSw()
    let done
    listeners.push({
      data: { json: () => ({ title: 'New booking', body: 'ABC123', url: '/operations/queue', tag: 't1' }) },
      waitUntil: (p) => { done = p },
    })
    await done
    assert.equal(calls.shown[0].title, 'New booking')
    assert.equal(calls.shown[0].body, 'ABC123')
    assert.deepEqual(calls.shown[0].data, { url: '/operations/queue' })
  })

  it('Android status-bar badge is a PNG with an alpha channel (Android paints only the alpha)', async () => {
    const { listeners, calls } = loadSw()
    let done
    listeners.push({ data: { json: () => ({ title: 't' }) }, waitUntil: (p) => { done = p } })
    await done
    const png = readFileSync(new URL(`../public${calls.shown[0].badge}`, import.meta.url))
    assert.equal(png.toString('ascii', 1, 4), 'PNG')
    assert.deepEqual([png[24], png[25]], [8, 6], 'badge must be 8-bit RGBA')
    const idat = []
    for (let i = 8; i < png.length; ) {
      const len = png.readUInt32BE(i)
      if (png.toString('ascii', i + 4, i + 8) === 'IDAT') idat.push(png.subarray(i + 8, i + 8 + len))
      i += 12 + len
    }
    // First pixel of row 0 is unfiltered under every PNG filter type: [filter, r, g, b, a].
    const alpha = inflateSync(Buffer.concat(idat))[4]
    assert.equal(alpha, 0, 'badge corner must be transparent or Android shows a solid square')
  })

  it('click with an open app window navigates it to the url and focuses', async () => {
    const w = win(`${ORIGIN}/operations/dashboard`)
    const { listeners, calls } = loadSw([w])
    const n = await click(listeners, '/operations/my-tasks')
    assert.equal(n.closed, true)
    assert.deepEqual(w.navigated, [`${ORIGIN}/operations/my-tasks`])
    assert.equal(w.focused, 1)
    assert.equal(calls.opened.length, 0)
  })

  it('uncontrolled window (navigate throws) gets HAKUM_NAV postMessage instead', async () => {
    const w = win(`${ORIGIN}/account`, { navigateThrows: true })
    const { listeners, calls } = loadSw([w])
    await click(listeners, '/account/queue')
    assert.deepEqual(w.messages, [{ type: 'HAKUM_NAV', url: `${ORIGIN}/account/queue` }])
    assert.equal(w.focused, 1)
    assert.equal(calls.opened.length, 0)
  })

  it('no app window (or only foreign-origin windows) opens a new one on the url', async () => {
    const foreign = win('https://other.test/')
    const { listeners, calls } = loadSw([foreign])
    await click(listeners, '/operations/payroll?tab=cash-advance')
    assert.deepEqual(calls.opened, [`${ORIGIN}/operations/payroll?tab=cash-advance`])
    assert.equal(foreign.navigated.length, 0)
  })

  it('missing url falls back to the site root', async () => {
    const { listeners, calls } = loadSw([])
    await click(listeners, undefined)
    assert.deepEqual(calls.opened, [`${ORIGIN}/`])
  })
})

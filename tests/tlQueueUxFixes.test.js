import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const editor = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
const tlPage = readFileSync(join(root, 'src/pages/TeamLeadQueuePage.jsx'), 'utf8')
const newTicket = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
const api = readFileSync(join(root, 'src/queue/queueApi.js'), 'utf8')

describe('TL queue UX — size, crew-first, start, price', () => {
  it('ticket editor puts assign crew before status actions', () => {
    const crewIdx = editor.indexOf('1 · Assign crew')
    const statusIdx = editor.indexOf('2 · Status actions')
    assert.ok(crewIdx > 0 && statusIdx > crewIdx, 'crew panel must appear before status actions in source')
    assert.match(editor, /Assign present crew first/)
    assert.match(editor, /Select crew above, then Start/)
  })

  it('exposes car size editor and optional price fold', () => {
    assert.match(editor, /Car size \(pricing\)/)
    assert.match(editor, /updateTicketVehicleType/)
    assert.match(editor, /Save car size/)
    assert.match(editor, /Adjust price \(optional\)/)
    assert.match(editor, /Reason \(optional\)/)
    assert.match(editor, /Services on this visit/)
  })

  it('queue list offers Assign crew & start for waiting tickets', () => {
    assert.match(tlPage, /Assign crew &amp; start|Assign crew & start/)
    assert.match(tlPage, /canManage/)
    assert.match(tlPage, /open=/)
  })

  it('new ticket keeps size pick and opens queue modal after create', () => {
    assert.match(newTicket, /_sizeReady/)
    assert.match(newTicket, /queue\?open=/)
    assert.match(api, /export async function updateTicketVehicleType/)
  })
})

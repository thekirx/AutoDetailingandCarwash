import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

describe('POS & Queue service modification syncs pos_handoffs/transactions without duplicates', () => {
  it('updateTicketService re-syncs send_queue_ticket_to_payment when ticket status is for_payment', () => {
    const api = read('src/queue/queueApi.js')
    const fnStart = api.indexOf('export async function updateTicketService(')
    assert.ok(fnStart > -1)
    const fnBody = api.slice(fnStart, api.indexOf('export async function updateTicketVehicleType('))
    assert.match(fnBody, /for_payment/)
    assert.match(fnBody, /send_queue_ticket_to_payment/)
  })

  it('PosPage handleModifyHandoffService passes ticket status so pos_handoffs & transactions re-sync cleanly', () => {
    const pos = read('src/pages/PosPage.jsx')
    const fnStart = pos.indexOf('async function handleModifyHandoffService()')
    assert.ok(fnStart > -1)
    const fnBody = pos.slice(fnStart, pos.indexOf('async function handleReturnToQueue('))
    assert.match(fnBody, /status:\s*booking\.status\s*\|\|\s*'for_payment'/)
  })
})

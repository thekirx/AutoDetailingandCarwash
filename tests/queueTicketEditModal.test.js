import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Queue ticket edit modal (TL board)', () => {
  it('board opens modal for queue editors instead of navigating away', () => {
    const ops = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(ops, /QueueTicketEditModal/)
    assert.match(ops, /onOpen=\{canManageQueue \? setEditBookingId/)
    assert.match(ops, /editBookingId/)
  })

  it('shared editor powers modal and full ticket page', () => {
    const editor = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    const modal = readFileSync(join(root, 'src/components/QueueTicketEditModal.jsx'), 'utf8')
    const ops = readFileSync(join(root, 'src/pages/OperationsPages.jsx'), 'utf8')
    assert.match(editor, /variant === 'modal'/)
    assert.match(editor, /updateTicketStatus/)
    assert.match(editor, /sendTicketToPayment/)
    assert.match(editor, /assignStaff/)
    assert.match(modal, /QueueTicketEditor/)
    assert.match(ops, /variant="page"/)
  })
})

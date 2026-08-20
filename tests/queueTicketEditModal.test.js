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

  it('modal work order shows the car first and keeps status actions compact', () => {
    const editor = readFileSync(join(root, 'src/components/QueueTicketEditor.jsx'), 'utf8')
    const modal = readFileSync(join(root, 'src/components/QueueTicketEditModal.jsx'), 'utf8')
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8')
    assert.match(editor, /queue-ticket-identity/)
    assert.match(editor, /queue-ticket-actions/)
    assert.match(editor, /queue-ticket-crew/)
    assert.match(editor, /queue-action-stack/)
    assert.match(editor, /bg-primary/)
    assert.doesNotMatch(editor, /bg-blue-500/)
    assert.doesNotMatch(editor, /floor-actions-sticky/)
    assert.match(modal, /sm:max-w-3xl/)
    assert.match(css, /container-name:\s*qt/)
    assert.match(css, /grid-area:\s*identity/)
    assert.match(css, /grid-area:\s*actions/)
    assert.doesNotMatch(css, /\.queue-ticket-editor-modal \.floor-actions-sticky/)
  })
})

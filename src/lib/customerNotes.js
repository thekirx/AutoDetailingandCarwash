/** Guest preference / plate notes (CRM + queue). */

import { normalizePlate } from './customerAuth.js'

export const CUSTOMER_NOTE_TYPES = Object.freeze([
  'general',
  'like',
  'dislike',
  'complaint',
  'preference',
])

export function validateCustomerNote({ body, noteType, plate }) {
  const errors = {}
  const text = String(body || '').trim()
  if (!text) errors.body = 'Note is required'
  else if (text.length > 4000) errors.body = 'Note is too long'
  const type = String(noteType || 'general').toLowerCase()
  if (!CUSTOMER_NOTE_TYPES.includes(type)) errors.note_type = 'Invalid note type'
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    body: text,
    note_type: type,
    plate_normalized: plate ? normalizePlate(plate) : null,
  }
}

export function isRegularGuest(notes = []) {
  return (notes || []).filter((n) => !n.archived_at).length >= 1
}

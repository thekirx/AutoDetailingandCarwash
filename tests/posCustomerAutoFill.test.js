import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { customerFormValues } from '../src/lib/posTicketCustomer.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src', 'pages', 'PosPage.jsx'), 'utf8')

/** The `onFound` body the auto-fill hook calls. */
function onFoundBody() {
  const start = src.indexOf('onFound: (customer) => {')
  assert.notEqual(start, -1, 'auto-fill onFound callback not found')
  const end = src.indexOf('    })', start)
  return src.slice(start, end)
}

/** Apply the callback's setters the way React would, and report final state. */
function applyFill(customer, typed) {
  const v = customerFormValues(customer)
  const state = { ...typed }

  const setters = onFoundBody()
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^setGuest[A-Za-z]+\(/.test(l))

  for (const line of setters) {
    const m = line.match(/^(setGuest[A-Za-z]+)\(([\s\S]*)\)$/)
    assert.ok(m, `could not parse setter: ${line}`)
    const fn = m[1]
    const arg = m[2]
    // setGuestFirstName -> firstName
    const key = fn.replace('setGuest', '')
    const norm = key.charAt(0).toLowerCase() + key.slice(1)
    const current = state[norm] ?? ''

    const isReducer = /^\(\s*current\s*\)\s*=>/.test(arg.trim())
    const expr = isReducer ? arg.trim().replace(/^\(\s*current\s*\)\s*=>/, '') : arg.trim()
    state[norm] = new Function('current', 'v', `return (${expr})`)(current, v)
  }
  // Without this the suite passes vacuously if the parser stops matching.
  assert.ok(setters.length >= 5, `expected the five setters, parsed ${setters.length}: ${setters.join(' | ')}`)
  return { ...state, v }
}

describe('auto-filling an existing customer must not erase what the cashier typed', () => {
  it('customerFormValues really does return an empty name for a phone-only record', () => {
    const v = customerFormValues({ phone: '09171234567', first_name: null, full_name: null })
    assert.equal(v.first, '')
    assert.equal(v.last, '')
  })

  it('fills the name when the matched customer has one', () => {
    const out = applyFill({ first_name: 'Maria', last_name: 'Cruz', phone: '09171234567' }, {
      firstName: '', lastName: '', name: '', phone: '', email: '',
    })
    assert.equal(out.firstName, 'Maria')
    assert.equal(out.lastName, 'Cruz')
    assert.equal(out.name, 'Maria Cruz')
    assert.equal(out.phone, '09171234567')
  })

  it('keeps a typed name when the matched record has none — this is the data-loss case', () => {
    // A customer row can exist with a phone and no name. The lookup resolves
    // ~400ms after the first keystroke, so a cashier typing fast would have
    // their name wiped by a blank autofill and the sale would record no name.
    const out = applyFill({ phone: '09171234567', first_name: null, full_name: null }, {
      firstName: 'Juan', lastName: '', name: 'Juan', phone: '', email: '',
    })
    assert.equal(out.firstName, 'Juan', 'a blank autofill erased the typed first name')
    assert.equal(out.name, 'Juan', 'a blank autofill erased the typed name')
    assert.equal(out.phone, '09171234567', 'the phone should still fill from the match')
  })

  it('keeps a typed name when the record has only a full_name that splits to nothing', () => {
    const out = applyFill({ phone: '09171234567', full_name: '   ' }, {
      firstName: 'Pedro', lastName: '', name: 'Pedro', phone: '', email: '',
    })
    assert.equal(out.firstName, 'Pedro')
  })

  it('still overwrites a typed name when the matched customer genuinely has one', () => {
    // The phone is the identity; the sale must attach to the account the phone
    // belongs to, not to whatever partial name was typed.
    const out = applyFill({ first_name: 'Maria', last_name: 'Cruz', phone: '09171234567' }, {
      firstName: 'J', lastName: '', name: 'J', phone: '', email: '',
    })
    assert.equal(out.firstName, 'Maria')
  })
})
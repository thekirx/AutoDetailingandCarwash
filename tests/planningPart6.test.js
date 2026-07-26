import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  complaintFields,
  formatFormPayloadDescription,
  parseCustomFieldsCsv,
  slugifyEventTitle,
} from '../src/lib/planningPart6.js'

describe('planning Part 6 helpers', () => {
  it('slugifies event titles with id suffix', () => {
    assert.equal(
      slugifyEventTitle('Hakum Car Meet!', 'abcdef12-3456-7890'),
      'hakum-car-meet-abcdef12',
    )
  })

  it('formats form payload for card description', () => {
    assert.equal(
      formatFormPayloadDescription({ branch: 'bacoor', notes: 'scratch' }),
      'branch: bacoor\nnotes: scratch',
    )
  })

  it('parses custom field CSV and has complaint defaults', () => {
    const fields = parseCustomFieldsCsv('Issue|Priority')
    assert.equal(fields.length, 2)
    assert.equal(fields[0].key, 'issue')
    assert.ok(complaintFields().length >= 4)
  })
})

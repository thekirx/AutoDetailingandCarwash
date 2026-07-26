import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validateCrewUsername } from '../src/queue/queueLogic.js'

describe('crew username', () => {
  it('normalizes and accepts valid usernames', () => {
    assert.equal(validateCrewUsername('Ana.Cruz'), 'ana.cruz')
    assert.equal(validateCrewUsername(' tech_01 '), 'tech_01')
  })

  it('rejects short or invalid usernames', () => {
    assert.throws(() => validateCrewUsername('ab'), /min 3/)
    assert.throws(() => validateCrewUsername('bad name'), /letters/)
    assert.throws(() => validateCrewUsername(''), /required/)
  })
})

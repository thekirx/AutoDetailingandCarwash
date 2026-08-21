import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  ASSISTANT_GRANT_GROUPS,
  ASSISTANT_GRANT_KEYS,
  DEFAULT_ASSISTANT_GRANTS,
  countEnabledAssistantGrants,
  normalizeAssistantGrants,
  setAssistantGrantsPreset,
} from '../src/auth/permissions.js'

describe('ASA grant editor helpers', () => {
  it('groups cover every grant key exactly once', () => {
    const grouped = ASSISTANT_GRANT_GROUPS.flatMap((g) => g.keys)
    assert.deepEqual([...grouped].sort(), [...ASSISTANT_GRANT_KEYS].sort())
    assert.equal(new Set(grouped).size, grouped.length)
  })

  it('normalize drops unknown keys and coerces booleans', () => {
    const next = normalizeAssistantGrants({ pos: 1, finance_write: 'yes', hacker: true })
    assert.equal(next.pos, true)
    assert.equal(next.finance_write, true)
    assert.equal(Object.prototype.hasOwnProperty.call(next, 'hacker'), false)
    assert.equal(next.rbac_edit, DEFAULT_ASSISTANT_GRANTS.rbac_edit)
  })

  it('presets: defaults, safe, all', () => {
    assert.deepEqual(setAssistantGrantsPreset('defaults'), DEFAULT_ASSISTANT_GRANTS)
    const safe = setAssistantGrantsPreset('safe')
    assert.equal(safe.finance_write, false)
    assert.equal(safe.planning_edit, false)
    assert.equal(safe.rbac_edit, false)
    assert.equal(safe.pos, true)
    const all = setAssistantGrantsPreset('all')
    assert.equal(countEnabledAssistantGrants(all), ASSISTANT_GRANT_KEYS.length)
  })
})

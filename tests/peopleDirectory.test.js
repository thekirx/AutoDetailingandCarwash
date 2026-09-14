import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filterDirectoryPeople, personDirectoryTab, supervisorCandidates } from '../src/lib/peopleDirectory.js'

describe('people directory tabs', () => {
  it('splits crew, TL, admins, and office, and filters search', () => {
    assert.equal(personDirectoryTab('staff'), 'crew')
    assert.equal(personDirectoryTab('detailer'), 'crew')
    assert.equal(personDirectoryTab('team_lead'), 'tl')
    assert.equal(personDirectoryTab('admin'), 'admins')
    assert.equal(personDirectoryTab('assistant_super_admin'), 'office')
    assert.equal(personDirectoryTab('operations_lead'), 'office')
    const rows = [
      { id: '1', full_name: 'Ana', role: 'staff', phone: '1', branch_slug: 'bacoor', is_active: true },
      { id: '2', full_name: 'Ben', role: 'team_lead', phone: '2', branch_slug: 'bacoor', is_active: true },
      { id: '3', full_name: 'Cara', role: 'marketing', phone: '3', is_active: true },
    ]
    assert.equal(filterDirectoryPeople(rows, { tab: 'crew' }).length, 1)
    assert.equal(filterDirectoryPeople(rows, { tab: 'office', q: 'cara' })[0].id, '3')
    assert.deepEqual(
      supervisorCandidates([{ id: 'x', is_active: true, is_supervisor: true, role: 'team_lead' }]).map((r) => r.id),
      ['x'],
    )
  })
})

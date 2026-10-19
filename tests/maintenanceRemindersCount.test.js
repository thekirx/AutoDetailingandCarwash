import assert from 'node:assert/strict'
import test from 'node:test'
import { runMaintenanceReminders } from '../server/maintenanceReminders.mjs'

function query(result) {
  const q = {
    select() { return q },
    lte() { return q },
    in() { return q },
    eq() { return q },
    limit() { return q },
    update() { return q },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return q
}

test('the maintenance job counts only the rows that are due, not the whole window', async () => {
  const now = new Date('2026-10-17T04:00:00+08:00')
  const admin = {
    from(table) {
      if (table === 'vehicle_maintenance_schedules') {
        return query({
          data: [
            { id: 'due', status: 'scheduled', next_due_at: '2026-10-17', service_slug: 'paint-maintenance' },
            { id: 'later', status: 'scheduled', next_due_at: '2026-12-17', service_slug: 'paint-maintenance' },
          ],
          error: null,
        })
      }
      return query({ data: [], error: null })
    },
  }
  const result = await runMaintenanceReminders(admin, now)
  assert.equal(result.due, 1)
  assert.equal(result.sent, 0)
  assert.equal(result.failed, 1)
})

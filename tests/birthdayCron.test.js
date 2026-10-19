import assert from 'node:assert/strict'
import test from 'node:test'
import { handleBirthdayGreetingsRequest } from '../server/birthdayGreetingsApi.mjs'
import { handleBookingRemindersRequest } from '../server/bookingRemindersApi.mjs'
import { handleMaintenanceRemindersRequest } from '../server/maintenanceRemindersApi.mjs'

function mockRes() {
  return {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(payload) {
      this.body = payload
    },
  }
}

test('Vercel cron GET reaches the scheduled-run gate for every reminder job', async () => {
  process.env.SUPABASE_URL ||= 'http://127.0.0.1'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-key'
  const prev = process.env.CRON_SECRET
  process.env.CRON_SECRET = ''
  try {
    for (const handle of [handleBirthdayGreetingsRequest, handleBookingRemindersRequest, handleMaintenanceRemindersRequest]) {
      const res = mockRes()
      await handle({ method: 'GET', headers: {} }, res)
      assert.equal(res.statusCode, 401, `${handle.name} rejected the cron method`)
    }
  } finally {
    if (prev == null) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prev
  }
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Detailing Maintenance tab contract', () => {
  it('Bookings board exposes Maintenance tab wired to panel + API', () => {
    const page = readFileSync(join(root, 'src/pages/BookingBoardPage.jsx'), 'utf8')
    const panel = readFileSync(join(root, 'src/components/DetailingMaintenancePanel.jsx'), 'utf8')
    const api = readFileSync(join(root, 'server/maintenanceSchedulesApi.mjs'), 'utf8')
    const bookings = readFileSync(join(root, 'api/bookings.js'), 'utf8')
    const vercel = readFileSync(join(root, 'vercel.json'), 'utf8')

    assert.match(page, /id: 'maintenance'/)
    assert.match(page, /DetailingMaintenancePanel/)
    assert.match(page, /Client update: moving this stage sends SMS/)
    assert.match(panel, /Schedule by detailing type/)
    assert.match(panel, /Notify client/)
    assert.match(panel, /\/api\/maintenance-schedules/)
    assert.match(api, /handleMaintenanceSchedulesRequest/)
    assert.match(bookings, /maintenance-schedules/)
    assert.match(vercel, /\/api\/maintenance-schedules/)
  })

  it('cron and ops share sendPaintMaintenanceReminder', () => {
    const cron = readFileSync(join(root, 'scripts/notify-maintenance-due.mjs'), 'utf8')
    const notify = readFileSync(join(root, 'server/paintMaintenanceNotify.mjs'), 'utf8')
    assert.match(cron, /sendPaintMaintenanceReminder/)
    assert.match(notify, /export async function sendPaintMaintenanceReminder/)
  })
})

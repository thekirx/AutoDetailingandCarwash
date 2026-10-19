import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import {
  formatCurrentCarLine,
  pickCurrentAssignment,
  sheetSalaryPoolMinor,
} from '../src/lib/crewDayCard.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('crew day card', () => {
  it('sums typed Daily Sheet salary lines and picks the active bay job', () => {
    assert.equal(
      sheetSalaryPoolMinor([
        { kind: 'salary', amount_minor: 150_00 },
        { kind: 'expense', amount_minor: 50_00 },
        { kind: 'salary', amount_minor: 200_00 },
      ]),
      350_00,
    )
    assert.equal(
      pickCurrentAssignment([
        { status: 'pending', vehicle_plate: 'AAA' },
        { status: 'active', vehicle_plate: 'BBB' },
      ])?.vehicle_plate,
      'BBB',
    )
    assert.match(
      formatCurrentCarLine({ queue_number: 12, vehicle_plate: 'ABC 123', service_name: 'Premium' }),
      /#12/,
    )
    assert.match(formatCurrentCarLine(null), /No car assigned/)
  })

  it('wires the crew snapshot RPC onto Attendance and documents failed QA', () => {
    const migration = readFileSync(join(root, 'supabase/migrations/20261019120000_crew_day_card.sql'), 'utf8')
    const panel = readFileSync(join(root, 'src/pages/crew/CrewAttendancePanels.jsx'), 'utf8')
    const lib = readFileSync(join(root, 'src/lib/crewDayCard.js'), 'utf8')
    assert.match(migration, /crew_day_card_snapshot/)
    assert.match(migration, /sheet_salaries_minor/)
    assert.match(migration, /failed_qa_count/)
    assert.match(migration, /current_car/)
    assert.match(panel, /crew_day_card_snapshot/)
    assert.match(panel, /Sheet salaries/)
    assert.match(panel, /Failed QA/)
    assert.match(panel, /formatCurrentCarLine/)
    assert.match(lib, /sheetSalaryPoolMinor/)
  })
})

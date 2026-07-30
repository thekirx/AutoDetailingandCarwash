import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DATA_CENTER_EXPORT_VERSION,
  DATA_CENTER_IMPORT_TABLES,
  buildExportManifest,
  isBackupOverdue,
  platformBackupGuidance,
  validateImportBundle,
} from '../src/lib/dataCenterLogic.js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allowRoute, ROLES } from '../src/auth/permissions.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('Data Center backup reminders', () => {
  it('marks overdue when never exported', () => {
    assert.equal(isBackupOverdue({ lastExportAt: null, reminderDays: 7 }), true)
  })

  it('respects snooze and reminder window', () => {
    const now = Date.parse('2026-07-30T00:00:00Z')
    assert.equal(
      isBackupOverdue({
        lastExportAt: '2026-07-29T00:00:00Z',
        reminderDays: 7,
        now,
      }),
      false,
    )
    assert.equal(
      isBackupOverdue({
        lastExportAt: '2026-07-01T00:00:00Z',
        reminderDays: 7,
        now,
      }),
      true,
    )
    assert.equal(
      isBackupOverdue({
        lastExportAt: '2026-07-01T00:00:00Z',
        snoozeUntil: '2026-08-01T00:00:00Z',
        reminderDays: 7,
        now,
      }),
      false,
    )
  })
})

describe('Data Center import/export contract', () => {
  it('builds versioned manifest', () => {
    const m = buildExportManifest(['customers'], { customers: 2 })
    assert.equal(m.version, DATA_CENTER_EXPORT_VERSION)
    assert.equal(m.product, 'hakum-auto-care')
    assert.equal(m.counts.customers, 2)
  })

  it('rejects unknown import tables and bad version', () => {
    assert.equal(validateImportBundle(null).ok, false)
    assert.equal(validateImportBundle({ version: 99, data: {} }).ok, false)
    assert.equal(
      validateImportBundle({
        version: DATA_CENTER_EXPORT_VERSION,
        data: { auth_users: [] },
      }).ok,
      false,
    )
    assert.equal(
      validateImportBundle({
        version: DATA_CENTER_EXPORT_VERSION,
        data: { customers: [{ id: '1' }] },
      }).ok,
      true,
    )
    assert.ok(DATA_CENTER_IMPORT_TABLES.includes('customers'))
    assert.equal(DATA_CENTER_IMPORT_TABLES.includes('bookings'), false)
  })

  it('documents platform PITR outside the app', () => {
    const g = platformBackupGuidance()
    assert.match(g.body, /Supabase/)
    assert.match(g.dashboard_hint, /Backups/)
  })
})

describe('Data Center SA-only route', () => {
  it('allowRoute data-center is Super Admin only', () => {
    assert.equal(allowRoute({ role: ROLES.SUPER_ADMIN }, 'data-center'), true)
    assert.equal(allowRoute({ role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: { branches_all: true } }, 'data-center'), false)
    assert.equal(allowRoute({ role: ROLES.ADMIN, branch_slug: 'bacoor' }, 'data-center'), false)
    assert.equal(allowRoute({ role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' }, 'data-center'), false)
  })

  it('page and API wires exist', () => {
    const page = readFileSync(join(root, 'src/pages/DataCenterPage.jsx'), 'utf8')
    assert.match(page, /Data Center/)
    assert.match(page, /\/api\/data-center/)
    const api = readFileSync(join(root, 'api/data-center.js'), 'utf8')
    assert.match(api, /handleDataCenterRequest/)
  })
})

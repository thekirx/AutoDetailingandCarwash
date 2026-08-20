import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DATA_CENTER_EXPORT_TABLES,
  DATA_CENTER_EXPORT_VERSION,
  DATA_CENTER_IMPORT_TABLES,
  DATA_CENTER_PURGE_TARGETS,
  exportOrderColumns,
  backupHealth,
  buildExportManifest,
  chunkRows,
  eligiblePurgeIds,
  isBackupOverdue,
  planImport,
  platformBackupGuidance,
  purgeCutoffIso,
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

  it('accepts a full owner export and imports catalog/CRM only', () => {
    const check = validateImportBundle({
      version: DATA_CENTER_EXPORT_VERSION,
      data: {
        customers: [{ id: 'c1' }],
        vehicles: [{ id: 'v1' }],
        bookings: [{ id: 'b1' }],
        sales: [{ id: 's1' }],
      },
    })
    assert.equal(check.ok, true)
    const plan = planImport({
      version: DATA_CENTER_EXPORT_VERSION,
      data: {
        customers: [{ id: 'c1' }, { id: 'c2' }],
        vehicles: [],
        bookings: [{ id: 'b1' }],
        sales: [{ id: 's1' }],
      },
    })
    assert.equal(plan.ok, true)
    assert.equal(plan.importable.find((t) => t.table === 'customers')?.count, 2)
    assert.equal(plan.skipped.find((t) => t.table === 'bookings')?.reason, 'export_only')
    assert.ok(DATA_CENTER_IMPORT_TABLES.indexOf('customers') < DATA_CENTER_IMPORT_TABLES.indexOf('vehicles'))
    assert.ok(DATA_CENTER_IMPORT_TABLES.indexOf('vehicles') < DATA_CENTER_IMPORT_TABLES.indexOf('customer_memberships'))
    assert.ok(DATA_CENTER_EXPORT_TABLES.includes('transactions'))
    assert.ok(DATA_CENTER_EXPORT_TABLES.includes('service_reviews'))
    assert.deepEqual(exportOrderColumns('staff_branch_assignments'), ['staff_id', 'branch_slug'])
    assert.deepEqual(exportOrderColumns('customers'), ['id'])
  })

  it('documents platform PITR outside the app', () => {
    const g = platformBackupGuidance()
    assert.match(g.body, /Supabase/)
    assert.match(g.dashboard_hint, /Backups/)
  })
})

describe('Data Center standard purge', () => {
  it('covers floor, CRM, garage, SMS, notifications, and audit — never wipe-all logs', () => {
    const ids = Object.keys(DATA_CENTER_PURGE_TARGETS)
    assert.ok(ids.includes('archived_bookings'))
    assert.ok(ids.includes('archived_customers'))
    assert.ok(ids.includes('archived_vehicles'))
    assert.ok(ids.includes('sms_events_90d'))
    assert.ok(ids.includes('queue_events_90d'))
    assert.ok(ids.includes('user_notifications_90d'))
    assert.ok(ids.includes('audit_logs_365d'))
    assert.equal(ids.includes('old_sms_events'), false)
    assert.equal(DATA_CENTER_PURGE_TARGETS.sms_events_90d.retention_days, 90)
    assert.equal(DATA_CENTER_PURGE_TARGETS.audit_logs_365d.retention_days, 365)
    assert.equal(DATA_CENTER_PURGE_TARGETS.sms_events_90d.filter, undefined)
  })

  it('keeps rows blocked by finance/floor FKs', () => {
    const result = eligiblePurgeIds(['a', 'b', 'c'], ['b', null, 'd'])
    assert.deepEqual(result.eligible, ['a', 'c'])
    assert.deepEqual(result.blocked, ['b'])
  })

  it('computes a retention cutoff from whole days', () => {
    const now = Date.parse('2026-08-17T00:00:00Z')
    assert.equal(purgeCutoffIso(90, now), '2026-05-19T00:00:00.000Z')
  })
})

describe('Data Center backup health and batching', () => {
  it('tracks owner export and platform ack separately', () => {
    const now = Date.parse('2026-08-17T00:00:00Z')
    const health = backupHealth({
      lastExportAt: '2026-08-16T00:00:00Z',
      lastPlatformAckAt: null,
      reminderDays: 7,
      now,
    })
    assert.equal(health.export_overdue, false)
    assert.equal(health.platform_ack_overdue, true)
    assert.equal(health.overdue, false)
  })

  it('chunks rows for batched upserts', () => {
    assert.deepEqual(chunkRows([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
    assert.deepEqual(chunkRows([], 200), [])
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
    assert.match(page, /dryRun/)
    assert.doesNotMatch(page, /console\.info/)
    assert.match(page, /eligible/)
    const api = readFileSync(join(root, 'api/data-center.js'), 'utf8')
    assert.match(api, /handleDataCenterRequest/)
    const server = readFileSync(join(root, 'server/dataCenter.mjs'), 'utf8')
    assert.match(server, /collectPaged/)
    assert.doesNotMatch(server, /\.limit\(5000\)/)
    assert.match(server, /planImport/)
    assert.match(server, /eligiblePurgeIds/)
  })
})

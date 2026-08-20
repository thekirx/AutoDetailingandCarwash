/**
 * Super Admin Data Center — owner snapshot, catalog/CRM import, standard purge.
 * Platform PITR stays in the Supabase Dashboard; this module is the Hakum seam.
 */

export const DATA_CENTER_EXPORT_VERSION = 1

/** Catalog restore (FK order). */
export const DATA_CENTER_CATALOG_TABLES = [
  'branches',
  'vehicle_sizes',
  'services',
  'service_size_prices',
  'products',
  'vehicle_catalog',
  'membership_tiers',
  'loyalty_milestones',
  'loyalty_program_settings',
  'expense_categories',
  'sms_templates',
]

/** CRM restore after catalog (FK order). */
export const DATA_CENTER_CRM_TABLES = [
  'customers',
  'vehicles',
  'customer_memberships',
  'customer_birthday_perks',
]

/** Floor/finance/logs — export for inspection; restore via PITR, not upsert. */
export const DATA_CENTER_OPS_TABLES = [
  'bookings',
  'sales',
  'sale_line_items',
  'expenses',
  'staff_profiles',
  'staff_branch_assignments',
  'staff_attendance',
  'loyalty_ledger',
  'pos_handoffs',
  'queue_events',
  'audit_logs',
  'sms_events',
  'transactions',
  'service_reviews',
  'complaints',
  'user_notifications',
  'vehicle_maintenance_schedules',
]

export const DATA_CENTER_IMPORT_TABLES = [...DATA_CENTER_CATALOG_TABLES, ...DATA_CENTER_CRM_TABLES]
export const DATA_CENTER_EXPORT_TABLES = [...DATA_CENTER_IMPORT_TABLES, ...DATA_CENTER_OPS_TABLES]

/** PostgREST page order — composite PK tables have no `id`. */
export function exportOrderColumns(table) {
  if (table === 'staff_branch_assignments') return ['staff_id', 'branch_slug']
  return ['id']
}

const IMPORT_SET = new Set(DATA_CENTER_IMPORT_TABLES)
const EXPORT_SET = new Set(DATA_CENTER_EXPORT_TABLES)

/**
 * Standard purge catalog. Archive-first for CRM/floor; retention for logs.
 * `blockers` names the FK parents the server must subtract before DELETE.
 */
export const DATA_CENTER_PURGE_TARGETS = {
  archived_bookings: {
    label: 'Archived floor tickets',
    system: 'Floor',
    table: 'bookings',
    kind: 'archived',
    blockers: ['transactions.booking_id'],
    description: 'Hard-delete archived tickets. Rows with a finance transaction are kept (RESTRICT).',
  },
  archived_vehicles: {
    label: 'Archived garage vehicles',
    system: 'Garage',
    table: 'vehicles',
    kind: 'archived',
    blockers: [],
    description: 'Hard-delete archived vehicles. Linked tickets keep their plate snapshot (SET NULL).',
  },
  archived_customers: {
    label: 'Archived CRM customers',
    system: 'CRM',
    table: 'customers',
    kind: 'archived',
    blockers: ['bookings.customer_id', 'loyalty_ledger.customer_id', 'transactions.customer_id'],
    description: 'Hard-delete archived customers with no remaining tickets, ledger, or finance rows.',
  },
  sms_events_90d: {
    label: 'SMS log older than 90 days',
    system: 'SMS',
    table: 'sms_events',
    kind: 'retention',
    retention_days: 90,
    description: 'Delete SMS send/receive rows older than 90 days. Live queue SMS stays.',
  },
  queue_events_90d: {
    label: 'Queue event log older than 90 days',
    system: 'Floor',
    table: 'queue_events',
    kind: 'retention',
    retention_days: 90,
    description: 'Delete floor status-history rows older than 90 days.',
  },
  user_notifications_90d: {
    label: 'In-app notifications older than 90 days',
    system: 'Notifications',
    table: 'user_notifications',
    kind: 'retention',
    retention_days: 90,
    description: 'Delete inbox rows older than 90 days. Push subscriptions are not touched.',
  },
  audit_logs_365d: {
    label: 'Audit log older than 1 year',
    system: 'Audit',
    table: 'audit_logs',
    kind: 'retention',
    retention_days: 365,
    description: 'Delete audit rows older than 365 days. Data Center events are kept separately.',
  },
  contact_inquiries_90d: {
    label: 'Contact form older than 90 days',
    system: 'Public',
    table: 'contact_inquiries',
    kind: 'retention',
    retention_days: 90,
    description: 'Delete public contact-form rows older than 90 days.',
  },
}

export function listPurgeTargets() {
  return Object.entries(DATA_CENTER_PURGE_TARGETS).map(([id, t]) => ({
    id,
    label: t.label,
    system: t.system,
    table: t.table,
    kind: t.kind,
    retention_days: t.retention_days || null,
    description: t.description,
    blockers: t.blockers || [],
  }))
}

export function isBackupOverdue({ lastExportAt, snoozeUntil, reminderDays = 7, now = Date.now() }) {
  if (snoozeUntil && new Date(snoozeUntil).getTime() > now) return false
  if (!lastExportAt) return true
  const days = Number(reminderDays) || 7
  const ageMs = now - new Date(lastExportAt).getTime()
  return ageMs > days * 24 * 60 * 60 * 1000
}

export function backupHealth({
  lastExportAt,
  lastPlatformAckAt,
  snoozeUntil,
  reminderDays = 7,
  now = Date.now(),
}) {
  const export_overdue = isBackupOverdue({ lastExportAt, snoozeUntil, reminderDays, now })
  const platform_ack_overdue = isBackupOverdue({
    lastExportAt: lastPlatformAckAt,
    snoozeUntil: null,
    reminderDays,
    now,
  })
  return {
    export_overdue,
    platform_ack_overdue,
    overdue: export_overdue,
    message: export_overdue
      ? 'Owner export is overdue. Download a fresh snapshot and confirm Supabase PITR in the dashboard.'
      : 'Owner export is within the reminder window.',
  }
}

export function daysSince(iso, now = Date.now()) {
  if (!iso) return null
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function purgeCutoffIso(days, now = Date.now()) {
  const d = Math.max(1, Number(days) || 90)
  return new Date(now - d * 24 * 60 * 60 * 1000).toISOString()
}

export function eligiblePurgeIds(candidateIds, blockingIds) {
  const blockedSet = new Set((blockingIds || []).filter(Boolean).map(String))
  const eligible = []
  const blocked = []
  for (const id of candidateIds || []) {
    if (id == null || id === '') continue
    if (blockedSet.has(String(id))) blocked.push(id)
    else eligible.push(id)
  }
  return { eligible, blocked }
}

export function chunkRows(rows, size = 200) {
  const list = Array.isArray(rows) ? rows : []
  const n = Math.max(1, Number(size) || 200)
  const out = []
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n))
  return out
}

export function buildExportManifest(tables, counts) {
  return {
    version: DATA_CENTER_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    product: 'hakum-auto-care',
    groups: {
      catalog: DATA_CENTER_CATALOG_TABLES,
      crm: DATA_CENTER_CRM_TABLES,
      ops: DATA_CENTER_OPS_TABLES,
    },
    tables: tables.filter((t) => (counts[t] || 0) > 0 || DATA_CENTER_EXPORT_TABLES.includes(t)),
    counts,
  }
}

export function validateImportBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') return { ok: false, error: 'Invalid bundle.' }
  if (Number(bundle.version) !== DATA_CENTER_EXPORT_VERSION) {
    return { ok: false, error: `Unsupported export version (need ${DATA_CENTER_EXPORT_VERSION}).` }
  }
  if (!bundle.data || typeof bundle.data !== 'object') {
    return { ok: false, error: 'Bundle missing data.' }
  }
  const unknown = Object.keys(bundle.data).filter((k) => !EXPORT_SET.has(k) && !IMPORT_SET.has(k))
  if (unknown.length) {
    return { ok: false, error: `Tables not allowed for import: ${unknown.join(', ')}` }
  }
  return { ok: true }
}

export function planImport(bundle) {
  const check = validateImportBundle(bundle)
  if (!check.ok) return { ...check, importable: [], skipped: [] }

  const importable = []
  for (const table of DATA_CENTER_IMPORT_TABLES) {
    const rows = bundle.data[table]
    const count = Array.isArray(rows) ? rows.length : 0
    importable.push({ table, count, rows: count ? rows : [] })
  }

  const skipped = []
  for (const table of Object.keys(bundle.data)) {
    if (IMPORT_SET.has(table)) continue
    const rows = bundle.data[table]
    skipped.push({
      table,
      count: Array.isArray(rows) ? rows.length : 0,
      reason: EXPORT_SET.has(table) ? 'export_only' : 'unknown',
    })
  }

  return { ok: true, importable, skipped }
}

export function platformBackupGuidance() {
  return {
    source: 'supabase',
    title: 'Supabase platform backups (PITR)',
    body: 'Automatic point-in-time recovery lives in the Supabase Dashboard (Project → Database → Backups), not inside Hakum. Enable Pro PITR there. This Data Center records every export, import, and purge you run so owner-controlled changes stay auditable. Catalog and CRM can be upserted from an export; floor and finance restore from PITR.',
    dashboard_hint: 'Supabase Dashboard → Database → Backups',
  }
}

/**
 * Super Admin Data Center — pure helpers (export schema + backup reminders).
 * Platform PITR is outside the app; this tracks owner-controlled permanence.
 */

export const DATA_CENTER_EXPORT_VERSION = 1

/** Tables included in a Hakum business snapshot (no auth.users / secrets). */
export const DATA_CENTER_EXPORT_TABLES = [
  'branches',
  'services',
  'service_size_prices',
  'products',
  'vehicle_sizes',
  'vehicle_catalog',
  'customers',
  'vehicles',
  'bookings',
  'sales',
  'sale_line_items',
  'expense_categories',
  'expenses',
  'staff_profiles',
  'staff_branch_assignments',
  'membership_tiers',
  'customer_memberships',
  'loyalty_milestones',
  'loyalty_program_settings',
  'loyalty_ledger',
  'pos_handoffs',
  'queue_events',
  'audit_logs',
  'sms_events',
]

/** Import may upsert these only (never auth / rate buckets). */
export const DATA_CENTER_IMPORT_TABLES = [
  'branches',
  'services',
  'service_size_prices',
  'products',
  'vehicle_sizes',
  'vehicle_catalog',
  'customers',
  'vehicles',
  'membership_tiers',
  'loyalty_milestones',
  'loyalty_program_settings',
]

/** Destructive purge targets (archive-first preferred). */
export const DATA_CENTER_PURGE_TARGETS = {
  archived_bookings: {
    label: 'Archived bookings (hard delete)',
    table: 'bookings',
    filter: { is_archived: true },
  },
  archived_customers: {
    label: 'Archived customers (hard delete)',
    table: 'customers',
    filter: { is_archived: true },
  },
  old_sms_events: {
    label: 'SMS event log (all rows)',
    table: 'sms_events',
    filter: null,
  },
  old_queue_events: {
    label: 'Queue event log (all rows)',
    table: 'queue_events',
    filter: null,
  },
}

export function isBackupOverdue({ lastExportAt, snoozeUntil, reminderDays = 7, now = Date.now() }) {
  if (snoozeUntil && new Date(snoozeUntil).getTime() > now) return false
  if (!lastExportAt) return true
  const days = Number(reminderDays) || 7
  const ageMs = now - new Date(lastExportAt).getTime()
  return ageMs > days * 24 * 60 * 60 * 1000
}

export function daysSince(iso, now = Date.now()) {
  if (!iso) return null
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function buildExportManifest(tables, counts) {
  return {
    version: DATA_CENTER_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    product: 'hakum-auto-care',
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
  const unknown = Object.keys(bundle.data).filter((k) => !DATA_CENTER_IMPORT_TABLES.includes(k))
  if (unknown.length) {
    return { ok: false, error: `Tables not allowed for import: ${unknown.join(', ')}` }
  }
  return { ok: true }
}

export function platformBackupGuidance() {
  return {
    source: 'supabase',
    title: 'Supabase platform backups (PITR)',
    body: 'Automatic point-in-time recovery lives in the Supabase Dashboard (Project → Database → Backups), not inside Hakum. Enable Pro PITR there. This Data Center records every export, import, and purge you run so owner-controlled changes stay auditable.',
    dashboard_hint: 'Supabase Dashboard → Database → Backups',
  }
}

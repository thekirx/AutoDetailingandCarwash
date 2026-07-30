/**
 * Super Admin Data Center API (service role).
 * Export / import / purge / status — BossMich only.
 */
import { createClient } from '@supabase/supabase-js'
import {
  DATA_CENTER_EXPORT_TABLES,
  DATA_CENTER_IMPORT_TABLES,
  DATA_CENTER_PURGE_TARGETS,
  buildExportManifest,
  isBackupOverdue,
  platformBackupGuidance,
  validateImportBundle,
} from '../src/lib/dataCenterLogic.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function requireSuperAdmin(accessToken) {
  if (!accessToken) throw Object.assign(new Error('Unauthorized'), { status: 401 })
  const admin = adminClient()
  const { data: userData, error } = await admin.auth.getUser(accessToken)
  if (error || !userData?.user) throw Object.assign(new Error('Unauthorized'), { status: 401 })

  const { data: staff } = await admin
    .from('staff_profiles')
    .select('id, role, is_active, full_name')
    .eq('id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff || staff.role !== 'BossMich') {
    throw Object.assign(new Error('Super Admin only.'), { status: 403 })
  }
  return { admin, user: userData.user, staff }
}

async function logEvent(admin, { actorId, action, summary, meta }) {
  await admin.from('data_center_events').insert({
    actor_id: actorId,
    action,
    summary,
    meta: meta || {},
  })
  // also mirror to audit_logs when RPC available
  try {
    await admin.rpc('write_audit_event', {
      input_action: `data_center_${action}`,
      input_entity_type: 'data_center',
      input_entity_id: null,
      input_summary: summary,
      input_meta: meta || {},
    })
  } catch {
    /* optional */
  }
}

async function touchSettings(admin, patch) {
  const { data } = await admin.from('data_center_settings').select('*').eq('id', 1).maybeSingle()
  const next = {
    ...(data || { id: 1 }),
    ...patch,
    updated_at: new Date().toISOString(),
  }
  await admin.from('data_center_settings').upsert(next, { onConflict: 'id' })
  return next
}

async function fetchTable(admin, table, { limit = 5000 } = {}) {
  const { data, error } = await admin.from(table).select('*').limit(limit)
  if (error) {
    // table may not exist in older envs
    return { rows: [], error: error.message }
  }
  return { rows: data || [], error: null }
}

async function buildStatus(admin, staff) {
  const [{ data: settings }, { data: events }, counts] = await Promise.all([
    admin.from('data_center_settings').select('*').eq('id', 1).maybeSingle(),
    admin.from('data_center_events').select('*').order('created_at', { ascending: false }).limit(40),
    Promise.all(
      ['bookings', 'customers', 'sales', 'expenses', 'vehicles', 'staff_profiles', 'audit_logs'].map(async (t) => {
        const { count, error } = await admin.from(t).select('*', { count: 'exact', head: true })
        return [t, error ? null : count]
      }),
    ),
  ])

  const s = settings || {}
  const overdue = isBackupOverdue({
    lastExportAt: s.last_export_at,
    snoozeUntil: s.snooze_until,
    reminderDays: s.reminder_days ?? 7,
  })

  return {
    ok: true,
    actor: { id: staff.id, full_name: staff.full_name, role: staff.role },
    settings: {
      last_export_at: s.last_export_at || null,
      last_import_at: s.last_import_at || null,
      last_purge_at: s.last_purge_at || null,
      last_platform_backup_ack_at: s.last_platform_backup_ack_at || null,
      reminder_days: s.reminder_days ?? 7,
      snooze_until: s.snooze_until || null,
    },
    backup_reminder: {
      overdue,
      message: overdue
        ? 'Owner export is overdue. Download a fresh snapshot and confirm Supabase PITR in the dashboard.'
        : 'Owner export is within the reminder window.',
    },
    platform: platformBackupGuidance(),
    row_counts: Object.fromEntries(counts),
    recent_events: events || [],
    purge_targets: Object.entries(DATA_CENTER_PURGE_TARGETS).map(([id, t]) => ({ id, label: t.label })),
    import_tables: DATA_CENTER_IMPORT_TABLES,
    export_tables: DATA_CENTER_EXPORT_TABLES,
  }
}

async function runExport(admin, user) {
  const data = {}
  const counts = {}
  const errors = {}
  for (const table of DATA_CENTER_EXPORT_TABLES) {
    const { rows, error } = await fetchTable(admin, table)
    if (error) {
      errors[table] = error
      counts[table] = 0
      continue
    }
    // strip sensitive staff fields
    if (table === 'staff_profiles') {
      data[table] = rows.map((r) => {
        const copy = { ...r }
        delete copy.password_hash
        return copy
      })
    } else {
      data[table] = rows
    }
    counts[table] = rows.length
  }

  const manifest = buildExportManifest(DATA_CENTER_EXPORT_TABLES, counts)
  const bundle = { ...manifest, data, errors: Object.keys(errors).length ? errors : undefined }

  await touchSettings(admin, { last_export_at: new Date().toISOString(), snooze_until: null })
  await logEvent(admin, {
    actorId: user.id,
    action: 'export',
    summary: `Exported ${Object.values(counts).reduce((a, b) => a + b, 0)} rows across ${DATA_CENTER_EXPORT_TABLES.length} tables`,
    meta: { counts, errors: Object.keys(errors) },
  })

  return bundle
}

async function runImport(admin, user, bundle, { dryRun = false } = {}) {
  const check = validateImportBundle(bundle)
  if (!check.ok) throw Object.assign(new Error(check.error), { status: 400 })

  const results = {}
  for (const table of DATA_CENTER_IMPORT_TABLES) {
    const rows = bundle.data[table]
    if (!Array.isArray(rows) || !rows.length) {
      results[table] = { upserted: 0, skipped: true }
      continue
    }
    if (dryRun) {
      results[table] = { upserted: rows.length, dry_run: true }
      continue
    }
    const { error } = await admin.from(table).upsert(rows, { onConflict: 'id' })
    if (error) throw Object.assign(new Error(`${table}: ${error.message}`), { status: 400 })
    results[table] = { upserted: rows.length }
  }

  if (!dryRun) {
    await touchSettings(admin, { last_import_at: new Date().toISOString() })
    await logEvent(admin, {
      actorId: user.id,
      action: 'import',
      summary: `Imported snapshot from ${bundle.exported_at || 'unknown'}`,
      meta: { results },
    })
  }

  return { ok: true, dry_run: dryRun, results }
}

async function runPurge(admin, user, { target, confirm }) {
  const spec = DATA_CENTER_PURGE_TARGETS[target]
  if (!spec) throw Object.assign(new Error('Unknown purge target.'), { status: 400 })
  if (confirm !== 'DELETE') {
    throw Object.assign(new Error('Type DELETE to confirm destructive purge.'), { status: 400 })
  }

  let query = admin.from(spec.table).delete()
  if (spec.filter) {
    for (const [k, v] of Object.entries(spec.filter)) {
      query = query.eq(k, v)
    }
  } else {
    // PostgREST requires a filter for DELETE — match all non-null ids
    query = query.not('id', 'is', null)
  }
  // count first
  let countQuery = admin.from(spec.table).select('*', { count: 'exact', head: true })
  if (spec.filter) {
    for (const [k, v] of Object.entries(spec.filter)) {
      countQuery = countQuery.eq(k, v)
    }
  }
  const { count } = await countQuery
  const { error } = await query
  if (error) throw Object.assign(new Error(error.message), { status: 400 })

  await touchSettings(admin, { last_purge_at: new Date().toISOString() })
  await logEvent(admin, {
    actorId: user.id,
    action: 'purge',
    summary: `Purged ${count ?? '?'} rows from ${spec.table} (${spec.label})`,
    meta: { target, table: spec.table, deleted_count: count },
  })

  return { ok: true, target, deleted_count: count }
}

export async function handleDataCenterRequest(req, res) {
  setCors(res, 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  try {
    const token = bearer(req)
    const { admin, user, staff } = await requireSuperAdmin(token)

    if (req.method === 'GET') {
      return json(res, 200, await buildStatus(admin, staff))
    }

    if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

    const body = await readJsonBody(req)
    const action = body.action || 'status'

    if (action === 'status') return json(res, 200, await buildStatus(admin, staff))

    if (action === 'export') {
      const bundle = await runExport(admin, user)
      return json(res, 200, { ok: true, bundle })
    }

    if (action === 'import') {
      const dryRun = Boolean(body.dry_run)
      if (!dryRun && body.confirm !== 'IMPORT') {
        throw Object.assign(new Error('Type IMPORT to confirm.'), { status: 400 })
      }
      const result = await runImport(admin, user, body.bundle, { dryRun })
      return json(res, 200, result)
    }

    if (action === 'purge') {
      const result = await runPurge(admin, user, { target: body.target, confirm: body.confirm })
      return json(res, 200, result)
    }

    if (action === 'backup_ack') {
      await touchSettings(admin, { last_platform_backup_ack_at: new Date().toISOString() })
      await logEvent(admin, {
        actorId: user.id,
        action: 'backup_ack',
        summary: 'Super Admin confirmed Supabase Dashboard backups / PITR checked',
        meta: { platform: 'supabase' },
      })
      return json(res, 200, await buildStatus(admin, staff))
    }

    if (action === 'reminder_snooze') {
      const days = Math.min(30, Math.max(1, Number(body.days) || 3))
      const until = new Date(Date.now() + days * 86400000).toISOString()
      await touchSettings(admin, { snooze_until: until })
      await logEvent(admin, {
        actorId: user.id,
        action: 'reminder_snooze',
        summary: `Snoozed backup reminder for ${days} day(s)`,
        meta: { snooze_until: until },
      })
      return json(res, 200, await buildStatus(admin, staff))
    }

    return json(res, 400, { error: 'Unknown action' })
  } catch (err) {
    return json(res, err.status || 500, { error: err.message || String(err) })
  }
}

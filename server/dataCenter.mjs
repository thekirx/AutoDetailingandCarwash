/**
 * Super Admin Data Center API (service role).
 * Export / import / purge / status — BossMich only.
 */
import { createClient } from '@supabase/supabase-js'
import { collectInChunks, collectPaged } from '../src/lib/crmInsights.js'
import {
  DATA_CENTER_EXPORT_TABLES,
  DATA_CENTER_IMPORT_TABLES,
  DATA_CENTER_PURGE_TARGETS,
  exportOrderColumns,
  backupHealth,
  buildExportManifest,
  chunkRows,
  eligiblePurgeIds,
  listPurgeTargets,
  planImport,
  platformBackupGuidance,
  purgeCutoffIso,
} from '../src/lib/dataCenterLogic.js'
import { bearer, json, readJsonBody, setCors } from './httpUtil.mjs'

const PAGE = 1000
const UPSERT_CHUNK = 200

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

async function fetchTable(admin, table) {
  try {
    const rows = await collectPaged(async (from, to) => {
      let q = admin.from(table).select('*')
      for (const col of exportOrderColumns(table)) q = q.order(col)
      const { data, error } = await q.range(from, to)
      if (error) throw error
      return data || []
    }, PAGE)
    return { rows, error: null }
  } catch (err) {
    return { rows: [], error: err.message || String(err) }
  }
}

async function fetchIds(admin, table, apply) {
  const rows = await collectPaged(async (from, to) => {
    let q = admin.from(table).select('id').order('id').range(from, to)
    if (apply) q = apply(q)
    const { data, error } = await q
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    return data || []
  }, PAGE)
  return rows.map((r) => r.id)
}

async function fetchBlockingIds(admin, spec, candidateIds) {
  if (!candidateIds.length || !spec.blockers?.length) return []
  const found = []
  for (const ref of spec.blockers) {
    const [table, column] = String(ref).split('.')
    if (!table || !column) continue
    const rows = await collectInChunks(candidateIds, async (chunk, from, to) => {
      const { data, error } = await admin
        .from(table)
        .select(`id, ${column}`)
        .in(column, chunk)
        .order('id')
        .range(from, to)
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      return data || []
    })
    for (const row of rows) {
      if (row[column]) found.push(row[column])
    }
  }
  return found
}

async function countExact(admin, table, apply) {
  let q = admin.from(table).select('*', { count: 'exact', head: true })
  if (apply) q = apply(q)
  const { count, error } = await q
  if (error) return null
  return count
}

async function previewPurge(admin, target) {
  const spec = DATA_CENTER_PURGE_TARGETS[target]
  if (!spec) throw Object.assign(new Error('Unknown purge target.'), { status: 400 })

  if (spec.kind === 'retention') {
    const cutoff = purgeCutoffIso(spec.retention_days)
    const eligible = await countExact(admin, spec.table, (q) => q.lt('created_at', cutoff))
    if (eligible == null) {
      return { id: target, eligible: 0, blocked: 0, cutoff, error: `Cannot read ${spec.table}` }
    }
    return { id: target, eligible, blocked: 0, cutoff }
  }

  const candidateIds = await fetchIds(admin, spec.table, (q) => q.eq('is_archived', true))
  const blockingIds = await fetchBlockingIds(admin, spec, candidateIds)
  const split = eligiblePurgeIds(candidateIds, blockingIds)
  return {
    id: target,
    eligible: split.eligible.length,
    blocked: split.blocked.length,
    eligible_ids: split.eligible,
    blocked_ids: split.blocked,
  }
}

async function buildStatus(admin, staff) {
  const [{ data: settings }, { data: events }, counts] = await Promise.all([
    admin.from('data_center_settings').select('*').eq('id', 1).maybeSingle(),
    admin.from('data_center_events').select('*').order('created_at', { ascending: false }).limit(40),
    Promise.all(
      DATA_CENTER_EXPORT_TABLES.map(async (t) => {
        const n = await countExact(admin, t)
        return [t, n]
      }),
    ),
  ])

  const s = settings || {}
  const health = backupHealth({
    lastExportAt: s.last_export_at,
    lastPlatformAckAt: s.last_platform_backup_ack_at,
    snoozeUntil: s.snooze_until,
    reminderDays: s.reminder_days ?? 7,
  })

  const purgePreviews = await Promise.all(
    listPurgeTargets().map(async (t) => {
      try {
        const preview = await previewPurge(admin, t.id)
        return {
          ...t,
          eligible: preview.eligible,
          blocked: preview.blocked,
          cutoff: preview.cutoff || null,
        }
      } catch {
        return { ...t, eligible: null, blocked: null, cutoff: null }
      }
    }),
  )

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
    backup_reminder: health,
    platform: platformBackupGuidance(),
    row_counts: Object.fromEntries(counts),
    recent_events: events || [],
    purge_targets: purgePreviews,
    import_tables: DATA_CENTER_IMPORT_TABLES,
    export_tables: DATA_CENTER_EXPORT_TABLES,
  }
}

function stripSecrets(table, rows) {
  if (table !== 'staff_profiles') return rows
  return rows.map((r) => {
    const copy = { ...r }
    delete copy.password_hash
    return copy
  })
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
    data[table] = stripSecrets(table, rows)
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
  const plan = planImport(bundle)
  if (!plan.ok) throw Object.assign(new Error(plan.error), { status: 400 })

  const results = {}
  for (const item of plan.importable) {
    if (!item.count) {
      results[item.table] = { upserted: 0, skipped: true }
      continue
    }
    if (dryRun) {
      results[item.table] = { upserted: item.count, dry_run: true }
      continue
    }
    let upserted = 0
    for (const chunk of chunkRows(item.rows, UPSERT_CHUNK)) {
      const { error } = await admin.from(item.table).upsert(chunk, { onConflict: 'id' })
      if (error) throw Object.assign(new Error(`${item.table}: ${error.message}`), { status: 400 })
      upserted += chunk.length
    }
    results[item.table] = { upserted }
  }

  if (!dryRun) {
    await touchSettings(admin, { last_import_at: new Date().toISOString() })
    await logEvent(admin, {
      actorId: user.id,
      action: 'import',
      summary: `Imported snapshot from ${bundle.exported_at || 'unknown'}`,
      meta: { results, skipped: plan.skipped },
    })
  }

  return { ok: true, dry_run: dryRun, results, skipped: plan.skipped }
}

async function runPurge(admin, user, { target, confirm }) {
  const spec = DATA_CENTER_PURGE_TARGETS[target]
  if (!spec) throw Object.assign(new Error('Unknown purge target.'), { status: 400 })
  if (confirm !== 'DELETE') {
    throw Object.assign(new Error('Type DELETE to confirm destructive purge.'), { status: 400 })
  }

  const preview = await previewPurge(admin, target)
  if (preview.error) throw Object.assign(new Error(preview.error), { status: 400 })

  let deleted = 0
  if (spec.kind === 'retention' && preview.eligible > 0) {
    const { error, count } = await admin
      .from(spec.table)
      .delete({ count: 'exact' })
      .lt('created_at', preview.cutoff)
    if (error) throw Object.assign(new Error(error.message), { status: 400 })
    deleted = count ?? preview.eligible
  } else if (preview.eligible_ids?.length) {
    for (const chunk of chunkRows(preview.eligible_ids, UPSERT_CHUNK)) {
      const { error, count } = await admin.from(spec.table).delete({ count: 'exact' }).in('id', chunk)
      if (error) throw Object.assign(new Error(error.message), { status: 400 })
      deleted += count ?? chunk.length
    }
  }

  await touchSettings(admin, { last_purge_at: new Date().toISOString() })
  await logEvent(admin, {
    actorId: user.id,
    action: 'purge',
    summary: `Purged ${deleted} rows from ${spec.table} (${spec.label}); kept ${preview.blocked} blocked`,
    meta: { target, table: spec.table, deleted_count: deleted, blocked_count: preview.blocked },
  })

  return { ok: true, target, deleted_count: deleted, blocked_count: preview.blocked }
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

    if (action === 'purge_preview') {
      const preview = await previewPurge(admin, body.target)
      return json(res, 200, {
        ok: true,
        id: preview.id,
        eligible: preview.eligible,
        blocked: preview.blocked,
        cutoff: preview.cutoff || null,
        error: preview.error || null,
      })
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

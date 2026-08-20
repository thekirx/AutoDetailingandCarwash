import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertTriangle, Database, Download, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessDataCenter } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  DATA_CENTER_CATALOG_TABLES,
  DATA_CENTER_CRM_TABLES,
  DATA_CENTER_OPS_TABLES,
  daysSince,
} from '@/lib/dataCenterLogic'
import { usePageMeta } from '@/lib/pageMeta'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

async function dataCenter(action, body = {}) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/data-center', {
    method: action === 'status' && !body.forcePost ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: action === 'status' && !body.forcePost ? undefined : JSON.stringify({ action, ...body }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Data Center request failed.')
  return json
}

function formatWhen(iso) {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
  } catch {
    return iso
  }
}

function CountList({ tables, counts }) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
      {tables.map((k) => (
        <li key={k}>
          {k}: <span className="font-semibold text-foreground">{counts?.[k] ?? '—'}</span>
        </li>
      ))}
    </ul>
  )
}

export default function DataCenterPage() {
  const { profile } = useAuth()
  usePageMeta({
    title: 'Data Center',
    description: 'Super Admin export, import, and standard purge for Hakum business data.',
    path: '/operations/data-center',
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [purgeTarget, setPurgeTarget] = useState('archived_bookings')
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [importConfirm, setImportConfirm] = useState('')
  const [importBundle, setImportBundle] = useState(null)
  const [dryRun, setDryRun] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await dataCenter('status'))
    } catch (err) {
      toast.error(err.message)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canAccessDataCenter(profile)) load()
  }, [load, profile])

  const selectedPurge = useMemo(
    () => (status?.purge_targets || []).find((t) => t.id === purgeTarget) || null,
    [status, purgeTarget],
  )

  if (!canAccessDataCenter(profile)) return <Navigate to="/operations/access-denied" replace />

  const overdue = status?.backup_reminder?.overdue
  const ackOverdue = status?.backup_reminder?.platform_ack_overdue

  async function exportSnapshot() {
    setBusy('export')
    try {
      const { bundle } = await dataCenter('export')
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hakum-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded — store this file offline (Drive / safe folder).')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  async function onImportFile(file) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      setImportBundle(parsed)
      setDryRun(null)
      toast.message('Import file loaded — run Dry run, then confirm IMPORT.')
    } catch {
      toast.error('Invalid JSON export file.')
      setImportBundle(null)
      setDryRun(null)
    }
  }

  async function runImport(isDryRun) {
    if (!importBundle) {
      toast.error('Choose an export JSON first.')
      return
    }
    setBusy(isDryRun ? 'dry' : 'import')
    try {
      const result = await dataCenter('import', {
        bundle: importBundle,
        dry_run: isDryRun,
        confirm: isDryRun ? undefined : importConfirm,
      })
      setDryRun(result)
      toast.success(isDryRun ? 'Dry run OK — review counts, then type IMPORT.' : 'Import applied.')
      if (!isDryRun) {
        setImportConfirm('')
        setImportBundle(null)
        await load()
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  async function runPurge() {
    setBusy('purge')
    try {
      const result = await dataCenter('purge', { target: purgeTarget, confirm: purgeConfirm })
      toast.success(`Deleted ${result.deleted_count ?? 0} rows${result.blocked_count ? ` · kept ${result.blocked_count} blocked` : ''}.`)
      setPurgeConfirm('')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  async function ackPlatform() {
    setBusy('ack')
    try {
      setStatus(await dataCenter('backup_ack', { forcePost: true }))
      toast.success('Recorded: you checked Supabase Dashboard backups / PITR.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  async function snooze() {
    setBusy('snooze')
    try {
      setStatus(await dataCenter('reminder_snooze', { days: 3, forcePost: true }))
      toast.message('Reminder snoozed for 3 days.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Data permanence</p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Database className="size-8 text-primary" aria-hidden />
            Data Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Super Admin only. Catalog and CRM can be exported and re-imported. Floor, sales, and finance restore from
            Supabase PITR. Purge is retention-based and skips rows blocked by live tickets or transactions.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {overdue ? (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-100">
              <AlertTriangle className="size-5" aria-hidden />
              Backup reminder
            </CardTitle>
            <CardDescription className="text-amber-100/80">
              {status?.backup_reminder?.message}
              {status?.settings?.last_export_at
                ? ` Last export ${daysSince(status.settings.last_export_at)} day(s) ago.`
                : ' No owner export on file yet.'}
              {ackOverdue ? ' Platform PITR has not been acknowledged in the reminder window.' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={exportSnapshot} disabled={!!busy}>
              <Download className="mr-2 size-4" /> Export now
            </Button>
            <Button variant="outline" onClick={ackPlatform} disabled={!!busy}>
              <ShieldCheck className="mr-2 size-4" /> I checked Supabase backups
            </Button>
            <Button variant="ghost" onClick={snooze} disabled={!!busy}>
              Snooze 3 days
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Last export', formatWhen(status?.settings?.last_export_at)],
          ['Last import', formatWhen(status?.settings?.last_import_at)],
          ['Last purge', formatWhen(status?.settings?.last_purge_at)],
          ['Platform backup ack', formatWhen(status?.settings?.last_platform_backup_ack_at)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
              <p className="mt-2 text-sm font-medium">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supabase platform backups</CardTitle>
          <CardDescription>{status?.platform?.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={ackOverdue ? 'destructive' : 'secondary'}>
            {ackOverdue ? 'PITR ack overdue' : status?.platform?.dashboard_hint || 'Database → Backups'}
          </Badge>
          <Button variant="outline" size="sm" onClick={ackPlatform} disabled={!!busy}>
            Confirm I reviewed PITR / daily backups
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="size-5" /> Export snapshot
            </CardTitle>
            <CardDescription>
              Full JSON of catalog, CRM, and ops tables. Auth passwords are never included. Ops tables are for inspection
              and PITR — they are skipped on import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportSnapshot} disabled={!!busy}>
              {busy === 'export' ? 'Exporting…' : 'Download export JSON'}
            </Button>
            {status?.row_counts ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Catalog (importable)</p>
                  <CountList tables={DATA_CENTER_CATALOG_TABLES} counts={status.row_counts} />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">CRM (importable)</p>
                  <CountList tables={DATA_CENTER_CRM_TABLES} counts={status.row_counts} />
                </div>
                <div>
                  <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Ops (export only · restore via PITR)</p>
                  <CountList tables={DATA_CENTER_OPS_TABLES} counts={status.row_counts} />
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5" /> Import snapshot
            </CardTitle>
            <CardDescription>
              Upserts catalog + CRM in FK order. Floor/sales in the same file are skipped, not overwritten. Not atomic —
              prefer PITR for a full restore.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Input type="file" accept="application/json,.json" onChange={(e) => onImportFile(e.target.files?.[0])} />
            {importBundle ? (
              <p className="text-xs text-muted-foreground">
                Loaded export from {importBundle.exported_at || 'unknown'} · v{importBundle.version}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => runImport(true)} disabled={!!busy || !importBundle}>
                {busy === 'dry' ? 'Checking…' : 'Dry run'}
              </Button>
            </div>
            {dryRun ? (
              <div className="rounded-md border border-border p-3 text-xs">
                <p className="font-medium text-foreground">{dryRun.dry_run ? 'Dry run' : 'Applied'} — catalog/CRM upserts</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {Object.entries(dryRun.results || {}).map(([table, row]) => (
                    <li key={table}>
                      {table}: {row.skipped ? 'empty' : `${row.upserted} row(s)`}
                    </li>
                  ))}
                </ul>
                {dryRun.skipped?.length ? (
                  <p className="mt-2 text-muted-foreground">
                    Skipped export-only: {dryRun.skipped.map((s) => `${s.table} (${s.count})`).join(', ')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <Label htmlFor="import-confirm">Type IMPORT to apply</Label>
            <Input id="import-confirm" value={importConfirm} onChange={(e) => setImportConfirm(e.target.value)} placeholder="IMPORT" />
            <Button onClick={() => runImport(false)} disabled={!!busy || !importBundle || importConfirm !== 'IMPORT'}>
              {busy === 'import' ? 'Importing…' : 'Apply import'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-500/30">
        <CardHeader>
          <CardTitle className="text-red-200">Standard purge</CardTitle>
          <CardDescription>
            Archive-first for tickets, vehicles, and customers. Logs use retention (90 days ops / 365 days audit). Blocked
            rows stay — live bookings and finance transactions are never deleted this way. Type DELETE to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:max-w-lg">
          <Select value={purgeTarget} onValueChange={setPurgeTarget}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(status?.purge_targets || []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.system}: {t.label}
                  {typeof t.eligible === 'number' ? ` · ${t.eligible} eligible` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPurge ? (
            <p className="text-xs text-muted-foreground">
              {selectedPurge.description}{' '}
              <span className="text-foreground">
                {selectedPurge.eligible ?? '—'} eligible
                {selectedPurge.blocked ? ` · ${selectedPurge.blocked} blocked` : ''}
              </span>
            </p>
          ) : null}
          <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" />
          <Button
            variant="destructive"
            onClick={runPurge}
            disabled={!!busy || purgeConfirm !== 'DELETE' || (selectedPurge?.eligible ?? 0) < 1}
          >
            {busy === 'purge' ? 'Purging…' : 'Purge permanently'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What changed (owner trail)</CardTitle>
          <CardDescription>
            Every export, import, purge, and platform-backup acknowledgement. Separate from Supabase automatic backups.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!status?.recent_events?.length ? (
            <p className="text-sm text-muted-foreground">No Data Center events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.recent_events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(ev.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ev.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{ev.summary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

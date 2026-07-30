import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertTriangle, Database, Download, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessDataCenter } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import { daysSince } from '@/lib/dataCenterLogic'
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

export default function DataCenterPage() {
  const { profile } = useAuth()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [purgeTarget, setPurgeTarget] = useState('archived_bookings')
  const [purgeConfirm, setPurgeConfirm] = useState('')
  const [importConfirm, setImportConfirm] = useState('')
  const [importBundle, setImportBundle] = useState(null)

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

  if (!canAccessDataCenter(profile)) return <Navigate to="/operations/access-denied" replace />

  const overdue = status?.backup_reminder?.overdue

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
      toast.message('Import file loaded — run Dry run, then confirm IMPORT.')
    } catch {
      toast.error('Invalid JSON export file.')
      setImportBundle(null)
    }
  }

  async function runImport(dryRun) {
    if (!importBundle) {
      toast.error('Choose an export JSON first.')
      return
    }
    setBusy(dryRun ? 'dry' : 'import')
    try {
      const result = await dataCenter('import', {
        bundle: importBundle,
        dry_run: dryRun,
        confirm: dryRun ? undefined : importConfirm,
      })
      toast.success(dryRun ? 'Dry run OK — review counts, then type IMPORT.' : 'Import applied.')
      if (!dryRun) {
        setImportConfirm('')
        setImportBundle(null)
        await load()
      } else {
        console.info('[data-center] dry-run', result.results)
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
      toast.success(`Deleted ${result.deleted_count ?? 0} rows.`)
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
            Super Admin only. Business data lives in Supabase Postgres (permanent). Use this page for owner-controlled
            export / import / purge and backup reminders. Automatic PITR snapshots are managed in the Supabase Dashboard.
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
          <Badge variant="secondary">{status?.platform?.dashboard_hint || 'Database → Backups'}</Badge>
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
              Download a JSON snapshot of business tables (customers, vehicles, bookings, sales, finance, catalog…). Store
              offline. Auth passwords are never included.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={exportSnapshot} disabled={!!busy}>
              {busy === 'export' ? 'Exporting…' : 'Download export JSON'}
            </Button>
            {status?.row_counts ? (
              <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                {Object.entries(status.row_counts).map(([k, v]) => (
                  <li key={k}>
                    {k}: <span className="font-semibold text-foreground">{v ?? '—'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="size-5" /> Import snapshot
            </CardTitle>
            <CardDescription>
              Upserts catalog + CRM core tables only ({(status?.import_tables || []).join(', ') || '…'}). Bookings/sales
              are export-only (restore via Supabase PITR for those).
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
          <CardTitle className="text-red-200">Destructive purge</CardTitle>
          <CardDescription>
            Hard-deletes selected rows and writes an event so you know exactly what was removed. Prefer archive in CRM/queue
            first. Type DELETE to confirm.
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
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={purgeConfirm} onChange={(e) => setPurgeConfirm(e.target.value)} placeholder="DELETE" />
          <Button variant="destructive" onClick={runPurge} disabled={!!busy || purgeConfirm !== 'DELETE'}>
            {busy === 'purge' ? 'Purging…' : 'Purge permanently'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What changed (owner trail)</CardTitle>
          <CardDescription>
            Every export, import, purge, and platform-backup acknowledgement. This is how Hakum informs you what was
            snapshotted or deleted by the Super Admin — separate from Supabase automatic backups.
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

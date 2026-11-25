import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessAudit } from '@/auth/permissions'
import { listAuditLogs } from '@/lib/audit'
import { formatAuditDetail } from '@/lib/auditDetail'
import { downloadCsv } from '@/lib/financeData'
import OpsPageShell from '@/components/ops/OpsPageShell'
import FilterBar from '@/components/ops/FilterBar'
import DataTable from '@/components/ops/DataTable'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
  } catch {
    return iso
  }
}

export default function AuditLogPage({ embedded = false } = {}) {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [detailRow, setDetailRow] = useState(null)

  const handleSearchChange = useCallback((value) => {
    setQ(value)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (String(value || '').trim()) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }, [setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listAuditLogs({ limit: 300 }))
    } catch (err) {
      toast.error(err.message || 'Unable to load audit log. Apply the audit migration if this is new.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canAccessAudit(profile)) load()
  }, [load, profile])

  const actionOptions = useMemo(
    () => [...new Set(rows.map((r) => r.action).filter(Boolean))].sort(),
    [rows],
  )
  const entityOptions = useMemo(
    () => [...new Set(rows.map((r) => r.entity_type).filter(Boolean))].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (actionFilter !== 'all' && r.action !== actionFilter) return false
      if (entityFilter !== 'all' && r.entity_type !== entityFilter) return false
      const day = String(r.created_at || '').slice(0, 10)
      if (fromDate && day < fromDate) return false
      if (toDate && day > toDate) return false
      if (!query) return true
      return [r.action, r.actor_role, r.entity_type, r.entity_id, formatAuditDetail(r)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [rows, actionFilter, entityFilter, fromDate, toDate, q])

  if (!canAccessAudit(profile)) return <Navigate to="/operations/access-denied" replace />

  const hasFilters = Boolean(q.trim() || actionFilter !== 'all' || entityFilter !== 'all' || fromDate || toDate)

  const columns = [
    { id: 'when', header: 'When', accessorKey: 'created_at', sortable: true, cell: (row) => formatWhen(row.created_at), className: 'whitespace-nowrap text-xs text-muted-foreground' },
    { id: 'actor', header: 'Actor', accessorKey: 'actor_role', sortable: true },
    { id: 'action', header: 'Action', accessorKey: 'action', sortable: true, className: 'font-medium' },
    {
      id: 'entity',
      header: 'Entity',
      accessorKey: 'entity_type',
      cell: (row) => (
        <div>
          <div>{row.entity_type}</div>
          <div className="text-xs text-muted-foreground">{row.entity_id || '—'}</div>
        </div>
      ),
    },
    {
      id: 'summary',
      header: 'Summary',
      cell: (row) => (
        <button
          type="button"
          className="text-left underline-offset-2 hover:underline"
          onClick={() => setDetailRow(row)}
        >
          {formatAuditDetail(row)}
        </button>
      ),
      className: 'max-w-md text-sm',
      hideOnMobile: false,
    },
  ]

  function exportCsv() {
    downloadCsv(
      filtered,
      [
        { key: 'created_at', label: 'When' },
        { key: 'actor_role', label: 'Actor role' },
        { key: 'actor_id', label: 'Actor ID' },
        { key: 'action', label: 'Action' },
        { key: 'entity_type', label: 'Entity type' },
        { key: 'entity_id', label: 'Entity ID' },
        { key: 'summary', label: 'Summary', value: (r) => formatAuditDetail(r) },
      ],
      `hakum-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const inner = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <FilterBar
            search={q}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search actions, actors, entities…"
            onClear={() => handleSearchChange('')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-11 shrink-0" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-1.5 size-4" aria-hidden />
            CSV
          </Button>
          {embedded ? (
            <Button variant="outline" className="min-h-11 shrink-0" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-action" className="text-xs">Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger id="audit-action" className="min-h-10">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionOptions.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-entity" className="text-xs">Entity</Label>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger id="audit-entity" className="min-h-10">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {entityOptions.map((ent) => (
                <SelectItem key={ent} value={ent}>{ent}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-from" className="text-xs">From date</Label>
          <Input id="audit-from" type="date" className="min-h-10" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="audit-to" className="text-xs">To date</Label>
          <Input id="audit-to" type="date" className="min-h-10" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {hasFilters ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {rows.length} events</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              handleSearchChange('')
              setActionFilter('all')
              setEntityFilter('all')
              setFromDate('')
              setToDate('')
            }}
          >
            Reset filters
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={filtered}
        searchKeys={false}
        emptyTitle="No audit events"
        emptyDescription="Create or edit a branch, person, or service to start the trail."
        getRowId={(row) => row.id}
      />

      <Dialog open={Boolean(detailRow)} onOpenChange={(open) => !open && setDetailRow(null)}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detailRow?.action || 'Audit event'}</DialogTitle>
            <DialogDescription>
              {detailRow ? `${formatWhen(detailRow.created_at)} · ${detailRow.actor_role || 'system'}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detailRow ? (
            <div className="space-y-3 text-sm">
              <p><strong>Entity:</strong> {detailRow.entity_type} {detailRow.entity_id ? `(${detailRow.entity_id})` : ''}</p>
              <p><strong>Summary:</strong> {formatAuditDetail(detailRow)}</p>
              {detailRow.actor_id ? <p className="text-xs text-muted-foreground">Actor ID: <code>{detailRow.actor_id}</code></p> : null}
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Metadata</p>
                <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  {JSON.stringify(detailRow.meta || {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )

  if (embedded) return inner

  return (
    <OpsPageShell
      className="hakum-audit"
      eyebrow="Governance"
      title="Audit log"
      breadcrumbs={[{ label: 'Ops', to: '/operations/audit' }, { label: 'Audit' }]}
      description="Super Admin and Admin actions on people, branches, services, and related ops mutations."
      actions={
        <Button variant="outline" className="min-h-11" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      {inner}
    </OpsPageShell>
  )
}

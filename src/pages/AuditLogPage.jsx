import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessAudit } from '@/auth/permissions'
import { listAuditLogs } from '@/lib/audit'
import { formatAuditDetail } from '@/lib/auditDetail'
import OpsPageShell from '@/components/ops/OpsPageShell'
import FilterBar from '@/components/ops/FilterBar'
import DataTable from '@/components/ops/DataTable'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
  } catch {
    return iso
  }
}

export default function AuditLogPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listAuditLogs({ limit: 150 }))
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

  if (!canAccessAudit(profile)) return <Navigate to="/operations/access-denied" replace />

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
    { id: 'summary', header: 'Summary', cell: (row) => formatAuditDetail(row), className: 'max-w-md text-sm', hideOnMobile: false },
  ]

  const filtered = q.trim()
    ? rows.filter((r) =>
        [r.action, r.actor_role, r.entity_type, r.entity_id, formatAuditDetail(r)]
          .join(' ')
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
      )
    : rows

  return (
    <OpsPageShell
      className="hakum-audit"
      eyebrow="Governance"
      title="Audit log"
      breadcrumbs={[{ label: 'Ops', to: '/operations/console' }, { label: 'Audit' }]}
      description="Super Admin and Admin actions on people, branches, services, and related ops mutations."
      actions={
        <Button variant="outline" className="min-h-11" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >
      <FilterBar search={q} onSearchChange={setQ} searchPlaceholder="Search actions, actors, entities…" onClear={() => setQ('')} />
      <DataTable
        columns={columns}
        data={filtered}
        searchKeys={false}
        emptyTitle="No audit events"
        emptyDescription="Create or edit a branch, person, or service to start the trail."
        getRowId={(row) => row.id}
      />
    </OpsPageShell>
  )
}

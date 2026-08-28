import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessAudit } from '@/auth/permissions'
import { listAuditLogs } from '@/lib/audit'
import { formatAuditDetail } from '@/lib/auditDetail'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

  return (
    <OpsPageShell
      className="hakum-audit"
      eyebrow="Governance"
      title="Audit log"
      description="Super Admin and Admin actions on people, branches, services, and related ops mutations."
      actions={
        <Button variant="outline" className="min-h-11" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      }
    >

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
          <CardDescription>{rows.length} latest entries</CardDescription>
        </CardHeader>
        <CardContent>
          {!rows.length && !loading ? (
            <p className="text-sm text-muted-foreground">No audit events yet — create or edit a branch, person, or service to start the trail.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Summary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatWhen(row.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.actor_role || '—'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{row.action}</TableCell>
                    <TableCell>
                      <div>{row.entity_type}</div>
                      <div className="text-xs text-muted-foreground">{row.entity_id || '—'}</div>
                    </TableCell>
                    <TableCell className="max-w-md text-sm">{formatAuditDetail(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </OpsPageShell>
  )
}

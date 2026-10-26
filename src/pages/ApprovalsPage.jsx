import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessApprovals, isSuperAdmin } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [bills, setBills] = useState(0)
  const [busyId, setBusyId] = useState('')
  const canDecide = isSuperAdmin(profile)

  const load = useCallback(async () => {
    const [stock, expenses] = await Promise.all([
      supabase
        .from('restock_requests')
        .select('id, add_qty, branch_slug, created_at, products(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    ])
    if (stock.error) throw stock.error
    setRows(stock.data || [])
    setBills(expenses.error ? 0 : Number(expenses.count) || 0)
  }, [])

  useEffect(() => {
    if (!canAccessApprovals(profile)) return
    load().catch((err) => toast.error(err.message || 'Could not load approvals'))
  }, [load, profile])

  if (!canAccessApprovals(profile)) return <Navigate to="/operations/access-denied" replace />

  async function decide(id, decision) {
    setBusyId(id)
    try {
      const { error } = await supabase.rpc('review_restock', { p_id: id, p_decision: decision })
      if (error) throw error
      toast.success(decision === 'approved' ? 'Count updated' : 'Restock declined')
      await load()
    } catch (err) {
      toast.error(err.message || 'Could not update the restock')
    } finally {
      setBusyId('')
    }
  }

  return (
    <OpsPageShell
      className="hakum-approvals"
      title="Approvals"
      description="Restock adds to the count after Super Admin accepts it. It is not a bill. Bills waiting for approval stay in Finance."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/finance?tab=purchases">Open bills</Link>
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">{bills} bill{bills === 1 ? '' : 's'} waiting for approval</p>
      {rows.length ? (
        <ul className="flex flex-col gap-3" aria-label="Restock waiting">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{row.products?.name || 'Item'}</p>
                <p className="text-sm text-muted-foreground">
                  {row.branch_slug} · add {row.add_qty}
                </p>
              </div>
              {canDecide ? (
                <div className="flex gap-2">
                  <Button type="button" className="min-h-11" disabled={busyId === row.id} onClick={() => decide(row.id, 'approved')}>
                    Approve
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" disabled={busyId === row.id} onClick={() => decide(row.id, 'rejected')}>
                    Decline
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for Super Admin</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No restock is waiting.</p>
      )}
    </OpsPageShell>
  )
}

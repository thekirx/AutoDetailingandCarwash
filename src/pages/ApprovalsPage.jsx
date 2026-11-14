import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessApprovals, canModifyStock } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { filterOperationalBranches } from '@/lib/inventoryBranchStock'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [expenseRows, setExpenseRows] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const canDecide = canModifyStock(profile)

  const load = useCallback(async () => {
    const [stock, expenses, brList] = await Promise.all([
      supabase
        .from('restock_requests')
        .select('id, add_qty, branch_slug, created_at, products(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      supabase.from('expenses').select('id, branch').eq('status', 'pending_approval'),
      listBranches().catch(() => []),
    ])
    if (stock.error) throw stock.error
    const opBranches = filterOperationalBranches(brList || [])
    setBranches(opBranches)
    setRows(stock.data || [])
    setExpenseRows(expenses.error ? [] : expenses.data || [])
  }, [])

  useEffect(() => {
    if (!canAccessApprovals(profile)) return
    load().catch((err) => toast.error(err.message || 'Could not load approvals'))
  }, [load, profile])

  const branchNameBySlug = useMemo(
    () => Object.fromEntries((branches || []).map((b) => [b.slug, b.name])),
    [branches],
  )

  const visibleRows = useMemo(() => {
    if (branchFilter === 'all') return rows
    return rows.filter((r) => String(r.branch_slug || '').toLowerCase() === branchFilter)
  }, [rows, branchFilter])

  const bills = useMemo(() => {
    if (branchFilter === 'all') return expenseRows.length
    return expenseRows.filter((e) => String(e.branch || '').toLowerCase() === branchFilter).length
  }, [expenseRows, branchFilter])

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{bills} bill{bills === 1 ? '' : 's'} waiting for approval</p>
        {branches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter approvals by branch">
            <Button
              type="button"
              size="sm"
              variant={branchFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setBranchFilter('all')}
            >
              All Branches
            </Button>
            {branches.map((b) => (
              <Button
                key={b.slug}
                type="button"
                size="sm"
                variant={branchFilter === b.slug ? 'default' : 'outline'}
                onClick={() => setBranchFilter(b.slug)}
              >
                {b.name}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
      {visibleRows.length ? (
        <ul className="flex flex-col gap-3" aria-label="Restock waiting">
          {visibleRows.map((row) => (
            <li key={row.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.products?.name || 'Item'}</p>
                  <Badge variant="outline" className="text-[11px]">
                    {branchNameBySlug[row.branch_slug] || row.branch_slug}
                  </Badge>
                </div>
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

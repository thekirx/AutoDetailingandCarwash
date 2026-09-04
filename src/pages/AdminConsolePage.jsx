import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Users,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, canSeeAllBranches, getBranchScopeList } from '@/auth/permissions'
import { fetchAdminConsoleSnapshot, formatPeso } from '@/lib/adminApi'
import { getBranchScope } from '@/queue/queueLogic'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsStatTile from '@/components/ops/OpsStatTile'
import OpsTabList from '@/components/ops/OpsTabBar'
import OpsSkeleton from '@/components/ops/OpsSkeleton'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'

export default function AdminConsolePage() {
  const { profile } = useAuth()
  const scopeList = getBranchScopeList(profile)
  const canPickBranch = canSeeAllBranches(profile) || (Array.isArray(scopeList) && scopeList.length > 1)
  const defaultBranch = canSeeAllBranches(profile)
    ? 'all'
    : Array.isArray(scopeList) && scopeList.length === 1
      ? scopeList[0]
      : Array.isArray(scopeList) && scopeList.length > 1
        ? 'all'
        : getBranchScope(profile) || 'all'
  const [branch, setBranch] = useState(defaultBranch)
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminConsoleSnapshot(profile, branch)
      setSnap(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile, branch])

  useEffect(() => {
    if (isAdmin(profile)) load()
  }, [load, profile])

  const staffCounts = useMemo(() => {
    const rows = snap?.staffRows || []
    return {
      total: rows.length,
      leads: rows.filter((r) => r.role === 'team_lead').length,
      crew: rows.filter((r) => r.role === 'staff').length,
      admins: rows.filter((r) => r.role === 'admin' || r.role === 'BossMich' || r.role === 'assistant_super_admin').length,
    }
  }, [snap])

  if (!isAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  const pickerBranches = canSeeAllBranches(profile)
    ? snap?.branches || []
    : (snap?.branches || []).filter((b) => (scopeList || []).includes(b.slug))

  return (
    <OpsPageShell
      className="hakum-console"
      eyebrow="Command"
      title="Operations console"
      breadcrumbs={[{ label: 'Ops', to: '/operations/console' }, { label: 'Console' }]}
      description={
        canSeeAllBranches(profile)
          ? 'Live revenue, cost, profit, stock, and floor queue — all branches or one site.'
          : 'Live revenue, cost, profit, stock, and floor queue for your assigned branches.'
      }
      meta={
        canPickBranch ? (
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="min-h-11 w-full sm:w-56" aria-label="Branch filter">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{canSeeAllBranches(profile) ? 'All branches' : 'All my branches'}</SelectItem>
              {pickerBranches.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm">
            Branch · {Array.isArray(scopeList) && scopeList[0] ? scopeList[0] : 'No branch assigned'}
          </p>
        )
      }
    >

      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}
      {snap?.errors?.length ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="status">
          Partial data load: {snap.errors.map((e) => e.message || String(e)).join(' · ')}
        </p>
      ) : null}

      {loading && !snap ? (
        <OpsSkeleton rows={3} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <OpsStatTile
              label="Today revenue"
              value={formatPeso(snap?.todayRevenueMinor)}
              hint={snap?.today}
              icon={CircleDollarSign}
              mono
              highlight
            />
            <OpsStatTile
              label="Active queue"
              value={String(snap?.queueRows?.length || 0)}
              hint="Waiting → payment"
              icon={ClipboardList}
              mono
            />
            <OpsStatTile
              label="Low stock SKUs"
              value={String(snap?.lowStock?.length || 0)}
              hint="≤ 10 units"
              icon={Boxes}
              mono
              highlight={Boolean(snap?.lowStock?.length)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Full P&amp;L lives on{' '}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/operations/finance">
              Finance
            </Link>
            . Staff count: {staffCounts.total} ({staffCounts.leads} TL · {staffCounts.crew} crew · {snap?.branches?.length || 0} sites).
          </p>

          <Tabs defaultValue="queue">
            <OpsTabList
              aria-label="Console sections"
              tabs={[
                { id: 'queue', label: 'Queue', icon: ClipboardList },
                { id: 'stock', label: 'Stock', icon: Boxes },
                { id: 'expenses', label: 'Expenses', icon: CircleDollarSign },
                { id: 'bookings', label: 'Tickets', icon: Users },
              ]}
            />

            <TabsContent value="queue" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Floor load</CardTitle>
                  <CardDescription>Live active tickets per branch</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Waiting</TableHead>
                        <TableHead>In progress</TableHead>
                        <TableHead>Checking</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.keys(snap?.queueByBranch || {}).length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-muted-foreground">No active queue right now.</TableCell></TableRow>
                      ) : (
                        Object.entries(snap.queueByBranch).map(([slug, counts]) => (
                          <TableRow key={slug}>
                            <TableCell className="font-medium">{slug}</TableCell>
                            <TableCell>{counts.waiting}</TableCell>
                            <TableCell>{counts.in_progress}</TableCell>
                            <TableCell>{counts.final_checking}</TableCell>
                            <TableCell>{counts.for_payment}</TableCell>
                            <TableCell><Badge variant="secondary">{counts.total}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stock" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory</CardTitle>
                  <CardDescription>Product stock across POS catalog</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.productRows || []).map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{p.sku || '—'}</TableCell>
                          <TableCell>{p.category || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={Number(p.stock_qty) <= 10 ? 'destructive' : 'secondary'}>{p.stock_qty}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatPeso(p.price_minor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expenses" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent expenses</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.expenseRows || []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-muted-foreground">No expenses recorded yet.</TableCell></TableRow>
                      ) : (
                        snap.expenseRows.slice(0, 20).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.title}</TableCell>
                            <TableCell>{row.branch}</TableCell>
                            <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                            <TableCell className="text-right">{formatPeso(row.total_minor)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bookings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Recent tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Plate</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(snap?.bookingRows || []).slice(0, 25).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.customer_name}</TableCell>
                          <TableCell>{row.vehicle_plate || '—'}</TableCell>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                          <TableCell className="text-right">{formatPeso(row.final_price_minor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </OpsPageShell>
  )
}

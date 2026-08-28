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
import OpsTabList from '@/components/ops/OpsTabBar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent } from '@/components/ui/tabs'

function MetricCard({ label, value, detail, icon: Icon, tone = 'default' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-amber-400' : 'text-primary'
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardDescription className="text-xs font-semibold tracking-[0.16em] uppercase">{label}</CardDescription>
        <Icon className={toneClass} size={18} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}

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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Today revenue"
              value={formatPeso(snap?.todayRevenueMinor)}
              detail={snap?.today}
              icon={CircleDollarSign}
              tone="good"
            />
            <MetricCard label="Active queue" value={String(snap?.queueRows?.length || 0)} detail="Waiting → payment" icon={ClipboardList} />
            <MetricCard label="Low stock SKUs" value={String(snap?.lowStock?.length || 0)} detail="≤ 10 units" icon={Boxes} tone={snap?.lowStock?.length ? 'warn' : 'good'} />
            <MetricCard label="Active staff" value={String(staffCounts.total)} detail={`${staffCounts.leads} TL · ${staffCounts.crew} crew`} icon={Users} />
            <MetricCard label="Branches" value={String(snap?.branches?.length || 0)} detail="Active sites" icon={ClipboardList} />
          </div>
          <p className="text-sm text-muted-foreground">
            Period books (income, expenses, net) live on{' '}
            <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/operations/finance">
              Finance
            </Link>
            . Console is today&apos;s ops pulse only.
          </p>

          <Tabs defaultValue="queue">
            <OpsTabList
              aria-label="Console sections"
              tabs={[
                { id: 'queue', label: 'Queue by branch', icon: ClipboardList },
                { id: 'stock', label: 'Stock', icon: Boxes },
                { id: 'expenses', label: 'Expenses', icon: CircleDollarSign },
                { id: 'bookings', label: 'Recent tickets', icon: Users },
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

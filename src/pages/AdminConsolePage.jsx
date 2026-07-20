import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin, isSuperAdmin } from '@/auth/permissions'
import { fetchAdminConsoleSnapshot, formatPeso } from '@/lib/adminApi'
import { getBranchScope } from '@/queue/queueLogic'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
  const scoped = getBranchScope(profile)
  const [branch, setBranch] = useState(scoped || 'all')
  const [snap, setSnap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filter = scoped || branch
      const data = await fetchAdminConsoleSnapshot(profile, filter)
      setSnap(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [profile, branch, scoped])

  useEffect(() => {
    if (isAdmin(profile)) load()
  }, [load, profile])

  useEffect(() => {
    if (scoped) setBranch(scoped)
  }, [scoped])

  const staffCounts = useMemo(() => {
    const rows = snap?.staffRows || []
    return {
      total: rows.length,
      leads: rows.filter((r) => r.role === 'team_lead').length,
      crew: rows.filter((r) => r.role === 'staff').length,
      admins: rows.filter((r) => r.role === 'admin' || r.role === 'BossMich').length,
    }
  }, [snap])

  if (!isAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Command</p>
          <h1 className="text-3xl font-semibold tracking-tight">Operations console</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Live revenue, cost, profit, stock, and floor queue — all branches or one site.
          </p>
        </div>
        <div className="w-full sm:w-56">
          {isSuperAdmin(profile) ? (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger aria-label="Branch filter">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {(snap?.branches || []).map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Branch · {scoped || 'unassigned'}
            </p>
          )}
        </div>
      </div>

      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      {loading && !snap ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Today revenue"
              value={formatPeso(snap?.todayRevenueMinor)}
              detail={snap?.today}
              icon={CircleDollarSign}
              tone="good"
            />
            <MetricCard
              label="Period revenue"
              value={formatPeso(snap?.revenueMinor)}
              detail="From daily sales summary"
              icon={TrendingUp}
            />
            <MetricCard
              label="Approved cost"
              value={formatPeso(snap?.approvedExpenseMinor)}
              detail={`Pending ${formatPeso(snap?.pendingExpenseMinor)}`}
              icon={Wallet}
              tone="warn"
            />
            <MetricCard
              label="Profit"
              value={formatPeso(snap?.profitMinor)}
              detail="Revenue − approved expenses"
              icon={snap?.profitMinor >= 0 ? ArrowUpRight : ArrowDownRight}
              tone={snap?.profitMinor >= 0 ? 'good' : 'bad'}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Active queue" value={String(snap?.queueRows?.length || 0)} detail="Waiting → payment" icon={ClipboardList} />
            <MetricCard label="Low stock SKUs" value={String(snap?.lowStock?.length || 0)} detail="≤ 10 units" icon={Boxes} tone={snap?.lowStock?.length ? 'warn' : 'good'} />
            <MetricCard label="Active staff" value={String(staffCounts.total)} detail={`${staffCounts.leads} TL · ${staffCounts.crew} crew`} icon={Users} />
            <MetricCard label="Branches" value={String(snap?.branches?.length || 0)} detail="Active sites" icon={ClipboardList} />
          </div>

          <Tabs defaultValue="queue">
            <TabsList>
              <TabsTrigger value="queue">Queue by branch</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
              <TabsTrigger value="bookings">Recent tickets</TabsTrigger>
            </TabsList>

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
    </section>
  )
}

/** Finance Overview tab: KPIs, income vs expense bar, payment-method breakdown,
 * top branches, recent POS sales. Real data only — no fake numbers. */
import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Building2, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/queue/queueApi'
import { rollupPl, salesByBranch, shareOfTotal, sumMinor } from '@/lib/financeData'

const NAVY = '#020a31'
const ACCENT = '#38bdf8'
const POSITIVE = '#16a34a'
const NEGATIVE = '#dc2626'

export default function FinanceOverviewTab({
  plRows,
  salesRows,
  branchOptions,
  range,
  loading,
}) {
  const pl = useMemo(() => rollupPl(plRows), [plRows])
  const byBranch = useMemo(() => salesByBranch(salesRows), [salesRows])
  const recentSales = useMemo(() => {
    return [...(salesRows || [])]
      .sort((a, b) => (a.sale_date < b.sale_date ? 1 : -1))
      .slice(0, 8)
  }, [salesRows])

  const paymentBreakdown = useMemo(() => {
    const cash = sumMinor(salesRows, 'cash_sales_minor')
    const gcash = sumMinor(salesRows, 'gcash_sales_minor')
    const card = sumMinor(salesRows, 'card_sales_minor')
    return [
      { name: 'Cash', value: cash, color: NAVY },
      { name: 'GCash', value: gcash, color: ACCENT },
      { name: 'Card', value: card, color: '#94a3b8' },
    ].filter((p) => p.value > 0)
  }, [salesRows])

  const incomeVsExpense = useMemo(
    () => [
      { name: 'Income', value: pl.income / 100, fill: NAVY },
      { name: 'Expenses', value: pl.expenses / 100, fill: ACCENT },
    ],
    [pl],
  )
  const incomeExpenseTotal = (pl.income + pl.expenses) / 100
  const paymentTotal = paymentBreakdown.reduce((sum, row) => sum + row.value, 0)

  if (loading) {
    return <OverviewSkeleton />
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="finance-kpi-row">
        <KpiCard
          label="Total income"
          value={formatMoney(pl.income)}
          delta={pl.income > 0 ? 'POS paid sales' : 'No paid sales in window'}
          tone="positive"
          icon={<Wallet className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Total expenses"
          value={formatMoney(pl.expenses)}
          delta="Paid + posted"
          tone="neutral"
          icon={<ArrowDownRight className="size-4" aria-hidden />}
        />
        <KpiCard
          label={pl.net >= 0 ? 'Net profit' : 'Net loss'}
          value={formatMoney(pl.net)}
          delta={`${pl.margin}% margin`}
          tone={pl.net >= 0 ? 'positive' : 'negative'}
          icon={<ArrowUpRight className="size-4" aria-hidden />}
        />
        <KpiCard
          label="Branches"
          value={byBranch.length}
          delta={branchOptions.length > 1 ? `${branchOptions.length} available` : 'Single branch'}
          tone="neutral"
          icon={<Building2 className="size-4" aria-hidden />}
        />
      </div>

      <div className="finance-grid-2-1">
        <Card>
          <CardHeader>
            <CardTitle>Income vs expenses</CardTitle>
            <CardDescription>{range.start} to {range.end}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {pl.income === 0 && pl.expenses === 0 ? (
              <EmptyChart label="No income or expenses in this window yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpense} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                  <XAxis dataKey="name" stroke="#475569" fontSize={12} />
                  <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => `₱${v.toLocaleString()}`} />
                  <Tooltip
                    formatter={(v) => {
                      const { percent } = shareOfTotal(v, incomeExpenseTotal)
                      return `${formatMoney(Math.round(v * 100))} · ${percent}%`
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={120} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment methods</CardTitle>
            <CardDescription>How customers paid</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {paymentBreakdown.length === 0 ? (
              <EmptyChart label="No paid sales in this window." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {paymentBreakdown.map((p) => (
                      <Cell key={p.name} fill={p.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => {
                      const { percent } = shareOfTotal(v, paymentTotal)
                      return `${formatMoney(v)} · ${percent}%`
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="finance-grid-2-1">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by branch</CardTitle>
            <CardDescription>POS paid sales in the window</CardDescription>
          </CardHeader>
          <CardContent>
            {byBranch.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branch sales in this window.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Paid tickets</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byBranch.map((b) => {
                    const name = branchOptions.find((x) => x.slug === b.branch)?.name || b.branch
                    return (
                      <TableRow key={b.branch}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(b.total_sales_minor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{b.paid_count}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
            <CardDescription>Latest POS days in the window</CardDescription>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this window.</p>
            ) : (
              <ul className="finance-recent-list">
                {recentSales.map((row) => {
                  const name = branchOptions.find((x) => x.slug === row.branch)?.name || row.branch
                  return (
                    <li key={`${row.branch}-${row.sale_date}`}>
                      <div>
                        <p className="finance-recent-branch">{name}</p>
                        <p className="finance-recent-date">{row.sale_date}</p>
                      </div>
                      <div className="finance-recent-amount">
                        <span className="tabular-nums">{formatMoney(row.total_sales_minor)}</span>
                        <Badge variant="secondary">{row.paid_count} paid</Badge>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ label, value, delta, tone, icon }) {
  const toneClass =
    tone === 'positive'
      ? 'finance-kpi-positive'
      : tone === 'negative'
        ? 'finance-kpi-negative'
        : 'finance-kpi-neutral'
  return (
    <Card className={toneClass}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
          <span className="finance-kpi-icon" aria-hidden>{icon}</span>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ label }) {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="finance-kpi-row">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <div className="finance-skeleton-line w-20" />
              <div className="finance-skeleton-line mt-4 w-32 h-7" />
              <div className="finance-skeleton-line mt-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="h-72 finance-skeleton-block" />
      </Card>
    </div>
  )
}

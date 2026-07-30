import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessReports, getBranchScopeList } from '@/auth/permissions'
import { aggregateBestSellers, applyBranchScope } from '@/lib/crmInsights'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

/** Super Admin (+ ASA reports grant) module rollup — branch-scoped for non-all roles. */
export default function ReportsPage() {
  const { profile } = useAuth()
  const [daily, setDaily] = useState([])
  const [services, setServices] = useState([])
  const [expenseTotal, setExpenseTotal] = useState(0)
  const [expenseCount, setExpenseCount] = useState(0)
  const [kpiCrew, setKpiCrew] = useState(0)
  const [complaints, setComplaints] = useState(0)
  const [bookingsDone, setBookingsDone] = useState(0)

  const load = useCallback(async () => {
    const scope = getBranchScopeList(profile)
    const branchFilter = scope === null ? 'all' : scope
    const start30 = new Date()
    start30.setDate(start30.getDate() - 30)
    const startIso = start30.toISOString()
    // Manila calendar for display consistency (sale queries use occurred_at window)
    void getLocalCalendarDate()

    let salesQ = supabase.from('daily_sales_summary').select('*').order('sale_date', { ascending: false }).limit(30)
    salesQ = applyBranchScope(salesQ, branchFilter)
    let expensesQ = supabase.from('expenses').select('total_minor, status, branch').gte('created_at', startIso).limit(500)
    expensesQ = applyBranchScope(expensesQ, branchFilter)
    let booksQ = supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('is_archived', false)
      .in('status', ['completed', 'for_payment'])
      .gte('scheduled_start', startIso)
    booksQ = applyBranchScope(booksQ, branchFilter)

    // sale_line_items has no branch — scope via parent sales ids
    let saleIdsQ = supabase.from('sales').select('id').gte('occurred_at', startIso).limit(500)
    saleIdsQ = applyBranchScope(saleIdsQ, branchFilter)

    let crewQ = supabase.from('crew_kpi_summary').select('staff_id', { count: 'exact', head: true })
    crewQ = applyBranchScope(crewQ, branchFilter)
    let compsQ = supabase.from('complaints').select('id', { count: 'exact', head: true }).gte('created_at', startIso)
    compsQ = applyBranchScope(compsQ, branchFilter)

    const [sales, saleIdsRes, expenses, crew, comps, books] = await Promise.all([
      salesQ,
      saleIdsQ,
      expensesQ,
      crewQ,
      compsQ,
      booksQ,
    ])

    if (sales.error) toast.error(sales.error.message)
    if (saleIdsRes.error) toast.error(saleIdsRes.error.message)
    setDaily((sales.data || []).reverse())

    const saleIds = (saleIdsRes.data || []).map((r) => r.id).filter(Boolean)
    let lines = { data: [], error: null }
    if (saleIds.length) {
      lines = await supabase
        .from('sale_line_items')
        .select('name, item_type, line_total_minor, quantity, sale_id')
        .in('sale_id', saleIds)
        .limit(1000)
      if (lines.error) toast.error(lines.error.message)
    }
    setServices(aggregateBestSellers(lines.data || [], 8))

    const expRows = expenses.data || []
    setExpenseCount(expRows.length)
    setExpenseTotal(expRows.reduce((s, r) => s + Number(r.total_minor || 0), 0))
    setKpiCrew(crew.count || 0)
    setComplaints(comps.count || 0)
    setBookingsDone(books.count || 0)
  }, [profile])

  useEffect(() => {
    load()
  }, [load])

  if (!canAccessReports(profile)) return <Navigate to="/operations/access-denied" replace />

  const revenue = daily.reduce((sum, row) => sum + (row.total_sales_minor || 0), 0)
  const chartData = daily.map((row) => ({
    date: row.sale_date,
    sales: (row.total_sales_minor || 0) / 100,
    branch: row.branch,
  }))
  const scopeLabel = getBranchScopeList(profile) === null
    ? 'All branches'
    : (getBranchScopeList(profile) || []).join(', ') || 'No branch'

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Analytics</p>
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Module rollup — sales, expenses, KPI headcount, complaints, bookings. Scope · {scopeLabel}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric label="Sales (30d loaded)" value={formatMoney(revenue)} />
        <Metric label="Expenses (30d)" value={formatMoney(expenseTotal)} />
        <Metric label="Net (sales − expenses)" value={formatMoney(revenue - expenseTotal)} />
        <Metric label="Crew in KPI view" value={kpiCrew} />
        <Metric label="Complaints (30d)" value={complaints} />
        <Metric label="Completed bookings (30d)" value={bookingsDone} />
        <Metric label="Expense rows" value={expenseCount} />
        <Metric label="Top SKUs" value={services.length} />
        <Metric label="Branches in sales" value={new Set(daily.map((d) => d.branch)).size} />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue trend</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="sales" stroke="#3b5bdb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Best sellers</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={services}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-20} textAnchor="end" height={70} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip />
              <Bar dataKey="total" fill="#052699" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  )
}

function Metric({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

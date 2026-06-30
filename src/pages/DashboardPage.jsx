import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { addDays, format, startOfDay, startOfMonth, subDays } from 'date-fns'
import { ArrowDownRight, ArrowUpRight, Banknote, CarFront, CircleDollarSign, LoaderCircle, ReceiptText } from 'lucide-react'
import { supabase } from '../lib/supabase'

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const preciseMoney = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
})

const transactionSelect = `
  id,
  booking_id,
  customer_id,
  type,
  amount_minor,
  currency,
  payment_method,
  reference_number,
  description,
  occurred_at,
  booking:bookings!transactions_booking_id_fkey (
    id,
    customer_name,
    vehicle_make,
    vehicle_model,
    status,
    service:services!bookings_service_id_fkey (id, name)
  )
`

function signedAmount(transaction) {
  if (transaction.type === 'refund' || transaction.type === 'expense') return -transaction.amount_minor
  return transaction.amount_minor
}

function buildTrend(transactions, firstDay) {
  const totals = new Map()
  for (const transaction of transactions) {
    if (transaction.type !== 'sale') continue
    const key = format(new Date(transaction.occurred_at), 'yyyy-MM-dd')
    totals.set(key, (totals.get(key) || 0) + transaction.amount_minor)
  }

  return Array.from({ length: 30 }, (_, index) => {
    const date = addDays(firstDay, index)
    const key = format(date, 'yyyy-MM-dd')
    return { date: format(date, 'MMM d'), revenue: (totals.get(key) || 0) / 100 }
  })
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#090e14]/95 px-4 py-3 shadow-xl backdrop-blur">
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-lime-300">{preciseMoney.format(payload[0].value)}</p>
    </div>
  )
}

function KpiCard({ label, value, detail, icon: Icon, tone = 'lime' }) {
  const toneClass = tone === 'red' ? 'bg-red-400/10 text-red-300' : tone === 'blue' ? 'bg-blue-400/10 text-blue-300' : 'bg-lime-400/10 text-lime-300'
  return (
    <article className="rounded-2xl border border-white/8 bg-[#10161e] p-5 shadow-lg shadow-black/10">
      <div className="flex items-start justify-between gap-3"><p className="text-xs font-medium tracking-[0.12em] text-slate-500 uppercase">{label}</p><span className={`grid size-10 place-items-center rounded-xl ${toneClass}`}><Icon size={19} /></span></div>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  )
}

export default function DashboardPage() {
  const [transactions, setTransactions] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const thirtyDaysAgo = useMemo(() => startOfDay(subDays(new Date(), 29)), [])
  const monthStart = useMemo(() => startOfMonth(new Date()), [])
  const analyticsStart = useMemo(() => new Date(Math.min(thirtyDaysAgo.getTime(), monthStart.getTime())), [thirtyDaysAgo, monthStart])

  const loadFinancials = useCallback(async () => {
    setLoading(true)
    setError('')

    const [analyticsResult, recentResult] = await Promise.all([
      supabase
        .from('transactions')
        .select(transactionSelect)
        .eq('is_archived', false)
        .gte('occurred_at', analyticsStart.toISOString())
        .order('occurred_at'),
      supabase
        .from('transactions')
        .select(transactionSelect)
        .eq('is_archived', false)
        .order('occurred_at', { ascending: false })
        .limit(10),
    ])

    if (analyticsResult.error || recentResult.error) {
      setError(analyticsResult.error?.message || recentResult.error?.message || 'Unable to load financial data.')
      setLoading(false)
      return
    }

    setTransactions(analyticsResult.data)
    setRecentTransactions(recentResult.data)
    setLoading(false)
  }, [analyticsStart])

  useEffect(() => {
    loadFinancials()
  }, [loadFinancials])

  const analytics = useMemo(() => {
    const mtd = transactions.filter((transaction) => new Date(transaction.occurred_at) >= monthStart)
    const grossMinor = mtd.filter((transaction) => transaction.type === 'sale').reduce((sum, transaction) => sum + transaction.amount_minor, 0)
    const netMinor = mtd.reduce((sum, transaction) => sum + signedAmount(transaction), 0)
    const completedBookingIds = new Set(mtd.filter((transaction) => transaction.booking?.status === 'completed').map((transaction) => transaction.booking_id).filter(Boolean))
    const ticketIds = new Set(mtd.filter((transaction) => transaction.type === 'sale').map((transaction) => transaction.booking_id || transaction.id))

    const serviceTotals = new Map()
    for (const transaction of transactions) {
      if (transaction.type !== 'sale') continue
      const service = transaction.booking?.service?.name || 'Uncategorized'
      serviceTotals.set(service, (serviceTotals.get(service) || 0) + transaction.amount_minor)
    }

    return {
      grossMinor,
      netMinor,
      vehiclesServiced: completedBookingIds.size,
      averageTicketMinor: ticketIds.size ? Math.round(grossMinor / ticketIds.size) : 0,
      trend: buildTrend(transactions, thirtyDaysAgo),
      serviceRevenue: [...serviceTotals.entries()]
        .map(([service, amount]) => ({ service, revenue: amount / 100 }))
        .sort((a, b) => b.revenue - a.revenue),
    }
  }, [transactions, monthStart, thirtyDaysAgo])

  if (error) {
    return <section><p className="text-sm text-red-300">{error}</p><button onClick={loadFinancials} className="mt-4 text-sm font-medium text-lime-400">Try again</button></section>
  }

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <div><p className="mb-2 text-xs tracking-[0.22em] text-lime-400 uppercase">Financial intelligence</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Sales &amp; P&amp;L</h1><p className="mt-3 text-slate-400">Month-to-date performance and rolling revenue visibility.</p></div>
        {loading && <LoaderCircle className="animate-spin text-lime-400" />}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="MTD Gross Revenue" value={money.format(analytics.grossMinor / 100)} detail="Sales recorded this month" icon={CircleDollarSign} />
        <KpiCard label="Net Profit / Loss" value={money.format(analytics.netMinor / 100)} detail="After refunds and expenses" icon={analytics.netMinor >= 0 ? ArrowUpRight : ArrowDownRight} tone={analytics.netMinor >= 0 ? 'lime' : 'red'} />
        <KpiCard label="Vehicles Serviced" value={analytics.vehiclesServiced.toLocaleString()} detail="Completed bookings this month" icon={CarFront} tone="blue" />
        <KpiCard label="Average Ticket Size" value={money.format(analytics.averageTicketMinor / 100)} detail="Gross revenue per sale booking" icon={ReceiptText} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
        <article className="rounded-2xl border border-white/8 bg-[#10161e] p-5 shadow-lg shadow-black/10 sm:p-6">
          <div className="mb-6"><h2 className="font-semibold text-slate-100">Revenue trend</h2><p className="mt-1 text-xs text-slate-500">Gross sales · last 30 days</p></div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trend} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={5} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${value / 1000}k`} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(163,230,53,.25)' }} />
                <Line type="monotone" dataKey="revenue" stroke="#a3e635" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: '#a3e635', stroke: '#10161e', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-white/8 bg-[#10161e] p-5 shadow-lg shadow-black/10 sm:p-6">
          <div className="mb-6"><h2 className="font-semibold text-slate-100">Revenue by service</h2><p className="mt-1 text-xs text-slate-500">Gross sales · last 30 days</p></div>
          <div className="h-72">
            {analytics.serviceRevenue.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.serviceRevenue} margin={{ top: 5, right: 5, left: -12, bottom: 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                  <XAxis dataKey="service" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} angle={-18} textAnchor="end" height={55} interval={0} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₱${value / 1000}k`} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,.025)' }} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-slate-600">No service revenue in this period.</div>}
          </div>
        </article>
      </div>

      <article className="mt-6 overflow-hidden rounded-2xl border border-white/8 bg-[#10161e] shadow-lg shadow-black/10">
        <div className="flex items-center gap-3 border-b border-white/8 px-6 py-5"><Banknote className="text-lime-400" size={20} /><div><h2 className="font-semibold">Recent Transactions</h2><p className="mt-0.5 text-xs text-slate-500">Latest entries from the financial audit trail</p></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-white/[0.025] text-[11px] tracking-[0.14em] text-slate-500 uppercase"><tr><th className="px-6 py-4 font-medium">Date</th><th className="px-6 py-4 font-medium">Type</th><th className="px-6 py-4 font-medium">Customer / Description</th><th className="px-6 py-4 font-medium">Service</th><th className="px-6 py-4 font-medium">Reference</th><th className="px-6 py-4 text-right font-medium">Amount</th></tr></thead>
            <tbody className="divide-y divide-white/6">
              {recentTransactions.length ? recentTransactions.map((transaction) => {
                const signed = signedAmount(transaction)
                return (
                  <tr key={transaction.id} className="transition hover:bg-white/[0.025]">
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-400">{format(new Date(transaction.occurred_at), 'MMM d, yyyy · h:mm a')}</td>
                    <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase ${signed < 0 ? 'bg-red-400/10 text-red-300' : 'bg-lime-400/10 text-lime-300'}`}>{transaction.type}</span></td>
                    <td className="px-6 py-4"><p className="text-sm text-slate-200">{transaction.booking?.customer_name || transaction.description || 'General transaction'}</p>{transaction.booking?.vehicle_model && <p className="mt-0.5 text-xs text-slate-500">{transaction.booking.vehicle_make} {transaction.booking.vehicle_model}</p>}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{transaction.booking?.service?.name || '—'}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{transaction.reference_number || '—'}</td>
                    <td className={`px-6 py-4 text-right font-semibold tabular-nums ${signed < 0 ? 'text-red-300' : 'text-slate-100'}`}>{signed < 0 ? '−' : ''}{preciseMoney.format(Math.abs(signed) / 100)}</td>
                  </tr>
                )
              }) : <tr><td colSpan="6" className="px-6 py-14 text-center text-sm text-slate-500">No transactions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

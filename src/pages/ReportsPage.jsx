import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessReports } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function ReportsPage() {
  const { profile } = useAuth()
  const [daily, setDaily] = useState([])
  const [services, setServices] = useState([])

  const load = useCallback(async () => {
    const [sales, lines] = await Promise.all([
      supabase.from('daily_sales_summary').select('*').order('sale_date', { ascending: false }).limit(30),
      supabase.from('sale_line_items').select('name, item_type, line_total_minor, quantity').limit(500),
    ])
    if (sales.error) toast.error(sales.error.message)
    setDaily((sales.data || []).reverse())
    const byName = {}
    for (const line of lines.data || []) {
      const key = `${line.item_type}:${line.name}`
      byName[key] = (byName[key] || 0) + (line.line_total_minor || 0)
    }
    setServices(
      Object.entries(byName)
        .map(([key, total]) => ({ name: key.split(':')[1], total: total / 100 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    )
  }, [])

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

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Analytics</p>
        <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Tracked revenue" value={formatMoney(revenue)} />
        <Metric label="Days loaded" value={daily.length} />
        <Metric label="Top SKUs" value={services.length} />
        <Metric label="Branches" value={new Set(daily.map((d) => d.branch)).size} />
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

/** Finance › Home — Xero-style business overview: accounts watchlist, net profit YTD, sheets waiting, recent payments. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { supabase } from '@/lib/supabase'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { scopeBranch } from '@/lib/financeData'
import { accountWatchlist, monthlyProfitYtd } from '@/lib/financeBooks'
import { formatAccounting } from '@/lib/dailySheet'
import { listSheets, loadAccounts, sheetErrorMessage } from '@/lib/dailySheetApi'
import { collectPaged } from '@/lib/crmInsights'
import { SheetStatusChip } from '@/pages/pos/DailySheetPanel'
import { FinanceEmpty, FinanceMetricCell, FinanceMetricStrip, FinancePanel, FinanceTabSkeleton } from './FinanceChrome'

const chartConfig = {
  income: { label: 'Income', color: '#052699' },
  expenses: { label: 'Expenses', color: '#9aa3b8' },
  net: { label: 'Net profit', color: '#020a31' },
  priorNet: { label: 'Net profit last year', color: '#c4c4bc' },
}
const pesoTick = (v) => (Math.abs(v) >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${Math.round(v)}`)

function Amount({ minor, onClick, label }) {
  if (!minor) return <span className="ds-num text-muted-foreground">—</span>
  return (
    <button type="button" className="ds-link ds-num min-h-11 px-1" onClick={onClick} aria-label={label}>
      {formatAccounting(minor)}
    </button>
  )
}

export default function FinanceHomeTab({ profile, branchFilter = 'all', branchName, branchOptions = [], showSheets = false, onDrill }) {
  const branchLabel = (slug) => branchOptions.find((b) => b.slug === slug)?.name || slug
  const today = getLocalCalendarDate()
  const [state, setState] = useState({ loading: true, error: '', pl: [], accounts: [], sheets: [], sheetError: '', payments: [] })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    const year = Number(today.slice(0, 4))
    try {
      const plPromise = collectPaged(async (from, to) => {
        const q = scopeBranch(
          supabase.from('finance_daily_pl').select('branch, period_date, kind, category, amount_minor').gte('period_date', `${year - 1}-01-01`).lte('period_date', today),
          profile,
          branchFilter,
        )
        const { data, error } = await q.range(from, to)
        if (error) throw error
        return data || []
      }, 1000)
      const payQ = scopeBranch(
        supabase.from('expenses').select('id, title, description, total_minor, branch, status, updated_at, expense_categories(*)').eq('status', 'paid').order('updated_at', { ascending: false }).limit(8),
        profile,
        branchFilter,
      )
      const [pl, accounts, payRes, sheetRes] = await Promise.all([
        plPromise,
        loadAccounts(),
        payQ,
        showSheets ? listSheets({ status: 'submitted', branch: branchFilter, limit: 20 }).then((rows) => ({ rows }), (err) => ({ error: sheetErrorMessage(err) })) : Promise.resolve({ rows: [] }),
      ])
      if (payRes.error) throw payRes.error
      setState({ loading: false, error: '', pl, accounts, payments: payRes.data || [], sheets: sheetRes.rows || [], sheetError: sheetRes.error || '' })
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message || 'Could not load Home' }))
    }
  }, [profile, branchFilter, showSheets, today])

  useEffect(() => {
    load()
  }, [load])

  const watch = useMemo(() => accountWatchlist(state.pl, state.accounts, { today }), [state.pl, state.accounts, today])
  const months = useMemo(() => monthlyProfitYtd(state.pl, { today }), [state.pl, today])
  const ytd = useMemo(() => {
    const income = watch.filter((r) => r.kind === 'income').reduce((s, r) => s + r.ytdMinor, 0)
    const expenses = watch.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.ytdMinor, 0)
    const month = watch.reduce((s, r) => s + (r.kind === 'income' ? r.monthMinor : -r.monthMinor), 0)
    return { income, expenses, net: income - expenses, month }
  }, [watch])
  const accountId = (name) => state.accounts.find((a) => a.name === name)?.id || ''

  function drill(row, period) {
    if (row.kind === 'income') onDrill?.({ tab: 'sales', period })
    else onDrill?.({ tab: 'purchases', period, extras: { acct: accountId(row.category) } })
  }

  if (state.loading && !state.pl.length) return <FinanceTabSkeleton metrics={4} />
  if (state.error) {
    return (
      <div className="ds-banner ds-banner--warn" role="alert">
        <p className="text-sm">{state.error}</p>
      </div>
    )
  }

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Year to date">
        <FinanceMetricCell label="Net profit this month" value={formatAccounting(ytd.month)} hint={branchName} />
        <FinanceMetricCell label="Income YTD" value={formatAccounting(ytd.income)} hint={`Since Jan 1 · ${branchName}`} />
        <FinanceMetricCell label="Expenses YTD" value={formatAccounting(ytd.expenses)} hint="Paid and posted" tone="muted" />
        <FinanceMetricCell label="Net profit YTD" value={formatAccounting(ytd.net)} hint="Income − expenses" tone={ytd.net >= 0 ? 'up' : 'down'} />
      </FinanceMetricStrip>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FinancePanel title="Net profit year to date" description="Income and expenses by month · last year's net profit as a ghost line">
          {months.some((m) => m.income || m.expenses || m.priorNet) ? (
            <div className="h-72">
              <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
                <ComposedChart accessibilityLayer data={months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={pesoTick} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => `${chartConfig[name]?.label || name}: ${formatAccounting(Math.round(Number(v) * 100))}`} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={false} type="monotone" />
                  <Line dataKey="priorNet" stroke="var(--color-priorNet)" strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" />
                </ComposedChart>
              </ChartContainer>
            </div>
          ) : (
            <FinanceEmpty title="No income or expenses this year yet" body="Paid sales and approved daily sheets build this chart." />
          )}
        </FinancePanel>

        {showSheets ? (
          <FinancePanel title="Daily sheets waiting" description="Approve before crew are paid">
            {state.sheetError ? (
              <p className="text-sm text-muted-foreground">{state.sheetError}</p>
            ) : state.sheets.length ? (
              <ul className="flex flex-col divide-y divide-border">
                {state.sheets.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted/40" onClick={() => onDrill?.({ tab: 'sheets', extras: { sheet: s.id } })}>
                      <span>
                        <span className="block font-medium">{s.business_date} · {branchLabel(s.branch)}</span>
                        <span className="text-xs text-muted-foreground">{s.staff_profiles?.full_name || 'Branch admin'}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="ds-num text-sm">{formatAccounting(s.totals?.netProfitMinor)}</span>
                        <SheetStatusChip status={s.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">All good — nothing waiting for approval.</p>
            )}
          </FinancePanel>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FinancePanel title="Account watchlist" description={`This month and year to date · ${branchName}. Tap an amount to see the transactions.`}>
          <div className="overflow-x-auto">
            <table className="xero-table min-w-[520px]">
              <thead>
                <tr>
                  <th className="w-14">Code</th>
                  <th>Account</th>
                  <th className="num">This month</th>
                  <th className="num">YTD</th>
                </tr>
              </thead>
              <tbody>
                {watch.map((r) => (
                  <tr key={`${r.kind}:${r.category}`}>
                    <td className="ds-num">{r.code || (r.kind === 'income' ? '—' : '')}</td>
                    <td>{r.kind === 'income' ? `Sales · ${r.category}` : r.category}</td>
                    <td className="num"><Amount minor={r.monthMinor} label={`${r.category} this month`} onClick={() => drill(r, 'month')} /></td>
                    <td className="num"><Amount minor={r.ytdMinor} label={`${r.category} year to date`} onClick={() => drill(r, 'year')} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FinancePanel>

        <FinancePanel title="Recent payments" description="Latest paid bills and posted expenses">
          {state.payments.length ? (
            <ul className="flex flex-col divide-y divide-border">
              {state.payments.map((p) => (
                <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title || p.description || 'Expense'}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.expense_categories?.code ? `${p.expense_categories.code} · ` : ''}{p.expense_categories?.name || 'No account'} · {branchLabel(p.branch)} · {String(p.updated_at).slice(0, 10)}
                    </span>
                  </span>
                  <span className="ds-num shrink-0">{formatAccounting(p.total_minor)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No paid bills yet.</p>
          )}
        </FinancePanel>
      </div>
    </div>
  )
}

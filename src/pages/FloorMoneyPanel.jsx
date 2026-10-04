/** Floor Board › Money (SA / ASA with finance view): net sales today vs yesterday by branch, MTD net profit,
 * daily sheets waiting and drawer over/short alerts. Quiet "all good" when nothing needs the owner. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { collectPaged } from '@/lib/crmInsights'
import { scopeBranch, pctChange } from '@/lib/financeData'
import { floorMoney, formatAccounting, manilaHour } from '@/lib/dailySheet'
import { listSheets, loadDaySales, previousDay } from '@/lib/dailySheetApi'

const LIGHT_SALE = 'id, branch, status, total_minor, discount_minor, payment_method, occurred_at'

function Delta({ today, prior }) {
  if (!prior) return <span className="text-xs text-muted-foreground">{today ? 'No sales yesterday by now' : '—'}</span>
  const pct = pctChange(today, prior)
  const up = pct >= 0
  return (
    <span className={`text-xs font-medium tabular-nums ${up ? 'text-emerald-700' : 'text-rose-700'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs yesterday
    </span>
  )
}

export default function FloorMoneyPanel({ profile, branchFilter = 'all', branchName = (slug) => slug, refreshKey }) {
  const [state, setState] = useState({ loading: true, error: '', money: null, sheetsError: '' })

  const load = useCallback(async () => {
    const today = getLocalCalendarDate()
    const yesterday = previousDay(today)
    const nowHour = manilaHour(new Date().toISOString())
    const weekAgo = new Date(`${today}T00:00:00Z`)
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 6)
    try {
      const [todaySales, yesterdaySales, plRows, sheetRes] = await Promise.all([
        loadDaySales(branchFilter, today, { select: LIGHT_SALE }),
        loadDaySales(branchFilter, yesterday, { select: LIGHT_SALE }),
        collectPaged(async (from, to) => {
          const q = scopeBranch(
            supabase.from('finance_daily_pl').select('kind, amount_minor').gte('period_date', `${today.slice(0, 7)}-01`).lte('period_date', today),
            profile,
            branchFilter,
          )
          const { data, error } = await q.range(from, to)
          if (error) throw error
          return data || []
        }, 1000),
        listSheets({ branch: branchFilter, from: weekAgo.toISOString().slice(0, 10), limit: 100 }).then(
          (rows) => ({ rows }),
          (err) => ({ rows: [], error: err.message }),
        ),
      ])
      setState({
        loading: false,
        error: '',
        sheetsError: sheetRes.error ? 'Daily sheets are not available yet (database update pending).' : '',
        money: floorMoney({ todaySales, yesterdaySales, nowHour, plRows, sheets: sheetRes.rows }),
      })
    } catch (err) {
      setState({ loading: false, error: err.message || 'Could not load money', money: null, sheetsError: '' })
    }
  }, [profile, branchFilter])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  if (state.loading && !state.money) {
    return <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground" role="status">Loading money…</p>
  }
  if (state.error) {
    return (
      <p className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900" role="alert">
        {state.error}. Tap Refresh above, or open Finance.
      </p>
    )
  }
  const m = state.money
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" data-testid="floor-money">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net sales today</p>
          <p className="text-2xl font-semibold tabular-nums">{formatAccounting(m.todayMinor)}</p>
          <Delta today={m.todayMinor} prior={m.yesterdayMinor} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Net profit this month</p>
          <p className={`text-2xl font-semibold tabular-nums ${m.mtdNetMinor < 0 ? 'text-rose-700' : ''}`}>{formatAccounting(m.mtdNetMinor)}</p>
          <Link to="/operations/finance?tab=pl&period=month" className="ds-link inline-flex min-h-11 items-center text-xs">Open Profit and loss</Link>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily sheets</p>
          {m.allGood ? (
            <p className="mt-1 text-sm text-muted-foreground">All good — nothing waiting, drawers balanced.</p>
          ) : (
            <div className="mt-1 flex flex-col gap-1 text-sm">
              {m.waiting ? (
                <Link to="/operations/finance?tab=sheets" className="ds-link inline-flex min-h-11 items-center font-medium">
                  {m.waiting} waiting for approval
                </Link>
              ) : null}
              {m.alerts.slice(0, 3).map((a) => (
                <Link key={a.id} to={`/operations/finance?tab=sheets&status=all&os=1&sheet=${a.id}`} className="inline-flex min-h-11 items-center text-rose-800 underline-offset-2 hover:underline">
                  {branchName(a.branch)} · {a.date}: drawer {a.overShortMinor > 0 ? 'over' : 'short'} {formatAccounting(Math.abs(a.overShortMinor))}
                </Link>
              ))}
            </div>
          )}
          {state.sheetsError ? <p className="text-xs text-muted-foreground">{state.sheetsError}</p> : null}
        </div>
      </div>
      {m.byBranch.length > 1 ? (
        <div className="overflow-x-auto">
          <table className="xero-table min-w-[420px]">
            <thead>
              <tr>
                <th>Branch</th>
                <th className="num">Today</th>
                <th className="num">Yesterday by now</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {m.byBranch.map((b) => (
                <tr key={b.branch}>
                  <td>{branchName(b.branch)}</td>
                  <td className="num">{formatAccounting(b.todayMinor)}</td>
                  <td className="num">{formatAccounting(b.yesterdayMinor)}</td>
                  <td className="num">
                    <Delta today={b.todayMinor} prior={b.yesterdayMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

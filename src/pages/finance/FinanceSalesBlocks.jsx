/** Square-style sales pieces shared by the Finance Dashboard and Reports tabs. */
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Minus } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatMoney } from '@/queue/queueApi'
import { salesPeriodLabel } from '@/lib/salesSummary'
import { FinanceEmpty } from './FinanceChrome'

const SALES_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
]

/** Arrow + percent vs the prior period. Direction is spoken, not only colored. */
export function DeltaChip({ pct }) {
  if (pct == null) {
    return (
      <span className="finance-delta" data-tone="na">
        N/A<span className="sr-only"> (no prior sales to compare)</span>
      </span>
    )
  }
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const Icon = tone === 'up' ? ArrowUp : tone === 'down' ? ArrowDown : Minus
  const word = tone === 'up' ? 'Up' : tone === 'down' ? 'Down' : 'No change'
  return (
    <span className="finance-delta" data-tone={tone}>
      <span className="sr-only">{word} </span>
      <Icon aria-hidden />
      {Math.abs(pct)}%<span className="sr-only"> vs prior period</span>
    </span>
  )
}

export function SalesPeriodTabs({ value, onChange }) {
  return (
    <div className="finance-period-tabs" role="group" aria-label="Sales period">
      {SALES_PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={value === p.value}
          onClick={() => onChange?.(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

/** "This year, 2026 · All branches, vs Jan 1 to Sep 28, 2025". */
export function SalesWindowLine({ salesWindow, branchName }) {
  if (!salesWindow?.range) return null
  const period = salesPeriodLabel(salesWindow.preset, salesWindow.range)
  const scope = branchName ? ` · ${branchName}` : ''
  const vs = salesWindow.compare?.label ? `, ${salesWindow.compare.label}` : ''
  return (
    <p className="finance-window-line" data-testid="finance-sales-window">
      {period}
      {scope}
      {vs}
    </p>
  )
}

export function SalesPeriodBar({ period, onPeriodChange, salesWindow, branchName }) {
  return (
    <div className="finance-sales-bar">
      <SalesPeriodTabs value={period} onChange={onPeriodChange} />
      <SalesWindowLine salesWindow={salesWindow} branchName={branchName} />
    </div>
  )
}

const LOCATION_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'netMinor', label: 'Net sales', numeric: true },
  { key: 'count', label: 'Transactions', numeric: true },
  { key: 'laborPct', label: 'Labor %', numeric: true },
]

/** Square "Locations": per-branch net, transactions, labor % with change chips. */
export function SalesLocationsTable({ rows, branchOptions = [] }) {
  const [sort, setSort] = useState({ key: 'netMinor', dir: 'desc' })
  const named = useMemo(
    () => rows.map((r) => ({ ...r, name: branchOptions.find((b) => b.slug === r.branch)?.name || r.branch })),
    [rows, branchOptions],
  )
  const sorted = useMemo(() => {
    const out = [...named].sort((a, b) => {
      const av = a[sort.key] ?? -Infinity
      const bv = b[sort.key] ?? -Infinity
      if (typeof av === 'string') return av.localeCompare(bv)
      return av - bv
    })
    return sort.dir === 'desc' ? out.reverse() : out
  }, [named, sort])

  if (!rows.length) {
    return <FinanceEmpty title="No sales in this window" body="Paid POS tickets show here per branch." />
  }

  function toggle(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }))
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            {LOCATION_COLUMNS.map((col) => {
              const active = sort.key === col.key
              return (
                <TableHead
                  key={col.key}
                  className={col.numeric ? 'text-right' : ''}
                  aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                >
                  <button type="button" className="finance-sort-btn" onClick={() => toggle(col.key)}>
                    {col.label}
                    {active ? (
                      sort.dir === 'desc' ? <ArrowDown aria-hidden /> : <ArrowUp aria-hidden />
                    ) : (
                      <ArrowUpDown aria-hidden />
                    )}
                  </button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((r) => (
            <TableRow key={r.branch}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="finance-cell-stack">
                  {formatMoney(r.netMinor)}
                  <DeltaChip pct={r.netPct} />
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <span className="finance-cell-stack">
                  {r.count.toLocaleString('en-PH')}
                  <DeltaChip pct={r.countPct} />
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.laborPct == null ? 'N/A' : `${r.laborPct}%`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

/** Square "Sales by payment types": total collected, per-method share, net total. */
export function PaymentTypesList({ types, collectedMinor }) {
  if (!(collectedMinor > 0)) {
    return <FinanceEmpty title="No payments collected" body="Paid POS tickets split into Cash, GCash, and Card here." />
  }
  return (
    <dl className="finance-paytypes">
      <div className="finance-paytypes-row" data-total>
        <dt>Total collected</dt>
        <dd className="tabular-nums">{formatMoney(collectedMinor)}</dd>
      </div>
      {types.map((t) => (
        <div key={t.id} className="finance-paytypes-row">
          <dt>
            {t.label}
            <span className="finance-paytypes-share tabular-nums">{t.share}%</span>
          </dt>
          <dd className="tabular-nums">{formatMoney(t.minor)}</dd>
          <div className="finance-share-track" aria-hidden>
            <div className="finance-share-fill" data-method={t.id} style={{ width: `${t.share}%` }} />
          </div>
        </div>
      ))}
      <div className="finance-paytypes-row" data-total>
        <dt>Net total</dt>
        <dd className="tabular-nums">{formatMoney(collectedMinor)}</dd>
      </div>
    </dl>
  )
}

/** Square "Top items": item, sold count, gross. */
export function TopItemsTable({ items }) {
  if (!items.length) {
    return <FinanceEmpty title="No items sold" body="Paid sale lines in this window rank here by gross." />
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Count</TableHead>
            <TableHead className="text-right">Gross</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, i) => (
            <TableRow key={`${item.name}-${i}`}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="text-right tabular-nums">{item.count.toLocaleString('en-PH')}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(item.grossMinor)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

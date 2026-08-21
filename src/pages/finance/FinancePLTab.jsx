/** Finance Profit & Loss: one statement, branch/period filters on the toolbar. */
import { useMemo } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/queue/queueApi'
import {
  COMPARE_PRESETS,
  rollupPl,
  mergePlByCategory,
  downloadCsv,
  downloadExcel,
  printAsPdf,
} from '@/lib/financeData'

export default function FinancePLTab({
  plRows,
  priorPlRows = [],
  range,
  compareRange,
  comparePreset = 'none',
  onCompareChange,
  loading,
}) {
  const pl = useMemo(() => rollupPl(plRows), [plRows])
  const prior = useMemo(() => rollupPl(priorPlRows), [priorPlRows])
  const comparing = Boolean(compareRange)
  const merged = useMemo(() => mergePlByCategory(plRows, comparing ? priorPlRows : []), [plRows, priorPlRows, comparing])
  const incomeRows = merged.filter((r) => r.kind === 'income')
  const expenseRows = merged.filter((r) => r.kind === 'expense')

  const exportRows = useMemo(() => {
    const rows = [
      ...incomeRows.map((r) => ({
        section: 'Trading income',
        kind: 'income',
        category: r.category,
        amount: formatMoney(r.current),
        compare: comparing ? formatMoney(r.prior) : '',
        change: comparing ? `${r.deltaPct}%` : '',
      })),
      {
        section: 'Trading income',
        kind: 'income',
        category: 'Total trading income',
        amount: formatMoney(pl.income),
        compare: comparing ? formatMoney(prior.income) : '',
        change: '',
      },
      ...expenseRows.map((r) => ({
        section: 'Operating expenses',
        kind: 'expense',
        category: r.category,
        amount: formatMoney(r.current),
        compare: comparing ? formatMoney(r.prior) : '',
        change: comparing ? `${r.deltaPct}%` : '',
      })),
      {
        section: 'Operating expenses',
        kind: 'expense',
        category: 'Total operating expenses',
        amount: formatMoney(pl.expenses),
        compare: comparing ? formatMoney(prior.expenses) : '',
        change: '',
      },
      {
        section: 'Bottom line',
        kind: 'net',
        category: pl.net >= 0 ? 'Net profit' : 'Net loss',
        amount: formatMoney(pl.net),
        compare: comparing ? formatMoney(prior.net) : '',
        change: '',
      },
    ]
    return rows
  }, [incomeRows, expenseRows, pl, prior, comparing])

  const exportColumns = comparing
    ? [
        { key: 'section', label: 'Section' },
        { key: 'kind', label: 'Kind' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'This period' },
        { key: 'compare', label: 'Compare' },
        { key: 'change', label: 'Change' },
      ]
    : [
        { key: 'section', label: 'Section' },
        { key: 'kind', label: 'Kind' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount' },
      ]

  const subtitle = comparing
    ? `${range.start} to ${range.end} vs ${compareRange.start} to ${compareRange.end}`
    : `${range.start} to ${range.end}`
  const fileBase = `hakum-profit-and-loss-${range.start}-to-${range.end}`
  const colSpan = comparing ? 4 : 2

  if (loading) return <PLSkeleton />

  return (
    <div className="finance-pl-layout">
      <aside className="finance-pl-aside">
        <p className="finance-pl-aside-title">How to read this</p>
        <p className="finance-pl-aside-hint">
          Filter by branch and period at the top. Income comes from POS paid sales; expenses from paid or posted bills.
        </p>
      </aside>

      <div className="finance-pl-main">
        <div className="finance-pl-toolbar">
          <div>
            <p className="finance-pl-period">{subtitle}</p>
            <p className="finance-pl-org">Hakum Auto Care</p>
          </div>
          <div className="finance-pl-toolbar-actions">
            <div className="finance-filter-group">
              <Label htmlFor="pl-compare">Compare with</Label>
              <select
                id="pl-compare"
                className="finance-toolbar-select"
                value={comparePreset}
                onChange={(e) => onCompareChange?.(e.target.value)}
              >
                {COMPARE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <Button variant="outline" onClick={() => downloadCsv(exportRows, exportColumns, `${fileBase}.csv`)}>
              <Download className="size-3.5" /> CSV
            </Button>
            <Button variant="outline" onClick={() => downloadExcel(exportRows, exportColumns, `${fileBase}.xls`, 'Hakum Profit and Loss')}>
              <FileSpreadsheet className="size-3.5" /> Excel
            </Button>
            <Button variant="outline" onClick={() => printAsPdf(exportRows, exportColumns, 'Hakum Profit and Loss', subtitle)}>
              <FileText className="size-3.5" /> PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profit and Loss</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="finance-pl-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="text-right">This period</th>
                  {comparing ? <th className="text-right">Compare</th> : null}
                  {comparing ? <th className="text-right">Change</th> : null}
                </tr>
              </thead>
              <tbody>
                <tr className="finance-pl-section">
                  <th colSpan={colSpan}>Trading income</th>
                </tr>
                {incomeRows.length === 0 ? (
                  <tr>
                    <td>No income in this window.</td>
                    <td className="text-right">—</td>
                    {comparing ? <td className="text-right">—</td> : null}
                    {comparing ? <td className="text-right">—</td> : null}
                  </tr>
                ) : (
                  incomeRows.map((r) => (
                    <tr key={`inc-${r.category}`}>
                      <td>{r.category}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.current)}</td>
                      {comparing ? <td className="text-right tabular-nums">{formatMoney(r.prior)}</td> : null}
                      {comparing ? <td className="text-right tabular-nums">{formatDelta(r.delta, r.deltaPct)}</td> : null}
                    </tr>
                  ))
                )}
                <tr className="finance-pl-subtotal">
                  <td>Total trading income</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.income)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.income)}</td> : null}
                  {comparing ? <td className="text-right tabular-nums">{formatDelta(pl.income - prior.income)}</td> : null}
                </tr>
                <tr className="finance-pl-section">
                  <th colSpan={colSpan}>Operating expenses</th>
                </tr>
                {expenseRows.length === 0 ? (
                  <tr>
                    <td>No expenses in this window.</td>
                    <td className="text-right">—</td>
                    {comparing ? <td className="text-right">—</td> : null}
                    {comparing ? <td className="text-right">—</td> : null}
                  </tr>
                ) : (
                  expenseRows.map((r) => (
                    <tr key={`exp-${r.category}`}>
                      <td>{r.category}</td>
                      <td className="text-right tabular-nums">{formatMoney(r.current)}</td>
                      {comparing ? <td className="text-right tabular-nums">{formatMoney(r.prior)}</td> : null}
                      {comparing ? <td className="text-right tabular-nums">{formatDelta(r.delta, r.deltaPct)}</td> : null}
                    </tr>
                  ))
                )}
                <tr className="finance-pl-subtotal">
                  <td>Total operating expenses</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.expenses)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.expenses)}</td> : null}
                  {comparing ? <td className="text-right tabular-nums">{formatDelta(pl.expenses - prior.expenses)}</td> : null}
                </tr>
                <tr className={`finance-pl-net ${pl.net >= 0 ? 'is-positive' : 'is-negative'}`}>
                  <td>{pl.net >= 0 ? 'Net profit' : 'Net loss'}</td>
                  <td className="text-right tabular-nums">{formatMoney(pl.net)}</td>
                  {comparing ? <td className="text-right tabular-nums">{formatMoney(prior.net)}</td> : null}
                  {comparing ? <td className="text-right tabular-nums">{formatDelta(pl.net - prior.net)}</td> : null}
                </tr>
                <tr className="finance-pl-margin">
                  <td>Net margin</td>
                  <td className="text-right tabular-nums">
                    <Badge variant={pl.margin >= 0 ? 'default' : 'destructive'}>{pl.margin}%</Badge>
                  </td>
                  {comparing ? (
                    <td className="text-right tabular-nums">
                      <Badge variant="secondary">{prior.margin}%</Badge>
                    </td>
                  ) : null}
                  {comparing ? <td /> : null}
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatDelta(deltaMinor, pct) {
  const sign = deltaMinor > 0 ? '+' : ''
  const money = `${sign}${formatMoney(deltaMinor)}`
  return pct == null ? money : `${money} (${sign}${pct}%)`
}

function PLSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="finance-skeleton-line h-10" />
        ))}
      </CardContent>
    </Card>
  )
}

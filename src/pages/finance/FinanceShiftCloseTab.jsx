/** Old shift closes — read-only history from before Daily Sheets (review RPCs are revoked). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { shiftCloseDiffRows } from '@/lib/shiftClose'
import { shiftClosePayrollCoverage } from '@/lib/payroll'
import { toast } from 'sonner'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
} from './FinanceChrome'

function statusVariant(status) {
  if (status === 'accepted' || status === 'locked') return 'default'
  if (status === 'rejected') return 'destructive'
  if (status === 'submitted') return 'secondary'
  return 'outline'
}

export default function FinanceShiftCloseTab({ range, branchFilter }) {
  const [rows, setRows] = useState([])
  const [payrollRuns, setPayrollRuns] = useState([])
  const [fieldConfig, setFieldConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('shift_close_reports')
        .select('id, branch, business_date, status, shift_ended_at, pos_baseline, submitted, override_reasons, review_note, submitted_at, reviewed_at')
        .gte('business_date', range.start)
        .lte('business_date', range.end)
        .order('business_date', { ascending: false })
      if (branchFilter && branchFilter !== 'all') q = q.eq('branch', branchFilter)
      let runsQ = supabase
        .from('payroll_runs')
        .select('id, branch, period_start, period_end, status, notes, run_kind, pos_sales_minor')
        .in('status', ['confirmed', 'paid'])
        .lte('period_start', range.end)
        .gte('period_end', range.start)
        .limit(120)
      const [reports, fields, runs] = await Promise.all([
        q,
        supabase.from('shift_close_field_config').select('*').order('sort_order'),
        runsQ,
      ])
      if (reports.error) throw reports.error
      if (fields.error) throw fields.error
      setRows(reports.data || [])
      setFieldConfig(fields.data || [])
      if (runs.error && /run_kind/i.test(runs.error.message || '')) {
        const retry = await supabase
          .from('payroll_runs')
          .select('id, branch, period_start, period_end, status, notes, pos_sales_minor')
          .in('status', ['confirmed', 'paid'])
          .lte('period_start', range.end)
          .gte('period_end', range.start)
          .limit(120)
        setPayrollRuns(retry.data || [])
      } else if (!runs.error) {
        setPayrollRuns(runs.data || [])
      } else {
        setPayrollRuns([])
      }
    } catch (err) {
      toast.error(err.message || 'Unable to load shift closes')
    } finally {
      setLoading(false)
    }
  }, [range.start, range.end, branchFilter])

  useEffect(() => {
    load()
  }, [load])

  const selected = rows.find((r) => r.id === selectedId) || null
  const selectedCoverage = useMemo(
    () => (selected ? shiftClosePayrollCoverage(selected, payrollRuns) : null),
    [selected, payrollRuns],
  )
  const diffs = selected
    ? shiftCloseDiffRows(selected.pos_baseline, selected.submitted, fieldConfig)
    : []

  const statusCounts = useMemo(() => {
    const counts = { total: rows.length, submitted: 0, accepted: 0, rejected: 0, locked: 0 }
    for (const r of rows) {
      if (r.status === 'submitted') counts.submitted += 1
      else if (r.status === 'accepted') counts.accepted += 1
      else if (r.status === 'rejected') counts.rejected += 1
      else if (r.status === 'locked') counts.locked += 1
    }
    return counts
  }, [rows])

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Shift close totals">
        <FinanceMetricCell label="In window" value={String(statusCounts.total)} hint={`${range.start} → ${range.end}`} tone="ink" />
        <FinanceMetricCell label="Submitted" value={String(statusCounts.submitted)} hint="Needs review" tone="muted" />
        <FinanceMetricCell label="Accepted" value={String(statusCounts.accepted)} tone="up" />
        <FinanceMetricCell label="Rejected" value={String(statusCounts.rejected)} tone="down" />
        <FinanceMetricCell label="Locked" value={String(statusCounts.locked)} hint="Day sealed" tone="ink" />
      </FinanceMetricStrip>

      <FinancePanel
        title="Old shift closes"
        description="Read-only history from before Daily Sheets. New days are closed and approved in Daily sheets."
        actions={
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/operations/finance?tab=sheets">Open Daily sheets</Link>
          </Button>
        }
      >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <FinanceEmpty
              title="No old shift closes in this range"
              body="End of shift was replaced by the Daily Sheet. Pick an earlier range to see past closes."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Shift ended</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Floor coverage</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const coverage = shiftClosePayrollCoverage(row, payrollRuns)
                  return (
                    <TableRow key={row.id} data-state={selectedId === row.id ? 'selected' : undefined}>
                      <TableCell className="tabular-nums">{row.business_date}</TableCell>
                      <TableCell>{row.branch}</TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {row.shift_ended_at
                          ? new Date(row.shift_ended_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={coverage.covered ? 'default' : 'outline'}>{coverage.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-10 cursor-pointer"
                          onClick={() => setSelectedId(row.id)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
      </FinancePanel>

      {selected ? (
        <FinancePanel
          title={`${selected.branch} · ${selected.business_date}`}
          description={`${selectedCoverage ? `${selectedCoverage.label} · ` : ''}Status ${selected.status}${
            selected.shift_ended_at ? ` · Shift ended ${new Date(selected.shift_ended_at).toLocaleString()}` : ''
          }${selected.review_note ? ` · Note: ${selected.review_note}` : ''}`}
        >
            <div className="flex flex-col gap-4">
            {diffs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Submitted matches POS baseline — no overrides.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>POS baseline</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Delta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffs.map((d) => (
                    <TableRow key={d.key}>
                      <TableCell>
                        {d.label}
                        {selected.override_reasons?.[d.key] ? (
                          <p className="text-xs text-muted-foreground">{selected.override_reasons[d.key]}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatMoney(d.baseline_minor)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(d.submitted_minor)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(d.delta_minor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!selectedCoverage?.covered && selected.status === 'accepted' ? (
              <p className="text-sm text-muted-foreground">
                No floor payroll run claimed this day. Crew pay now goes through{' '}
                <Link className="underline" to="/operations/finance?tab=sheets">
                  Daily sheets
                </Link>
              </p>
            ) : null}

            </div>
        </FinancePanel>
      ) : null}
    </div>
  )
}

/** SA / ASA finance_view: review BA end-of-shift closes vs POS baseline. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import {
  canReviewShiftClose,
  shiftCloseDiffRows,
} from '@/lib/shiftClose'
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

export default function FinanceShiftCloseTab({ profile, range, branchFilter, canWrite }) {
  const canReview = canReviewShiftClose(profile)
  const [rows, setRows] = useState([])
  const [payrollRuns, setPayrollRuns] = useState([])
  const [fieldConfig, setFieldConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function review(action) {
    if (!canReview || !selected) return
    if (action === 'reject' && String(reviewNote).trim().length < 3) {
      toast.error('Reject needs a review note')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('review_shift_close', {
      payload: {
        id: selected.id,
        action,
        review_note: reviewNote.trim() || null,
      },
    })
    setBusy(false)
    if (error) toast.error(error.message)
    else {
      toast.success(`Shift close ${data?.status || action}`)
      setReviewNote('')
      if (action === 'accept' && selected) {
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData?.session?.access_token
          if (token) {
            await fetch('/api/notify-shift-close', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                branch: selected.branch,
                business_date: selected.business_date,
                close_id: selected.id,
              }),
            })
          }
        } catch {
          /* inbox already written by RPC; push is best-effort */
        }
      }
      load()
    }
  }

  async function toggleOverride(fieldKey, allow) {
    if (!canWrite || profile?.role !== 'BossMich') return
    const { error } = await supabase
      .from('shift_close_field_config')
      .update({ allow_override: allow })
      .eq('field_key', fieldKey)
    if (error) toast.error(error.message)
    else {
      toast.success('Field updated')
      load()
    }
  }

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
        title="Shift reviews"
        description="POS baseline vs Branch Admin submission. Accept unlocks Pending floor pay — it does not rewrite POS sales. P&L income stays on paid tickets."
      >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <FinanceEmpty
              title="No shift closes in this range"
              body="Branch Admin, Super Admin, or ASA submit from POS → End of shift (with editable close time)."
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
                          Review
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
                No floor payroll run claimed this day yet.{' '}
                <Link className="underline" to="/operations/payroll">
                  Open Payroll dashboard
                </Link>
              </p>
            ) : null}

            {canReview && selected.status === 'submitted' ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shift-review-note">Review note (required to reject)</Label>
                  <Input
                    id="shift-review-note"
                    className="min-h-10"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Reason for reject, or optional accept note"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="min-h-10 cursor-pointer" disabled={busy} onClick={() => review('accept')}>
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-10 cursor-pointer"
                    disabled={busy}
                    onClick={() => review('reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}

            {canReview && selected.status === 'accepted' ? (
              <Button type="button" variant="secondary" className="min-h-10 cursor-pointer" disabled={busy} onClick={() => review('lock')}>
                Lock day
              </Button>
            ) : null}

            {selected.status === 'locked' ? (
              <p className="text-sm text-muted-foreground">This day is locked. Resubmit is blocked until unlocked by policy.</p>
            ) : null}
            </div>
        </FinancePanel>
      ) : null}

      {profile?.role === 'BossMich' ? (
        <FinancePanel title="Field customization" description="Which money fields Branch Admins may override on End of shift.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Allow override</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fieldConfig.map((f) => (
                  <TableRow key={f.field_key}>
                    <TableCell>{f.label}</TableCell>
                    <TableCell>
                      <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={f.allow_override !== false}
                          disabled={!canWrite}
                          onChange={(e) => toggleOverride(f.field_key, e.target.checked)}
                        />
                        Override allowed
                      </label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </FinancePanel>
      ) : null}
    </div>
  )
}

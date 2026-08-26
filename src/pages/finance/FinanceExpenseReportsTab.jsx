/** ASA expense report composer + SA approve — dashboard chrome. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { NamedSelect } from '@/components/ui/named-select'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { isSuperAdmin } from '@/auth/permissions'
import { toast } from 'sonner'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
} from './FinanceChrome'

export default function FinanceExpenseReportsTab({
  profile,
  categories = [],
  writableBranches = [],
  canWrite,
  onReload,
  branchFilter = 'all',
  range = null,
}) {
  const [reports, setReports] = useState([])
  const [form, setForm] = useState({
    branch: '',
    period_start: '',
    period_end: '',
    title: '',
    category_id: '',
    amountPesos: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [reviewNote, setReviewNote] = useState('')

  const load = useCallback(async () => {
    let q = supabase
      .from('expense_reports')
      .select('id, branch, period_start, period_end, status, title, review_note, expense_report_lines(id, category_id, amount_minor, notes, expense_id)')
      .order('created_at', { ascending: false })
      .limit(40)
    if (branchFilter && branchFilter !== 'all') q = q.eq('branch', branchFilter)
    if (range?.start) q = q.gte('period_end', range.start)
    if (range?.end) q = q.lte('period_start', range.end)
    const { data, error } = await q
    if (error) toast.error(error.message)
    else setReports(data || [])
  }, [branchFilter, range?.start, range?.end])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (branchFilter && branchFilter !== 'all') {
      setForm((f) => ({ ...f, branch: branchFilter }))
      return
    }
    if (!form.branch && writableBranches[0]?.slug) {
      setForm((f) => ({ ...f, branch: writableBranches[0].slug }))
    }
  }, [writableBranches, branchFilter, form.branch])

  const metrics = useMemo(() => {
    const draft = reports.filter((r) => r.status === 'draft' || r.status === 'rejected').length
    const submitted = reports.filter((r) => r.status === 'submitted').length
    const approved = reports.filter((r) => r.status === 'approved').length
    const totalMinor = reports.reduce(
      (s, r) => s + (r.expense_report_lines || []).reduce((a, l) => a + (Number(l.amount_minor) || 0), 0),
      0,
    )
    return { draft, submitted, approved, totalMinor, count: reports.length }
  }, [reports])

  async function createAndAddLine(e) {
    e.preventDefault()
    if (!canWrite) return toast.error('Finance write required')
    const amount_minor = Math.round(Number(form.amountPesos) * 100)
    if (!form.branch || !form.period_start || !form.period_end || !form.category_id || !(amount_minor > 0)) {
      toast.error('Branch, period, category, and amount are required')
      return
    }
    if (form.period_end < form.period_start) {
      toast.error('Period end must be on or after start')
      return
    }
    setBusy(true)
    const { data: report, error } = await supabase
      .from('expense_reports')
      .insert({
        branch: form.branch,
        period_start: form.period_start,
        period_end: form.period_end,
        title: form.title.trim() || null,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) {
      setBusy(false)
      toast.error(error.message)
      return
    }
    const { error: lineErr } = await supabase.from('expense_report_lines').insert({
      report_id: report.id,
      category_id: form.category_id,
      amount_minor,
      notes: form.notes.trim() || null,
    })
    setBusy(false)
    if (lineErr) toast.error(lineErr.message)
    else {
      toast.success('Draft expense report created')
      setForm((f) => ({ ...f, amountPesos: '', notes: '', title: '' }))
      load()
    }
  }

  async function submit(id) {
    setBusy(true)
    const { error } = await supabase.rpc('submit_expense_report', { payload: { id } })
    setBusy(false)
    if (error) toast.error(error.message)
    else {
      toast.success('Report submitted — expenses pending approval')
      load()
      onReload?.()
    }
  }

  async function review(id, action) {
    if (action === 'reject' && String(reviewNote).trim().length < 3) {
      toast.error('Reject needs a note')
      return
    }
    setBusy(true)
    const { error } = await supabase.rpc('review_expense_report', {
      payload: { id, action, review_note: reviewNote.trim() || null },
    })
    setBusy(false)
    if (error) toast.error(error.message)
    else {
      toast.success(
        action === 'approve'
          ? 'Approved — expenses pending payment'
          : action === 'approve_paid'
            ? 'Approved and marked paid'
            : action === 'mark_paid'
              ? 'Expenses marked paid'
              : `Report ${action}d`,
      )
      setReviewNote('')
      load()
      onReload?.()
    }
  }

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Expense report totals">
        <FinanceMetricCell label="Reports" value={String(metrics.count)} hint="In filter scope" tone="ink" />
        <FinanceMetricCell label="Draft / rejected" value={String(metrics.draft)} tone="muted" />
        <FinanceMetricCell label="Submitted" value={String(metrics.submitted)} hint="Awaiting SA" tone="muted" />
        <FinanceMetricCell label="Approved" value={String(metrics.approved)} hint="Pending payment" tone="up" />
        <FinanceMetricCell label="Line total" value={formatMoney(metrics.totalMinor)} hint="All open reports" tone="ink" />
      </FinanceMetricStrip>

      {canWrite ? (
        <FinancePanel
          title="Compose expense report"
          description="ASA category lines. Submit creates pending_approval expenses. SA approves to pending payment; mark paid when cash leaves."
        >
          <form onSubmit={createAndAddLine} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Branch</Label>
              <NamedSelect
                value={form.branch}
                onChange={(branch) => setForm((f) => ({ ...f, branch }))}
                options={writableBranches.map((b) => ({ value: b.slug, label: b.name || b.slug }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Title</Label>
              <Input
                className="min-h-10"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="August utilities"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Period start</Label>
              <Input
                type="date"
                required
                className="min-h-10"
                value={form.period_start}
                onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Period end</Label>
              <Input
                type="date"
                required
                className="min-h-10"
                value={form.period_end}
                onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <NamedSelect
                value={form.category_id}
                onChange={(category_id) => setForm((f) => ({ ...f, category_id }))}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Amount (pesos)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                required
                className="min-h-10"
                value={form.amountPesos}
                onChange={(e) => setForm((f) => ({ ...f, amountPesos: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label>Line notes</Label>
              <Input
                className="min-h-10"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button type="submit" className="min-h-11 cursor-pointer sm:col-span-2" disabled={busy}>
              Save draft + line
            </Button>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel
        title="Reports"
        description="Submit → pending approval. Approve → pending payment (not on P&L until paid). Mark paid when settled."
      >
        {isSuperAdmin(profile) ? (
          <div className="mb-4 flex flex-col gap-1.5">
            <Label>Review note (required to reject)</Label>
            <Input className="min-h-10" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
          </div>
        ) : null}
        {!reports.length ? (
          <FinanceEmpty
            title="No expense reports yet"
            body={canWrite ? 'Compose a draft above for the selected branch and period.' : 'No reports in this filter scope.'}
          />
        ) : (
          <ul className="finance-cue-list">
            {reports.map((r) => {
              const total = (r.expense_report_lines || []).reduce((s, l) => s + (Number(l.amount_minor) || 0), 0)
              return (
                <li key={r.id} className="!border-b border-border !py-4" data-tone="info">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.title || `${r.branch} · ${r.period_start}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {r.branch} · {r.period_start} to {r.period_end} · {formatMoney(total)}
                      </p>
                      {r.review_note ? (
                        <p className="mt-1 text-xs text-muted-foreground">Note: {r.review_note}</p>
                      ) : null}
                    </div>
                    <Badge>{r.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {canWrite && (r.status === 'draft' || r.status === 'rejected') ? (
                      <Button type="button" size="sm" className="min-h-10 cursor-pointer" disabled={busy} onClick={() => submit(r.id)}>
                        Submit
                      </Button>
                    ) : null}
                    {isSuperAdmin(profile) && r.status === 'submitted' ? (
                      <>
                        <Button type="button" size="sm" className="min-h-10 cursor-pointer" disabled={busy} onClick={() => review(r.id, 'approve')}>
                          Approve · pending payment
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="min-h-10 cursor-pointer"
                          disabled={busy}
                          onClick={() => review(r.id, 'approve_paid')}
                        >
                          Approve &amp; pay now
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="min-h-10 cursor-pointer"
                          disabled={busy}
                          onClick={() => review(r.id, 'reject')}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {isSuperAdmin(profile) && r.status === 'approved' ? (
                      <Button type="button" size="sm" className="min-h-10 cursor-pointer" disabled={busy} onClick={() => review(r.id, 'mark_paid')}>
                        Mark paid
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </FinancePanel>
    </div>
  )
}

/** ASA expense report composer + SA approve. */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { NamedSelect } from '@/components/ui/named-select'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { isSuperAdmin } from '@/auth/permissions'
import { toast } from 'sonner'

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
      toast.success(`Report ${action}d`)
      setReviewNote('')
      load()
      onReload?.()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Compose expense report</CardTitle>
            <CardDescription>
              ASA monthly/custom category lines. Submit posts pending expenses into Purchases / P&amp;L.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="August utilities" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Period start</Label>
                <Input type="date" required value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Period end</Label>
                <Input type="date" required value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} />
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
                <Input type="number" min="0" step="0.01" required value={form.amountPesos} onChange={(e) => setForm((f) => ({ ...f, amountPesos: e.target.value }))} />
              </div>
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Label>Line notes</Label>
                <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button type="submit" className="min-h-11 sm:col-span-2" disabled={busy}>
                Save draft + line
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>Submit posts to expenses; Super Admin approves to paid.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuperAdmin(profile) ? (
            <div className="flex flex-col gap-1.5">
              <Label>Review note (required to reject)</Label>
              <Input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </div>
          ) : null}
          {reports.map((r) => {
            const total = (r.expense_report_lines || []).reduce((s, l) => s + (Number(l.amount_minor) || 0), 0)
            return (
              <article key={r.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.title || `${r.branch} · ${r.period_start}`}</p>
                    <p className="text-sm text-muted-foreground">
                      {r.branch} · {r.period_start} to {r.period_end} · {formatMoney(total)}
                    </p>
                  </div>
                  <Badge>{r.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canWrite && (r.status === 'draft' || r.status === 'rejected') ? (
                    <Button type="button" size="sm" disabled={busy} onClick={() => submit(r.id)}>
                      Submit
                    </Button>
                  ) : null}
                  {isSuperAdmin(profile) && r.status === 'submitted' ? (
                    <>
                      <Button type="button" size="sm" disabled={busy} onClick={() => review(r.id, 'approve')}>
                        Approve
                      </Button>
                      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => review(r.id, 'reject')}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
          {!reports.length ? <p className="text-sm text-muted-foreground">No expense reports yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  )
}

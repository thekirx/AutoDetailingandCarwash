/** SA / ASA finance_view: review BA end-of-shift closes vs POS baseline. */
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { toast } from 'sonner'

function statusVariant(status) {
  if (status === 'accepted' || status === 'locked') return 'default'
  if (status === 'rejected') return 'destructive'
  if (status === 'submitted') return 'secondary'
  return 'outline'
}

export default function FinanceShiftCloseTab({ profile, range, branchFilter, canWrite }) {
  const canReview = canReviewShiftClose(profile)
  const [rows, setRows] = useState([])
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
        .select('id, branch, business_date, status, pos_baseline, submitted, override_reasons, review_note, submitted_at, reviewed_at')
        .gte('business_date', range.start)
        .lte('business_date', range.end)
        .order('business_date', { ascending: false })
      if (branchFilter && branchFilter !== 'all') q = q.eq('branch', branchFilter)
      const [reports, fields] = await Promise.all([
        q,
        supabase.from('shift_close_field_config').select('*').order('sort_order'),
      ])
      if (reports.error) throw reports.error
      if (fields.error) throw fields.error
      setRows(reports.data || [])
      setFieldConfig(fields.data || [])
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
  const diffs = selected
    ? shiftCloseDiffRows(selected.pos_baseline, selected.submitted, fieldConfig)
    : []

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
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Shift reviews</CardTitle>
          <CardDescription>
            POS baseline vs Branch Admin submission. Accept, reject, or lock — does not change POS sales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No shift closes in this range. Branch Admins submit from POS → End of shift.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-state={selectedId === row.id ? 'selected' : undefined}>
                    <TableCell>{row.business_date}</TableCell>
                    <TableCell>{row.branch}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {selected.branch} · {selected.business_date}
            </CardTitle>
            <CardDescription>
              Status {selected.status}
              {selected.review_note ? ` · Note: ${selected.review_note}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
                      <TableCell>{formatMoney(d.baseline_minor)}</TableCell>
                      <TableCell>{formatMoney(d.submitted_minor)}</TableCell>
                      <TableCell>{formatMoney(d.delta_minor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {canReview && selected.status === 'submitted' ? (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shift-review-note">Review note (required to reject)</Label>
                  <Input
                    id="shift-review-note"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Reason for reject, or optional accept note"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => review('accept')}>
                    Accept
                  </Button>
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => review('reject')}>
                    Reject
                  </Button>
                </div>
              </div>
            ) : null}

            {canReview && selected.status === 'accepted' ? (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => review('lock')}>
                Lock day
              </Button>
            ) : null}

            {selected.status === 'locked' ? (
              <p className="text-sm text-muted-foreground">This day is locked. Resubmit is blocked until unlocked by policy.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {profile?.role === 'BossMich' ? (
        <Card>
          <CardHeader>
            <CardTitle>Field customization</CardTitle>
            <CardDescription>Which money fields Branch Admins may override on End of shift.</CardDescription>
          </CardHeader>
          <CardContent>
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
                      <label className="inline-flex items-center gap-2 text-sm">
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

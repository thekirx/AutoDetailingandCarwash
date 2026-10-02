import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, CircleAlert, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NamedSelect } from '@/components/ui/named-select'
import { cn } from '@/lib/utils'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { parsePesosToMinor } from '@/lib/shiftClose'
import { notifyOpsEvent } from '@/lib/opsEventNotify'
import { ROLES } from '@/auth/permissions'
import {
  METHOD_LABELS,
  SHEET_STATUS_LABELS,
  computeSheetTotals,
  formatAccounting,
  mergeSalarySuggestions,
  salaryLineNeedsReason,
  sheetChecklist,
  summarizeSheetSales,
} from '@/lib/dailySheet'
import {
  loadDaySales,
  loadSheetById,
  loadSheetContext,
  receiptUrl,
  reopenSheet,
  reviewSheet,
  saveSheet,
  sheetErrorMessage,
  submitSheet,
  uploadReceipt,
} from '@/lib/dailySheetApi'

const toText = (minor) => (minor == null ? '' : String(Math.round(Number(minor)) / 100))
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

function hydrateLine(row) {
  return {
    id: row.id || newId(),
    kind: row.kind,
    staff_id: row.staff_id || '',
    staff_name: row.staff_name || row.staff_profiles?.full_name || '',
    role: row.role || row.staff_profiles?.role || '',
    account_id: row.account_id || '',
    account_label: row.expense_categories ? `${row.expense_categories.code || ''} ${row.expense_categories.name}`.trim() : '',
    description: row.description || '',
    suggested_minor: row.suggested_minor ?? null,
    amount_minor: Number(row.amount_minor) || 0,
    amountText: toText(row.amount_minor),
    reason: row.reason || '',
    receipt_path: row.receipt_path || null,
    parts: row.parts || null,
  }
}

/** Xero-style figure: right-aligned tabular, negatives in parentheses. */
export function Money({ minor, bold = false, className, tone }) {
  const n = Number(minor) || 0
  return (
    <span className={cn('ds-num', bold && 'font-semibold', n < 0 && 'ds-neg', tone === 'muted' && 'text-muted-foreground', className)}>
      {formatAccounting(n)}
    </span>
  )
}

export function SheetStatusChip({ status, className }) {
  const label = status ? SHEET_STATUS_LABELS[status] || status : 'Not started'
  return <span className={cn('ds-chip', `ds-chip--${status || 'none'}`, className)}>{label}</span>
}

function SectionHead({ step, title, hint, done }) {
  return (
    <div className="ds-section-head">
      <span className={cn('ds-step', done && 'ds-step--done')} aria-hidden>
        {done ? <Check className="size-4" /> : step}
      </span>
      <div className="min-w-0">
        <h3 className="ds-section-title">
          {title}
          {done ? <span className="sr-only"> — complete</span> : null}
        </h3>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

function Row({ label, children, bold, rule }) {
  return (
    <div className={cn('ds-row', rule && 'ds-row--rule', bold && 'font-semibold')}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

function SalesSection({ sales }) {
  const s = useMemo(() => summarizeSheetSales(sales), [sales])
  return (
    <section className="ds-card" aria-labelledby="ds-sales">
      <SectionHead step={1} title="Money in" hint="From today's paid POS tickets — fills in by itself." done />
      <div id="ds-sales" className="grid gap-6 md:grid-cols-2">
        <div>
          <Row label="Gross sales"><Money minor={s.grossMinor} /></Row>
          <Row label="Discounts"><Money minor={-s.discountsMinor} /></Row>
          <Row label="Refunds"><Money minor={-s.refundsMinor} /></Row>
          <Row label="Net sales" bold rule><Money minor={s.netMinor} bold /></Row>
          <Row label="Transactions"><span className="ds-num">{s.count}</span></Row>
          <Row label="Average sale"><Money minor={s.avgMinor} /></Row>
        </div>
        <div className="grid gap-4">
          <div>
            <p className="ds-mini-head">By payment</p>
            {Object.entries(s.byMethod).map(([id, minor]) => (
              <Row key={id} label={METHOD_LABELS[id]}><Money minor={minor} tone={minor ? undefined : 'muted'} /></Row>
            ))}
          </div>
          <div>
            <p className="ds-mini-head">By service</p>
            {s.byFamily.length ? (
              s.byFamily.map((f) => (
                <Row key={f.id} label={f.label}><Money minor={f.minor} /></Row>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No paid sales yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AmountInput({ id, value, onChange, disabled, label = 'Amount (₱)', invalid }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0.00"
        className="ds-input-num min-h-11"
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function ReceiptButton({ line, editable, onUpload }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  async function open() {
    try {
      const url = await receiptUrl(line.receipt_path)
      if (url) window.open(url, '_blank', 'noopener')
    } catch (err) {
      toast.error(sheetErrorMessage(err))
    }
  }
  if (!editable) {
    return line.receipt_path ? (
      <Button type="button" variant="link" className="min-h-11 px-0" onClick={open}>View receipt</Button>
    ) : null
  }
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Receipt photo"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            await onUpload(file)
          } finally {
            setBusy(false)
          }
        }}
      />
      <Button type="button" variant="outline" className="min-h-11 gap-2" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Camera aria-hidden className="size-4" />
        {busy ? 'Uploading…' : line.receipt_path ? 'Receipt ✓' : 'Receipt'}
      </Button>
    </>
  )
}

/**
 * One Daily Sheet. mode="edit": Branch Admin fills + submits at POS.
 * mode="review": SA / ASA read the same sheet and Approve or Return in Finance.
 */
export default function DailySheetPanel({ branch, branchLabel, mode = 'edit', sheetId = null, initialDate = null, profile, onReviewed, onStatus }) {
  const review = mode === 'review'
  const [date, setDate] = useState(() => {
    const today = getLocalCalendarDate()
    return /^\d{4}-\d{2}-\d{2}$/.test(initialDate || '') && initialDate <= today ? initialDate : today
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [ctx, setCtx] = useState(null)
  const [sheet, setSheet] = useState(null)
  const [lines, setLines] = useState([])
  const [floatText, setFloatText] = useState('')
  const [countText, setCountText] = useState('')
  const [notes, setNotes] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [returnNote, setReturnNote] = useState('')
  const [returnOpen, setReturnOpen] = useState(false)

  const load = useCallback(async () => {
    if (!review && !branch) return
    setLoading(true)
    setLoadError('')
    try {
      if (review) {
        const row = await loadSheetById(sheetId)
        if (!row) throw new Error('Sheet not found')
        const sales = await loadDaySales(row.branch, row.business_date)
        setCtx({ sales, accounts: [], staff: [], suggestions: [], caRequests: [] })
        setSheet(row)
        setLines((row.daily_sheet_lines || []).sort((a, b) => a.sort - b.sort).map(hydrateLine))
        setFloatText(toText(row.opening_float_minor))
        setCountText(toText(row.counted_cash_minor))
        setNotes(row.notes || '')
      } else {
        const next = await loadSheetContext(branch, date)
        setCtx(next)
        setSheet(next.sheet)
        const saved = (next.sheet?.daily_sheet_lines || []).sort((a, b) => a.sort - b.sort).map(hydrateLine)
        const editableNow = !next.sheet || ['draft', 'returned'].includes(next.sheet.status)
        setLines(editableNow ? mergeSalarySuggestions(saved, next.suggestions).map(hydrateLine) : saved)
        setFloatText(toText(next.sheet?.opening_float_minor))
        setCountText(toText(next.sheet?.counted_cash_minor))
        setNotes(next.sheet?.notes || '')
      }
      setDirty(false)
    } catch (err) {
      setLoadError(sheetErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [review, sheetId, branch, date])

  useEffect(() => {
    load()
  }, [load])

  const status = sheet?.status || null
  useEffect(() => {
    onStatus?.(status)
  }, [onStatus, status])

  const editable = !review && (!sheet || ['draft', 'returned'].includes(sheet.status))
  const sheetValues = {
    opening_float_minor: parsePesosToMinor(floatText),
    counted_cash_minor: parsePesosToMinor(countText),
    notes,
  }
  const sales = useMemo(() => ctx?.sales || [], [ctx])
  const check = sheetChecklist({ sheet: sheetValues, lines, sales })
  const totals = check.totals

  const accountOptions = useMemo(
    () => (ctx?.accounts || []).map((a) => ({ value: a.id, label: a.code ? `${a.code} · ${a.name}` : a.name })),
    [ctx],
  )
  const staffOptions = useMemo(() => {
    const seen = new Map()
    for (const a of ctx?.attendance || []) seen.set(a.staff_id, a.full_name || 'Staff')
    for (const s of ctx?.staff || []) {
      if (!seen.has(s.id) && (!s.branch_slug || s.branch_slug === branch)) seen.set(s.id, s.full_name || 'Staff')
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [ctx, branch])
  const staffName = (id) => staffOptions.find((o) => o.value === id)?.label || lines.find((l) => l.staff_id === id)?.staff_name || 'Staff'

  function patchLine(id, patch) {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
    setDirty(true)
  }
  function setAmount(id, text) {
    patchLine(id, { amountText: text, amount_minor: parsePesosToMinor(text) ?? 0 })
  }
  function addLine(kind, extra = {}) {
    const line = hydrateLine({ kind, amount_minor: 0, ...extra })
    setLines((cur) => [...cur, line.amount_minor ? line : { ...line, amountText: '' }])
    setDirty(true)
  }
  function removeLine(id) {
    setLines((cur) => cur.filter((l) => l.id !== id))
    setDirty(true)
  }
  function refreshSuggestions() {
    setLines((cur) => mergeSalarySuggestions(cur, ctx?.suggestions || []).map(hydrateLine))
    setDirty(true)
    toast.success('Suggested pay refreshed from today\u2019s sales and clock-ins')
  }

  const persist = useCallback(async () => {
    const t = computeSheetTotals({ sales, lines, openingFloatMinor: sheetValues.opening_float_minor, countedCashMinor: sheetValues.counted_cash_minor })
    const res = await saveSheet({
      branch,
      date,
      openingFloatMinor: sheetValues.opening_float_minor,
      countedCashMinor: sheetValues.counted_cash_minor,
      notes,
      totals: t,
      lines,
    })
    setDirty(false)
    return res
  }, [sales, lines, sheetValues.opening_float_minor, sheetValues.counted_cash_minor, notes, branch, date])

  useEffect(() => {
    if (!editable || !dirty) return undefined
    const timer = setTimeout(async () => {
      setSaveState('saving')
      try {
        const res = await persist()
        if (!sheet && res?.id) setSheet({ id: res.id, status: res.status })
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        toast.error(sheetErrorMessage(err))
      }
    }, 1500)
    return () => clearTimeout(timer)
  }, [editable, dirty, persist, sheet])

  async function submit() {
    if (!check.canSubmit) return
    setBusy(true)
    try {
      const saved = await persist()
      const res = await submitSheet(saved?.id || sheet?.id)
      notifyOpsEvent('sheet_submitted', res?.id)
      toast.success('Sent for approval. You will get a push when it is approved.')
      await load()
    } catch (err) {
      toast.error(sheetErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function decide(action) {
    setBusy(true)
    try {
      if (action === 'reopen') await reopenSheet(sheet.id, returnNote)
      else await reviewSheet(sheet.id, action, action === 'return' ? returnNote : null)
      notifyOpsEvent('sheet_reviewed', sheet.id)
      toast.success(action === 'approve' ? 'Approved — the Branch Admin can release pay.' : action === 'return' ? 'Returned to the Branch Admin.' : 'Reopened — posted lines were voided.')
      setReturnOpen(false)
      setReturnNote('')
      await load()
      onReviewed?.()
    } catch (err) {
      toast.error(sheetErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading && !ctx) return <p className="py-10 text-center text-sm text-muted-foreground">Loading the daily sheet…</p>
  if (loadError) {
    return (
      <div className="ds-banner ds-banner--warn" role="alert">
        <CircleAlert aria-hidden className="size-5 shrink-0" />
        <div>
          <p className="font-semibold">The daily sheet could not load</p>
          <p className="text-sm">{loadError}</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={load}>Try again</Button>
        </div>
      </div>
    )
  }

  const expenseLines = lines.filter((l) => l.kind === 'expense')
  const salaryLines = lines.filter((l) => l.kind === 'salary')
  const caLines = lines.filter((l) => l.kind === 'ca_release' || l.kind === 'ca_repay')
  const isSuperAdmin = profile?.role === ROLES.SUPER_ADMIN
  const sheetBranchLabel = review ? sheet?.branch : branchLabel
  const sheetDate = review ? sheet?.business_date : date

  return (
    <div className="ds-root">
      <header className="ds-head">
        <div>
          <p className="ds-eyebrow">Daily sheet · {sheetBranchLabel}</p>
          <h2 className="ds-title">
            {new Date(`${sheetDate}T00:00:00+08:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SheetStatusChip status={status} />
          {!review ? (
            <div className="flex flex-col gap-1">
              <Label htmlFor="ds-date" className="sr-only">Sheet date</Label>
              <Input id="ds-date" type="date" className="min-h-11 w-auto" value={date} max={getLocalCalendarDate()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          ) : null}
          {editable ? (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' && !dirty ? 'Saved' : dirty ? 'Unsaved changes' : ''}
            </span>
          ) : null}
        </div>
      </header>

      {status === 'returned' && sheet?.review_note ? (
        <div className="ds-banner ds-banner--warn" role="status">
          <CircleAlert aria-hidden className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Returned — please fix and submit again</p>
            <p className="text-sm">{sheet.review_note}</p>
          </div>
        </div>
      ) : null}
      {status === 'submitted' && !review ? (
        <div className="ds-banner" role="status">
          <p className="font-semibold">Waiting for approval</p>
          <p className="text-sm">Do not pay crew yet. You will get a push when the owner approves.</p>
        </div>
      ) : null}
      {status === 'approved' ? (
        <div className="ds-banner ds-banner--ok" role="status">
          <Check aria-hidden className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">Approved{review ? '' : ': release pay'}</p>
            <p className="text-sm">{review ? 'Expenses and salaries are posted to the books.' : 'You can now pay the crew the amounts below.'}</p>
          </div>
        </div>
      ) : null}

      <div className="ds-layout">
        <div className="flex min-w-0 flex-col gap-5">
          <SalesSection sales={sales} />

          <section className="ds-card" aria-label="Money out">
            <SectionHead step={2} title="Money out" hint="Every expense paid from the drawer today." done={check.sections.expenses} />
            {expenseLines.length === 0 ? <p className="text-sm text-muted-foreground">No expenses yet.</p> : null}
            <div className="flex flex-col gap-3">
              {expenseLines.map((l, i) =>
                editable ? (
                  <div key={l.id} className="ds-line">
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label htmlFor={`ds-exp-d-${l.id}`} className="text-xs text-muted-foreground">What was it?</Label>
                      <Input id={`ds-exp-d-${l.id}`} className="min-h-11" placeholder="e.g. ice, soap, parking" value={l.description} onChange={(e) => patchLine(l.id, { description: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ds-exp-a-${l.id}`} className="text-xs text-muted-foreground">Account</Label>
                      <NamedSelect id={`ds-exp-a-${l.id}`} className="min-h-11" value={l.account_id} onChange={(v) => patchLine(l.id, { account_id: v })} options={accountOptions} placeholder="Pick account" />
                    </div>
                    <AmountInput id={`ds-exp-m-${l.id}`} value={l.amountText} onChange={(v) => setAmount(l.id, v)} />
                    <div className="flex items-end gap-2">
                      <ReceiptButton
                        line={l}
                        editable
                        onUpload={async (file) => {
                          try {
                            patchLine(l.id, { receipt_path: await uploadReceipt({ branch, date, file }) })
                          } catch (err) {
                            toast.error(sheetErrorMessage(err))
                          }
                        }}
                      />
                      <Button type="button" variant="ghost" className="min-h-11 min-w-11" aria-label={`Remove expense ${i + 1}`} onClick={() => removeLine(l.id)}>
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={l.id} className="ds-row">
                    <span>
                      {l.description || 'Expense'}
                      <span className="block text-xs text-muted-foreground">{l.account_label}</span>
                      <ReceiptButton line={l} editable={false} />
                    </span>
                    <Money minor={l.amount_minor} />
                  </div>
                ),
              )}
            </div>
            {editable ? (
              <Button type="button" variant="outline" className="mt-3 min-h-11 gap-2 self-start" onClick={() => addLine('expense')}>
                <Plus aria-hidden className="size-4" /> Add expense
              </Button>
            ) : null}
            <Row label="Total expenses" bold rule><Money minor={totals.expensesMinor} bold /></Row>
          </section>

          <section className="ds-card" aria-label="Pay crew">
            <SectionHead step={3} title="Pay crew" hint="Everyone who clocked in. The amount is suggested — change it if needed and say why." done={check.sections.salaries} />
            {salaryLines.length === 0 ? <p className="text-sm text-muted-foreground">Nobody clocked in on this day.</p> : null}
            <div className="flex flex-col gap-3">
              {salaryLines.map((l) => {
                const changed = l.suggested_minor != null && l.amount_minor !== Number(l.suggested_minor)
                const needsReason = salaryLineNeedsReason(l)
                const p = l.parts
                return (
                  <div key={l.id} className="ds-line ds-line--salary">
                    <div className="min-w-0 sm:col-span-2">
                      <p className="font-medium">{l.staff_name || staffName(l.staff_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.role ? `${String(l.role).replace(/_/g, ' ')} · ` : ''}
                        Suggested {formatAccounting(l.suggested_minor || 0)}
                        {p ? ` (daily ${formatAccounting(p.daily_minor)} · wash ${formatAccounting(p.wash_minor)} · detailing ${formatAccounting(p.detailing_minor)})` : ''}
                      </p>
                    </div>
                    {editable ? (
                      <AmountInput id={`ds-sal-${l.id}`} label="Pay (₱)" value={l.amountText} onChange={(v) => setAmount(l.id, v)} />
                    ) : (
                      <div className="text-right">
                        {changed ? <s className="ds-num block text-xs text-muted-foreground">{formatAccounting(l.suggested_minor)}</s> : null}
                        <Money minor={l.amount_minor} bold />
                      </div>
                    )}
                    {changed ? (
                      editable ? (
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <Label htmlFor={`ds-sal-r-${l.id}`} className="text-xs text-muted-foreground">
                            Why change? <s className="ds-num">{formatAccounting(l.suggested_minor)}</s> → {formatAccounting(l.amount_minor)}
                          </Label>
                          <Input id={`ds-sal-r-${l.id}`} className="min-h-11" aria-invalid={needsReason || undefined} placeholder="e.g. half day, extra car" value={l.reason} onChange={(e) => patchLine(l.id, { reason: e.target.value })} />
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground sm:col-span-3">Reason: {l.reason || '—'}</p>
                      )
                    ) : null}
                  </div>
                )
              })}
            </div>
            {editable && ctx?.suggestions ? (
              <Button type="button" variant="outline" className="mt-3 min-h-11 gap-2 self-start" onClick={refreshSuggestions}>
                <RefreshCw aria-hidden className="size-4" /> Refresh suggested pay
              </Button>
            ) : null}
            <Row label="Total salaries" bold rule><Money minor={totals.salariesMinor} bold /></Row>
          </section>

          <section className="ds-card" aria-label="Cash advances">
            <SectionHead step={4} title="Cash advances" hint="Cash given to staff, or paid back. Not a cost — it only moves drawer cash." done={check.sections.cashAdvances} />
            {editable && (ctx?.caRequests || []).length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {ctx.caRequests.map((r) => (
                  <Button
                    key={r.id}
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() =>
                      addLine('ca_release', {
                        staff_id: r.payload?.staff_id || '',
                        description: `Request · ${r.payload?.employee_name || r.respondent_label || 'staff'}`,
                        amount_minor: Math.round(Number(r.payload?.amount || 0) * 100),
                      })
                    }
                  >
                    + {r.payload?.employee_name || r.respondent_label || 'Request'} · {formatAccounting(Math.round(Number(r.payload?.amount || 0) * 100))}
                  </Button>
                ))}
              </div>
            ) : null}
            {caLines.length === 0 ? <p className="text-sm text-muted-foreground">No cash advances.</p> : null}
            <div className="flex flex-col gap-3">
              {caLines.map((l, i) =>
                editable ? (
                  <div key={l.id} className="ds-line">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ds-ca-k-${l.id}`} className="text-xs text-muted-foreground">Type</Label>
                      <NamedSelect
                        id={`ds-ca-k-${l.id}`}
                        className="min-h-11"
                        value={l.kind}
                        onChange={(v) => patchLine(l.id, { kind: v })}
                        options={[{ value: 'ca_release', label: 'Given out' }, { value: 'ca_repay', label: 'Paid back' }]}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`ds-ca-s-${l.id}`} className="text-xs text-muted-foreground">Staff</Label>
                      <NamedSelect id={`ds-ca-s-${l.id}`} className="min-h-11" value={l.staff_id} onChange={(v) => patchLine(l.id, { staff_id: v })} options={staffOptions} placeholder="Pick staff" />
                    </div>
                    <AmountInput id={`ds-ca-m-${l.id}`} value={l.amountText} onChange={(v) => setAmount(l.id, v)} />
                    <div className="flex items-end">
                      <Button type="button" variant="ghost" className="min-h-11 min-w-11" aria-label={`Remove cash advance ${i + 1}`} onClick={() => removeLine(l.id)}>
                        <Trash2 aria-hidden className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={l.id} className="ds-row">
                    <span>
                      {l.kind === 'ca_release' ? 'Given out' : 'Paid back'} · {l.staff_name || staffName(l.staff_id)}
                    </span>
                    <Money minor={l.kind === 'ca_release' ? -l.amount_minor : l.amount_minor} />
                  </div>
                ),
              )}
            </div>
            {editable ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => addLine('ca_release')}>
                  <Plus aria-hidden className="size-4" /> Cash given out
                </Button>
                <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => addLine('ca_repay')}>
                  <Plus aria-hidden className="size-4" /> Cash paid back
                </Button>
              </div>
            ) : null}
          </section>

          <section className="ds-card" aria-label="Cash in drawer">
            <SectionHead step={5} title="Cash in drawer" hint="Opening float this morning, then count the drawer at closing." done={check.sections.cash} />
            <div className="grid gap-4 sm:grid-cols-2">
              <AmountInput id="ds-float" label="Opening float (₱)" value={floatText} disabled={!editable} onChange={(v) => { setFloatText(v); setDirty(true) }} />
              <AmountInput id="ds-count" label="Cash counted (₱)" value={countText} disabled={!editable} onChange={(v) => { setCountText(v); setDirty(true) }} />
            </div>
            <div className="mt-3">
              <Row label="Expected cash"><Money minor={totals.expectedCashMinor} /></Row>
              <Row label="Over / short" bold rule>
                {totals.overShortMinor == null ? <span className="text-muted-foreground">Count the drawer</span> : <Money minor={totals.overShortMinor} bold className={totals.overShortMinor ? 'ds-alert' : 'ds-ok'} />}
              </Row>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              <Label htmlFor="ds-notes" className="text-xs text-muted-foreground">
                Note {totals.overShortMinor ? '(required — explain the difference)' : '(optional)'}
              </Label>
              <Textarea id="ds-notes" rows={2} disabled={!editable} value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true) }} />
            </div>
          </section>
        </div>

        <aside className="ds-summary" aria-label="Summary">
          <p className="ds-summary-head">Summary</p>
          <Row label="Net sales"><Money minor={totals.netMinor} /></Row>
          <Row label="Expenses"><Money minor={-totals.expensesMinor} /></Row>
          <Row label="Salaries"><Money minor={-totals.salariesMinor} /></Row>
          <Row label="Net profit" bold rule><Money minor={totals.netProfitMinor} bold /></Row>
          <div className="ds-summary-gap" />
          <Row label="Opening float"><Money minor={totals.openingFloatMinor} /></Row>
          <Row label="Cash sales"><Money minor={totals.cashMinor} /></Row>
          <Row label="CA paid back"><Money minor={totals.caRepaidMinor} /></Row>
          <Row label="CA given out"><Money minor={-totals.caReleasedMinor} /></Row>
          <Row label="Expected cash" bold rule><Money minor={totals.expectedCashMinor} bold /></Row>
          <Row label="Over / short">
            {totals.overShortMinor == null ? <span>—</span> : <Money minor={totals.overShortMinor} bold className={totals.overShortMinor ? 'ds-alert' : 'ds-ok'} />}
          </Row>

          {editable ? (
            <div className="ds-summary-actions">
              {check.missing.length ? (
                <ul className="ds-missing" aria-label="What's missing">
                  {check.missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm">Everything is filled in. Submit when the shop is closed.</p>
              )}
              <Button type="button" className="ds-submit min-h-12 w-full" disabled={!check.canSubmit || busy} onClick={submit}>
                {busy ? 'Submitting…' : 'Submit for approval'}
              </Button>
            </div>
          ) : null}

          {review && status === 'submitted' ? (
            <div className="ds-summary-actions">
              <Button type="button" className="ds-submit min-h-12 w-full" disabled={busy} onClick={() => decide('approve')}>
                Approve
              </Button>
              {returnOpen ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ds-return" className="text-sm">What should the Branch Admin fix?</Label>
                  <Textarea id="ds-return" rows={3} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy || returnNote.trim().length < 3} onClick={() => decide('return')}>
                    Send back
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setReturnOpen(true)}>
                  Return with a note
                </Button>
              )}
            </div>
          ) : null}

          {review && status === 'approved' && isSuperAdmin ? (
            <div className="ds-summary-actions">
              {returnOpen ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ds-reopen" className="text-sm">Why reopen? Posted lines will be voided.</Label>
                  <Textarea id="ds-reopen" rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
                  <Button type="button" variant="outline" className="min-h-11" disabled={busy || returnNote.trim().length < 3} onClick={() => decide('reopen')}>
                    Reopen sheet
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setReturnOpen(true)}>
                  Reopen (Super Admin)
                </Button>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {editable ? (
        <div className="ds-mobile-bar">
          <div className="min-w-0">
            <p className="text-xs opacity-75">Net profit</p>
            <Money minor={totals.netProfitMinor} bold />
          </div>
          <Button type="button" className="ds-submit min-h-11" disabled={!check.canSubmit || busy} onClick={submit}>
            {check.canSubmit ? 'Submit' : `${check.missing.length} to finish`}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

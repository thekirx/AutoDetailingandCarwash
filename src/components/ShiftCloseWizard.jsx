/** Multi-step End of shift sheet body — computed totals, overridable with reasons. */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatMoney } from '@/queue/queueApi'
import {
  SHIFT_CLOSE_STEP_KEYS,
  SHIFT_CLOSE_WIZARD_STEPS,
  isShiftCloseComputedKey,
  minorToPesosInput,
  moneySnapshotFromReport,
  parsePesosToMinor,
  projectShiftCloseMoney,
  shiftCloseFieldHint,
  shiftCloseFieldLabel,
} from '@/lib/shiftClose'

export default function ShiftCloseWizard({
  step,
  onStep,
  branchLabel,
  shiftEndedAtLocal,
  onShiftEndedAt,
  shiftEndedError,
  dailyReportData,
  shiftFieldConfig,
  shiftOverrides,
  setShiftOverrides,
  shiftReasons,
  setShiftReasons,
  shiftFieldErrors,
  setShiftFieldErrors,
  salaryDraftExtras = [],
  setSalaryDraftExtras,
  staffOptions = [],
  onSubmit,
  shiftSubmitting,
}) {
  const baselineSnap = moneySnapshotFromReport(dailyReportData)
  const projectedSnap = projectShiftCloseMoney(dailyReportData, shiftOverrides)
  const stepMeta = SHIFT_CLOSE_WIZARD_STEPS[step] || SHIFT_CLOSE_WIZARD_STEPS[0]
  const approvedCa = dailyReportData?.approved_ca || []
  const caRepayments = dailyReportData?.ca_repayments || []
  const draftExpenseCount = Number(dailyReportData?.expense_draft_count || 0)

  function keysForStep() {
    if (stepMeta.id === 'money') return SHIFT_CLOSE_STEP_KEYS.money
    if (stepMeta.id === 'detail') return SHIFT_CLOSE_STEP_KEYS.detail
    return []
  }

  function fieldBaseline(key) {
    if (key === 'total_cash_left_minor' || key === 'ca_collected_minor') {
      return projectedSnap[key] ?? baselineSnap[key] ?? 0
    }
    return baselineSnap[key] || 0
  }

  function addSalaryDraft() {
    if (!setSalaryDraftExtras) return
    setSalaryDraftExtras((prev) => [
      ...(prev || []),
      { staff_id: '', staff_name: '', amount_pesos: '', note: '', kind: 'extra' },
    ])
  }

  function updateSalaryDraft(idx, patch) {
    if (!setSalaryDraftExtras) return
    setSalaryDraftExtras((prev) =>
      (prev || []).map((row, i) => {
        if (i !== idx) return row
        const next = { ...row, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'staff_id')) {
          const opt = (staffOptions || []).find((s) => String(s.id) === String(patch.staff_id))
          if (opt) next.staff_name = opt.full_name
        }
        return next
      }),
    )
  }

  function removeSalaryDraft(idx) {
    if (!setSalaryDraftExtras) return
    setSalaryDraftExtras((prev) => (prev || []).filter((_, i) => i !== idx))
  }

  /** UI rows use amount_pesos; PosPage maps via attachSalaryDraftExtras. */
  const draftRowsForSubmit = (salaryDraftExtras || []).map((row) => ({
    staff_id: row.staff_id || null,
    staff_name: row.staff_name,
    amount_minor:
      row.amount_minor != null ? row.amount_minor : parsePesosToMinor(row.amount_pesos) ?? 0,
    note: row.note,
    kind: row.kind,
  }))

  function renderField(key) {
    const cfg = shiftFieldConfig.find((f) => f.field_key === key)
    if (cfg?.is_active === false) return null
    const label = shiftCloseFieldLabel(key, shiftFieldConfig)
    const hint = shiftCloseFieldHint(key)
    const baseline = fieldBaseline(key)
    const inputVal = shiftOverrides[key] != null ? shiftOverrides[key] : minorToPesosInput(baseline)
    const changed = parsePesosToMinor(inputVal) != null && parsePesosToMinor(inputVal) !== baseline
    const computed = isShiftCloseComputedKey(key)
    const liveHint =
      key === 'total_cash_left_minor' &&
      projectedSnap.total_cash_left_minor !== baselineSnap.total_cash_left_minor &&
      shiftOverrides.total_cash_left_minor == null
        ? `Includes CA repaid · ${formatMoney(projectedSnap.total_cash_left_minor)}`
        : null
    return (
      <div key={key} className="rounded-xl border border-border bg-card/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <Label htmlFor={`shift-${key}`}>{label}</Label>
          <span className="shrink-0 text-[10px] font-bold tracking-wide uppercase text-muted-foreground">
            {computed ? 'From POS' : 'Type in'}
          </span>
        </div>
        <p className="mb-1 text-xs text-muted-foreground">
          Baseline · {formatMoney(baseline)}
          {computed ? ' · change only if the drawer count differs' : ' · enter if you collected any'}
        </p>
        {hint ? <p className="mb-2 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
        {liveHint ? <p className="mb-2 text-xs font-medium text-primary">{liveHint}</p> : null}
        <Input
          id={`shift-${key}`}
          inputMode="decimal"
          className="min-h-11"
          disabled={cfg?.allow_override === false}
          value={inputVal}
          onChange={(e) => {
            setShiftOverrides((prev) => ({ ...prev, [key]: e.target.value }))
            setShiftFieldErrors((prev) => {
              const next = { ...prev }
              delete next[key]
              return next
            })
          }}
        />
        {changed ? (
          <Input
            className="mt-2 min-h-11"
            placeholder="Why different? (required)"
            value={shiftReasons[key] || ''}
            onChange={(e) => setShiftReasons((prev) => ({ ...prev, [key]: e.target.value }))}
          />
        ) : null}
        {shiftFieldErrors[key] ? (
          <p className="mt-1 text-xs text-destructive">{shiftFieldErrors[key]}</p>
        ) : null}
      </div>
    )
  }

  const salaryDraftPanel = setSalaryDraftExtras ? (
    <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
            Salary drafts (not payroll)
          </p>
          <p className="text-xs text-muted-foreground">
            Extra pay or deductions for SA to see on floor confirm — does not post pay.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-9" onClick={addSalaryDraft}>
          Add draft
        </Button>
      </div>
      {(salaryDraftExtras || []).map((row, idx) => (
        <div key={idx} className="grid gap-2 rounded-lg border border-border bg-card/40 p-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Staff</Label>
            {staffOptions.length ? (
              <select
                className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={row.staff_id || ''}
                onChange={(e) => updateSalaryDraft(idx, { staff_id: e.target.value })}
              >
                <option value="">Name only…</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                className="min-h-10"
                placeholder="Staff name"
                value={row.staff_name || ''}
                onChange={(e) => updateSalaryDraft(idx, { staff_name: e.target.value })}
              />
            )}
            {staffOptions.length && !row.staff_id ? (
              <Input
                className="min-h-10"
                placeholder="Or type staff name"
                value={row.staff_name || ''}
                onChange={(e) => updateSalaryDraft(idx, { staff_name: e.target.value })}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Kind</Label>
            <select
              className="min-h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={row.kind || 'extra'}
              onChange={(e) => updateSalaryDraft(idx, { kind: e.target.value })}
            >
              <option value="extra">Extra pay</option>
              <option value="deduction">Deduction</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Amount (₱)</Label>
            <Input
              inputMode="decimal"
              className="min-h-10"
              value={row.amount_pesos ?? (row.amount_minor != null ? minorToPesosInput(row.amount_minor) : '')}
              onChange={(e) => updateSalaryDraft(idx, { amount_pesos: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Note</Label>
            <div className="flex gap-2">
              <Input
                className="min-h-10"
                value={row.note || ''}
                onChange={(e) => updateSalaryDraft(idx, { note: e.target.value })}
                placeholder="Optional"
              />
              <Button type="button" variant="ghost" className="min-h-10 shrink-0" onClick={() => removeSalaryDraft(idx)}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  ) : null

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        {branchLabel} · walk through each step. Numbers fill from today&apos;s paid sales — edit only when
        the count is different. This close is an attestation for Finance — it does not run payroll.
      </p>

      <ol className="hakum-shift-steps" aria-label="End of shift steps">
        {SHIFT_CLOSE_WIZARD_STEPS.map((item, idx) => (
          <li key={item.id}>
            <button
              type="button"
              className={idx === step ? 'is-on' : ''}
              aria-current={idx === step ? 'step' : undefined}
              onClick={() => onStep(idx)}
            >
              <span>{idx + 1}</span>
              {item.label}
            </button>
          </li>
        ))}
      </ol>

      {stepMeta.id === 'when' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">{stepMeta.hint}</p>
          <div className="rounded-xl border border-border p-3">
            <Label htmlFor="shift-ended-at">Shift ended at</Label>
            <Input
              id="shift-ended-at"
              type="datetime-local"
              className="mt-1 min-h-11"
              value={shiftEndedAtLocal}
              onChange={(e) => onShiftEndedAt(e.target.value)}
            />
            {shiftEndedError ? (
              <p className="mt-1 text-xs text-destructive">{shiftEndedError}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Close early or late — this time anchors the day for Finance review.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
            <p className="text-[10px] font-bold tracking-wide text-primary uppercase">Today so far</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
              {formatMoney(baselineSnap.square_sales_minor)}
            </p>
            <p className="text-xs text-muted-foreground">Total sales (paid POS) · {branchLabel}</p>
          </div>
        </div>
      ) : null}

      {stepMeta.id === 'money' || stepMeta.id === 'detail' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">{stepMeta.hint}</p>
          {stepMeta.id === 'money' && approvedCa.length > 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                Approved cash advances (already in expenses)
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {approvedCa.map((row, i) => (
                  <li key={`${row.label}-${i}`} className="flex justify-between gap-2 tabular-nums">
                    <span>{row.label}</span>
                    <span>{formatMoney(row.amount_minor)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Do not type these again under CA repaid to drawer unless staff paid cash back into the till.
              </p>
            </div>
          ) : null}
          {stepMeta.id === 'money' && caRepayments.length > 0 ? (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
              <p className="text-[10px] font-bold tracking-wide text-primary uppercase">
                CA repayments logged today
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {caRepayments.map((row, i) => (
                  <li key={`${row.label}-${i}`} className="flex justify-between gap-2 tabular-nums">
                    <span>{row.label}</span>
                    <span>{formatMoney(row.amount_minor)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Total CA repaid · {formatMoney(projectedSnap.ca_collected_minor)} · cash left updates automatically.
              </p>
            </div>
          ) : null}
          {stepMeta.id === 'detail' && draftExpenseCount > 0 ? (
            <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {draftExpenseCount} expense draft{draftExpenseCount === 1 ? '' : 's'} count toward Total expenses /
              cash left. Confirm they match cash that actually left the drawer.
            </p>
          ) : null}
          {keysForStep().map(renderField)}
          {stepMeta.id === 'detail' ? salaryDraftPanel : null}
        </div>
      ) : null}

      {stepMeta.id === 'review' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">Double-check totals, then submit for Super Admin review.</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {[...SHIFT_CLOSE_STEP_KEYS.money, 'total_expenses_minor'].map((key) => {
              const baseline = fieldBaseline(key)
              const inputVal =
                shiftOverrides[key] != null ? shiftOverrides[key] : minorToPesosInput(baseline)
              const minor = parsePesosToMinor(inputVal) ?? baseline
              return (
                <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span>{shiftCloseFieldLabel(key, shiftFieldConfig)}</span>
                  <span className="tabular-nums font-medium">{formatMoney(minor)}</span>
                </li>
              )
            })}
          </ul>
          {draftRowsForSubmit.filter((r) => r.staff_name && r.amount_minor > 0).length ? (
            <div className="rounded-xl border border-border p-3 text-xs">
              <p className="font-medium">Salary drafts for SA</p>
              <ul className="mt-1 space-y-1 text-muted-foreground">
                {draftRowsForSubmit
                  .filter((r) => r.staff_name && r.amount_minor > 0)
                  .map((r, i) => (
                    <li key={i} className="tabular-nums">
                      {r.kind === 'deduction' ? 'Deduct' : 'Extra'} · {r.staff_name} · {formatMoney(r.amount_minor)}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Ended · {shiftEndedAtLocal ? shiftEndedAtLocal.replace('T', ' ') : '—'}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        {step > 0 ? (
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => onStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < SHIFT_CLOSE_WIZARD_STEPS.length - 1 ? (
          <Button type="button" className="min-h-11 flex-1" onClick={() => onStep(step + 1)}>
            Continue
          </Button>
        ) : (
          <Button
            type="button"
            className="hakum-pos-end-shift min-h-11 flex-1"
            disabled={shiftSubmitting}
            onClick={onSubmit}
          >
            {shiftSubmitting ? 'Submitting…' : 'Submit end of shift'}
          </Button>
        )}
      </div>
    </div>
  )
}

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
  onSubmit,
  shiftSubmitting,
}) {
  const baselineSnap = moneySnapshotFromReport(dailyReportData)
  const stepMeta = SHIFT_CLOSE_WIZARD_STEPS[step] || SHIFT_CLOSE_WIZARD_STEPS[0]

  function keysForStep() {
    if (stepMeta.id === 'money') return SHIFT_CLOSE_STEP_KEYS.money
    if (stepMeta.id === 'detail') return SHIFT_CLOSE_STEP_KEYS.detail
    return []
  }

  function renderField(key) {
    const cfg = shiftFieldConfig.find((f) => f.field_key === key)
    if (cfg?.is_active === false) return null
    const label = shiftCloseFieldLabel(key, shiftFieldConfig)
    const baseline = baselineSnap[key] || 0
    const inputVal = shiftOverrides[key] != null ? shiftOverrides[key] : minorToPesosInput(baseline)
    const changed = parsePesosToMinor(inputVal) != null && parsePesosToMinor(inputVal) !== baseline
    const computed = isShiftCloseComputedKey(key)
    return (
      <div key={key} className="rounded-xl border border-border p-3">
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

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        {branchLabel} · walk through each step. Numbers fill from today&apos;s paid sales — edit only when
        the count is different.
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
                Close early or late — this time anchors the day for payroll windows.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">Today so far</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(baselineSnap.square_sales_minor)}
            </p>
            <p className="text-xs text-muted-foreground">Total sales (paid)</p>
          </div>
        </div>
      ) : null}

      {stepMeta.id === 'money' || stepMeta.id === 'detail' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">{stepMeta.hint}</p>
          {keysForStep().map(renderField)}
        </div>
      ) : null}

      {stepMeta.id === 'review' ? (
        <div className="space-y-3">
          <p className="text-muted-foreground">Double-check totals, then submit for Super Admin review.</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {[...SHIFT_CLOSE_STEP_KEYS.money, 'total_expenses_minor'].map((key) => {
              const baseline = baselineSnap[key] || 0
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

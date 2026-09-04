/** Short customer-facing step names for the bar; keys come from buildVisitProgress(status). */
const SHORT = {
  waiting: 'Queued',
  in_progress: 'Washing',
  final_checking: 'Checking',
  for_payment: 'Payment',
}

/**
 * Visit progress bar. `visit` is the portal payload: { steps: [{key,label}], currentIndex, isComplete }.
 * Fill width is derived from the current step so it always matches the booking status in the database.
 * pending/confirmed bookings still show the bar at Queued (index 0).
 */
export default function VisitProgress({ visit }) {
  const steps = visit?.steps || []
  if (!steps.length) return null
  const last = Math.max(steps.length - 1, 1)
  const raw = Number(visit.currentIndex)
  const idx = visit.isComplete ? last : Math.min(Math.max(Number.isFinite(raw) ? raw : 0, 0), last)
  const pct = visit.isComplete ? 100 : last === 0 ? 0 : (idx / last) * 100

  return (
    <div
      className="capp-progress"
      role="progressbar"
      aria-label="Visit progress"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={idx}
      aria-valuetext={visit.isComplete ? 'Completed' : steps[idx]?.label || SHORT[steps[idx]?.key]}
    >
      <div className="capp-progress-track">
        <div className="capp-progress-fill" style={{ '--p': `${pct}%` }} />
      </div>
      <ol className="capp-progress-steps" style={{ '--n': steps.length }}>
        {steps.map((step, i) => {
          const done = visit.isComplete || i < idx
          const current = !visit.isComplete && i === idx
          return (
            <li
              key={step.key}
              className={`capp-progress-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              <span className="capp-progress-dot" aria-hidden />
              <span>{SHORT[step.key] || step.label}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

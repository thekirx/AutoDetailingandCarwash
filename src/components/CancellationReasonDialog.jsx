/**
 * Cancel ticket/booking with required reason + easy-fill presets (legacy CancellationModal port).
 * TL may cancel; never hard-delete.
 */
import { useState } from 'react'
import { CANCEL_REASON_PRESETS, validateCancellationReason } from '../queue/queueLogic'

export default function CancellationReasonDialog({ open, title = 'Cancel ticket', onClose, onConfirm, loading }) {
  const [preset, setPreset] = useState(CANCEL_REASON_PRESETS[0])
  const [other, setOther] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const draft = preset === 'Others' ? other : preset

  function submit(e) {
    e.preventDefault()
    const checked = validateCancellationReason(draft)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setError('')
    onConfirm(checked.reason)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl">
        <h2 id="cancel-dialog-title" className="text-lg font-bold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Team Lead can cancel with a reason. Delete is not allowed.</p>
        <fieldset className="mt-3 grid gap-2">
          <legend className="sr-only">Cancel reason</legend>
          {CANCEL_REASON_PRESETS.map((label) => (
            <label key={label} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-3 text-sm text-foreground">
              <input
                type="radio"
                name="cancel-preset"
                checked={preset === label}
                onChange={() => {
                  setPreset(label)
                  setError('')
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {preset === 'Others' ? (
          <label className="mt-3 block text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            Reason
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              maxLength={500}
              required
            />
          </label>
        ) : null}
        {error ? <p className="mt-2 text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <button type="button" className="min-h-11 flex-1 rounded-xl border border-border px-3 text-sm font-semibold" onClick={onClose} disabled={loading}>
            Keep open
          </button>
          <button type="submit" className="min-h-11 flex-1 rounded-xl bg-destructive px-3 text-sm font-semibold text-white" disabled={loading}>
            {loading ? 'Cancelling…' : 'Cancel ticket'}
          </button>
        </div>
      </form>
    </div>
  )
}

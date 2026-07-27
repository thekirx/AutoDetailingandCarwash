import { normalizeFields } from '@/lib/opsForms'

/**
 * Branded Hakum customer form surface — used by /f/:slug and admin Preview.
 */
export default function BrandedOpsForm({
  form,
  values = {},
  onChange,
  onSubmit,
  status = 'idle',
  error = '',
  preview = false,
  className = '',
}) {
  const fields = normalizeFields(form?.fields)
  const kindLabel = String(form?.kind || 'form').replace(/_/g, ' ')

  function setField(key, value) {
    onChange?.({ ...values, [key]: value })
  }

  return (
    <div className={`hakum-form-shell ${preview ? 'is-preview' : ''} ${className}`.trim()}>
      <header className="hakum-form-hero">
        <div className="hakum-form-brand">
          <span className="hakum-form-mark" aria-hidden>
            H
          </span>
          <div>
            <p className="hakum-form-eyebrow">Hakum Auto Care</p>
            <p className="hakum-form-kind">{kindLabel}</p>
          </div>
        </div>
        {preview && <span className="hakum-form-preview-badge">Customer preview</span>}
        <h1 className="hakum-form-title">{form?.name || 'Form'}</h1>
        {form?.description ? <p className="hakum-form-lead">{form.description}</p> : null}
      </header>

      <div className="hakum-form-body">
        {error ? (
          <p className="hakum-form-alert" role="alert">
            {error}
          </p>
        ) : null}

        {status === 'success' ? (
          <div className="hakum-form-success">
            <p className="hakum-form-success-title">Thank you</p>
            <p>Your response was submitted. Our team will follow up if needed.</p>
          </div>
        ) : (
          <form
            className="hakum-form-fields"
            onSubmit={(e) => {
              e.preventDefault()
              if (preview) return
              onSubmit?.(e)
            }}
          >
            {fields.map((field) => (
              <label key={field.key} className="hakum-form-field">
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                {field.type === 'textarea' ? (
                  <textarea
                    required={field.required && !preview}
                    disabled={preview}
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    rows={4}
                  />
                ) : field.type === 'select' ? (
                  <select
                    required={field.required && !preview}
                    disabled={preview}
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  >
                    <option value="">Select…</option>
                    {(field.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'checkbox' ? (
                  <span className="hakum-form-check">
                    <input
                      type="checkbox"
                      disabled={preview}
                      checked={Boolean(values[field.key])}
                      onChange={(e) => setField(field.key, e.target.checked)}
                    />
                    Yes
                  </span>
                ) : (
                  <input
                    type={
                      field.type === 'datetime'
                        ? 'datetime-local'
                        : field.type === 'phone'
                          ? 'tel'
                          : field.type
                    }
                    required={field.required && !preview}
                    disabled={preview}
                    value={values[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}

            {!fields.length ? (
              <p className="hakum-form-empty">This form has no fields yet.</p>
            ) : null}

            <button
              type={preview ? 'button' : 'submit'}
              className="hakum-form-submit"
              disabled={preview || status === 'loading' || !fields.length}
            >
              {preview ? 'Submit (preview only)' : status === 'loading' ? 'Sending…' : 'Submit'}
            </button>
            {preview ? (
              <p className="hakum-form-preview-note">Read-only preview — customers see this on the public share link.</p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  )
}

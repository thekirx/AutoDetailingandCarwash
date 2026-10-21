import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { answerRows, firstInvalidStep, isWizardForm, validateStep, wizardScreens, wizardSteps } from '@/lib/formWizard'
import { formKindLabel, normalizeFields, normalizeFormSettings } from '@/lib/opsForms'

/**
 * Branded Hakum customer form surface — used by /f/:slug and admin Preview.
 * Reading this as: ops branded form for customers/staff, Hakum blue language, existing DS.
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
  footerSlot = null,
  submissionId = null,
}) {
  const fields = normalizeFields(form?.fields)
  const settings = normalizeFormSettings(form?.settings, form?.kind)
  const kindLabel = formKindLabel(form?.kind)
  const title = settings.header_title || form?.name || 'Form'
  const logoUrl = settings.show_logo ? settings.logo_url : ''

  function setField(key, value) {
    onChange?.({ ...values, [key]: value })
  }

  return (
    <div className={`hakum-form-shell ${preview ? 'is-preview' : ''} ${className}`.trim()}>
      <header className="hakum-form-hero">
        <div className="hakum-form-brand">
          {logoUrl ? (
            <img
              className="hakum-form-logo"
              src={logoUrl}
              alt="Hakum Auto Care"
              width={140}
              height={40}
            />
          ) : (
            <span className="hakum-form-mark" aria-hidden>
              H
            </span>
          )}
          <div>
            <p className="hakum-form-eyebrow">Hakum Auto Care</p>
            <p className="hakum-form-kind">{kindLabel}</p>
          </div>
        </div>
        {preview && <span className="hakum-form-preview-badge">Customer preview</span>}
        <h1 className="hakum-form-title">{title}</h1>
        {form?.description ? <p className="hakum-form-lead">{form.description}</p> : null}
      </header>

      <div className="hakum-form-body">
        {error ? (
          <p className="hakum-form-alert" role="alert">
            {error}
          </p>
        ) : null}

        {isWizardForm(form) ? (
          <WizardBody key={`${form?.id || ''}:${form?.slug || ''}`} form={form} values={values} onChange={onChange} onSubmit={onSubmit} status={status} preview={preview} footerSlot={footerSlot} submissionId={submissionId} />
        ) : status === 'success' ? (
          <div className="hakum-form-success">
            <p className="hakum-form-success-title">{settings.thank_you.title || 'Thank you'}</p>
            <p>{settings.thank_you.body || 'Your response was submitted. Our team will follow up if needed.'}</p>
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
              <FormField key={field.key} field={field} value={values[field.key]} onChange={(value) => setField(field.key, value)} preview={preview} />
            ))}

            {!fields.length ? (
              <p className="hakum-form-empty">This form has no fields yet.</p>
            ) : null}

            {footerSlot}

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


function FormField({ field, value, onChange, preview, error = '' }) {
  const id = useId()
  const props = {
    id, name: field.key, required: field.required && !preview && field.type !== 'checkbox', disabled: preview,
    'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined,
    className: error ? 'is-invalid' : undefined,
  }
  return (
    <label className="hakum-form-field" htmlFor={id}>
      <span>{field.label}{field.required ? ' *' : ''}</span>
      {field.type === 'textarea' ? (
        <textarea {...props} value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={4} />
      ) : field.type === 'select' ? (
        <select {...props} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === 'checkbox' ? (
        <span className="hakum-form-check"><input {...props} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />Yes</span>
      ) : (
        <input {...props} type={field.type === 'datetime' ? 'datetime-local' : field.type === 'phone' ? 'tel' : field.type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
      )}
      {error && <span id={`${id}-error`} className="hakum-form-field-error" role="alert">{error}</span>}
    </label>
  )
}

function WizardBody({ form, values, onChange, onSubmit, status, preview, footerSlot, submissionId }) {
  const [index, setIndex] = useState(0)
  const [errors, setErrors] = useState({})
  const heading = useRef(null)
  const body = useRef(null)
  const steps = wizardSteps(form)
  const screens = wizardScreens(form)
  const currentIndex = Math.min(index, screens.length - 1)
  const screen = screens[currentIndex]
  const last = currentIndex === screens.length - 1
  const review = screen.id === '__review'
  const settings = normalizeFormSettings(form.settings, form.kind)
  const success = status === 'success'
  const pendingFocus = useRef(false)

  useEffect(() => { heading.current?.focus() }, [currentIndex, success])
  useEffect(() => {
    if (pendingFocus.current) {
      body.current?.querySelector('[aria-invalid="true"]')?.focus()
      pendingFocus.current = false
    }
  }, [currentIndex, errors])

  function showErrors(step, targetIndex) {
    const nextErrors = Object.fromEntries(step.fields.flatMap(field => {
      const message = validateStep({ fields: [field] }, values)[0]
      return message ? [[field.key, message]] : []
    }))
    pendingFocus.current = true
    setErrors(nextErrors)
    setIndex(targetIndex)
  }

  function advance(e) {
    e.preventDefault()
    if (status === 'loading') return
    if (last) {
      if (preview) return
      const invalid = firstInvalidStep(steps, values)
      if (invalid !== -1) return showErrors(steps[invalid], invalid)
      onSubmit?.(e)
    } else {
      if (!preview && validateStep(screen, values).length) return showErrors(screen, currentIndex)
      setErrors({})
      setIndex(currentIndex + 1)
    }
  }

  function changeField(key, value) {
    onChange?.({ ...values, [key]: value })
    if (errors[key]) setErrors(previous => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  const reference = String(submissionId || '').replace(/-/g, '').slice(0, 8).toUpperCase()
  return (
    <div ref={body}>
      <div className="wz-prog"><span><b>Step {success ? screens.length : currentIndex + 1}</b> of {screens.length}</span><span>{success ? 'Complete' : screen.title}</span></div>
      <div className="wz-bar" role="progressbar" aria-valuemin={1} aria-valuemax={screens.length} aria-valuenow={success ? screens.length : currentIndex + 1} aria-label="Form progress" style={{ '--n': screens.length }}>
        {screens.map((item, i) => <i key={item.id} className={success || i <= currentIndex ? 'on' : ''} />)}
      </div>
      {success ? (
        <div className="wz-done" role="status">
          <span className="ok" aria-hidden="true">✓</span>
          <h2 ref={heading} tabIndex={-1}>{settings.thank_you.title || 'Thank you'}</h2>
          <p>{settings.thank_you.body || 'Your response was submitted. Our team will follow up if needed.'}</p>
          {reference && <span className="wz-ref">Reference {reference.slice(0, 4)}-{reference.slice(4)}</span>}
        </div>
      ) : (
        <form className="hakum-form-fields" onSubmit={advance} noValidate>
          <div>
            {!review && <span className="wz-num" aria-hidden="true">{String(currentIndex + 1).padStart(2, '0')}</span>}
            <h2 className="wz-h" ref={heading} tabIndex={-1}>{screen.title}</h2>
            {screen.hint && <p className="wz-hint">{screen.hint}</p>}
          </div>
          {review ? (
            <div className="wz-sum" aria-label="Check and send answers">
              {steps.map((step, i) => (
                <section key={step.id}>
                  <header><span>{step.title}</span><button type="button" aria-label={`Edit ${step.title}`} onClick={() => { setErrors({}); setIndex(i) }} disabled={status === 'loading'}>Edit</button></header>
                  <dl>{answerRows(step, values).map(row => <Fragment key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></Fragment>)}</dl>
                </section>
              ))}
            </div>
          ) : screen.fields.length ? screen.fields.map(field => (
            <FormField key={field.key} field={field} value={values[field.key]} onChange={value => changeField(field.key, value)} preview={preview} error={errors[field.key]} />
          )) : <p className="hakum-form-empty">No questions in this step yet.</p>}
          {last && footerSlot}
          <div className="wz-act" style={currentIndex === 0 ? { gridTemplateColumns: '1fr' } : undefined}>
            {currentIndex > 0 && <button type="button" className="wz-back" disabled={status === 'loading'} onClick={() => { setErrors({}); setIndex(currentIndex - 1) }}>Back</button>}
            <button type="submit" className="hakum-form-submit" disabled={status === 'loading' || (preview && last)}>
              {last ? preview ? 'Send (preview only)' : status === 'loading' ? 'Sending…' : 'Send' : 'Continue'}
            </button>
          </div>
          {preview && <p className="hakum-form-preview-note">Read-only preview — customers see this on the public share link.</p>}
        </form>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { normalizeFields, validatePayload } from '@/lib/opsForms'

export default function PublicFormPage() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!slug) return
    setError('')
    supabase.rpc('get_public_ops_form', { p_slug: slug }).then(({ data, error: e }) => {
      if (e) setError(e.message)
      else if (!data) setError('This form is closed or not found.')
      else setForm(data)
    })
  }, [slug])

  const fields = normalizeFields(form?.fields)

  async function onSubmit(e) {
    e.preventDefault()
    if (!form) return
    const errs = validatePayload(fields, values)
    if (errs[0]) {
      setError(errs[0])
      return
    }
    setStatus('loading')
    setError('')
    const { data, error: err } = await supabase.rpc('submit_public_ops_form', {
      p_slug: slug,
      p_payload: values,
      p_calendar_at: null,
      p_respondent_label: values.customer_name || values.name || values.full_name || null,
    })
    if (err) {
      setError(err.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    setValues({})
    if (data?.calendar_at) {
      // keep success message; calendar sync happens server-side
    }
  }

  return (
    <>
      <section className="inner-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Hakum form</p>
          <h1 className="display-title">{form?.name || 'Form'}</h1>
          {form?.description && <p className="inner-hero-copy">{form.description}</p>}
        </div>
      </section>
      <section className="content-section">
        <div className="public-shell" style={{ maxWidth: 640 }}>
          {error && <p className="form-error" role="alert">{error}</p>}
          {status === 'success' && (
            <p style={{ marginBottom: 24, lineHeight: 1.6 }}>
              Thank you — your response was submitted.
            </p>
          )}
          {form && status !== 'success' && (
            <form onSubmit={onSubmit} className="booking-form">
              {fields.map((field) => (
                <label key={field.key}>
                  {field.label}{field.required ? ' *' : ''}
                  {field.type === 'textarea' ? (
                    <textarea
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(values[field.key])}
                        onChange={(e) => setValues({ ...values, [field.key]: e.target.checked })}
                      />
                      Yes
                    </span>
                  ) : (
                    <input
                      type={field.type === 'datetime' ? 'datetime-local' : field.type === 'phone' ? 'tel' : field.type}
                      required={field.required}
                      value={values[field.key] || ''}
                      onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
              <button className="button button-blue" disabled={status === 'loading'}>
                {status === 'loading' ? 'Sending…' : 'Submit'}
              </button>
            </form>
          )}
          <p style={{ marginTop: 40 }}>
            <Link className="dark-link" to="/">Home</Link>
            {' · '}
            <Link className="dark-link" to="/contact">Contact</Link>
          </p>
        </div>
      </section>
    </>
  )
}

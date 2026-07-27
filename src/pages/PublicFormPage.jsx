import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import { normalizeFields, validatePayload } from '@/lib/opsForms'
import { supabase } from '@/lib/supabase'

export default function PublicFormPage() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!slug) return
    setError('')
    setStatus('idle')
    supabase.rpc('get_public_ops_form', { p_slug: slug }).then(({ data, error: e }) => {
      if (e) setError(e.message)
      else if (!data) setError('This form is closed or not found.')
      else setForm(data)
    })
  }, [slug])

  async function onSubmit() {
    if (!form) return
    const fields = normalizeFields(form.fields)
    const errs = validatePayload(fields, values)
    if (errs[0]) {
      setError(errs[0])
      return
    }
    setStatus('loading')
    setError('')
    const { error: err } = await supabase.rpc('submit_public_ops_form', {
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
  }

  return (
    <main className="hakum-form-page">
      <div className="hakum-form-page-bg" aria-hidden />
      <div className="hakum-form-page-inner">
        {!form && !error ? <p className="hakum-form-loading">Loading form…</p> : null}
        {(form || error) && (
          <BrandedOpsForm
            form={form || { name: 'Form unavailable', fields: [], kind: 'custom' }}
            values={values}
            onChange={setValues}
            onSubmit={onSubmit}
            status={form ? status : 'idle'}
            error={error}
          />
        )}
        <p className="hakum-form-footer-links">
          <Link to="/">Home</Link>
          <span aria-hidden>·</span>
          <Link to="/contact">Contact</Link>
          <span aria-hidden>·</span>
          <Link to="/book">Book a visit</Link>
        </p>
      </div>
    </main>
  )
}

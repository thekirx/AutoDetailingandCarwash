import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import { extractComplaintBranch, normalizeFields, validatePayload, withLiveBranchOptions } from '@/lib/opsForms'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'

export default function PublicFormPage() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [status, setStatus] = useState('idle')
  const [acceptedLegal, setAcceptedLegal] = useState(false)

  useEffect(() => {
    if (!slug) return
    setError('')
    setStatus('idle')
    setAcceptedLegal(false)
    Promise.all([
      supabase.rpc('get_public_ops_form', { p_slug: slug }),
      listBranches().catch(() => []),
    ]).then(([{ data, error: e }, branches]) => {
      if (e) setError(e.message)
      else if (!data) setError('This form is closed or not found.')
      else {
        const slugs = (branches || [])
          .filter((b) => b && !b.is_archived && b.is_active !== false)
          .map((b) => b.slug)
          .filter(Boolean)
        setForm({ ...data, fields: withLiveBranchOptions(data.fields, slugs) })
      }
    })
  }, [slug])

  async function onSubmit() {
    if (!form) return
    if (!acceptedLegal) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }
    const fields = normalizeFields(form.fields)
    const errs = validatePayload(fields, values)
    if (errs[0]) {
      setError(errs[0])
      return
    }
    setStatus('loading')
    setError('')
    const submittedPayload = { ...values }
    const { data, error: err } = await supabase.rpc('submit_public_ops_form', {
      p_slug: slug,
      p_payload: submittedPayload,
      p_calendar_at: null,
      p_respondent_label: submittedPayload.customer_name || submittedPayload.name || submittedPayload.full_name || null,
    })
    if (err) {
      setError(err.message)
      setStatus('idle')
      return
    }
    if (form.kind === 'complaint') {
      try {
        await fetch('/api/notify-ops-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug,
            form_name: form.name,
            payload: submittedPayload,
            submission_id: data?.id || null,
            branch: extractComplaintBranch(submittedPayload),
          }),
        })
      } catch {
        // best-effort push
      }
    }
    setStatus('success')
    setValues({})
    setAcceptedLegal(false)
  }

  return (
    <main className="hakum-form-page">
      <div className="hakum-form-page-bg" aria-hidden />
      <div className="hakum-form-page-inner">
        {!form && !error ? <p className="hakum-form-loading">Loading form…</p> : null}
        {(form || error) && (
          <BrandedOpsForm
            form={form || { name: 'Form unavailable', fields: [], kind: 'complaint' }}
            values={values}
            onChange={setValues}
            onSubmit={onSubmit}
            status={form ? status : 'idle'}
            error={error}
            footerSlot={
              form ? (
                <label className="form-legal-notice hakum-form-legal" htmlFor="ops-form-legal">
                  <input
                    id="ops-form-legal"
                    type="checkbox"
                    checked={acceptedLegal}
                    onChange={(e) => setAcceptedLegal(e.target.checked)}
                    required
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" target="_blank" rel="noopener noreferrer">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              ) : null
            }
          />
        )}
        <p className="hakum-form-footer-links">
          <Link to="/">Home</Link>
          <span aria-hidden>·</span>
          <Link to="/contact">Contact</Link>
          <span aria-hidden>·</span>
          <Link to="/book">Book a visit</Link>
          <span aria-hidden>·</span>
          <Link to="/terms">Terms</Link>
          <span aria-hidden>·</span>
          <Link to="/privacy">Privacy</Link>
          <span aria-hidden>·</span>
          <Link to="/cookies">Cookies</Link>
        </p>
      </div>
    </main>
  )
}

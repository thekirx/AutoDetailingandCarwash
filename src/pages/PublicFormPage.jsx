import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BrandedOpsForm from '@/components/BrandedOpsForm'
import {
  filterFormBranchSlugs,
  normalizeFields,
  validatePayload,
  withLiveBranchOptions,
} from '@/lib/opsForms'
import { listBranches } from '@/lib/adminApi'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import { submitPublicOpsFormViaApi } from '@/lib/publicInquiryApi'
import { supabase } from '@/lib/supabase'
import { usePageMeta } from '@/lib/pageMeta'

export default function PublicFormPage() {
  const { slug } = useParams()
  const [form, setForm] = useState(null)

  usePageMeta({
    title: form?.name || 'Inquiry Form',
    description: form?.description || 'Submit a form or feedback directly to Hakum Auto Care.',
    path: slug ? `/f/${slug}` : '/contact',
    noindex: true,
  })
  const [error, setError] = useState('')
  const [values, setValues] = useState({})
  const [status, setStatus] = useState('idle')
  const [submissionId, setSubmissionId] = useState(null)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [guard, setGuard] = useState(() => createPublicFormGuard())

  const loadForm = useCallback(() => {
    if (!slug) return
    setError('')
    setStatus('idle')
    setSubmissionId(null)
    setValues({})
    setForm(null)
    setAcceptedLegal(false)
    setGuard(createPublicFormGuard())
    Promise.all([
      supabase.rpc('get_public_ops_form', { p_slug: slug }),
      listBranches().catch(() => []),
    ])
      .then(([{ data, error: e }, branches]) => {
        if (e) setError(e.message)
        else if (!data || data.kind === 'event') setError('This form is closed or not found.')
        else {
          const slugs = filterFormBranchSlugs(branches || [])
          setForm({ ...data, fields: withLiveBranchOptions(data.fields, slugs) })
        }
      })
      .catch((err) => setError(err?.message || 'Unable to load form.'))
  }, [slug])

  useEffect(() => {
    loadForm()
  }, [loadForm])

  async function onSubmit() {
    if (!form) return
    if (!acceptedLegal) {
      setError('Please agree to the Terms of Service and Privacy Policy.')
      return
    }
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
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
    const respondentLabel =
      submittedPayload.customer_name || submittedPayload.name || submittedPayload.full_name || null

    let accessToken = null
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      accessToken = sessionData?.session?.access_token || null
    } catch {
      /* guest public submission */
    }

    const res = await submitPublicOpsFormViaApi({
      slug,
      payload: submittedPayload,
      calendarAt: null,
      respondentLabel,
      source: 'public',
      guard,
      accessToken,
    })

    if (!res.ok) {
      setError(res.error)
      setStatus('idle')
      return
    }

    setSubmissionId(res.booking?.id || res.id || null)
    setStatus('success')
    setValues({})
    setAcceptedLegal(false)
    setGuard(createPublicFormGuard())
  }

  return (
    <main className="hakum-form-page">
      <div className="hakum-form-page-bg" aria-hidden />
      <div className="hakum-form-page-inner">
        {!form && !error ? <p className="hakum-form-loading">Loading form…</p> : null}
        {!form && error ? (
          <div className="mb-4 text-center">
            <button type="button" className="underline text-sm font-semibold" onClick={loadForm}>
              Retry loading form
            </button>
          </div>
        ) : null}
        {(form || error) && (
          <BrandedOpsForm
            form={form || { name: 'Form unavailable', fields: [], kind: 'complaint' }}
            values={values}
            onChange={setValues}
            onSubmit={onSubmit}
            status={form ? status : 'idle'}
            error={error}
            submissionId={submissionId}
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

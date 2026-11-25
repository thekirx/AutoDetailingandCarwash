import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicBranches } from '@/lib/branches'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import { submitPublicInquiry } from '../lib/publicInquiryApi'
import FormLegalNotice from '@/components/FormLegalNotice'
import { usePageMeta } from '@/lib/pageMeta'
import BdPageHero from '../components/public/bredesign/BdPageHero'

export default function ComplaintsPage() {
  usePageMeta({
    title: 'Submit a Complaint',
    description: 'Submit a service feedback report or branch inquiry directly to Hakum Auto Care management in Bacoor or Batangas City.',
    path: '/complaints',
    noindex: true,
  })
  const { branches, loading: branchesLoading, error: branchesError, reload: reloadBranches } = usePublicBranches()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [guard, setGuard] = useState(() => createPublicFormGuard())
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    branch: '',
    category: 'Service quality',
    description: '',
  })

  useEffect(() => {
    if (!form.branch && branches[0]?.slug) {
      setForm((f) => ({ ...f, branch: branches[0].slug }))
    }
  }, [branches, form.branch])

  async function submit(event) {
    event.preventDefault()
    setError('')
    const digits = String(form.customer_phone || '').replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 13) {
      setError('Enter a valid Philippine mobile number (e.g. 09171234567).')
      return
    }
    setStatus('loading')
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
      setStatus('idle')
      return
    }
    const result = await submitPublicInquiry(
      'complaint',
      {
        customerName: form.customer_name.trim(),
        customerPhone: form.customer_phone.trim(),
        customerEmail: form.customer_email.trim(),
        branch: form.branch,
        category: form.category,
        description: form.description.trim(),
      },
      guard,
    )
    if (!result.ok) {
      setError(result.error)
      setStatus('idle')
      return
    }
    setStatus('success')
    setGuard(createPublicFormGuard())
  }

  if (status === 'success') {
    return (
      <section className="utility-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Complaints</p>
          <h1 className="display-title">We heard you.</h1>
          <p className="inner-hero-copy">Your complaint is under review. We will follow up by phone.</p>
          <Link className="button button-blue" to="/">Back home</Link>
        </div>
      </section>
    )
  }

  const update = (key) => (e) => {
    setError('')
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  return (
    <>
      <BdPageHero
        eyebrow="Feedback"
        title={
          <>
            Submit a
            <br />
            <em>complaint.</em>
          </>
        }
        copy="Tell us what went wrong so we can make it right — branch teams review every submission."
      />
      <section className="booking-page">
      <div className="public-shell booking-grid is-single">
        <form onSubmit={submit} className="booking-form">
          <label>Customer name<input required value={form.customer_name} onChange={update('customer_name')} /></label>
          <label>Mobile number<input required type="tel" inputMode="tel" placeholder="0917 123 4567" value={form.customer_phone} onChange={update('customer_phone')} /></label>
          <label>Email (optional)<input type="email" placeholder="you@email.com" value={form.customer_email} onChange={update('customer_email')} /></label>
          <label>Branch
            <select required value={form.branch} onChange={update('branch')} disabled={branchesLoading}>
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
          </label>
          <label>Category
            <select required value={form.category} onChange={update('category')}>
              <option>Service quality</option>
              <option>Wait time</option>
              <option>Staff conduct</option>
              <option>Pricing</option>
              <option>Other</option>
            </select>
          </label>
          <label className="booking-span-2">Description<textarea required rows={4} value={form.description} onChange={update('description')} /></label>
          <label className="sr-only" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            Company website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={guard.honeypot}
              onChange={(e) => setGuard((g) => ({ ...g, honeypot: e.target.value }))}
            />
          </label>
          <FormLegalNotice id="complaint-legal" className="form-legal-notice booking-span-2" />
          {branchesError ? (
            <p className="form-error booking-span-2" role="alert">
              Branches could not load ({branchesError}).{' '}
              <button type="button" className="underline font-semibold" onClick={reloadBranches}>
                Retry
              </button>
            </p>
          ) : null}
          {error && <p className="form-error">{error}</p>}
          <button disabled={status === 'loading' || branchesLoading || !form.branch} className="button button-blue">{status === 'loading' ? 'Submitting…' : 'Submit complaint'}</button>
        </form>
      </div>
    </section>
    </>
  )
}

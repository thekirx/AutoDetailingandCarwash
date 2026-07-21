import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { usePublicBranches } from '@/lib/branches'

export default function ComplaintsPage() {
  const { branches, loading: branchesLoading } = usePublicBranches()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
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
    setStatus('loading')
    setError('')
    const { error: e } = await supabase.from('complaints').insert({
      customer_name: form.customer_name.trim(),
      branch: form.branch,
      category: form.category,
      description: form.description.trim(),
      status: 'submitted',
    })
    if (e) {
      setError(e.message)
      setStatus('idle')
      return
    }
    setStatus('success')
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

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <section className="booking-page">
      <div className="public-shell booking-grid">
        <div>
          <p className="eyebrow">Feedback</p>
          <h1 className="section-title">Submit a complaint</h1>
          <p>Tell us what went wrong so we can make it right — branch teams review every submission.</p>
        </div>
        <form onSubmit={submit} className="booking-form">
          <label>Customer name<input required value={form.customer_name} onChange={update('customer_name')} /></label>
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
          <label>Description<textarea required value={form.description} onChange={update('description')} /></label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={status === 'loading' || branchesLoading || !form.branch} className="button button-blue">{status === 'loading' ? 'Submitting…' : 'Submit complaint'}</button>
        </form>
      </div>
    </section>
  )
}

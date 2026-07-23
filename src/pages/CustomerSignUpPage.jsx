import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import HakumAuthShell, { CUSTOMER_AUTH_BULLETS } from '../components/HakumAuthShell'
import { usePageMeta } from '../lib/pageMeta'

export default function CustomerSignUpPage() {
  usePageMeta({
    title: 'Sign up',
    description: 'Create a Hakum Auto Care customer account to track visits and live queue progress.',
    path: '/signup',
  })

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!acceptedTerms) {
      setError('Accept the Terms of Service and Privacy Policy to continue.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/customer-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          email: form.email || null,
          password: form.password,
          accepted_terms: true,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to create account.')

      const loginEmail = body.email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: form.password,
      })
      if (signInError) {
        navigate('/signin', { replace: true, state: { justSignedUp: true } })
        return
      }
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <HakumAuthShell
      title="Join the Hakum circle."
      subtitle="Create a customer account to track visits, plates, and live queue at Bacoor and Batangas."
      bullets={CUSTOMER_AUTH_BULLETS}
      footerLinks={
        <>
          <p>
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
          <p>
            <Link to="/">Back to site</Link>
          </p>
        </>
      }
    >
      <h2>Create account</h2>
      <p className="hakum-auth-welcome">Customer signup only — team accounts are issued by Super Admin.</p>
      {error ? <p className="hakum-auth-alert" role="alert">{error}</p> : null}
      <form onSubmit={handleSubmit} className="hakum-auth-form">
        <label>
          <span>Full name</span>
          <input required value={form.full_name} onChange={update('full_name')} autoComplete="name" />
        </label>
        <label>
          <span>Phone</span>
          <input required value={form.phone} onChange={update('phone')} autoComplete="tel" placeholder="09XXXXXXXXX" />
        </label>
        <label>
          <span>Email (optional)</span>
          <input type="email" value={form.email} onChange={update('email')} autoComplete="email" placeholder="you@email.com" />
        </label>
        <label>
          <span>Password</span>
          <div className="hakum-auth-password">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              minLength={8}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <label>
          <span>Confirm password</span>
          <input required type="password" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} minLength={8} />
        </label>
        <label className="hakum-auth-terms">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            required
          />
          <span>
            I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</Link>
            {' '}and <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.
          </span>
        </label>
        <button type="submit" className="hakum-auth-submit" disabled={submitting || !acceptedTerms}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </HakumAuthShell>
  )
}

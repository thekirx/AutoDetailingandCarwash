import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell, { CUSTOMER_AUTH_BULLETS } from '../components/HakumAuthShell'
import { phoneLoginEmail } from '../lib/customerAuth'

export default function CustomerSignInPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user && profile?.role === 'customer') navigate('/account', { replace: true })
  }, [loading, user, profile, navigate])

  if (loading) return <LoadingScreen />
  if (user && profile?.role === 'customer') return <Navigate to="/account" replace />

  const resolveEmail = (raw) => (raw.includes('@') ? raw.trim() : phoneLoginEmail(raw.trim()))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      const email = resolveEmail(identifier)
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('Invalid email/phone or password.')

      const { data: customer } = await supabase
        .from('customers')
        .select('id, role, is_archived')
        .eq('id', data.user.id)
        .eq('role', 'customer')
        .eq('is_archived', false)
        .maybeSingle()

      const metaCustomer =
        data.user.user_metadata?.role === 'customer' ||
        (data.user.email || '').includes('@customers.hakumautocare.com')

      if (!customer && !metaCustomer) {
        await supabase.auth.signOut()
        throw new Error('This sign-in is for customers. Team members use the operations portal.')
      }

      if (data.user.user_metadata?.must_set_password) {
        navigate('/account/set-password', { replace: true })
        return
      }
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err.message)
      await signOut().catch(() => {})
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgot = async () => {
    setError('')
    setInfo('')
    try {
      const email = resolveEmail(identifier)
      if (!email.includes('@')) throw new Error('Enter your email (or phone) first.')
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account/set-password`,
      })
      if (resetError) throw resetError
      setInfo('Password reset email sent if that account exists.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <HakumAuthShell
      title="Your car. Your account."
      subtitle="Sign in to manage visit history, live queue, and bookings across Hakum branches."
      bullets={CUSTOMER_AUTH_BULLETS}
      footerLinks={
        <>
          <p>
            New here? <Link to="/signup">Create an account</Link>
          </p>
          <p className="hakum-auth-team-link">
            <Link to="/operations/login">Team member? Use the operations portal</Link>
          </p>
          <p>
            <Link to="/">Back to site</Link>
          </p>
        </>
      }
    >
      <h2>Sign in</h2>
      <p className="hakum-auth-welcome">Welcome back to Hakum Auto Care</p>
      {error ? <p className="hakum-auth-alert" role="alert">{error}</p> : null}
      {info ? <p className="hakum-auth-info">{info}</p> : null}
      <form onSubmit={handleSubmit} className="hakum-auth-form">
        <label>
          <span>Email or phone</span>
          <input
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com or 09XXXXXXXXX"
          />
        </label>
        <label>
          <span>Password</span>
          <div className="hakum-auth-password">
            <input
              required
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <div className="hakum-auth-row">
          <button type="button" className="hakum-auth-text-btn" onClick={handleForgot}>
            Forgot password?
          </button>
        </div>
        <button type="submit" className="hakum-auth-submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </HakumAuthShell>
  )
}

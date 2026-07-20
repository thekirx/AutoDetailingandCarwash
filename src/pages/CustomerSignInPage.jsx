import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell, { CUSTOMER_AUTH_BULLETS } from '../components/HakumAuthShell'
import { classifyIdentifier, resolveLoginEmail } from '../lib/customerAuth'

async function authLookup(identifier, action = 'lookup') {
  const res = await fetch('/api/customer-auth-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, action, site_origin: window.location.origin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Lookup failed.')
  return data
}

export default function CustomerSignInPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [setupStatus, setSetupStatus] = useState(null) // needs_password | needs_invite | ready | unknown | null
  const [lookupEmail, setLookupEmail] = useState(null)
  const [checking, setChecking] = useState(false)
  const [sendingSetup, setSendingSetup] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user && profile?.role === 'customer') navigate('/account', { replace: true })
  }, [loading, user, profile, navigate])

  // Smart check: plate / phone / email → TL-provisioned without password?
  useEffect(() => {
    const raw = identifier.trim()
    setError('')
    if (raw.length < 3) {
      setSetupStatus(null)
      setLookupEmail(null)
      return undefined
    }
    const kind = classifyIdentifier(raw)
    if (kind === 'phone' && raw.replace(/\D/g, '').length < 10) {
      setSetupStatus(null)
      setLookupEmail(null)
      return undefined
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setChecking(true)
      try {
        const data = await authLookup(raw, 'lookup')
        if (cancelled) return
        setSetupStatus(data.status || 'unknown')
        setLookupEmail(data.login_email || null)
      } catch {
        if (!cancelled) {
          setSetupStatus(null)
          setLookupEmail(null)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }, 450)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [identifier])

  if (loading) return <LoadingScreen />
  if (user && profile?.role === 'customer') return <Navigate to="/account" replace />

  const resolveEmail = async (raw) => {
    const kind = classifyIdentifier(raw)
    if (kind === 'email' || kind === 'phone') return resolveLoginEmail(raw)
    if (lookupEmail) return lookupEmail
    const data = await authLookup(raw, 'lookup')
    if (data.login_email) return data.login_email
    throw new Error('No Hakum account found for that plate. Try phone or email, or ask your Team Lead.')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    try {
      if (setupStatus === 'needs_password' && !password) {
        throw new Error('Set a password first — use the button below to get your link.')
      }
      if (setupStatus === 'needs_invite') {
        throw new Error('Your visit is on file, but your account invite is not ready. Ask your Team Lead to send it from the queue.')
      }

      const email = await resolveEmail(identifier)
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        if (setupStatus === 'needs_password') {
          throw new Error('You still need to set a password. Your Team Lead registered your visit — send yourself a set-password link below.')
        }
        throw new Error('Invalid email, phone, plate, or password.')
      }

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

  const handleSendSetup = async () => {
    setError('')
    setInfo('')
    setSendingSetup(true)
    try {
      await authLookup(identifier.trim(), 'send_setup')
      setInfo('Set-password link queued to your phone. Open it to finish your account, then sign in here.')
      setSetupStatus('needs_password')
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingSetup(false)
    }
  }

  const handleForgot = async () => {
    setError('')
    setInfo('')
    try {
      const email = await resolveEmail(identifier)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/account/set-password`,
      })
      if (resetError) throw resetError
      setInfo('Password reset email sent if that account has an email on file. Phone-only accounts: use “Send set-password link”.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <HakumAuthShell
      title="Your car. Your account."
      subtitle="Sign in with email, phone, or plate to manage visit history, live queue, and bookings."
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
      {error ? (
        <p className="hakum-auth-alert" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="hakum-auth-info" role="status">
          {info}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="hakum-auth-form">
        <label>
          <span>Email, phone, or plate</span>
          <input
            required
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="you@email.com, 09XXXXXXXXX, or ABC 1234"
          />
        </label>

        {checking ? <p className="hakum-auth-hint">Checking your Hakum visit…</p> : null}

        {setupStatus === 'needs_password' ? (
          <div className="hakum-auth-setup" role="status">
            <strong>Set up your password</strong>
            <p>
              Your Team Lead already registered your visit. You do not have a password yet — send a set-password link to finish
              your account.
            </p>
            <button type="button" className="hakum-auth-setup-btn" onClick={handleSendSetup} disabled={sendingSetup || !identifier.trim()}>
              {sendingSetup ? 'Sending…' : 'Send set-password link'}
            </button>
          </div>
        ) : null}

        {setupStatus === 'needs_invite' ? (
          <div className="hakum-auth-setup" role="status">
            <strong>Account invite pending</strong>
            <p>Your plate or number is on file, but the Team Lead has not issued your login invite yet. Ask them at the shop.</p>
          </div>
        ) : null}

        {setupStatus === 'ready' ? <p className="hakum-auth-hint hakum-auth-hint--ok">Account found — enter your password.</p> : null}

        <label>
          <span>Password</span>
          <div className="hakum-auth-password">
            <input
              required={setupStatus !== 'needs_password'}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={setupStatus === 'needs_password' ? 'After you set one' : undefined}
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
        <button type="submit" className="hakum-auth-submit" disabled={submitting || setupStatus === 'needs_invite'}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </HakumAuthShell>
  )
}

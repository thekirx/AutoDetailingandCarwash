import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell, { CUSTOMER_AUTH_BULLETS } from '../components/HakumAuthShell'
import { AuthLegalLinks } from '../components/FormLegalNotice'
import { classifyIdentifier, resolveLoginEmail } from '../lib/customerAuth'
import { activateSignupHref, resolveCustomerAuthIntent } from '../lib/customerAccountLifecycle'
import { canOfferPasswordEmailReset } from '../lib/uiDeadControls'
import DemoAccountChips from '../components/DemoAccountChips'
import { isDemoLoginEnabled } from '../lib/demoLogin'
import { usePageMeta } from '../lib/pageMeta'

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
  usePageMeta({
    title: 'Sign in',
    description: 'Sign in to your Hakum Auto Care customer account with your phone and password.',
    path: '/signin',
  })

  const [idMode, setIdMode] = useState('phone')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [setupStatus, setSetupStatus] = useState(null) // needs_password | needs_invite | ready | unknown | null
  const [lookupEmail, setLookupEmail] = useState(null)
  const [checking, setChecking] = useState(false)
  const [sendingSetup, setSendingSetup] = useState(false)
  const [sendingReset, setSendingReset] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [demoCustomer, setDemoCustomer] = useState(null)
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isDemoLoginEnabled()) return undefined
    let cancelled = false
    import('../lib/demoAccounts').then((m) => {
      if (!cancelled) setDemoCustomer(m.CUSTOMER_DEMO_ACCOUNT)
    })
    return () => {
      cancelled = true
    }
  }, [])

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

  const signInWithCredentials = async (nextIdentifier, nextPassword, { skipIntentCheck = false } = {}) => {
    setError('')
    setInfo('')
    const rawIdentifier = nextIdentifier.trim()
    if (!skipIntentCheck) {
      const intent = resolveCustomerAuthIntent({
        status: setupStatus || 'unknown',
        passwordProvided: Boolean(nextPassword),
        flow: 'signin',
      })
      if (intent.action === 'activate') {
        navigate(activateSignupHref(rawIdentifier))
        return
      }
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/customer-auth-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: rawIdentifier,
          password: nextPassword,
          action: 'signin',
          site_origin: window.location.origin,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.activate) {
        navigate(activateSignupHref(rawIdentifier))
        return
      }
      if (data.offer_signup) {
        setSetupStatus('unknown')
        throw new Error(data.error || 'No Hakum account for that number yet. Create one to track visits.')
      }
      if (!res.ok || !data.access_token || !data.refresh_token) {
        throw new Error(data.error || 'Invalid phone or password.')
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (sessionError || !sessionData?.user) {
        throw new Error(sessionError?.message || 'Could not open your session. Try again.')
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, role, is_archived')
        .eq('id', sessionData.user.id)
        .eq('role', 'customer')
        .eq('is_archived', false)
        .maybeSingle()

      if (customerError || !customer) {
        await supabase.auth.signOut()
        throw new Error(
          customerError && /42501|permission|policy|row-level/i.test(customerError.message || '')
            ? 'Unable to verify your customer profile (permissions). Try again shortly.'
            : !customer
              ? 'This sign-in is for customers. Team members use the operations portal.'
              : customerError.message || 'Unable to verify customer account.',
        )
      }

      const accessToken = sessionData.session?.access_token || data.access_token
      if (accessToken) {
        fetch('/api/lifecycle-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ kind: 'welcome', site_origin: window.location.origin }),
        }).catch(() => {})
      }

      if (sessionData.user.user_metadata?.must_set_password) {
        navigate(activateSignupHref(rawIdentifier), { replace: true })
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

  const handleSubmit = async (event) => {
    event.preventDefault()
    await signInWithCredentials(identifier, password)
  }

  const handleSendSetup = async () => {
    setError('')
    setInfo('')
    setSendingSetup(true)
    try {
      await authLookup(identifier.trim(), 'send_setup')
      setInfo('Set-password email sent via Supabase. Check your inbox (and spam), open the link, then sign in here.')
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
    const raw = identifier.trim()
    if (raw.length < 3) {
      setError('Enter your email, phone, or plate first.')
      return
    }
    setSendingReset(true)
    try {
      const redirectTo = `${window.location.origin}/account/set-password`
      try {
        const data = await authLookup(raw, 'send_reset')
        if (!data.sent) throw new Error('Could not send reset email.')
        setInfo('Password reset email sent. Check your inbox (and spam), then choose a new password.')
      } catch (lookupErr) {
        // Email-only path when lookup misses CRM row but Auth email exists
        const kind = classifyIdentifier(raw)
        if (kind !== 'email') throw lookupErr
        const email = resolveLoginEmail(raw)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
        if (resetError) throw resetError
        setInfo('Password reset email sent. Check your inbox (and spam), then choose a new password.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingReset(false)
    }
  }

  const idKind = classifyIdentifier(identifier.trim())
  // Plate/phone login can still receive mail when CRM has a real email (lookupEmail).
  const offerEmailReset =
    (idKind === 'email' && canOfferPasswordEmailReset(identifier.trim())) ||
    canOfferPasswordEmailReset(lookupEmail)

  return (
    <HakumAuthShell
      variant="customer"
      title="Give your car the pampering it deserves."
      subtitle="Expert detailing, precision car care, and the shine that turns heads."
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
          <AuthLegalLinks />
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
          <span>{idMode === 'phone' ? 'Mobile number' : 'Email or plate'}</span>
          <input
            required
            autoComplete="username"
            inputMode={idMode === 'phone' ? 'tel' : 'text'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={idMode === 'phone' ? '09XXXXXXXXX' : 'you@email.com or ABC 1234'}
          />
        </label>
        <button
          type="button"
          className="hakum-auth-text-btn hakum-auth-mode-toggle"
          onClick={() => {
            setIdMode((m) => (m === 'phone' ? 'other' : 'phone'))
            setIdentifier('')
            setSetupStatus(null)
            setError('')
          }}
        >
          {idMode === 'phone' ? 'Use email or plate instead' : 'Use phone number instead'}
        </button>

        {checking ? <p className="hakum-auth-hint">Checking your Hakum visit…</p> : null}

        {setupStatus === 'needs_password' || setupStatus === 'needs_invite' ? (
          <div className="hakum-auth-setup" role="status">
            <strong>Activate your Hakum account</strong>
            <p>
              Your Team Lead already saved your visit. Finish setup to open your history (name, plate, birthday,
              password).
            </p>
            <Link className="hakum-auth-setup-btn" to={activateSignupHref(identifier.trim())}>
              Continue setup
            </Link>
            {setupStatus === 'needs_password' && offerEmailReset ? (
              <button
                type="button"
                className="hakum-auth-text-btn"
                onClick={handleSendSetup}
                disabled={sendingSetup || !identifier.trim()}
              >
                {sendingSetup ? 'Sending…' : 'Or email a set-password link'}
              </button>
            ) : null}
          </div>
        ) : null}

        {setupStatus === 'ready' ? <p className="hakum-auth-hint hakum-auth-hint--ok">Account found. Enter your password.</p> : null}
        {setupStatus === 'unknown' ? (
          <p className="hakum-auth-hint">
            No account for that number yet.{' '}
            <Link to={activateSignupHref(identifier.trim())}>Create one</Link> to track visits.
          </p>
        ) : null}

        <label>
          <span>Password</span>
          <div className="hakum-auth-password">
            <input
              required={setupStatus !== 'needs_password' && setupStatus !== 'needs_invite'}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                setupStatus === 'needs_password' || setupStatus === 'needs_invite' ? 'Set this in setup' : undefined
              }
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <div className="hakum-auth-row">
          <button
            type="button"
            className="hakum-auth-text-btn"
            onClick={handleForgot}
            disabled={sendingReset || !identifier.trim()}
          >
            {sendingReset ? 'Sending reset…' : 'Forgot password?'}
          </button>
        </div>
        {(idKind === 'phone' || idKind === 'plate') && lookupEmail && !canOfferPasswordEmailReset(lookupEmail) ? (
          <p className="hakum-auth-hint">This account has no real email on file, so reset mail cannot be sent. Ask the shop to add one.</p>
        ) : null}
        <button type="submit" className="hakum-auth-submit" disabled={submitting}>
          {submitting
            ? 'Signing in…'
            : setupStatus === 'needs_password' || setupStatus === 'needs_invite'
              ? 'Activate account'
              : 'Sign in'}
        </button>
      </form>

      <DemoAccountChips
        title="Demo customer"
        accounts={demoCustomer ? [demoCustomer] : []}
        disabled={submitting}
        onPick={async (a) => {
          setIdentifier(a.email)
          setPassword(a.password)
          setError('')
          setInfo('')
          setSetupStatus(null)
          await signInWithCredentials(a.email, a.password, { skipIntentCheck: true })
        }}
      />
    </HakumAuthShell>
  )
}

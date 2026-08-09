import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { OPS_LOGIN_ROLES } from '../auth/permissions'
import { resolvePostLoginPath, safeAuthReturnPath } from '../auth/authRedirect'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell, { TEAM_AUTH_BULLETS } from '../components/HakumAuthShell'
import DemoAccountChips from '../components/DemoAccountChips'
import { isDemoLoginEnabled } from '../lib/demoLogin'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [demoAccounts, setDemoAccounts] = useState([])
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const returnPath = safeAuthReturnPath(location.state?.from?.pathname)
  const missingProfileTries = useRef(0)

  useEffect(() => {
    if (!isDemoLoginEnabled()) return undefined
    let cancelled = false
    import('../lib/demoAccounts').then((m) => {
      if (!cancelled) setDemoAccounts(m.OPS_DEMO_ACCOUNTS)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Only sign out after repeated failed profile hydrations — never on the first paint after login.
  useEffect(() => {
    if (loading || !user || profile || location.state?.signedOut || submitting) {
      missingProfileTries.current = 0
      return undefined
    }
    const t = window.setTimeout(async () => {
      missingProfileTries.current += 1
      try {
        const next = await refreshProfile()
        if (next) return
      } catch {
        /* retry below */
      }
      if (missingProfileTries.current >= 3) {
        signOut().catch(() => {})
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [loading, user, profile, location.state?.signedOut, submitting, refreshProfile, signOut])

  useEffect(() => {
    if (!loading && location.state?.signedOut && user) {
      signOut().catch(() => {})
    }
  }, [loading, location.state?.signedOut, user, signOut])

  if (loading || submitting) {
    return <LoadingScreen label={submitting ? 'Opening your floor…' : undefined} />
  }
  // After explicit sign-out from access-denied, stay on the form even if session briefly lingers
  if (user && profile && !location.state?.signedOut) {
    return <Navigate to={resolvePostLoginPath(profile, returnPath)} replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setSubmitting(true)
    missingProfileTries.current = 0

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('Invalid email or password.')
      setSubmitting(false)
      return
    }

    const { data: staffProfile, error: profileError } = await supabase
      .from('staff_profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (profileError) {
      await supabase.auth.signOut()
      const rls = /42501|permission|policy|row-level/i.test(profileError.message || '')
      setError(
        rls
          ? 'Unable to verify your role (permissions). Try again or contact Super Admin.'
          : 'Unable to load your staff profile. Try again.',
      )
      setSubmitting(false)
      return
    }

    let role = staffProfile?.role || null

    if (!staffProfile) {
      const { data: legacyProfile, error: legacyError } = await supabase
        .from('customers')
        .select('role')
        .eq('id', data.user.id)
        .in('role', OPS_LOGIN_ROLES)
        .eq('is_archived', false)
        .maybeSingle()

      if (legacyError) {
        await supabase.auth.signOut()
        setError('Unable to verify team access. Try again.')
        setSubmitting(false)
        return
      }

      if (!legacyProfile) {
        await supabase.auth.signOut()
        setError('This account does not have team portal access.')
        setSubmitting(false)
        return
      }
      role = legacyProfile.role
    }

    // Wait for AuthProvider profile so ProtectedRoute never sees user-without-profile.
    let hydrated = null
    try {
      hydrated = await refreshProfile()
    } catch {
      hydrated = null
    }
    if (!hydrated) {
      await new Promise((r) => setTimeout(r, 250))
      try {
        hydrated = await refreshProfile()
      } catch {
        hydrated = null
      }
    }

    const dest = resolvePostLoginPath(hydrated || { role }, returnPath)
    navigate(dest, { replace: true })
    setSubmitting(false)
  }

  const handleForgot = async () => {
    setError('')
    setInfo('')
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your team email, then tap Forgot password.')
      return
    }
    setResetting(true)
    try {
      const redirectTo = `${window.location.origin}/account/set-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo })
      if (resetError) throw resetError
      setInfo('Password reset email sent. Open the link, set a new password, then sign in here.')
    } catch (err) {
      setError(err.message || 'Could not send reset email.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <HakumAuthShell
      kicker="Hakum Auto Care — Team portal"
      title="Command the floor."
      subtitle="Sign in to run queue, crew, and branch operations. Accounts are issued by Super Admin."
      bullets={TEAM_AUTH_BULLETS}
      footerLinks={
        <>
          <p>
            Customer? <Link to="/signin">Sign in to your account</Link>
          </p>
          <p className="hakum-auth-team-link">
            <Link to="/">Back to site</Link>
          </p>
        </>
      }
    >
      <h2>Sign in</h2>
      <p className="hakum-auth-welcome">Welcome back to the Hakum floor</p>

      {location.state?.unauthorized ? (
        <p className="hakum-auth-info" role="status">
          Team portal access is required for that page.
        </p>
      ) : null}
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
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@hakumautocare.com"
          />
        </label>
        <label>
          <span>Password</span>
          <div className="hakum-auth-password">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        <button type="submit" className="hakum-auth-submit" disabled={submitting}>
          {submitting ? 'Opening your floor…' : 'Sign in'}
        </button>
      </form>

      <div className="hakum-auth-row">
        <button type="button" className="hakum-auth-text-btn" onClick={handleForgot} disabled={resetting}>
          {resetting ? 'Sending reset…' : 'Forgot password?'}
        </button>
      </div>

      <DemoAccountChips
        title="Demo team accounts"
        accounts={demoAccounts}
        onPick={(a) => {
          setEmail(a.email)
          setPassword(a.password)
          setError('')
          setInfo('')
        }}
      />
    </HakumAuthShell>
  )
}

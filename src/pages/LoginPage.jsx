import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { OPS_LOGIN_ROLES, redirectForRole } from '../auth/permissions'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell, { TEAM_AUTH_BULLETS } from '../components/HakumAuthShell'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, profile, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user && !profile) signOut()
  }, [loading, user, profile, signOut])

  if (loading) return <LoadingScreen />
  if (user && profile) return <Navigate to={location.state?.from?.pathname || redirectForRole(profile.role)} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

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

    if (profileError || !staffProfile) {
      const { data: legacyProfile, error: legacyError } = await supabase
        .from('customers')
        .select('role')
        .eq('id', data.user.id)
        .in('role', OPS_LOGIN_ROLES)
        .eq('is_archived', false)
        .maybeSingle()

      if (legacyError || !legacyProfile) {
        await supabase.auth.signOut()
        setError('This account does not have team portal access.')
        setSubmitting(false)
        return
      }

      navigate(location.state?.from?.pathname || redirectForRole(legacyProfile.role), { replace: true })
      setSubmitting(false)
      return
    }

    navigate(location.state?.from?.pathname || redirectForRole(staffProfile.role), { replace: true })
    setSubmitting(false)
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
          {submitting ? 'Verifying…' : 'Sign in'}
        </button>
      </form>
    </HakumAuthShell>
  )
}

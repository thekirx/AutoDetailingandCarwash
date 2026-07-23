import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import HakumAuthShell from '../components/HakumAuthShell'
import { usePageMeta } from '../lib/pageMeta'

export default function CustomerSetPasswordPage() {
  usePageMeta({
    title: 'Set password',
    description: 'Choose a new password for your Hakum Auto Care customer account.',
    path: '/account/set-password',
  })

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true

    const markReady = (session) => {
      if (!active) return
      setHasSession(Boolean(session))
      setReady(true)
      if (!session) {
        setError('Open the reset or set-password link from your SMS or email first.')
      } else {
        setError('')
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        markReady(data.session)
        return
      }
      // Invite / recovery links land with hash tokens; detectSessionInUrl needs a beat
      window.setTimeout(async () => {
        const { data: again } = await supabase.auth.getSession()
        markReady(again.session)
      }, 900)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        markReady(session)
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!hasSession) {
      setError('Open the reset or set-password link from your SMS or email first.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_set_password: false },
      })
      if (updateError) throw updateError
      setDone(true)
      window.setTimeout(() => navigate('/account', { replace: true }), 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) return <LoadingScreen />

  return (
    <HakumAuthShell
      title="Secure your account."
      subtitle="Choose a password to sign in, track your vehicle, and follow live queue progress."
      footerLinks={
        <p>
          <Link to="/signin">Back to sign in</Link>
        </p>
      }
    >
      <h2>Set your password</h2>
      <p className="hakum-auth-welcome">Use at least 8 characters. You will use this with your email, phone, or plate.</p>
      {error ? (
        <p className="hakum-auth-alert" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="hakum-auth-info" role="status">
          Password saved. Redirecting to your account…
        </p>
      ) : (
        <form onSubmit={submit} className="hakum-auth-form">
          <label>
            <span>New password</span>
            <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} disabled={!hasSession} />
          </label>
          <label>
            <span>Confirm password</span>
            <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={8} disabled={!hasSession} />
          </label>
          <button type="submit" className="hakum-auth-submit" disabled={submitting || !hasSession}>
            {submitting ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </HakumAuthShell>
  )
}

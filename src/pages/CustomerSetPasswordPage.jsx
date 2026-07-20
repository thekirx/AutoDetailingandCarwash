import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'

export default function CustomerSetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (data.session) {
        setReady(true)
        return
      }
      // Invite / recovery links land with hash tokens; detectSessionInUrl handles exchange
      const timer = window.setTimeout(async () => {
        const { data: again } = await supabase.auth.getSession()
        if (!active) return
        if (!again.session) {
          setError('Open the set-password link from your SMS or email invite first.')
        }
        setReady(true)
      }, 800)
      return () => window.clearTimeout(timer)
    })
    return () => {
      active = false
    }
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
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
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090d12] px-5 py-10 text-slate-100">
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11171f]/90 p-7 shadow-2xl sm:p-10">
        <h1 className="text-xl font-semibold">Hakum Auto Care</h1>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight">Set your password</h2>
        <p className="mt-2 text-sm text-slate-400">Your Team Lead created your account when they checked in your vehicle.</p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p>}
        {done ? (
          <p className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">Password saved. Redirecting…</p>
        ) : (
          <form onSubmit={submit} className="mt-7 space-y-5">
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-300">New password</span>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none" />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs uppercase tracking-wide text-slate-300">Confirm password</span>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none" />
            </label>
            <button disabled={submitting || Boolean(error && error.includes('Open the set-password'))} className="w-full rounded-xl bg-blue-500 px-4 py-3.5 font-semibold text-white hover:bg-blue-400 disabled:opacity-60">
              {submitting ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link className="text-blue-300 hover:underline" to="/signin">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

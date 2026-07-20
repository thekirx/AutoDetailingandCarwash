import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import LoadingScreen from '../components/LoadingScreen'
import { phoneLoginEmail } from '../lib/customerAuth'

export default function CustomerLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, profile, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isSignup = params.get('intent') === 'signup'

  useEffect(() => {
    if (!loading && user && profile?.role === 'customer') navigate('/account', { replace: true })
  }, [loading, user, profile, navigate])

  if (loading) return <LoadingScreen />
  if (user && profile?.role === 'customer') return <Navigate to="/account" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const raw = identifier.trim()
      const email = raw.includes('@') ? raw : phoneLoginEmail(raw)
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw new Error('Invalid phone/email or password.')

      const { data: customer } = await supabase
        .from('customers')
        .select('id, role, is_archived')
        .eq('id', data.user.id)
        .eq('role', 'customer')
        .eq('is_archived', false)
        .maybeSingle()

      if (!customer) {
        await supabase.auth.signOut()
        throw new Error('This login is for customer accounts. Team members use the Team portal.')
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

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090d12] px-5 py-10 text-slate-100">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_25%_20%,rgba(5,38,153,.35),transparent_32%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11171f]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
        <h1 className="text-xl font-semibold tracking-wide">Hakum Auto Care</h1>
        <p className="mt-1 text-xs tracking-[0.2em] text-slate-500 uppercase">Customer portal</p>
        <h2 className="mt-7 text-3xl font-semibold tracking-tight">{isSignup ? 'Welcome' : 'Sign in'}</h2>
        <p className="mt-2 text-sm text-slate-400">
          {isSignup
            ? 'Your account is created when a Team Lead checks in your car. Use the phone or email from that visit, then the password from your invite link.'
            : 'Use your email, or the phone number from your visit.'}
        </p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-medium tracking-wide text-slate-300 uppercase">Phone or email</span>
            <input required value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-blue-400/70" placeholder="09XXXXXXXXX or you@email.com" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium tracking-wide text-slate-300 uppercase">Password</span>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none focus:border-blue-400/70" />
          </label>
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3.5 font-semibold text-white hover:bg-blue-400 disabled:opacity-60">
            <LockKeyhole size={18} />{submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          <Link className="text-blue-300 hover:underline" to="/signin">All portals</Link>
          {' · '}
          <Link className="text-blue-300 hover:underline" to="/">Home</Link>
        </p>
      </div>
    </div>
  )
}

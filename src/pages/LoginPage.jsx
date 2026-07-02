import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { CarFront, LockKeyhole } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import LoadingScreen from '../components/LoadingScreen'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user, isStaff, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user && !isStaff) signOut()
  }, [loading, user, isStaff, signOut])

  if (loading) return <LoadingScreen />
  if (user && isStaff) return <Navigate to={location.state?.from?.pathname || '/admin/dashboard'} replace />

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
      .from('customers')
      .select('role')
      .eq('id', data.user.id)
      .in('role', ['staff', 'admin'])
      .eq('is_archived', false)
      .maybeSingle()

    if (profileError || !staffProfile) {
      await supabase.auth.signOut()
      setError('This account does not have staff or admin portal access.')
      setSubmitting(false)
      return
    }

    navigate(location.state?.from?.pathname || '/admin/dashboard', { replace: true })
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#090d12] px-5 py-10 text-slate-100">
      <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_75%_20%,rgba(163,230,53,.16),transparent_28%),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:auto,48px_48px,48px_48px]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#11171f]/90 p-7 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-9 flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-lime-400 text-[#090d12]"><CarFront /></div><div><h1 className="text-xl font-semibold tracking-wide">Hakum Auto Care</h1><p className="text-xs tracking-[0.2em] text-slate-500 uppercase">Staff portal</p></div></div>
        <div className="mb-7"><h2 className="text-3xl font-semibold tracking-tight">Welcome back.</h2><p className="mt-2 text-sm text-slate-400">Sign in with your authorized staff account.</p></div>

        {location.state?.unauthorized && <p className="mb-5 rounded-xl border border-amber-400/20 bg-amber-400/8 px-4 py-3 text-sm text-amber-200">Staff access is required for that page.</p>}
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-200">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block"><span className="mb-2 block text-xs font-medium tracking-wide text-slate-300 uppercase">Email address</span><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none transition placeholder:text-slate-600 focus:border-lime-400/70 focus:ring-2 focus:ring-lime-400/10" placeholder="staff@hakumautocare.com" /></label>
          <label className="block"><span className="mb-2 block text-xs font-medium tracking-wide text-slate-300 uppercase">Password</span><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 outline-none transition focus:border-lime-400/70 focus:ring-2 focus:ring-lime-400/10" /></label>
          <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 px-4 py-3.5 font-semibold text-[#090d12] transition hover:bg-lime-300 disabled:cursor-wait disabled:opacity-60"><LockKeyhole size={18} />{submitting ? 'Verifying…' : 'Secure sign in'}</button>
        </form>
      </div>
    </div>
  )
}

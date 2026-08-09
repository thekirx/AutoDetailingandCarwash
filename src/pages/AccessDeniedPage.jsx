import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { redirectForRole } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'

/**
 * Lightweight access-denied shell (own chunk — never pull OperationsPages).
 * Hakum bay vernacular: blocked lane, clear recovery to home or login.
 */
export default function AccessDeniedPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const home = profile?.role ? redirectForRole(profile.role) : '/operations/login'

  const goLogin = async () => {
    setBusy(true)
    try {
      await signOut()
    } catch (err) {
      console.warn('[auth] sign out from access denied failed', err?.message || err)
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        /* still navigate */
      }
    } finally {
      navigate('/operations/login', { replace: true, state: { signedOut: true } })
      setBusy(false)
    }
  }

  return (
    <section className="grid min-h-svh place-items-center bg-[radial-gradient(ellipse_at_top,_rgba(14,116,144,0.12),_transparent_55%)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/95 p-8 text-center text-card-foreground shadow-sm backdrop-blur">
        <p className="text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Hakum Ops</p>
        <ShieldAlert className="mx-auto mt-4 text-amber-600 dark:text-amber-200" size={42} aria-hidden />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">Lane closed</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account does not have access to this operations area. Head to your home floor or sign in with a different team account.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {profile?.role ? (
            <Link
              to={home}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-background px-5 py-3 font-semibold text-foreground no-underline"
            >
              Go to my home
            </Link>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={goLogin}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? 'Signing out…' : 'Sign out & back to login'}
          </button>
        </div>
      </div>
    </section>
  )
}

import { Link, Navigate } from 'react-router-dom'
import { CarFront, ClipboardList } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { MARKETING_HOME_PATH, resolveAppHome } from '@/lib/appShell'
import LoadingScreen from '@/components/LoadingScreen'

/**
 * App-first entry for PWA / mobile: stay signed in → home; else customer or team sign-in.
 * Desktop marketing lives at /home (via / → RootEntry).
 */
export default function AppShellGate() {
  const { user, profile, loading } = useAuth()

  if (loading || (user && !profile)) {
    return <LoadingScreen label="Opening Hakum…" />
  }

  const home = resolveAppHome(profile)
  if (user && home) {
    return <Navigate to={home} replace />
  }

  return (
    <section className="portal-gate public-site">
      <div className="portal-gate-panel">
        <p className="portal-gate-kicker">Hakum Auto Care</p>
        <h1>
          Your bay.
          <br />
          <i>Your account.</i>
        </h1>
        <p className="portal-gate-copy">
          Sign in once — you stay signed in on this device until you log out. Track visits, stamps, and queue updates like a native app.
        </p>
        <div className="portal-gate-grid">
          <Link className="portal-card" to="/signin">
            <span className="portal-card-icon" aria-hidden>
              <CarFront size={22} />
            </span>
            <strong>Customer</strong>
            <span>Bookings, loyalty, live queue, and visit history.</span>
            <em>Sign in →</em>
          </Link>
          <Link className="portal-card" to="/operations/login">
            <span className="portal-card-icon" aria-hidden>
              <ClipboardList size={22} />
            </span>
            <strong>Team</strong>
            <span>Queue, POS, crew, and branch operations.</span>
            <em>Team portal →</em>
          </Link>
        </div>
        <p className="portal-gate-foot">
          Prefer the full website? <Link to={MARKETING_HOME_PATH}>Open marketing site</Link>
        </p>
      </div>
    </section>
  )
}

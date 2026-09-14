import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import LoadingScreen from '../components/LoadingScreen'

export default function ProtectedRoute({
  allowedRoles,
  redirectTo = '/operations/login',
  unauthorizedTo = '/operations/access-denied',
}) {
  const { user, profile, loading, retryAuth } = useAuth()
  const location = useLocation()
  const waiting = loading || (user && !profile)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!waiting) {
      setSlow(false)
      return undefined
    }
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [waiting])

  // Session without profile yet = still hydrating (never treat as unauthorized).
  if (waiting) {
    return (
      <LoadingScreen
        label={slow ? 'Still verifying — tap to retry' : undefined}
        onRetry={slow ? retryAuth : undefined}
      />
    )
  }

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
    return <Navigate to={unauthorizedTo} replace state={{ from: location, unauthorized: true }} />
  }

  return <Outlet />
}

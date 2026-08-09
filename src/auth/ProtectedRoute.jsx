import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import LoadingScreen from '../components/LoadingScreen'

export default function ProtectedRoute({
  allowedRoles,
  redirectTo = '/operations/login',
  unauthorizedTo = '/operations/access-denied',
}) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Session without profile yet = still hydrating (never treat as unauthorized).
  if (loading || (user && !profile)) return <LoadingScreen />

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  if (allowedRoles?.length && !allowedRoles.includes(profile.role)) {
    return <Navigate to={unauthorizedTo} replace state={{ from: location, unauthorized: true }} />
  }

  return <Outlet />
}

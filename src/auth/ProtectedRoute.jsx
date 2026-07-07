import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import LoadingScreen from '../components/LoadingScreen'

export default function ProtectedRoute({ allowedRoles, redirectTo = '/operations/login' }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />
  }

  if (allowedRoles?.length && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/operations/access-denied" replace state={{ from: location, unauthorized: true }} />
  }

  return <Outlet />
}

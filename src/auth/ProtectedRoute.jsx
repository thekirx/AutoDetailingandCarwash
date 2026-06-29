import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import LoadingScreen from '../components/LoadingScreen'

export default function ProtectedRoute() {
  const { user, isStaff, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user || !isStaff) {
    return <Navigate to="/login" replace state={{ from: location, unauthorized: Boolean(user) }} />
  }

  return <Outlet />
}

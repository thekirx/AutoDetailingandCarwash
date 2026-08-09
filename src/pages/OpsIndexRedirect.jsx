import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { redirectForRole } from '@/auth/permissions'
import LoadingScreen from '@/components/LoadingScreen'

/** Role-aware landing inside /operations. */
export default function OpsIndexRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return <LoadingScreen />
  if (!profile?.role) return <Navigate to="/operations/login" replace />
  return <Navigate to={redirectForRole(profile.role)} replace />
}

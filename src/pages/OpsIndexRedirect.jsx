import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { resolvePostLoginPath } from '@/auth/authRedirect'
import LoadingScreen from '@/components/LoadingScreen'

/** Role-aware landing inside /operations. */
export default function OpsIndexRedirect() {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return <LoadingScreen />
  if (!profile?.role) return <Navigate to="/operations/login" replace />
  return <Navigate to={resolvePostLoginPath(profile, null)} replace />
}

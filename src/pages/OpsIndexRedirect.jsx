import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { redirectForRole } from '@/auth/permissions'
import LoadingScreen from '@/components/LoadingScreen'

/** Role-aware landing inside /operations. */
export default function OpsIndexRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <Navigate to={redirectForRole(profile?.role)} replace />
}

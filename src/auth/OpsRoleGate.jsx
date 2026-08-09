import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { allowRoute } from '@/auth/permissions'
import LoadingScreen from '@/components/LoadingScreen'

/** Gates an ops page by allowRoute key (permissions matrix). */
export default function OpsRoleGate({ routeKey, children }) {
  const { user, profile, loading } = useAuth()
  if (loading || (user && !profile)) return <LoadingScreen />
  if (!allowRoute(profile, routeKey)) {
    return <Navigate to="/operations/access-denied" replace />
  }
  return children
}

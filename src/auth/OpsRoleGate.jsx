import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { allowRoute } from './permissions'
import LoadingScreen from '@/components/LoadingScreen'

/** Gates an ops page by allowRoute key (permissions matrix). */
export default function OpsRoleGate({ routeKey, children }) {
  const { user, profile, loading, retryAuth } = useAuth()
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

  if (waiting) {
    return (
      <LoadingScreen
        label={slow ? 'Still verifying — tap to retry' : undefined}
        onRetry={slow ? retryAuth : undefined}
      />
    )
  }
  if (!allowRoute(profile, routeKey)) {
    return <Navigate to="/operations/access-denied" replace />
  }
  return children
}

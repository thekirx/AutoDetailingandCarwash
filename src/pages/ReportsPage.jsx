import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canAccessReports } from '@/auth/permissions'

/** Legacy Reports URL → Finance Reports tab (single books surface). */
export default function ReportsPage() {
  const { profile } = useAuth()
  if (!canAccessReports(profile) && !canAccessFinance(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }
  return <Navigate to="/operations/finance?tab=reports" replace />
}

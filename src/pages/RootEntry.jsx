import { Navigate } from 'react-router-dom'
import { prefersAppShell, APP_SHELL_PATH, MARKETING_HOME_PATH } from '@/lib/appShell'

/**
 * `/` — browsers (phone or desktop) → marketing home; installed app → app shell.
 */
export default function RootEntry() {
  if (prefersAppShell()) {
    return <Navigate to={APP_SHELL_PATH} replace />
  }
  return <Navigate to={MARKETING_HOME_PATH} replace />
}

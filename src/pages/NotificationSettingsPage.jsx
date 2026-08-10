import { Navigate } from 'react-router-dom'

/** @deprecated use NotificationsPage — kept for old bookmarks */
export default function NotificationSettingsPage() {
  return <Navigate to="/operations/notifications" replace />
}

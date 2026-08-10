import { Navigate } from 'react-router-dom'

/** @deprecated use NotificationsPage?tab=broadcast — kept for old bookmarks */
export default function BroadcastPage() {
  return <Navigate to="/operations/notifications?tab=broadcast" replace />
}

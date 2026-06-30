import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/LoginPage'
import { AdminPage } from './pages/AdminPages'
import LoadingScreen from './components/LoadingScreen'
import PublicLayout from './layouts/PublicLayout'
import PublicLandingPage from './pages/PublicLandingPage'
import { BookingPage, QueuePage } from './pages/PublicUtilityPage'

const MasterlistPage = lazy(() => import('./pages/MasterlistPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/booking" element={<BookingPage />} />
        <Route path="/queue/:branch" element={<QueuePage />} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
          <Route path="calendar" element={<Suspense fallback={<LoadingScreen />}><CalendarPage /></Suspense>} />
          <Route path="masterlist" element={<Suspense fallback={<LoadingScreen />}><MasterlistPage /></Suspense>} />
          <Route path="services" element={<AdminPage page="services" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

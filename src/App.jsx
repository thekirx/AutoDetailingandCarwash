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
import { BranchesPage, PackagesPage, ServicesPage } from './pages/PublicPages'

const MasterlistPage = lazy(() => import('./pages/MasterlistPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/book" element={<BookingPage />} />
        <Route path="/booking" element={<Navigate to="/book" replace />} />
        <Route path="/queue" element={<QueuePage />} />
        <Route path="/queue/:branch" element={<QueuePage />} />
        <Route path="/branches" element={<BranchesPage />} />
      </Route>
      <Route path="/admin" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/admin" replace />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
          <Route path="bookings" element={<Suspense fallback={<LoadingScreen />}><CalendarPage /></Suspense>} />
          <Route path="queue" element={<AdminPage page="queue" />} />
          <Route path="customers" element={<Suspense fallback={<LoadingScreen />}><MasterlistPage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

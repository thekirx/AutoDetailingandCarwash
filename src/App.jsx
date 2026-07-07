import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import OperationsLayout from './layouts/OperationsLayout'
import LoginPage from './pages/LoginPage'
import { AdminPage } from './pages/AdminPages'
import LoadingScreen from './components/LoadingScreen'
import PublicLayout from './layouts/PublicLayout'
import PublicLandingPage from './pages/PublicLandingPage'
import { BookingPage } from './pages/PublicUtilityPage'
import { BranchesPage, PackagesPage, ServicesPage } from './pages/PublicPages'
import PublicQueuePage from './pages/PublicQueuePage'
import {
  AccessDeniedPage,
  CrewPage,
  KpiPage,
  MyTasksPage,
  NewQueueTicketPage,
  OperationsDashboardPage,
  OperationsQueuePage,
  QueueTicketPage,
} from './pages/OperationsPages'

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
        <Route path="/queue" element={<Navigate to="/queue/bacoor" replace />} />
        <Route path="/branches" element={<BranchesPage />} />
      </Route>
      <Route path="/queue/:branch" element={<PublicQueuePage />} />
      <Route path="/admin" element={<LoginPage />} />
      <Route path="/operations/login" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/operations/login" replace />} />
      <Route path="/operations/access-denied" element={<AccessDeniedPage />} />
      <Route element={<ProtectedRoute allowedRoles={['admin', 'team_lead', 'staff']} />}>
        <Route path="/operations" element={<OperationsLayout />}>
          <Route index element={<Navigate to="/operations/dashboard" replace />} />
          <Route path="dashboard" element={<OperationsDashboardPage />} />
          <Route path="queue" element={<OperationsQueuePage />} />
          <Route path="queue/new" element={<NewQueueTicketPage />} />
          <Route path="queue/:id" element={<QueueTicketPage />} />
          <Route path="crew" element={<CrewPage />} />
          <Route path="kpi" element={<KpiPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute allowedRoles={['staff', 'admin']} redirectTo="/admin" />}>
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

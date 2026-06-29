import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import AdminLayout from './layouts/AdminLayout'
import LoginPage from './pages/LoginPage'
import { AdminPage } from './pages/AdminPages'
import LoadingScreen from './components/LoadingScreen'

const MasterlistPage = lazy(() => import('./pages/MasterlistPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminPage page="dashboard" />} />
          <Route path="calendar" element={<Suspense fallback={<LoadingScreen />}><CalendarPage /></Suspense>} />
          <Route path="masterlist" element={<Suspense fallback={<LoadingScreen />}><MasterlistPage /></Suspense>} />
          <Route path="services" element={<AdminPage page="services" />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}

import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import { OPS_LOGIN_ROLES, ROLES } from './auth/permissions'
import AdminLayout from './layouts/AdminLayout'
import OperationsLayout from './layouts/OperationsLayout'
import LoginPage from './pages/LoginPage'
import { AdminPage } from './pages/AdminPages'
import LoadingScreen from './components/LoadingScreen'
import PublicLayout from './layouts/PublicLayout'
import PublicLandingPage from './pages/PublicLandingPage'
import { BookingPage, QueuePage } from './pages/PublicUtilityPage'
import { BranchesPage, PackagesPage, ServicesPage } from './pages/PublicPages'
import PublicQueuePage from './pages/PublicQueuePage'
import ContactPage from './pages/ContactPage'
import ComplaintsPage from './pages/ComplaintsPage'
import EventsPage from './pages/EventsPage'
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
import PosPage from './pages/PosPage'
import FinancePage from './pages/FinancePage'
import CrmPage from './pages/CrmPage'
import ServicesManagePage from './pages/ServicesManagePage'
import SmsPage from './pages/SmsPage'
import BookingBoardPage from './pages/BookingBoardPage'
import ReportsPage from './pages/ReportsPage'
import MembershipsPage from './pages/MembershipsPage'
import AdminConsolePage from './pages/AdminConsolePage'
import BranchesManagePage from './pages/BranchesManagePage'
import PeopleManagePage from './pages/PeopleManagePage'
import AuditLogPage from './pages/AuditLogPage'
import CustomerSignInPage from './pages/CustomerSignInPage'
import CustomerSignUpPage from './pages/CustomerSignUpPage'
import CustomerSetPasswordPage from './pages/CustomerSetPasswordPage'
import CustomerAccountPage from './pages/CustomerAccountPage'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import NotFoundPage from './pages/NotFoundPage'
import OpsIndexRedirect from './pages/OpsIndexRedirect'

const MasterlistPage = lazy(() => import('./pages/MasterlistPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))

const opsRoles = OPS_LOGIN_ROLES
const adminRoles = [ROLES.ADMIN, ROLES.SUPER_ADMIN]

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
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route element={<ProtectedRoute allowedRoles={['customer']} redirectTo="/signin" />}>
          <Route path="/account" element={<CustomerAccountPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Customer auth — full-bleed (no public chrome); Team portal is a discreet link on sign-in */}
      <Route path="/signin" element={<CustomerSignInPage />} />
      <Route path="/signup" element={<CustomerSignUpPage />} />
      <Route path="/account/login" element={<Navigate to="/signin" replace />} />
      <Route path="/account/set-password" element={<CustomerSetPasswordPage />} />

      <Route path="/queue/:branch" element={<PublicQueuePage />} />
      <Route path="/admin" element={<Navigate to="/operations/login" replace />} />
      <Route path="/operations/login" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/operations/access-denied" element={<AccessDeniedPage />} />

      <Route element={<ProtectedRoute allowedRoles={opsRoles} />}>
        <Route path="/operations" element={<OperationsLayout />}>
          <Route index element={<OpsIndexRedirect />} />
          <Route path="console" element={<AdminConsolePage />} />
          <Route path="people" element={<PeopleManagePage />} />
          <Route path="branches" element={<BranchesManagePage />} />
          <Route path="audit" element={<AuditLogPage />} />
          <Route path="dashboard" element={<OperationsDashboardPage />} />
          <Route path="queue" element={<OperationsQueuePage />} />
          <Route path="queue/new" element={<NewQueueTicketPage />} />
          <Route path="queue/:id" element={<QueueTicketPage />} />
          <Route path="crew" element={<CrewPage />} />
          <Route path="kpi" element={<KpiPage />} />
          <Route path="my-tasks" element={<MyTasksPage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="finance" element={<FinancePage />} />
          <Route path="crm" element={<CrmPage />} />
          <Route path="services" element={<ServicesManagePage />} />
          <Route path="sms" element={<SmsPage />} />
          <Route path="bookings" element={<BookingBoardPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="memberships" element={<MembershipsPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={adminRoles} redirectTo="/operations/login" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
          <Route path="bookings" element={<Suspense fallback={<LoadingScreen />}><CalendarPage /></Suspense>} />
          <Route path="queue" element={<AdminPage page="queue" />} />
          <Route path="customers" element={<Suspense fallback={<LoadingScreen />}><MasterlistPage /></Suspense>} />
          <Route path="reports" element={<Suspense fallback={<LoadingScreen />}><DashboardPage /></Suspense>} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

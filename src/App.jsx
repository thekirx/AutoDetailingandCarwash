import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import OpsRoleGate from './auth/OpsRoleGate'
import { OPS_LOGIN_ROLES } from './auth/permissions'
import OperationsLayout from './layouts/OperationsLayout'
import LoginPage from './pages/LoginPage'
import PublicLayout from './layouts/PublicLayout'
import PublicLandingPage from './pages/PublicLandingPage'
import { BookingPage, QueuePage } from './pages/PublicUtilityPage'
import { BranchesPage, PackagesPage, ServicesPage } from './pages/PublicPages'
import PublicQueuePage from './pages/PublicQueuePage'
import ContactPage from './pages/ContactPage'
import ComplaintsPage from './pages/ComplaintsPage'
import EventsPage from './pages/EventsPage'
import EventSharePage from './pages/EventSharePage'
import PublicFormPage from './pages/PublicFormPage'
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
import BookingBoardPage from './pages/BookingBoardPage'
import PlanningBoardPage from './pages/PlanningBoardPage'
import ReportsPage from './pages/ReportsPage'
import MembershipsPage from './pages/MembershipsPage'
import AdminConsolePage from './pages/AdminConsolePage'
import BranchesManagePage from './pages/BranchesManagePage'
import PeopleManagePage from './pages/PeopleManagePage'
import AuditLogPage from './pages/AuditLogPage'
import DataCenterPage from './pages/DataCenterPage'
import CarsCatalogPage from './pages/CarsCatalogPage'
import CustomerSignInPage from './pages/CustomerSignInPage'
import CustomerSignUpPage from './pages/CustomerSignUpPage'
import CustomerSetPasswordPage from './pages/CustomerSetPasswordPage'
import CustomerAccountPage from './pages/CustomerAccountPage'
import { PrivacyPage, TermsPage } from './pages/LegalPages'
import NotFoundPage from './pages/NotFoundPage'
import OpsIndexRedirect from './pages/OpsIndexRedirect'

const opsRoles = OPS_LOGIN_ROLES

function gate(routeKey, el) {
  return <OpsRoleGate routeKey={routeKey}>{el}</OpsRoleGate>
}

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
        <Route path="/events/:slug" element={<EventSharePage />} />
        <Route path="/f/:slug" element={<PublicFormPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route element={<ProtectedRoute allowedRoles={['customer']} redirectTo="/signin" unauthorizedTo="/signin" />}>
          <Route path="/account" element={<CustomerAccountPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="/signin" element={<CustomerSignInPage />} />
      <Route path="/signup" element={<CustomerSignUpPage />} />
      <Route path="/account/login" element={<Navigate to="/signin" replace />} />
      <Route path="/account/set-password" element={<CustomerSetPasswordPage />} />

      <Route path="/queue/:branch" element={<PublicQueuePage />} />
      <Route path="/admin" element={<Navigate to="/operations/login" replace />} />
      <Route path="/admin/dashboard" element={<Navigate to="/operations/console" replace />} />
      <Route path="/admin/customers" element={<Navigate to="/operations/crm" replace />} />
      <Route path="/admin/bookings" element={<Navigate to="/operations/bookings?tab=calendar" replace />} />
      <Route path="/admin/queue" element={<Navigate to="/operations/queue" replace />} />
      <Route path="/admin/reports" element={<Navigate to="/operations/reports" replace />} />
      <Route path="/operations/login" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/operations/access-denied" element={<AccessDeniedPage />} />

      <Route element={<ProtectedRoute allowedRoles={opsRoles} />}>
        <Route path="/operations" element={<OperationsLayout />}>
          <Route index element={<OpsIndexRedirect />} />
          <Route path="console" element={gate('console', <AdminConsolePage />)} />
          <Route path="people" element={gate('people', <PeopleManagePage />)} />
          <Route path="branches" element={gate('branches', <BranchesManagePage />)} />
          <Route path="cars" element={gate('cars', <CarsCatalogPage />)} />
          <Route path="audit" element={gate('audit', <AuditLogPage />)} />
          <Route path="data-center" element={gate('data-center', <DataCenterPage />)} />
          <Route path="dashboard" element={gate('dashboard', <OperationsDashboardPage />)} />
          <Route path="queue" element={gate('queue', <OperationsQueuePage />)} />
          <Route path="queue/new" element={gate('queue-new', <NewQueueTicketPage />)} />
          <Route path="queue/:id" element={gate('queue', <QueueTicketPage />)} />
          <Route path="crew" element={gate('crew', <CrewPage />)} />
          <Route path="kpi" element={gate('kpi', <KpiPage />)} />
          <Route path="my-tasks" element={gate('my-tasks', <MyTasksPage />)} />
          <Route path="pos" element={gate('pos', <PosPage />)} />
          <Route path="finance" element={gate('finance', <FinancePage />)} />
          <Route path="crm" element={gate('crm', <CrmPage />)} />
          <Route path="services" element={gate('pos', <Navigate to="/operations/pos?tab=services" replace />)} />
          <Route path="products" element={gate('pos', <Navigate to="/operations/pos?tab=merch" replace />)} />
          <Route path="sms" element={gate('crm', <Navigate to="/operations/crm?tab=sms" replace />)} />
          <Route path="bookings" element={gate('bookings', <BookingBoardPage />)} />
          <Route path="planning" element={gate('planning', <PlanningBoardPage />)} />
          <Route path="reports" element={gate('reports', <ReportsPage />)} />
          <Route path="memberships" element={gate('memberships', <MembershipsPage />)} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

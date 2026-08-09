import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import OpsRoleGate from './auth/OpsRoleGate'
import { OPS_LOGIN_ROLES } from './auth/permissions'
import OperationsLayout from './layouts/OperationsLayout'
import PublicLayout from './layouts/PublicLayout'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OpsIndexRedirect from './pages/OpsIndexRedirect'

const PublicLandingPage = lazy(() => import('./pages/PublicLandingPage'))
const PublicQueuePage = lazy(() => import('./pages/PublicQueuePage'))
const PublicQueueTvPage = lazy(() =>
  import('./pages/PublicQueuePage').then((m) => ({ default: m.PublicQueueTvPage })),
)
const ContactPage = lazy(() => import('./pages/ContactPage'))
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const EventSharePage = lazy(() => import('./pages/EventSharePage'))
const PublicFormPage = lazy(() => import('./pages/PublicFormPage'))
const CustomerSignInPage = lazy(() => import('./pages/CustomerSignInPage'))
const CustomerSignUpPage = lazy(() => import('./pages/CustomerSignUpPage'))
const CustomerSetPasswordPage = lazy(() => import('./pages/CustomerSetPasswordPage'))
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage'))

const AdminConsolePage = lazy(() => import('./pages/AdminConsolePage'))
const PeopleManagePage = lazy(() => import('./pages/PeopleManagePage'))
const BranchesManagePage = lazy(() => import('./pages/BranchesManagePage'))
const CarsCatalogPage = lazy(() => import('./pages/CarsCatalogPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const DataCenterPage = lazy(() => import('./pages/DataCenterPage'))
const PosPage = lazy(() => import('./pages/PosPage'))
const FinancePage = lazy(() => import('./pages/FinancePage'))
const CrmPage = lazy(() => import('./pages/CrmPage'))
const ContentManagePage = lazy(() => import('./pages/ContentManagePage'))
const BookingBoardPage = lazy(() => import('./pages/BookingBoardPage'))
const PlanningBoardPage = lazy(() => import('./pages/PlanningBoardPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const MembershipsPage = lazy(() => import('./pages/MembershipsPage'))
const KpiPage = lazy(() => import('./pages/KpiPage'))

const BookingPage = lazy(() =>
  import('./pages/PublicUtilityPage').then((m) => ({ default: m.BookingPage })),
)
const QueuePage = lazy(() =>
  import('./pages/PublicUtilityPage').then((m) => ({ default: m.QueuePage })),
)
const ServicesPage = lazy(() =>
  import('./pages/PublicPages').then((m) => ({ default: m.ServicesPage })),
)
const PackagesPage = lazy(() =>
  import('./pages/PublicPages').then((m) => ({ default: m.PackagesPage })),
)
const BranchesPage = lazy(() =>
  import('./pages/PublicPages').then((m) => ({ default: m.BranchesPage })),
)
const PrivacyPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPage })),
)
const TermsPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.TermsPage })),
)
const CookiesPage = lazy(() =>
  import('./pages/LegalPages').then((m) => ({ default: m.CookiesPage })),
)
const ForbiddenPage = lazy(() => import('./pages/ForbiddenPage'))

const OperationsDashboardPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.OperationsDashboardPage })),
)
const OperationsQueuePage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.OperationsQueuePage })),
)
const QueueTicketPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.QueueTicketPage })),
)
const NewQueueTicketPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.NewQueueTicketPage })),
)
const CrewPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.CrewPage })),
)
const MyTasksPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.MyTasksPage })),
)
const AccessDeniedPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.AccessDeniedPage })),
)

const opsRoles = OPS_LOGIN_ROLES

function gate(routeKey, el) {
  return <OpsRoleGate routeKey={routeKey}>{el}</OpsRoleGate>
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route
            element={
              <ProtectedRoute allowedRoles={['customer']} redirectTo="/signin" unauthorizedTo="/403" />
            }
          >
            <Route path="/account" element={<CustomerAccountPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="/signin" element={<CustomerSignInPage />} />
        <Route path="/signup" element={<CustomerSignUpPage />} />
        <Route path="/account/login" element={<Navigate to="/signin" replace />} />
        <Route path="/account/set-password" element={<CustomerSetPasswordPage />} />

        <Route path="/queue/:branch" element={<PublicQueuePage />} />
        <Route path="/queue/:branch/tv" element={<PublicQueueTvPage />} />
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
            <Route path="content" element={gate('content', <ContentManagePage />)} />
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
    </Suspense>
  )
}

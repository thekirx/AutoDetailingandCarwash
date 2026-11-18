import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import ProtectedRoute from './auth/ProtectedRoute'
import OpsRoleGate from './auth/OpsRoleGate'
import { useAuth } from './auth/AuthProvider'
import { allowRoute, canAccessCrm, canAccessRewardsHub, OPS_LOGIN_ROLES, usesFloorAppShell } from './auth/permissions'
import OperationsLayout from './layouts/OperationsLayout'
import PublicLayout from './layouts/PublicLayout'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OpsIndexRedirect from './pages/OpsIndexRedirect'
import InAppNotificationListener from './components/InAppNotificationListener'
import PwaUpdateBanner from './components/PwaUpdateBanner'

const PublicLandingPage = lazy(() => import('./pages/PublicLandingPage'))
const ServiceDetailPage = lazy(() => import('./pages/ServiceDetailPage'))
const TintFinderPage = lazy(() => import('./pages/TintFinderPage'))
const RootEntry = lazy(() => import('./pages/RootEntry'))
const AppShellGate = lazy(() => import('./pages/AppShellGate'))
const PublicQueuePage = lazy(() => import('./pages/PublicQueuePage'))
const PublicQueueTvPage = lazy(() => import('./pages/PublicQueueTvPage'))
const ContactPage = lazy(() => import('./pages/ContactPage'))
const PartnershipsPage = lazy(() => import('./pages/PartnershipsPage'))
const ReferPage = lazy(() => import('./pages/ReferPage'))
const ReferralLinkPage = lazy(() => import('./pages/ReferralLinkPage'))
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const EventSharePage = lazy(() => import('./pages/EventSharePage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const BranchCityPage = lazy(() => import('./pages/BranchCityPage'))
const CustomerBlogPage = lazy(() => import('./pages/CustomerBlogPage'))
const CustomerEventsPage = lazy(() => import('./pages/CustomerEventsPage'))
const PublicFormPage = lazy(() => import('./pages/PublicFormPage'))
const CustomerSignInPage = lazy(() => import('./pages/CustomerSignInPage'))
const CustomerSignUpPage = lazy(() => import('./pages/CustomerSignUpPage'))
const CustomerSetPasswordPage = lazy(() => import('./pages/CustomerSetPasswordPage'))
const CustomerAccountPage = lazy(() => import('./pages/CustomerAccountPage'))
const CustomerQueuePage = lazy(() => import('./pages/CustomerQueuePage'))
const CustomerBookPage = lazy(() => import('./pages/CustomerBookPage'))
const CustomerPickupPage = lazy(() => import('./pages/CustomerPickupPage'))
const CustomerLoyaltyPage = lazy(() => import('./pages/CustomerLoyaltyPage'))
const CustomerReferralPage = lazy(() => import('./pages/CustomerReferralPage'))
const CustomerVouchersPage = lazy(() => import('./pages/CustomerVouchersPage'))
const CustomerVisitPage = lazy(() => import('./pages/CustomerVisitPage'))
const CustomerMorePage = lazy(() => import('./pages/CustomerMorePage'))
const CustomerCarsPage = lazy(() => import('./pages/CustomerCarsPage'))
const ContentAdminPage = lazy(() => import('./pages/ContentAdminPage'))

const PeopleManagePage = lazy(() => import('./pages/PeopleManagePage'))
const EmployeesHubPage = lazy(() => import('./pages/EmployeesHubPage'))
const BranchesManagePage = lazy(() => import('./pages/BranchesManagePage'))
const CarsCatalogPage = lazy(() => import('./pages/CarsCatalogPage'))
const VehicleTransferPage = lazy(() => import('./pages/VehicleTransferPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const DataCenterPage = lazy(() => import('./pages/DataCenterPage'))
const SystemHubPage = lazy(() => import('./pages/SystemHubPage'))
const InquiriesPage = lazy(() => import('./pages/InquiriesPage'))
const PosPage = lazy(() => import('./pages/PosPage'))
const MerchShopPage = lazy(() => import('./pages/MerchShopPage'))
const InventoryPage = lazy(() => import('./pages/InventoryPage'))
const FinancePage = lazy(() => import('./pages/FinancePage'))
const CrmPage = lazy(() => import('./pages/CrmPage'))
const BookingBoardPage = lazy(() => import('./pages/BookingBoardPage'))
const PlanningBoardPage = lazy(() => import('./pages/PlanningBoardPage'))
const FormResultsBoardPage = lazy(() => import('./pages/FormResultsBoardPage'))
const AccessDeniedPage = lazy(() => import('./pages/AccessDeniedPage'))
const SettingsHubPage = lazy(() => import('./pages/SettingsHubPage'))
const PosSettingsPage = lazy(() => import('./pages/settings/PosSettingsPage'))
const TintFinderSettingsPage = lazy(() => import('./pages/settings/TintFinderSettingsPage'))
const DailySheetRulesPage = lazy(() => import('./pages/settings/DailySheetRulesPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AttendancePage = lazy(() => import('./pages/AttendancePage'))
const MyCashAdvancesPage = lazy(() => import('./pages/MyCashAdvancesPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))
const BroadcastPage = lazy(() => import('./pages/BroadcastPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const MembershipsPage = lazy(() => import('./pages/MembershipsPage'))
const VouchersPage = lazy(() => import('./pages/VouchersPage'))
const RewardsPage = lazy(() => import('./pages/RewardsPage'))
const MonthlyPayrollPage = lazy(() => import('./pages/MonthlyPayrollPage'))
const MyPayslipsPage = lazy(() => import('./pages/MyPayslipsPage'))
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'))
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
const MyTasksPage = lazy(() =>
  import('./pages/OperationsPages').then((m) => ({ default: m.MyTasksPage })),
)

const opsRoles = OPS_LOGIN_ROLES

function gate(routeKey, el) {
  return <OpsRoleGate routeKey={routeKey}>{el}</OpsRoleGate>
}

function CustomerHubRedirect({ tab, subTabParam, fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!canAccessCrm(profile)) return fallback
  const params = new URLSearchParams(searchParams)
  if (subTabParam && params.get('tab')) {
    params.set(subTabParam, params.get('tab'))
  }
  params.set('tab', tab)
  return <Navigate to={`/operations/crm?${params.toString()}`} replace />
}

function RewardsHubRedirect({ tab, subTabParam, fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!canAccessRewardsHub(profile)) return fallback
  const params = new URLSearchParams(searchParams)
  if (subTabParam && params.get('tab')) {
    params.set(subTabParam, params.get('tab'))
  }
  params.set('tab', tab)
  return <Navigate to={`/operations/rewards?${params.toString()}`} replace />
}

function EmployeesHubRedirect({ defaultTab = 'employees', preserveTabParam = false, fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!allowRoute(profile, 'employees') || usesFloorAppShell(profile)) return fallback
  const params = new URLSearchParams(searchParams)
  const incomingTab = params.get('tab')
  const hubTabs = new Set(['clock', 'attendance', 'register', 'employees', 'access', 'settings'])
  if (preserveTabParam && incomingTab && hubTabs.has(incomingTab)) {
    params.set('tab', incomingTab)
  } else {
    if (incomingTab && ['crew', 'tl', 'admins', 'office'].includes(incomingTab)) {
      params.set('dtab', incomingTab)
    }
    params.set('tab', defaultTab)
  }
  return <Navigate to={`/operations/employees?${params.toString()}`} replace />
}

function FinanceHubRedirect({ tab, fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!allowRoute(profile, 'finance')) return fallback
  const params = new URLSearchParams(searchParams)
  params.set('tab', tab)
  return <Navigate to={`/operations/finance?${params.toString()}`} replace />
}

function SystemHubRedirect({ tab, fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!allowRoute(profile, 'system')) return fallback
  const params = new URLSearchParams(searchParams)
  params.set('tab', tab)
  return <Navigate to={`/operations/system?${params.toString()}`} replace />
}

function CatalogCarsRedirect({ fallback }) {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  if (!allowRoute(profile, 'inventory') || !allowRoute(profile, 'cars')) return fallback
  const params = new URLSearchParams(searchParams)
  params.set('tab', 'cars')
  return <Navigate to={`/operations/inventory?${params.toString()}`} replace />
}

function RouteFallback() {
  return (
    <div data-loading="true" className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <InAppNotificationListener />
      <PwaUpdateBanner />
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/app" element={<AppShellGate />} />

        <Route element={<PublicLayout />}>
          <Route path="/home" element={<PublicLandingPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/services/:slug" element={<ServiceDetailPage />} />
          <Route path="/tint-finder" element={<TintFinderPage />} />
          <Route path="/packages" element={<Navigate to="/services" replace />} />
          <Route path="/book" element={<BookingPage />} />
          <Route path="/booking" element={<Navigate to="/book" replace />} />
          <Route path="/queue" element={<QueuePage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/branches/:citySlug" element={<BranchCityPage />} />
          <Route path="/partnerships" element={<PartnershipsPage />} />
          <Route path="/refer" element={<ReferPage />} />
          <Route path="/r/:code" element={<ReferralLinkPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/complaints" element={<ComplaintsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:slug" element={<EventSharePage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
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
            <Route path="/account/blog" element={<CustomerBlogPage />} />
            <Route path="/account/events" element={<CustomerEventsPage />} />
            <Route path="/account/queue" element={<CustomerQueuePage />} />
            <Route path="/account/book" element={<CustomerBookPage />} />
            <Route path="/account/pickup/:id" element={<CustomerPickupPage />} />
            <Route path="/account/loyalty" element={<CustomerLoyaltyPage />} />
            <Route path="/account/referral" element={<CustomerReferralPage />} />
            <Route path="/account/vouchers" element={<CustomerVouchersPage />} />
            <Route path="/account/more" element={<CustomerMorePage />} />
            <Route path="/account/cars" element={<CustomerCarsPage />} />
            <Route path="/account/visit" element={<CustomerVisitPage />} />
            <Route path="/account/visit/:id" element={<CustomerVisitPage />} />
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
        <Route path="/admin/dashboard" element={<Navigate to="/operations/dashboard" replace />} />
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
            <Route path="employees" element={gate('employees', <EmployeesHubPage />)} />
            <Route path="people" element={gate('people', <EmployeesHubRedirect defaultTab="employees" preserveTabParam fallback={<PeopleManagePage />} />)} />
            <Route path="branches" element={gate('branches', <BranchesManagePage />)} />
            <Route path="cars" element={gate('cars', <CatalogCarsRedirect fallback={<CarsCatalogPage />} />)} />
            <Route path="vehicle-transfer" element={gate('vehicle-transfer', <CustomerHubRedirect tab="transfer" fallback={<VehicleTransferPage />} />)} />
            <Route path="system" element={gate('system', <SystemHubPage />)} />
            <Route path="audit" element={gate('audit', <SystemHubRedirect tab="audit" fallback={<AuditLogPage />} />)} />
            <Route path="data-center" element={gate('data-center', <SystemHubRedirect tab="data-center" fallback={<DataCenterPage />} />)} />
            <Route path="inquiries" element={gate('inquiries', <CustomerHubRedirect tab="inquiries" fallback={<InquiriesPage />} />)} />
            <Route path="dashboard" element={gate('dashboard', <OperationsDashboardPage />)} />
            <Route path="queue" element={gate('queue', <OperationsQueuePage />)} />
            <Route path="queue/new" element={gate('queue-new', <NewQueueTicketPage />)} />
            <Route path="queue/:id" element={gate('queue', <QueueTicketPage />)} />
            <Route path="crew" element={<Navigate to="/operations/attendance" replace />} />
            <Route path="attendance" element={gate('attendance', <EmployeesHubRedirect defaultTab="attendance" preserveTabParam fallback={<AttendancePage />} />)} />
            <Route path="my-advances" element={gate('my-advances', <MyCashAdvancesPage />)} />
            <Route path="kpi" element={gate('kpi', <KpiPage />)} />
            <Route path="my-tasks" element={gate('my-tasks', <MyTasksPage />)} />
            <Route path="pos" element={gate('pos', <PosPage />)} />
            <Route path="merch-shop" element={gate('merch-shop', <RewardsHubRedirect tab="points-shop" fallback={<MerchShopPage />} />)} />
            <Route path="inventory" element={gate('inventory', <InventoryPage />)} />
            <Route path="approvals" element={gate('approvals', <FinanceHubRedirect tab="approvals" fallback={<ApprovalsPage />} />)} />
            <Route path="finance" element={gate('finance', <FinancePage />)} />
            <Route path="monthly-payroll" element={gate('monthly-payroll', <FinanceHubRedirect tab="salaries" fallback={<MonthlyPayrollPage />} />)} />
            <Route path="my-pay" element={<Navigate to="/operations" replace />} />
            <Route path="payslips" element={gate('payslips', <MyPayslipsPage />)} />
            <Route path="payroll" element={<Navigate to="/operations/monthly-payroll" replace />} />
            <Route path="crm" element={gate('crm', <CrmPage />)} />
            <Route path="services" element={gate('inventory', <Navigate to="/operations/inventory?tab=services&scope=bay" replace />)} />
            <Route path="products" element={gate('inventory', <Navigate to="/operations/inventory?tab=merch" replace />)} />
            <Route path="sms" element={gate('crm', <Navigate to="/operations/crm?tab=sms" replace />)} />
            <Route path="bookings" element={gate('bookings', <BookingBoardPage />)} />
            <Route path="planning" element={gate('planning', <PlanningBoardPage />)} />
            <Route path="forms/results" element={gate('planning', <FormResultsBoardPage />)} />
            <Route path="forms/results/:formSlug" element={gate('planning', <FormResultsBoardPage />)} />
            <Route path="roadmap" element={<Navigate to="/operations" replace />} />
            <Route path="settings" element={gate('settings', <SettingsHubPage />)} />
            <Route path="settings/tint-finder" element={gate('settings', <TintFinderSettingsPage />)} />
            <Route path="settings/pos" element={gate('settings', <PosSettingsPage />)} />
            <Route path="settings/daily-sheet" element={gate('settings', <DailySheetRulesPage />)} />
            <Route path="settings/payroll" element={<Navigate to="/operations/settings/daily-sheet" replace />} />
            <Route path="content" element={gate('content', <ContentAdminPage />)} />
            <Route path="notifications" element={gate('notifications', <NotificationsPage />)} />
            <Route path="history" element={gate('history', <HistoryPage />)} />
            <Route path="broadcast" element={gate('notifications', <BroadcastPage />)} />
            <Route path="reports" element={gate('reports', <ReportsPage />)} />
            <Route path="rewards" element={gate('rewards', <RewardsPage />)} />
            <Route path="memberships" element={gate('memberships', <RewardsHubRedirect tab="memberships" subTabParam="mtab" fallback={<MembershipsPage />} />)} />
            <Route path="vouchers" element={gate('vouchers', <RewardsHubRedirect tab="vouchers" fallback={<VouchersPage />} />)} />
            <Route path="reviews" element={gate('reviews', <Navigate to="/operations/forms/results" replace />)} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}

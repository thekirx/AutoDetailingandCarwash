/** Finance module shell — Xero-like books hub for Hakum Auto Care.
 * Tabs: Dashboard · Sales · Bills · P&L · Shift · Expense reports · Categories · Reports.
 * Real POS income + real expenses, scoped per branch or all branches. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  FileBarChart,
  Tags,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  Building2,
  Truck,
  Mail,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canOpenFinanceHub, canSeeAllBranches, canWriteFinance, ROLES } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  FINANCE_TABS,
  resolveFinanceTab,
  financeRangeIso,
  financeCompareRange,
  formatFinanceWindow,
  scopeBranch,
  branchScopeList,
  rollupPl,
} from '@/lib/financeData'
import {
  canAccessCorporateFinance,
  canManageFinanceVendors,
  filterFinanceBranchOptions,
  labelFinanceBranch,
} from '@/lib/financeCorporate'
import { collectPaged } from '@/lib/crmInsights'
import { formatMoney } from '@/queue/queueApi'
import FinanceFilters from './finance/FinanceFilters'
import FinanceOverviewTab from './finance/FinanceOverviewTab'
import FinanceSalesTab from './finance/FinanceSalesTab'
import FinancePurchasesTab from './finance/FinancePurchasesTab'
import FinancePLTab from './finance/FinancePLTab'
import FinanceCategoriesTab from './finance/FinanceCategoriesTab'
import FinanceReportsTab from './finance/FinanceReportsTab'
import FinanceShiftCloseTab from './finance/FinanceShiftCloseTab'
import FinanceExpenseReportsTab from './finance/FinanceExpenseReportsTab'
import FinanceVendorsTab from './finance/FinanceVendorsTab'
import FinanceQuotesTab from './finance/FinanceQuotesTab'
import FinanceCorporateTab from './finance/FinanceCorporateTab'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { FINANCE_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { opsTabSearchParams } from '@/lib/opsShell'

const TAB_ICONS = {
  overview: LayoutDashboard,
  sales: ShoppingCart,
  purchases: Receipt,
  pl: FileBarChart,
  'shift-close': ClipboardCheck,
  'expense-reports': FileSpreadsheet,
  vendors: Truck,
  quotes: Mail,
  corporate: Building2,
  categories: Tags,
  reports: BookOpen,
}

export default function FinancePage() {
  const { profile } = useAuth()
  const booksAccess = canAccessFinance(profile)
  const canWrite = booksAccess && canWriteFinance(profile)
  const canManageVendors = canManageFinanceVendors(profile)
  const showCorporate = canAccessCorporateFinance(profile)
  const reportsOnly = !booksAccess && canOpenFinanceHub(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = reportsOnly ? 'reports' : resolveFinanceTab(searchParams.get('tab'))
  const visibleTabs = useMemo(() => {
    if (reportsOnly) return FINANCE_TABS.filter((t) => t.id === 'reports')
    return FINANCE_TABS.filter((t) => {
      if (t.id === 'corporate') return showCorporate
      // Quotes write is SA/ASA/admin; investor has no SELECT on finance_quotes
      if (t.id === 'quotes' && profile?.role === ROLES.INVESTOR) return false
      return true
    })
  }, [reportsOnly, showCorporate, profile?.role])

  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [vendors, setVendors] = useState([])
  const [salesRows, setSalesRows] = useState([])
  const [plRows, setPlRows] = useState([])
  const [priorPlRows, setPriorPlRows] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const scope = branchScopeList(profile)
  const [branchFilter, setBranchFilter] = useState(scope === null ? 'all' : (scope[0] || 'all'))
  const [datePreset, setDatePreset] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [comparePreset, setComparePreset] = useState('none')

  const range = useMemo(
    () => financeRangeIso(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  )
  const compareRange = useMemo(
    () => financeCompareRange(range.start, range.end, comparePreset),
    [range.start, range.end, comparePreset],
  )

  const branchOptions = useMemo(() => {
    const labeled = (list) =>
      filterFinanceBranchOptions(list, profile).map((b) => ({
        slug: b.slug,
        name: labelFinanceBranch(b),
      }))
    if (scope === null) {
      return [{ slug: 'all', name: 'All branches' }, ...labeled(branches)]
    }
    return labeled(branches.filter((b) => scope.includes(b.slug)))
  }, [branches, scope, profile])

  useEffect(() => {
    if (branchFilter !== 'all' && branchOptions.length && !branchOptions.some((b) => b.slug === branchFilter)) {
      setBranchFilter(branchOptions[0]?.slug || 'all')
    }
  }, [branchFilter, branchOptions])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const startIso = `${range.start}T00:00:00+08:00`
      const endIso = `${range.end}T23:59:59.999+08:00`

      let salesQ = supabase
        .from('daily_sales_summary')
        .select('*')
        .gte('sale_date', range.start)
        .lte('sale_date', range.end)
        .order('sale_date', { ascending: false })
      salesQ = scopeBranch(salesQ, profile, branchFilter)

      let plQ = supabase
        .from('finance_daily_pl')
        .select('*')
        .gte('period_date', range.start)
        .lte('period_date', range.end)
      plQ = scopeBranch(plQ, profile, branchFilter)

      let priorQ = null
      if (compareRange) {
        priorQ = supabase
          .from('finance_daily_pl')
          .select('*')
          .gte('period_date', compareRange.start)
          .lte('period_date', compareRange.end)
        priorQ = scopeBranch(priorQ, profile, branchFilter)
      }

      const [branchRows, cats, sales, pl, expRows, prior, vendorRes] = await Promise.all([
        listBranches(),
        supabase.from('expense_categories').select('id, name, is_chemical, kind').order('name'),
        salesQ,
        plQ,
        collectPaged(async (from, to) => {
          let q = supabase
            .from('expenses')
            .select('id, title, description, total_minor, branch, status, expense_kind, category_id, vendor_id, created_at, quantity, unit_cost_minor')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .range(from, to)
          q = scopeBranch(q, profile, branchFilter)
          const { data, error } = await q
          if (error) throw error
          return data || []
        }, 1000),
        priorQ || Promise.resolve({ data: [], error: null }),
        supabase.from('vendors').select('id, name, is_active').eq('is_active', true).order('name'),
      ])
      if (cats.error) throw cats.error
      if (sales.error) throw sales.error
      if (pl.error) throw pl.error
      if (prior.error) throw prior.error
      // ponytail: vendors table may be missing until P5 migration — soft-fail empty list
      if (vendorRes.error) console.warn('vendors load:', vendorRes.error.message)
      setBranches(branchRows || [])
      setCategories(cats.data || [])
      setVendors(vendorRes.error ? [] : vendorRes.data || [])
      setSalesRows(sales.data || [])
      setPlRows(pl.data || [])
      setPriorPlRows(prior.data || [])
      setExpenses(expRows)
    } catch (err) {
      const message = err.message || 'Unable to load finance data'
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter, range.start, range.end, compareRange])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (reportsOnly && searchParams.get('tab') !== 'reports') {
      setSearchParams({ tab: 'reports' }, { replace: true })
      return
    }
    if (!reportsOnly && !visibleTabs.some((t) => t.id === tab)) {
      setSearchParams({}, { replace: true })
    }
  }, [reportsOnly, searchParams, setSearchParams, visibleTabs, tab])

  const writableBranches = useMemo(() => {
    if (scope === null) return branches
    return branches.filter((b) => scope.includes(b.slug))
  }, [branches, scope])

  const windowLabel = useMemo(
    () => formatFinanceWindow(range.start, range.end),
    [range.start, range.end],
  )

  const headlinePl = useMemo(() => rollupPl(plRows), [plRows])

  const branchName = useMemo(() => {
    if (branchFilter === 'all') return 'All branches'
    return branchOptions.find((b) => b.slug === branchFilter)?.name || branchFilter
  }, [branchFilter, branchOptions])

  if (!canOpenFinanceHub(profile)) return <Navigate to="/operations/access-denied" replace />

  function setTab(next) {
    if (reportsOnly) {
      setSearchParams({ tab: 'reports' }, { replace: true })
      return
    }
    setSearchParams(opsTabSearchParams(next, 'overview'), { replace: true })
  }

  const activeTab = visibleTabs.find((t) => t.id === tab) || FINANCE_TABS.find((t) => t.id === 'reports')
  const ActiveIcon = TAB_ICONS[tab] || LayoutDashboard
  const financeStepIcons = {
    sales: ShoppingCart,
    shift: ClipboardCheck,
    bills: Receipt,
    payroll: FileBarChart,
  }

  return (
    <OpsPageShell
      className="finance-shell hakum-finance gap-4"
      eyebrow="Books · Hakum Auto Care"
      title={activeTab?.label || 'Dashboard'}
      icon={ActiveIcon}
      description={`${activeTab?.hint || 'Finance overview'} · ${windowLabel} · ${branchName}`}
      actions={
        <>
          <div className="finance-net-chip" data-tone={headlinePl.net >= 0 ? 'up' : 'down'}>
            <p className="finance-net-label">{headlinePl.net >= 0 ? 'Net profit' : 'Net loss'}</p>
            <p className="finance-net-value tabular-nums">{loading ? '—' : formatMoney(headlinePl.net)}</p>
          </div>
          <Badge variant={canWrite ? 'default' : 'secondary'} className="finance-role-badge">
            {canWrite ? 'Can edit' : 'View only'}
          </Badge>
        </>
      }
    >
      {!reportsOnly ? (
        <OpsGuideCard
          title="How Finance works"
          description="Income from POS, expenses from bills, shift closes before payroll. Open a step if you are new to books."
          steps={FINANCE_WORKFLOW_STEPS}
          stepIcons={financeStepIcons}
          defaultOpen={tab === 'overview'}
        />
      ) : null}

      <FinanceFilters
        branchOptions={branchOptions}
        branchFilter={branchFilter}
        onBranchChange={setBranchFilter}
        datePreset={datePreset}
        onDatePresetChange={(next) => {
          setDatePreset(next)
          if (next === 'custom' && !customStart && !customEnd) {
            setCustomStart(range.start)
            setCustomEnd(range.end)
          }
        }}
        customStart={customStart}
        customEnd={customEnd}
        onCustomRangeChange={(s, e) => {
          setCustomStart(s)
          setCustomEnd(e)
        }}
        comparePreset={comparePreset}
        onCompareChange={setComparePreset}
        showBranch={canSeeAllBranches(profile) || branchOptions.length > 1}
        onRefresh={load}
        refreshing={loading}
        windowLabel={windowLabel}
      />

      {loadError ? (
        <div
          role="alert"
          className="finance-load-error mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Finance data failed to load</p>
          <p className="mt-1 text-destructive/90">{loadError}</p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-destructive/30 bg-background px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/5 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="finance-tabs">
        <div className="finance-tabs-rail">
          <TabsList className="finance-tabs-list">
            {visibleTabs.map((item) => {
              const Icon = TAB_ICONS[item.id]
              return (
                <TabsTrigger key={item.id} value={item.id} title={item.hint} className="cursor-pointer">
                  {Icon ? <Icon aria-hidden /> : null}
                  <span>{item.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <Separator className="finance-tabs-sep" />

        <TabsContent value="overview" className="finance-tab-panel">
          <FinanceOverviewTab
            plRows={plRows}
            priorPlRows={priorPlRows}
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={range}
            compareRange={compareRange}
            loading={loading}
            onNavigate={setTab}
          />
        </TabsContent>

        <TabsContent value="sales" className="finance-tab-panel">
          <FinanceSalesTab
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={range}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="purchases" className="finance-tab-panel">
          <FinancePurchasesTab
            expenses={expenses}
            categories={categories}
            vendors={vendors}
            branches={branches}
            writableBranches={writableBranches.map((b) => ({ ...b, name: labelFinanceBranch(b) }))}
            canWrite={canWrite}
            range={range}
            loading={loading}
            onReload={load}
          />
        </TabsContent>

        <TabsContent value="pl" className="finance-tab-panel">
          <FinancePLTab
            plRows={plRows}
            priorPlRows={priorPlRows}
            range={range}
            compareRange={compareRange}
            comparePreset={comparePreset}
            onCompareChange={setComparePreset}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="shift-close" className="finance-tab-panel">
          <FinanceShiftCloseTab
            profile={profile}
            range={range}
            branchFilter={branchFilter}
            canWrite={canWrite}
          />
        </TabsContent>

        <TabsContent value="expense-reports" className="finance-tab-panel">
          <FinanceExpenseReportsTab
            profile={profile}
            categories={categories}
            writableBranches={writableBranches}
            canWrite={canWrite}
            onReload={load}
            branchFilter={branchFilter}
            range={range}
          />
        </TabsContent>

        <TabsContent value="vendors" className="finance-tab-panel">
          <FinanceVendorsTab
            canManage={canManageVendors}
            onVendorsChange={(rows) => setVendors((rows || []).filter((v) => v.is_active))}
          />
        </TabsContent>

        <TabsContent value="quotes" className="finance-tab-panel">
          <FinanceQuotesTab
            canWrite={canWrite}
            branches={writableBranches.map((b) => ({ ...b, name: labelFinanceBranch(b) }))}
          />
        </TabsContent>

        <TabsContent value="corporate" className="finance-tab-panel">
          <FinanceCorporateTab profile={profile} range={range} />
        </TabsContent>

        <TabsContent value="categories" className="finance-tab-panel">
          <FinanceCategoriesTab categories={categories} canWrite={canWrite} onReload={load} />
        </TabsContent>

        <TabsContent value="reports" className="finance-tab-panel">
          <FinanceReportsTab
            salesRows={salesRows}
            plRows={plRows}
            expenses={expenses}
            range={range}
            loading={loading}
            profile={profile}
            branchFilter={branchFilter}
          />
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  )
}

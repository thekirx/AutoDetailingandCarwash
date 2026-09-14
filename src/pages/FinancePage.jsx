/** Finance module shell — Xero-like books hub for Hakum Auto Care.
 * Tabs: Dashboard · Sales · Bills · P&L · Shift · Expense reports · Categories · Reports.
 * Real POS income + real expenses, scoped per branch or all branches. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
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
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canOpenFinanceHub, canSeeAllBranches, canWriteFinance, ROLES } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  FINANCE_PRIMARY_TAB_IDS,
  FINANCE_TABS,
  buildFinanceSearchParams,
  financeCompareRange,
  financeEmptyWindowCue,
  financeRangeIso,
  financeStatementCues,
  formatFinanceWindow,
  isFinancePrimaryTab,
  parseFinanceSearch,
  postedPayrollExpenseMinor,
  resolveFinanceTab,
  rollupPl,
  scopeBranch,
  branchScopeList,
  validateFinanceCustomRange,
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
  const scope = branchScopeList(profile)
  const defaultBranch = scope === null ? 'all' : (scope[0] || 'all')
  const parsed = useMemo(
    () => parseFinanceSearch(searchParams, { defaultBranch }),
    [searchParams, defaultBranch],
  )
  const tab = reportsOnly ? 'reports' : resolveFinanceTab(parsed.tab)
  const datePreset = parsed.period
  const customStart = parsed.from
  const customEnd = parsed.to
  const comparePreset = parsed.compare
  const branchFilter = parsed.branch || defaultBranch
  const visibleTabs = useMemo(() => {
    if (reportsOnly) return FINANCE_TABS.filter((t) => t.id === 'reports')
    return FINANCE_TABS.filter((t) => {
      if (t.id === 'corporate') return showCorporate
      // Quotes write is SA/ASA/admin; investor has no SELECT on finance_quotes
      if (t.id === 'quotes' && profile?.role === ROLES.INVESTOR) return false
      return true
    })
  }, [reportsOnly, showCorporate, profile?.role])
  const primaryTabs = useMemo(
    () => visibleTabs.filter((t) => FINANCE_PRIMARY_TAB_IDS.includes(t.id)),
    [visibleTabs],
  )
  const moreTabs = useMemo(
    () => visibleTabs.filter((t) => !isFinancePrimaryTab(t.id)),
    [visibleTabs],
  )

  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [vendors, setVendors] = useState([])
  const [salesRows, setSalesRows] = useState([])
  const [plRows, setPlRows] = useState([])
  const [priorPlRows, setPriorPlRows] = useState([])
  const [expenses, setExpenses] = useState([])
  const [lastPaidHint, setLastPaidHint] = useState(null)
  const [shiftCloseCount, setShiftCloseCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const customRangeCheck = useMemo(
    () => (datePreset === 'custom' ? validateFinanceCustomRange(customStart, customEnd) : { ok: true, reason: null }),
    [datePreset, customStart, customEnd],
  )
  const rangeError = customRangeCheck.ok ? '' : customRangeCheck.reason

  const range = useMemo(
    () => financeRangeIso(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  )
  const queryRangeRef = useRef(range)
  if (datePreset !== 'custom' || customRangeCheck.ok) {
    queryRangeRef.current = range
  }
  const queryRange = queryRangeRef.current
  const compareRange = useMemo(
    () => financeCompareRange(queryRange.start, queryRange.end, comparePreset),
    [queryRange.start, queryRange.end, comparePreset],
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

  const patchSearch = useCallback(
    (patch = {}) => {
      setSearchParams(
        buildFinanceSearchParams({
          tab: patch.tab ?? tab,
          period: patch.period ?? datePreset,
          branch: patch.branch ?? branchFilter,
          compare: patch.compare ?? comparePreset,
          from: patch.from ?? customStart,
          to: patch.to ?? customEnd,
          defaultBranch,
          reportsOnly,
        }),
        { replace: true },
      )
    },
    [
      tab,
      datePreset,
      branchFilter,
      comparePreset,
      customStart,
      customEnd,
      defaultBranch,
      reportsOnly,
      setSearchParams,
    ],
  )

  useEffect(() => {
    if (branchFilter !== 'all' && branchOptions.length && !branchOptions.some((b) => b.slug === branchFilter)) {
      patchSearch({ branch: branchOptions[0]?.slug || defaultBranch })
    }
  }, [branchFilter, branchOptions, defaultBranch, patchSearch])

  const onVendorsChange = useCallback((rows) => {
    setVendors((rows || []).filter((v) => v.is_active))
  }, [])

  const load = useCallback(async () => {
    if (datePreset === 'custom' && !customRangeCheck.ok) {
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const startIso = `${queryRange.start}T00:00:00+08:00`
      const endIso = `${queryRange.end}T23:59:59.999+08:00`

      let salesQ = supabase
        .from('daily_sales_summary')
        .select('*')
        .gte('sale_date', queryRange.start)
        .lte('sale_date', queryRange.end)
        .order('sale_date', { ascending: false })
      salesQ = scopeBranch(salesQ, profile, branchFilter)

      let plQ = supabase
        .from('finance_daily_pl')
        .select('*')
        .gte('period_date', queryRange.start)
        .lte('period_date', queryRange.end)
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

      let lastPaidQ = supabase
        .from('daily_sales_summary')
        .select('sale_date, total_sales_minor, paid_count')
        .gt('paid_count', 0)
        .order('sale_date', { ascending: false })
        .limit(1)
      lastPaidQ = scopeBranch(lastPaidQ, profile, branchFilter)

      let shiftCountQ = supabase
        .from('shift_close_reports')
        .select('id', { count: 'exact', head: true })
        .in('status', ['accepted', 'locked'])
        .gte('business_date', queryRange.start)
        .lte('business_date', queryRange.end)
      shiftCountQ = scopeBranch(shiftCountQ, profile, branchFilter)

      const [branchRows, cats, sales, pl, expRows, prior, vendorRes, lastPaidRes, shiftCountRes] = await Promise.all([
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
        lastPaidQ,
        shiftCountQ,
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
      setLastPaidHint(lastPaidRes.error ? null : lastPaidRes.data?.[0] || null)
      setShiftCloseCount(shiftCountRes.error ? 0 : shiftCountRes.count || 0)
    } catch (err) {
      const message = err.message || 'Unable to load finance data'
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter, queryRange.start, queryRange.end, compareRange, datePreset, customRangeCheck.ok])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (reportsOnly && searchParams.get('tab') !== 'reports') {
      patchSearch({ tab: 'reports' })
      return
    }
    if (!reportsOnly && !visibleTabs.some((t) => t.id === tab)) {
      patchSearch({ tab: 'overview' })
    }
  }, [reportsOnly, searchParams, visibleTabs, tab, patchSearch])

  const writableBranches = useMemo(() => {
    if (scope === null) return branches
    return branches.filter((b) => scope.includes(b.slug))
  }, [branches, scope])

  const windowLabel = useMemo(
    () => formatFinanceWindow(queryRange.start, queryRange.end),
    [queryRange.start, queryRange.end],
  )

  const headlinePl = useMemo(() => rollupPl(plRows), [plRows])
  const paidCount = useMemo(
    () => salesRows.reduce((acc, row) => acc + Number(row.paid_count || 0), 0),
    [salesRows],
  )
  const statementCues = useMemo(() => {
    const empty = financeEmptyWindowCue({
      income: headlinePl.income,
      expenses: headlinePl.expenses,
      lastPaidDate: lastPaidHint?.sale_date,
      lastPaidMinor: lastPaidHint?.total_sales_minor,
      range: queryRange,
    })
    const extra = financeStatementCues({
      income: headlinePl.income,
      payrollExpenseMinor: postedPayrollExpenseMinor(plRows),
      shiftCloseCount,
      paidCount,
    })
    const out = []
    if (empty && empty.id === 'last-paid-outside') out.push(empty)
    extra.forEach((cue) => out.push(cue))
    return out
  }, [headlinePl.income, headlinePl.expenses, lastPaidHint, queryRange, plRows, shiftCloseCount, paidCount])

  const branchName = useMemo(() => {
    if (branchFilter === 'all') return 'All branches'
    return branchOptions.find((b) => b.slug === branchFilter)?.name || branchFilter
  }, [branchFilter, branchOptions])

  if (!canOpenFinanceHub(profile)) return <Navigate to="/operations/access-denied" replace />

  function setTab(next) {
    patchSearch({ tab: reportsOnly ? 'reports' : next })
  }

  const activeTab = visibleTabs.find((t) => t.id === tab) || FINANCE_TABS.find((t) => t.id === 'reports')
  const ActiveIcon = TAB_ICONS[tab] || LayoutDashboard
  const financeStepIcons = {
    sales: ShoppingCart,
    shift: ClipboardCheck,
    bills: Receipt,
    payroll: FileBarChart,
  }
  const moreActive = moreTabs.some((item) => item.id === tab)
  const railTabs = reportsOnly ? visibleTabs : primaryTabs

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
          defaultOpen={false}
        />
      ) : null}

      <FinanceFilters
        branchOptions={branchOptions}
        branchFilter={branchFilter}
        onBranchChange={(next) => patchSearch({ branch: next })}
        datePreset={datePreset}
        onDatePresetChange={(next) => {
          if (next === 'custom' && !customStart && !customEnd) {
            patchSearch({ period: next, from: queryRange.start, to: queryRange.end })
            return
          }
          patchSearch({ period: next })
        }}
        customStart={customStart}
        customEnd={customEnd}
        onCustomRangeChange={(s, e) => patchSearch({ period: 'custom', from: s, to: e })}
        comparePreset={comparePreset}
        onCompareChange={(next) => patchSearch({ compare: next })}
        showBranch={canSeeAllBranches(profile) || branchOptions.length > 1}
        onRefresh={load}
        refreshing={loading}
        windowLabel={windowLabel}
        rangeError={rangeError}
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

      {statementCues.length ? (
        <div className="flex flex-col gap-2">
          {statementCues.map((cue) => (
            <div key={cue.id} role="status" className="finance-statement-cue">
              <p>
                {cue.id === 'last-paid-outside' && cue.lastPaidMinor
                  ? `${cue.text.replace(/\.$/, '')} · ${formatMoney(cue.lastPaidMinor)}.`
                  : cue.text}
              </p>
              <div className="flex flex-wrap gap-2">
                {cue.id === 'last-paid-outside' && cue.lastPaidDate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 cursor-pointer"
                    onClick={() => patchSearch({ period: 'custom', from: cue.lastPaidDate, to: cue.lastPaidDate })}
                  >
                    Include that day
                  </Button>
                ) : null}
                {cue.href ? (
                  <Button asChild variant="outline" size="sm" className="min-h-11">
                    <Link to={cue.href}>
                      {cue.id === 'unposted-pay' ? 'Open Payroll' : 'Open POS'}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="finance-tabs">
        <div className="finance-tabs-rail">
          <TabsList className="finance-tabs-list">
            {railTabs.map((item) => {
              const Icon = TAB_ICONS[item.id]
              return (
                <TabsTrigger key={item.id} value={item.id} title={item.hint} className="cursor-pointer">
                  {Icon ? <Icon aria-hidden /> : null}
                  <span>{item.label}</span>
                </TabsTrigger>
              )
            })}
            {!reportsOnly && moreTabs.length ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="finance-tabs-more"
                  data-active={moreActive ? '' : undefined}
                  aria-label="More finance pages"
                  title="Reports, quotes, vendors, and settings"
                >
                  <span>More</span>
                  <ChevronDown aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  <DropdownMenuGroup>
                    {moreTabs.map((item) => (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        data-active={item.id === tab ? '' : undefined}
                      >
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </TabsList>
        </div>

        <Separator className="finance-tabs-sep" />

        <TabsContent value="overview" className="finance-tab-panel">
          <FinanceOverviewTab
            plRows={plRows}
            priorPlRows={priorPlRows}
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={queryRange}
            compareRange={compareRange}
            loading={loading}
            onNavigate={setTab}
            lastPaidHint={lastPaidHint}
          />
        </TabsContent>

        <TabsContent value="sales" className="finance-tab-panel">
          <FinanceSalesTab
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={queryRange}
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
            range={queryRange}
            loading={loading}
            onReload={load}
          />
        </TabsContent>

        <TabsContent value="pl" className="finance-tab-panel">
          <FinancePLTab
            plRows={plRows}
            priorPlRows={priorPlRows}
            range={queryRange}
            compareRange={compareRange}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="shift-close" className="finance-tab-panel">
          <FinanceShiftCloseTab
            profile={profile}
            range={queryRange}
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
            range={queryRange}
          />
        </TabsContent>

        <TabsContent value="vendors" className="finance-tab-panel">
          <FinanceVendorsTab
            canManage={canManageVendors}
            onVendorsChange={onVendorsChange}
          />
        </TabsContent>

        <TabsContent value="quotes" className="finance-tab-panel">
          <FinanceQuotesTab
            canWrite={canWrite}
            branches={writableBranches.map((b) => ({ ...b, name: labelFinanceBranch(b) }))}
          />
        </TabsContent>

        <TabsContent value="corporate" className="finance-tab-panel">
          <FinanceCorporateTab profile={profile} range={queryRange} />
        </TabsContent>

        <TabsContent value="categories" className="finance-tab-panel">
          <FinanceCategoriesTab categories={categories} canWrite={canWrite} onReload={load} />
        </TabsContent>

        <TabsContent value="reports" className="finance-tab-panel">
          <FinanceReportsTab
            salesRows={salesRows}
            plRows={plRows}
            expenses={expenses}
            range={queryRange}
            loading={loading}
            profile={profile}
            branchFilter={branchFilter}
          />
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  )
}

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
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canOpenFinanceHub, canSeeAllBranches, canWriteFinance } from '@/auth/permissions'
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

const TAB_ICONS = {
  overview: LayoutDashboard,
  sales: ShoppingCart,
  purchases: Receipt,
  pl: FileBarChart,
  'shift-close': ClipboardCheck,
  'expense-reports': FileSpreadsheet,
  categories: Tags,
  reports: BookOpen,
}

export default function FinancePage() {
  const { profile } = useAuth()
  const booksAccess = canAccessFinance(profile)
  const canWrite = booksAccess && canWriteFinance(profile)
  const reportsOnly = !booksAccess && canOpenFinanceHub(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = reportsOnly ? 'reports' : resolveFinanceTab(searchParams.get('tab'))
  const visibleTabs = reportsOnly ? FINANCE_TABS.filter((t) => t.id === 'reports') : FINANCE_TABS

  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [salesRows, setSalesRows] = useState([])
  const [plRows, setPlRows] = useState([])
  const [priorPlRows, setPriorPlRows] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

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
    if (scope === null) {
      return [{ slug: 'all', name: 'All branches' }, ...branches]
    }
    return branches
      .filter((b) => scope.includes(b.slug))
      .map((b) => ({ slug: b.slug, name: b.name }))
  }, [branches, scope])

  const load = useCallback(async () => {
    setLoading(true)
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

      const [branchRows, cats, sales, pl, expRows, prior] = await Promise.all([
        listBranches(),
        supabase.from('expense_categories').select('id, name, is_chemical, kind').order('name'),
        salesQ,
        plQ,
        collectPaged(async (from, to) => {
          let q = supabase
            .from('expenses')
            .select('id, title, description, total_minor, branch, status, expense_kind, category_id, created_at, quantity, unit_cost_minor')
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
      ])
      if (cats.error) throw cats.error
      if (sales.error) throw sales.error
      if (pl.error) throw pl.error
      if (prior.error) throw prior.error
      setBranches(branchRows || [])
      setCategories(cats.data || [])
      setSalesRows(sales.data || [])
      setPlRows(pl.data || [])
      setPriorPlRows(prior.data || [])
      setExpenses(expRows)
    } catch (err) {
      toast.error(err.message || 'Unable to load finance data')
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
    }
  }, [reportsOnly, searchParams, setSearchParams])

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
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true })
  }

  const activeTab = visibleTabs.find((t) => t.id === tab) || FINANCE_TABS.find((t) => t.id === 'reports')

  return (
    <section className="finance-shell">
      <header className="finance-hero">
        <div className="finance-hero-copy">
          <p className="finance-eyebrow">Books · Hakum Auto Care</p>
          <h1 className="finance-title">
            {(() => {
              const Icon = TAB_ICONS[tab] || LayoutDashboard
              return <Icon aria-hidden />
            })()}
            {activeTab?.label || 'Dashboard'}
          </h1>
          <p className="finance-lead">
            {activeTab?.hint || 'Finance overview'}
            <span className="finance-lead-sep" aria-hidden>
              ·
            </span>
            <span className="tabular-nums">{windowLabel}</span>
            <span className="finance-lead-sep" aria-hidden>
              ·
            </span>
            {branchName}
          </p>
        </div>

        <div className="finance-hero-aside">
          <div className="finance-net-chip" data-tone={headlinePl.net >= 0 ? 'up' : 'down'}>
            <p className="finance-net-label">{headlinePl.net >= 0 ? 'Net profit' : 'Net loss'}</p>
            <p className="finance-net-value tabular-nums">
              {loading ? '—' : formatMoney(headlinePl.net)}
            </p>
          </div>
          <Badge variant={canWrite ? 'default' : 'secondary'} className="finance-role-badge">
            {canWrite ? 'Can edit' : 'View only'}
          </Badge>
        </div>
      </header>

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
            branches={branches}
            writableBranches={writableBranches}
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
    </section>
  )
}

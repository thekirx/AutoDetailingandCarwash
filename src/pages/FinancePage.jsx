/** Finance module shell — Xero-like IA, tailored for Hakum.
 * Tabs: Overview · Sales · Purchases · Profit & Loss · Categories · Reports.
 * Real POS income + real expenses, scoped per branch or all branches. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Receipt, FileBarChart, Tags, BookOpen } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessFinance, canSeeAllBranches, canWriteFinance } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  FINANCE_TABS,
  FINANCE_TAB_IDS,
  financeRangeIso,
  financeCompareRange,
  scopeBranch,
  branchScopeList,
} from '@/lib/financeData'
import FinanceFilters from './finance/FinanceFilters'
import FinanceOverviewTab from './finance/FinanceOverviewTab'
import FinanceSalesTab from './finance/FinanceSalesTab'
import FinancePurchasesTab from './finance/FinancePurchasesTab'
import FinancePLTab from './finance/FinancePLTab'
import FinanceCategoriesTab from './finance/FinanceCategoriesTab'
import FinanceReportsTab from './finance/FinanceReportsTab'

const TAB_ICONS = {
  overview: LayoutDashboard,
  sales: ShoppingCart,
  purchases: Receipt,
  pl: FileBarChart,
  categories: Tags,
  reports: BookOpen,
}

export default function FinancePage() {
  const { profile } = useAuth()
  const canWrite = canWriteFinance(profile)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = FINANCE_TAB_IDS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview'

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

      let expQ = supabase
        .from('expenses')
        .select('id, title, description, total_minor, branch, status, category_id, created_at, quantity, unit_cost_minor')
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: false })
        .limit(300)
      expQ = scopeBranch(expQ, profile, branchFilter)

      let priorQ = null
      if (compareRange) {
        priorQ = supabase
          .from('finance_daily_pl')
          .select('*')
          .gte('period_date', compareRange.start)
          .lte('period_date', compareRange.end)
        priorQ = scopeBranch(priorQ, profile, branchFilter)
      }

      const [branchRows, cats, sales, pl, exp, prior] = await Promise.all([
        listBranches(),
        supabase.from('expense_categories').select('id, name, is_chemical, kind').order('name'),
        salesQ,
        plQ,
        expQ,
        priorQ || Promise.resolve({ data: [], error: null }),
      ])
      if (cats.error) throw cats.error
      if (sales.error) throw sales.error
      if (pl.error) throw pl.error
      if (exp.error) throw exp.error
      if (prior.error) throw prior.error
      setBranches(branchRows || [])
      setCategories(cats.data || [])
      setSalesRows(sales.data || [])
      setPlRows(pl.data || [])
      setPriorPlRows(prior.data || [])
      setExpenses(exp.data || [])
    } catch (err) {
      toast.error(err.message || 'Unable to load finance data')
    } finally {
      setLoading(false)
    }
  }, [profile, branchFilter, range.start, range.end, compareRange])

  useEffect(() => {
    load()
  }, [load])

  const writableBranches = useMemo(() => {
    if (scope === null) return branches
    return branches.filter((b) => scope.includes(b.slug))
  }, [branches, scope])

  if (!canAccessFinance(profile)) return <Navigate to="/operations/access-denied" replace />

  function setTab(next) {
    setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true })
  }

  const activeTab = FINANCE_TABS.find((t) => t.id === tab)

  return (
    <section className="finance-shell">
      <header className="finance-hero">
        <div className="finance-hero-copy">
          <p className="finance-eyebrow">Finance</p>
          <h1 className="finance-title">
            {(() => {
              const Icon = TAB_ICONS[tab] || LayoutDashboard
              return <Icon className="size-6" aria-hidden />
            })()}
            Hakum Auto Care
          </h1>
          <p className="finance-lead">
            {activeTab?.hint || 'Finance overview'} · {range.start} to {range.end}
          </p>
        </div>
        <Badge variant={canWrite ? 'default' : 'secondary'} className="finance-role-badge">
          {canWrite ? 'Can edit' : 'View only'}
        </Badge>
      </header>

      <FinanceFilters
        branchOptions={branchOptions}
        branchFilter={branchFilter}
        onBranchChange={setBranchFilter}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        customStart={customStart}
        customEnd={customEnd}
        onCustomRangeChange={(s, e) => {
          setCustomStart(s)
          setCustomEnd(e)
        }}
        showBranch={canSeeAllBranches(profile) || branchOptions.length > 1}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="finance-tabs-list">
          {FINANCE_TABS.map((item) => {
            const Icon = TAB_ICONS[item.id]
            return (
              <TabsTrigger key={item.id} value={item.id} title={item.hint}>
                {Icon ? <Icon className="size-4" aria-hidden /> : null}
                {item.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <FinanceOverviewTab
            plRows={plRows}
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={range}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="sales" className="mt-6">
          <FinanceSalesTab
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={range}
            loading={loading}
          />
        </TabsContent>

        <TabsContent value="purchases" className="mt-6">
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

        <TabsContent value="pl" className="mt-6">
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

        <TabsContent value="categories" className="mt-6">
          <FinanceCategoriesTab categories={categories} canWrite={canWrite} onReload={load} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <FinanceReportsTab
            salesRows={salesRows}
            branchOptions={branchOptions.filter((b) => b.slug !== 'all')}
            range={range}
            loading={loading}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}

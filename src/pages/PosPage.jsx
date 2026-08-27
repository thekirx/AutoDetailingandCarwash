import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams, Link } from 'react-router-dom'
import { Cake, Gift, Link2, LogOut, MapPin, Search, ShoppingCart, Trash2, UserRound, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { allowRoute, canAccessPos, canAccessSettings, canManageServices, canSeeAllBranches, canWriteFinance, getBranchScopeList, isAdmin, isBranchAdmin } from '@/auth/permissions'
import { listBranches, getLoyaltyProgramSettings } from '@/lib/adminApi'
import { writeAudit } from '@/lib/audit'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { applyAdHocDiscount, buildPosSalePayload, buildVisitHandoffCartLines, canRemovePosCartLine, cashAdvanceVisibleOnPos, expenseCountsOnDailyClose, isAllowedPosPaymentMethod, keepQueueHandoffWhenAdding, posCartBlocksCheckout, priceCartForMembership, removePosCartLine } from '@/lib/posSale'
import { PRICING_SIZES, resolveServicePriceMinor, formatSizePriceRange, availablePricingSizes, serviceHasSizePricing } from '@/lib/servicePricing'
import { filterPosBayCatalog, filterPosDetailingCatalog, serviceKindFromPayCategory } from '@/lib/serviceKinds'
import { supabase } from '@/lib/supabase'
import { filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { formatMoney, searchPosCustomer } from '@/queue/queueApi'
import { approvedCaForCloseDay, formatBacoorReportText } from '@/lib/bacoorDailyReport'
import { buildShopDaySettlementReport, shopDayShouldClose } from '@/lib/shopDaySettlement'
import {
  applyCaCollectedToCashLeft,
  attachSalaryDraftExtras,
  canSubmitShiftClose,
  datetimeLocalToIso,
  moneySnapshotFromReport,
  parsePesosToMinor,
  shiftCloseValidationBaseline,
  toDatetimeLocalValue,
  validateShiftCloseSubmit,
  SHIFT_CLOSE_MONEY_KEYS,
} from '@/lib/shiftClose'
import ShiftCloseWizard from '@/components/ShiftCloseWizard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { PAYMENT_METHODS } from '@/lib/paymentMethods'
import { normalizePosSettings, DEFAULT_POS_EXPENSE_KINDS } from '@/lib/posSettings'
import { accumulatePosCategoryTotals, emptyPosCategoryTotals, MERCH_FAMILIES, productIsPosSellable, productMatchesMerchFamily } from '@/lib/posSellables'
import { getAccessTokenFresh } from '@/lib/authToken'
import { collectPaged } from '@/lib/crmInsights'
import {
  DEFAULT_COMPENSATION_RULES,
  normalizeCompensationSettings,
  detailingAmountMinor,
  buildCeramicCompensationExpenses,
  computeCeramicPay,
  effectiveCeramicToggles,
} from '@/lib/compensation'

const SHELL_TABS = ['checkout', 'pending', 'expenses', 'dashboard']

export default function PosPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const branchAdmin = isBranchAdmin(profile)
  const canManageCatalog = canManageServices(profile)
  const canOpenFinance = allowRoute(profile, 'finance')
  const requestedShellTab = SHELL_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'checkout'
  const shellTab = requestedShellTab
  const scopeList = getBranchScopeList(profile)
  const canPickPosBranch = canSeeAllBranches(profile) || (Array.isArray(scopeList) && scopeList.length > 1)
  const branchLocked = !canPickPosBranch
  const assignedBranch = pickDefaultBranchSlug(profile, [])
  const canProvisionCustomer = isAdmin(profile)

  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [merchFamilyFilter, setMerchFamilyFilter] = useState('all')
  // Branch Admin sells merch + pays queue tickets only — not freeform service catalog.
  const [tab, setTab] = useState(() => (isBranchAdmin(profile) ? 'merch' : 'bay'))

  useEffect(() => {
    if (branchAdmin && tab !== 'merch') setTab('merch')
  }, [branchAdmin, tab])

  const [cart, setCart] = useState([])
  const [branch, setBranch] = useState(assignedBranch)
  const [branches, setBranches] = useState([])
  const [handoffVehicleSize, setHandoffVehicleSize] = useState('medium')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [linkedCustomer, setLinkedCustomer] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [guestFirstName, setGuestFirstName] = useState('')
  const [guestLastName, setGuestLastName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountAmountPesos, setDiscountAmountPesos] = useState('')
  const [discountReason, setDiscountReason] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerHits, setCustomerHits] = useState([])
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compToggles, setCompToggles] = useState({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
  const [compRules, setCompRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [paymentOptions, setPaymentOptions] = useState(() => PAYMENT_METHODS.map((m) => ({ ...m })))
  const [expenseKinds, setExpenseKinds] = useState(() => DEFAULT_POS_EXPENSE_KINDS.map((k) => ({ ...k })))

  useEffect(() => {
    if (!paymentOptions.length) return
    if (!isAllowedPosPaymentMethod(paymentMethod, paymentOptions)) {
      setPaymentMethod(paymentOptions[0].value)
    }
  }, [paymentOptions, paymentMethod])
  const [todayStats, setTodayStats] = useState(null)
  const [todaySales, setTodaySales] = useState([])
  const [categoryTotals, setCategoryTotals] = useState(emptyPosCategoryTotals())
  const [dailyReportOpen, setDailyReportOpen] = useState(false)
  const [shiftCloseMode, setShiftCloseMode] = useState(false)
  const [shiftOverrides, setShiftOverrides] = useState({})
  const [shiftEndedAtLocal, setShiftEndedAtLocal] = useState(() => toDatetimeLocalValue())
  const [shiftEndedError, setShiftEndedError] = useState('')
  const [shiftReasons, setShiftReasons] = useState({})
  const [shiftFieldErrors, setShiftFieldErrors] = useState({})
  const [shiftSubmitting, setShiftSubmitting] = useState(false)
  const [shiftFieldConfig, setShiftFieldConfig] = useState([])
  const [shiftWizardStep, setShiftWizardStep] = useState(0)
  const [salaryDraftExtras, setSalaryDraftExtras] = useState([])
  const [handoffs, setHandoffs] = useState([])
  const [activeHandoff, setActiveHandoff] = useState(null)
  const [activeMembership, setActiveMembership] = useState(null)
  const [birthdayPerk, setBirthdayPerk] = useState(null)
  const [membershipsEnabled, setMembershipsEnabled] = useState(true)

  // Expenses tab
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', expense_kind: 'daily' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [todayExpenses, setTodayExpenses] = useState([])

  // Approved cash advances for daily / shift-close report (approve on Payroll)
  const [approvedCas, setApprovedCas] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])

  const membershipContext = useMemo(
    () => ({
      membershipsEnabled: membershipsEnabled && !!activeMembership,
      discountPercent: Number(activeMembership?.discount_percent) || 0,
      includedServices: activeMembership?.included_services || [],
    }),
    [activeMembership, membershipsEnabled],
  )

  const branchLabel = useMemo(
    () => branches.find((b) => b.slug === branch)?.name || branch || '—',
    [branches, branch],
  )

  const familyTiles = useMemo(
    () => [
      { label: 'Car wash', value: formatMoney(categoryTotals.car_wash) },
      { label: 'Coating', value: formatMoney(categoryTotals.ceramic_coating) },
      { label: 'Paint maintenance', value: formatMoney(categoryTotals.paint_maintenance) },
      { label: 'Other detailing', value: formatMoney(categoryTotals.detailing) },
      { label: 'Tint', value: formatMoney(categoryTotals.nano_tint) },
      { label: 'PPF', value: formatMoney(categoryTotals.ppf) },
      { label: 'Coffee / refreshments', value: formatMoney(categoryTotals.coffee) },
      { label: 'Accessories', value: formatMoney(categoryTotals.accessories) },
      { label: 'Hakum clothing', value: formatMoney(categoryTotals.clothing) },
      { label: 'Other merch', value: formatMoney(categoryTotals.merch) },
    ],
    [categoryTotals],
  )

  const load = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const startIso = `${today}T00:00:00+08:00`
    const endIso = `${today}T23:59:59.999+08:00`
    let saleRows = []
    const [svc, prod, stats, handoffRes, compRes, posSettingsRes] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, slug, description, pay_category, price_minor, included_service_ids, service_size_prices(size_slug, price_minor)')
        .eq('is_active', true)
        .eq('is_archived', false),
      supabase
        .from('products')
        .select('id, name, price_minor, category, stock_qty, sku, tags, usage_kind')
        .eq('is_active', true)
        .eq('is_archived', false),
      supabase.from('daily_sales_summary').select('*').eq('sale_date', today).eq('branch', branch).maybeSingle(),
      supabase
        .from('pos_handoffs')
        .select('id, booking_id, branch, status, amount_minor, created_at, bookings(id, customer_id, customer_name, vehicle_plate, service_id, final_price_minor, price_minor, vehicle_type, status, queue_number, visit_group_id)')
        .eq('status', 'pending')
        .eq('branch', branch)
        .order('created_at', { ascending: true }),
      supabase
        .from('compensation_settings')
        .select(
          'wash_pool_pct, ceramic_shirt_deduction_minor, ceramic_card_fee_pct, ceramic_crew_solo_pct, ceramic_crew_split_pct, ceramic_detailer_split_pct',
        )
        .eq('id', 1)
        .maybeSingle(),
      supabase.from('ops_pos_settings').select('payment_methods, expense_kinds').eq('id', 1).maybeSingle(),
    ])
    try {
      saleRows = await collectPaged(async (from, to) => {
        const { data, error } = await supabase
          .from('sales')
          .select(
            'id, total_minor, payment_method, booking_id, bookings(services(name, pay_category)), sale_line_items(item_type, line_total_minor, name, service_id, product_id, services(name, slug, pay_category), products(name, tags, category))',
          )
          .eq('status', 'paid')
          .eq('branch', branch)
          .gte('occurred_at', startIso)
          .lte('occurred_at', endIso)
          .order('occurred_at', { ascending: false })
          .range(from, to)
        if (error) throw error
        return data || []
      }, 1000)
    } catch (err) {
      toast.error(err.message)
    }
    if (svc.error) toast.error(svc.error.message)
    if (prod.error) toast.error(prod.error.message)
    if (stats.error) toast.error(stats.error.message)
    if (handoffRes.error) toast.error(handoffRes.error.message)
    if (compRes.error) toast.error(compRes.error.message)
    else setCompRules(normalizeCompensationSettings(compRes.data))
    if (!posSettingsRes.error && posSettingsRes.data) {
      const normalized = normalizePosSettings(posSettingsRes.data)
      setPaymentOptions(normalized.payment_methods)
      setExpenseKinds(normalized.expense_kinds)
    }
    // Finance expense_categories is source of truth when present
    const { data: finCats } = await supabase
      .from('expense_categories')
      .select('id, name, kind, is_active')
      .eq('is_active', true)
      .order('name')
    if (finCats?.length) {
      setExpenseKinds(
        finCats.map((c) => ({
          value: String(c.kind || c.name || c.id).toLowerCase().replace(/\s+/g, '_'),
          label: c.name,
        })),
      )
    }
    setServices(
      (svc.data || []).map((row) => ({
        ...row,
        included_service_ids: Array.isArray(row.included_service_ids) ? row.included_service_ids : [],
        size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
      })),
    )
    const productRows = (prod.data || []).filter((p) => (branchAdmin ? productIsPosSellable(p) : true))
    let stockMap = {}
    if (branch && productRows.length) {
      const { data: branchStock, error: stockErr } = await supabase
        .from('product_branch_stock')
        .select('product_id, qty')
        .eq('branch_slug', branch)
      if (stockErr) toast.error(stockErr.message)
      else {
        for (const row of branchStock || []) stockMap[row.product_id] = Number(row.qty) || 0
      }
    }
    setProducts(
      productRows.map((p) => ({
        ...p,
        branch_stock_qty: stockMap[p.id],
        stock_qty: stockMap[p.id] != null ? stockMap[p.id] : p.stock_qty,
      })),
    )
    setTodayStats(stats.data)
    setTodaySales(saleRows)
    setHandoffs(handoffRes.data || [])

    const catRows = []
    for (const sale of saleRows) {
      const lines = sale.sale_line_items || []
      if (!lines.length) {
        catRows.push({ total_minor: sale.total_minor, itemType: sale.booking_id ? 'service' : 'product' })
        continue
      }
      for (const line of lines) {
        catRows.push({
          total_minor: line.line_total_minor,
          itemType: line.item_type,
          serviceSlug: line.services?.slug,
          serviceName: line.services?.name,
          payCategory: line.services?.pay_category,
          productTags: line.products?.tags,
          productCategory: line.products?.category,
          productName: line.products?.name || line.name,
        })
      }
    }
    setCategoryTotals(accumulatePosCategoryTotals(catRows))
  }, [branch, branchAdmin])

  useEffect(() => {
    listBranches()
      .then((rows) => {
        const scoped = filterBranchesForProfile(rows, profile)
        const options = canSeeAllBranches(profile) ? rows : scoped
        setBranches(options)
        setBranch((current) => {
          if (current && options.some((b) => b.slug === current)) return current
          if (branchLocked && assignedBranch) return assignedBranch
          return assignedBranch || options[0]?.slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [assignedBranch, branchLocked, profile])

  useEffect(() => {
    if (!branchLocked) return
    if (assignedBranch && branch !== assignedBranch) setBranch(assignedBranch)
  }, [assignedBranch, branchLocked, branch])

  useEffect(() => {
    setCart([])
    setActiveHandoff(null)
    setShiftOverrides({})
    setShiftReasons({})
    setShiftFieldErrors({})
  }, [branch])

  const loadExpenses = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const { data, error } = await supabase
      .from('expenses')
      .select('id, title, description, total_minor, expense_kind, branch, status, created_at')
      .eq('branch', branch)
      .gte('created_at', `${today}T00:00:00+08:00`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) toast.error(error.message)
    setTodayExpenses(data || [])
  }, [branch])

  const loadApprovedCashAdvances = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const { data, error } = await supabase
      .from('ops_form_submissions')
      .select('id, form_id, payload, status, respondent_label, created_at, resolved_at, ops_forms!inner ( name, kind, slug )')
      .eq('status', 'resolved')
      .eq('ops_forms.kind', 'cash_advance')
      .gte('resolved_at', `${today}T00:00:00+08:00`)
      .order('resolved_at', { ascending: false })
      .limit(100)
    if (error) {
      toast.error(error.message)
      return
    }
    const scope = getBranchScopeList(profile)
    const inScope = (row) => cashAdvanceVisibleOnPos(row, { posBranch: branch, branchScopeList: scope })
    setApprovedCas((data || []).filter(inScope).filter((row) => approvedCaForCloseDay(row, today)))
  }, [branch, profile])

  const loadTodayAttendance = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const { data, error } = await supabase
      .from('staff_attendance')
      .select('staff_id, branch_slug, attendance_date, status, staff_profiles(id, full_name, role)')
      .eq('branch_slug', branch)
      .eq('attendance_date', today)
      .limit(200)
    if (error) {
      setTodayAttendance([])
      return
    }
    setTodayAttendance(data || [])
  }, [branch])

  const loadRef = useRef(load)
  loadRef.current = load
  const expensesRef = useRef(loadExpenses)
  expensesRef.current = loadExpenses
  const scheduleReload = useMemo(() => createCoalescedReload(() => loadRef.current(), 400), [])
  const scheduleExpenses = useMemo(() => createCoalescedReload(() => expensesRef.current(), 400), [])

  useEffect(() => {
    if (!branch) return
    load()
    loadExpenses()
    loadApprovedCashAdvances()
    loadTodayAttendance()
    const channel = supabase
      .channel(`pos-${branch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `branch=eq.${branch}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_handoffs', filter: `branch=eq.${branch}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `branch=eq.${branch}` }, scheduleExpenses)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      scheduleExpenses.cancel()
      supabase.removeChannel(channel)
    }
  }, [load, loadExpenses, loadApprovedCashAdvances, loadTodayAttendance, branch, scheduleReload, scheduleExpenses])

  const bayItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    const nameById = Object.fromEntries((services || []).map((s) => [s.id, s.name]))
    return filterPosBayCatalog(services)
      .map((s) => {
        const kind = serviceKindFromPayCategory(s.pay_category)
        const sized = serviceHasSizePricing(s)
        const includes = (s.included_service_ids || [])
          .map((id) => nameById[id])
          .filter(Boolean)
        const price_minor = resolveServicePriceMinor(s, 'medium')
        return {
          key: `service-${s.id}`,
          item_type: 'service',
          catalog_kind: kind === 'package' ? 'package' : 'service',
          id: s.id,
          name: s.name,
          pay_category: s.pay_category,
          price_minor,
          size_options: sized ? availablePricingSizes(s) : [],
          size_prices: s.size_prices || {},
          meta: [
            kind === 'package' ? 'Package' : 'Service',
            sized ? `from ${formatSizePriceRange(s, formatMoney)}` : null,
            includes.length ? `Includes ${includes.join(' · ')}` : s.description || null,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      })
      .filter((item) => !q || item.name.toLowerCase().includes(q) || (item.meta || '').toLowerCase().includes(q))
  }, [services, query])

  const detailingItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return filterPosDetailingCatalog(services)
      .map((s) => {
        const sized = serviceHasSizePricing(s)
        const price_minor = resolveServicePriceMinor(s, 'medium')
        return {
          key: `service-${s.id}`,
          item_type: 'service',
          catalog_kind: 'detailing',
          id: s.id,
          name: s.name,
          pay_category: s.pay_category,
          price_minor,
          size_options: sized ? availablePricingSizes(s) : [],
          size_prices: s.size_prices || {},
          meta: [
            'Detailing',
            sized ? formatSizePriceRange(s, formatMoney) : null,
            s.description || null,
          ]
            .filter(Boolean)
            .join(' · '),
        }
      })
      .filter((item) => !q || item.name.toLowerCase().includes(q) || (item.meta || '').toLowerCase().includes(q))
  }, [services, query])

  const merchItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products || [])
      .filter((p) => productMatchesMerchFamily(p, merchFamilyFilter))
      .map((p) => ({
        key: `product-${p.id}`,
        item_type: 'product',
        id: p.id,
        name: p.name,
        price_minor: p.price_minor,
        meta: `Stock ${p.branch_stock_qty != null ? p.branch_stock_qty : p.stock_qty}${p.sku ? ` · ${p.sku}` : ''}`,
      }))
      .filter((item) => !q || item.name.toLowerCase().includes(q) || (item.meta || '').toLowerCase().includes(q))
  }, [products, query, merchFamilyFilter])

  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * line.unit_price_minor, 0)
  const ceramicPreview = useMemo(() => {
    const salesMinor = detailingAmountMinor(cart)
    if (!salesMinor) return null
    return computeCeramicPay({
      salesMinor,
      rules: compRules,
      toggles: effectiveCeramicToggles(compToggles, paymentMethod),
    })
  }, [cart, compRules, compToggles, paymentMethod])

  async function refreshMembershipForCustomer(cid) {
    if (!cid) {
      setActiveMembership(null)
      const ctx = { membershipsEnabled: false, discountPercent: 0, includedServices: [] }
      setCart((current) => priceCartForMembership(current, ctx))
      return
    }
    try {
      const [settings, memRes] = await Promise.all([
        getLoyaltyProgramSettings(),
        supabase
          .from('customer_memberships')
          .select(
            'id, ends_at, membership_tiers(name, discount_percent, loyalty_multiplier, included_services, is_active)',
          )
          .eq('customer_id', cid)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const enabled = settings?.memberships_enabled !== false
      setMembershipsEnabled(enabled)
      const tier = memRes.data?.membership_tiers
      const today = getLocalCalendarDate()
      const expired = memRes.data?.ends_at && memRes.data.ends_at < today
      const membership =
        enabled && tier?.is_active !== false && !expired && !memRes.error
          ? {
              name: tier.name,
              discount_percent: tier.discount_percent,
              loyalty_multiplier: tier.loyalty_multiplier,
              included_services: tier.included_services || [],
            }
          : null
      setActiveMembership(membership)
      const ctx = {
        membershipsEnabled: enabled && !!membership,
        discountPercent: Number(membership?.discount_percent) || 0,
        includedServices: membership?.included_services || [],
      }
      setCart((current) => priceCartForMembership(current, ctx))
    } catch (err) {
      toast.warning(err.message || 'Could not load membership')
      setActiveMembership(null)
    }
  }

  async function refreshBirthdayPerk(customerIdValue) {
    if (!customerIdValue) {
      setBirthdayPerk(null)
      return
    }
    const { data } = await supabase
      .from('customer_birthday_perks')
      .select('id, perk_year, status, expires_at')
      .eq('customer_id', customerIdValue)
      .eq('status', 'available')
      .gt('expires_at', new Date().toISOString())
      .order('perk_year', { ascending: false })
      .limit(1)
      .maybeSingle()
    setBirthdayPerk(data || null)
  }

  function clearCustomerLink() {
    setCustomerId('')
    setLinkedCustomer(null)
    setCustomerHits([])
    setCustomerSearch('')
    setActiveMembership(null)
    setBirthdayPerk(null)
    setBirthdayPerk(null)
    setCart((current) =>
      priceCartForMembership(current, {
        membershipsEnabled: false,
        discountPercent: 0,
        includedServices: [],
      }),
    )
  }

  function resetCheckoutExtras() {
    clearCustomerLink()
    setGuestName('')
    setGuestFirstName('')
    setGuestLastName('')
    setGuestEmail('')
    setGuestPhone('')
    setDiscountPercent('')
    setDiscountAmountPesos('')
    setDiscountReason('')
    setPaymentMethod('cash')
  }

  function applyCartDiscount() {
    const amountMinor = discountAmountPesos.trim()
      ? Math.round(Number(discountAmountPesos) * 100)
      : 0
    const result = applyAdHocDiscount(cart, {
      percent: Number(discountPercent) || 0,
      amountMinor,
      reason: discountReason,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCart(result.cart)
    writeAudit({
      action: 'pos.discount',
      entityType: 'pos_cart',
      summary: `Ad-hoc discount: ${result.audit.reason}`,
      meta: result.audit,
    })
    toast.success('Discount applied')
  }

  function addToCart(item, { loyaltyAward = false, birthdayAward = false } = {}) {
    if (!keepQueueHandoffWhenAdding(item)) setActiveHandoff(null)
    const listPrice = item.price_minor
    const free = loyaltyAward || birthdayAward
    const priced = priceCartForMembership(
      [
        {
          ...item,
          key: birthdayAward ? `${item.key}-birthday` : loyaltyAward ? `${item.key}-loyalty` : item.key,
          quantity: 1,
          list_price_minor: listPrice,
          unit_price_minor: listPrice,
          price_minor: listPrice,
          is_loyalty_award: free,
          is_birthday_award: birthdayAward,
          name: birthdayAward ? `${item.name} (birthday)` : loyaltyAward ? `${item.name} (loyalty award)` : item.name,
          from_handoff: false,
        },
      ],
      membershipContext,
    )[0]
    setCart((current) => {
      const existing = current.find((line) => line.key === priced.key)
      if (existing) {
        return current.map((line) => (line.key === priced.key ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [...current, priced]
    })
    setCartOpen(true)
  }

  async function notifyPosStaff(payload) {
    try {
      const token = await getAccessTokenFresh()
      if (!token) return
      await fetch('/api/notify-pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      })
    } catch {
      /* ponytail: durable POS write already succeeded */
    }
  }

  async function loadHandoff(row) {
    const booking = row.bookings || {}
    const serviceId = booking.service_id
    const svc = serviceId ? services.find((s) => s.id === serviceId) : null
    if (booking.vehicle_type) setHandoffVehicleSize(booking.vehicle_type)
    const amount =
      row.amount_minor ??
      booking.final_price_minor ??
      resolveServicePriceMinor(svc, booking.vehicle_type || handoffVehicleSize) ??
      0
    setActiveHandoff(row)
    if (!branchLocked) setBranch(row.branch || branch)
    const cid = booking.customer_id || ''
    setCustomerId(cid)
    setLinkedCustomer(
      cid
        ? {
            id: cid,
            full_name: booking.customer_name || 'Queue customer',
            phone: '',
            plate: booking.vehicle_plate || '',
            source: 'handoff',
          }
        : null,
    )
    setGuestName(booking.customer_name || '')
    setGuestPhone('')
    setCustomerSearch('')
    setCustomerHits([])
    setTab(branchAdmin ? 'merch' : 'bay')
    let siblings = []
    if (booking.visit_group_id) {
      const { data } = await supabase
        .from('bookings')
        .select('id, service_id, final_price_minor, price_minor, vehicle_plate, customer_id, customer_name, vehicle_type, status')
        .eq('visit_group_id', booking.visit_group_id)
      siblings = (data || []).filter((row) => !['completed', 'cancelled'].includes(String(row.status || '')))
    }
    const lines = buildVisitHandoffCartLines({
      handoff: { ...row, amount_minor: amount },
      siblings,
      services,
    })
    setCart(lines)
    if (lines.some((line) => line.missing_service)) {
      toast.message('Queue ticket has no linked service — checkout will record the amount without loyalty stamps.')
    }
    setCartOpen(true)
    if (cid) {
      refreshMembershipForCustomer(cid)
      refreshBirthdayPerk(cid)
    } else {
      setActiveMembership(null)
      setBirthdayPerk(null)
    }
  }

  async function runCustomerSearch() {
    const q = customerSearch.trim()
    if (q.length < 2) {
      toast.message('Type at least 2 characters (name, phone, or plate)')
      return
    }
    setSearchingCustomer(true)
    try {
      const hits = await searchPosCustomer(q, profile)
      setCustomerHits(hits)
      if (!hits.length) toast.message('No customer found — leave as walk-in or adjust search')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSearchingCustomer(false)
    }
  }

  function attachCustomer(hit) {
    setCustomerId(hit.id)
    setLinkedCustomer(hit)
    setGuestName(hit.full_name || '')
    setGuestPhone(hit.phone || '')
    setCustomerHits([])
    setCustomerSearch('')
    toast.success(`Linked · ${hit.full_name}`)
    refreshMembershipForCustomer(hit.id)
    refreshBirthdayPerk(hit.id)
  }

  async function checkout() {
    if (!cart.length || !branch) return
    if (posCartBlocksCheckout(cart)) {
      toast.error('This queue ticket has no linked service. Ask a Team Lead to set the service on the booking, then send it to payment again.')
      return
    }
    if (!isAllowedPosPaymentMethod(paymentMethod, paymentOptions)) {
      toast.error('Choose a payment method from the list.')
      return
    }
    setSaving(true)
    const handoff = activeHandoff
    let resolvedCustomerId = customerId

    // Admin+ only: create customer account on paid walk-in (idempotent via provision API)
    if (!resolvedCustomerId && canProvisionCustomer && guestPhone.trim().length >= 10) {
      try {
        const token = await getAccessTokenFresh()
        if (token) {
          const res = await fetch('/api/provision-customer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              customer_name:
                [guestFirstName.trim(), guestLastName.trim()].filter(Boolean).join(' ') ||
                guestName.trim() ||
                'Walk-in customer',
              customer_first_name: guestFirstName.trim() || undefined,
              customer_last_name: guestLastName.trim() || undefined,
              customer_email: guestEmail.trim() || undefined,
              customer_phone: guestPhone.trim(),
              site_origin: window.location.origin,
              allow_walk_in_name: true,
            }),
          })
          const body = await res.json().catch(() => ({}))
          if (res.ok && body.customer_id) {
            resolvedCustomerId = body.customer_id
            toast.message(body.created ? 'Customer account created' : 'Linked existing customer')
          } else if (!res.ok && !body.customer_id) {
            toast.warning(body.error || 'Could not create customer — sale continues as walk-in')
          }
        }
      } catch (err) {
        toast.warning(err.message || 'Customer provision skipped')
      }
    }

    const noteParts = []
    const walkInLabel = [
      [guestFirstName.trim(), guestLastName.trim()].filter(Boolean).join(' ') || guestName.trim(),
      guestPhone.trim(),
      guestEmail.trim(),
    ].filter(Boolean)
    if (!resolvedCustomerId && walkInLabel.length) {
      noteParts.push(`Walk-in: ${walkInLabel.join(' · ')}`)
    }
    if (cart.some((l) => l.adhoc_discount_applied)) {
      const reasons = [...new Set(cart.filter((l) => l.adhoc_discount_reason).map((l) => l.adhoc_discount_reason))]
      noteParts.push(`Discount: ${reasons.join('; ') || 'ad-hoc'}`)
    }
    if (linkedCustomer?.plate) noteParts.push(`Plate ${linkedCustomer.plate}`)
    if (cart.some((l) => l.is_loyalty_award && !l.is_birthday_award)) noteParts.push('Includes loyalty award line')
    if (cart.some((l) => l.is_birthday_award)) noteParts.push('Includes birthday free service')
    if (cart.some((l) => l.is_membership_included)) noteParts.push('Includes membership service')
    if (cart.some((l) => l.membership_discount_applied) && activeMembership?.name) {
      noteParts.push(`Member ${activeMembership.name} ${activeMembership.discount_percent}% off`)
    }
    const activeCompKeys = Object.entries(compToggles).filter(([, v]) => v).map(([k]) => k)
    if (activeCompKeys.length) noteParts.push(`comp:${activeCompKeys.join(',')}`)
    const { data, error } = await supabase.rpc('complete_pos_sale', {
      payload: buildPosSalePayload({
        branch,
        customerId: resolvedCustomerId,
        paymentMethod,
        cart,
        activeHandoff: handoff,
        notes: noteParts.join(' · '),
      }),
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    if (handoff?.booking_id) {
      try {
        const token = await getAccessTokenFresh()
        if (token) {
          const res = await fetch('/api/notify-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ booking_id: handoff.booking_id, status: 'completed' }),
          })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            toast.warning(body.error || 'Sale saved — customer notify failed')
          }
        }
      } catch (err) {
        toast.warning(err.message || 'Sale saved — customer notify failed')
      }
    }
    // Loyalty claim thank-you SMS — fire and forget, server dedupes per sale.
    if (resolvedCustomerId && cart.some((l) => l.is_birthday_award)) {
      supabase.rpc('claim_birthday_perk', {
        p_customer_id: resolvedCustomerId,
        p_sale_id: data?.sale_id || null,
      }).then(({ error: claimErr }) => {
        if (claimErr) toast.warning(claimErr.message || 'Birthday perk not marked claimed')
      })
    }
    if (resolvedCustomerId && cart.some((l) => l.is_loyalty_award && !l.is_birthday_award)) {
      getAccessTokenFresh()
        .then((token) => {
          if (!token) return null
          return fetch('/api/lifecycle-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ kind: 'loyalty_claim', customer_id: resolvedCustomerId, sale_id: data?.sale_id || '' }),
          })
        })
        .catch(() => {})
    }
    const loyalty = data?.loyalty_awarded || data?.stamps_awarded
    const saleId = data?.sale_id
    const detailingMinor = detailingAmountMinor(cart)
    if (saleId && detailingMinor && canWriteFinance(profile)) {
      const drafts = buildCeramicCompensationExpenses({
        saleId,
        date: getLocalCalendarDate(),
        branch,
        salesMinor: detailingMinor,
        rules: compRules,
        toggles: compToggles,
        paymentMethod,
      })
      if (drafts.length) {
        const { error: ceramicErr } = await supabase.from('expenses').insert(drafts)
        if (ceramicErr) toast.warning(`Sale saved — ceramic salary draft failed: ${ceramicErr.message}`)
      }
    }
    toast.success(
      handoff
        ? `Ticket paid · ${formatMoney(data?.total_minor || cartTotal)}`
        : `Sale complete · ${formatMoney(data?.total_minor || cartTotal)}${loyalty ? ' · loyalty updated' : ''}`,
    )
    if (!handoff) {
      notifyPosStaff({
        event: 'sale',
        branch,
        amount_minor: data?.total_minor || cartTotal,
        entity_id: saleId || '',
      })
    }
    setCart([])
    setActiveHandoff(null)
    resetCheckoutExtras()
    setCompToggles({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
    setCartOpen(false)
    load()
  }

  const dailyReportData = useMemo(() => {
    return buildShopDaySettlementReport({
      branchSlug: branch || '',
      branchDisplay: branchLabel || branch || '',
      date: getLocalCalendarDate(),
      sales: todaySales,
      expenses: todayExpenses,
      cashAdvances: approvedCas.map((r) => ({
        status: 'approved',
        amount_minor: Number(r.payload?.amount || 0) * 100,
        employee_name: r.payload?.employee_name || r.respondent_label || 'Employee',
      })),
      attendance: todayAttendance,
      rules: compRules,
    })
  }, [branch, branchLabel, todaySales, todayExpenses, approvedCas, todayAttendance, compRules])

  if (!canAccessPos(profile)) return <Navigate to="/operations/access-denied" replace />

  const catalogTab = branchAdmin ? 'merch' : tab

  function setShellTab(next) {
    setSearchParams(next === 'checkout' ? {} : { tab: next }, { replace: true })
  }

  async function submitExpense(e) {
    e.preventDefault()
    if (!canWriteFinance(profile)) {
      return toast.error('You do not have Finance write access to record expenses.')
    }
    const pesos = Number(String(expenseForm.amount).replace(/,/g, '').trim())
    if (!expenseForm.title.trim() || !Number.isFinite(pesos) || pesos <= 0) {
      return toast.error('Enter a title and valid amount')
    }
    setSavingExpense(true)
    const total = Math.round(pesos * 100)
    const { data: expRow, error } = await supabase.from('expenses').insert({
      title: expenseForm.title.trim(),
      total_minor: total,
      unit_cost_minor: total,
      quantity: 1,
      expense_kind: expenseForm.expense_kind,
      branch,
      status: 'draft',
    }).select('id').maybeSingle()
    setSavingExpense(false)
    if (error) return toast.error(error.message)
    toast.success('Expense recorded')
    writeAudit({
      action: 'pos.expense',
      entityType: 'expense',
      entityId: expRow?.id,
      summary: `POS expense · ${expenseForm.title.trim()} · ${branch}`,
      meta: { expense_title: expenseForm.title.trim(), amount_minor: total, branch },
    })
    notifyPosStaff({
      event: 'expense',
      branch,
      amount_minor: total,
      title: expenseForm.title.trim(),
      entity_id: expRow?.id || '',
    })
    setExpenseForm({ title: '', amount: '', expense_kind: 'daily' })
    loadExpenses()
  }

  function openEndOfShift() {
    if (
      !shopDayShouldClose({
        sales: todaySales,
        expenses: todayExpenses,
        cashAdvances: approvedCas.map((r) => ({
          amount_minor: Number(r.payload?.amount || 0) * 100,
        })),
        caRepayments: dailyReportData?.ca_repayments,
      })
    ) {
      toast.message('Nothing to close today — no paid sales, expenses, or cash advances')
      return
    }
    setShiftCloseMode(true)
    setShiftOverrides({})
    setShiftReasons({})
    setShiftFieldErrors({})
    setSalaryDraftExtras([])
    setShiftEndedError('')
    setShiftWizardStep(0)
    setShiftEndedAtLocal(toDatetimeLocalValue())
    setDailyReportOpen(true)
    supabase
      .from('shift_close_field_config')
      .select('field_key, label, allow_override, is_active, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        const rows = (data || []).map((row) =>
          row.field_key === 'square_sales_minor' && /square/i.test(row.label || '')
            ? { ...row, label: 'Total sales' }
            : row,
        )
        setShiftFieldConfig(rows)
      })
  }

  async function submitEndOfShift() {
    const endedIso = datetimeLocalToIso(shiftEndedAtLocal)
    if (!endedIso) {
      setShiftEndedError('Pick when this shift ended.')
      setShiftWizardStep(0)
      toast.error('Set shift end time')
      return
    }
    const baseline = moneySnapshotFromReport(dailyReportData)
    const submitted = { ...baseline }
    for (const key of SHIFT_CLOSE_MONEY_KEYS) {
      if (shiftOverrides[key] != null) {
        const parsed = parsePesosToMinor(shiftOverrides[key])
        if (parsed == null) {
          setShiftFieldErrors({ [key]: 'Enter a valid amount (0 or more).' })
          toast.error('Fix invalid amounts before submit')
          return
        }
        submitted[key] = parsed
      }
    }
    Object.assign(submitted, applyCaCollectedToCashLeft(baseline, submitted))
    const draftForSubmit = (salaryDraftExtras || []).map((row) => ({
      staff_id: row.staff_id || null,
      staff_name: row.staff_name,
      amount_minor:
        row.amount_minor != null ? row.amount_minor : parsePesosToMinor(row.amount_pesos) ?? 0,
      note: row.note,
      kind: row.kind,
    }))
    Object.assign(submitted, attachSalaryDraftExtras(submitted, draftForSubmit))
    const validationBaseline = shiftCloseValidationBaseline(dailyReportData, submitted)
    const check = validateShiftCloseSubmit({
      baseline: validationBaseline,
      submitted,
      reasons: shiftReasons,
      fieldConfig: shiftFieldConfig,
    })
    if (!check.ok) {
      setShiftFieldErrors(check.errors)
      const errKey = Object.keys(check.errors)[0]
      if (['square_sales_minor', 'total_gcash_minor', 'credit_card_minor', 'total_cash_left_minor', 'downpayments_minor', 'ca_collected_minor'].includes(errKey)) {
        setShiftWizardStep(1)
      } else if (errKey) {
        setShiftWizardStep(2)
      }
      toast.error('Fix override reasons or amounts')
      return
    }
    setShiftSubmitting(true)
    const { error } = await supabase.rpc('submit_shift_close', {
      payload: {
        branch,
        business_date: getLocalCalendarDate(),
        shift_ended_at: endedIso,
        pos_baseline: baseline,
        submitted,
        override_reasons: check.overrideReasons,
      },
    })
    setShiftSubmitting(false)
    if (error) toast.error(error.message)
    else {
      toast.success('End of shift submitted for review')
      setDailyReportOpen(false)
      setShiftCloseMode(false)
    }
  }

  const checkoutBody = (
    <div className="mt-6 flex flex-col gap-6">
      <PosDayHero
        sales={formatMoney(todayStats?.total_sales_minor || 0)}
        paid={todayStats?.paid_count ?? 0}
        queue={handoffs.length}
        avg={formatMoney(todayStats?.average_ticket_minor || 0)}
        families={familyTiles}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setDailyReportOpen(true)}>
          Daily sales report
        </Button>
        {canManageCatalog ? (
          <Button type="button" variant="secondary" className="min-h-11" asChild>
            <Link to="/operations/inventory">Inventory Management</Link>
          </Button>
        ) : null}
      </div>

      {handoffs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <div>
            <p className="font-medium">
              {handoffs.length} ticket{handoffs.length === 1 ? '' : 's'} waiting for payment
            </p>
            <p className="text-sm text-muted-foreground">Open Pay queue to settle floor handoffs.</p>
          </div>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => {
              setShellTab('pending')
              setSearchParams({ tab: 'pending' }, { replace: true })
            }}
          >
            Open Pay queue
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-11 pl-9"
            placeholder={
              branchAdmin || catalogTab === 'merch'
                ? 'Search merch / items'
                : catalogTab === 'detailing'
                  ? 'Search detailing'
                  : 'Search services & packages'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {branchLocked ? (
          <div className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm">
            <MapPin className="size-4 text-primary" aria-hidden />
            <span className="font-medium">{branchLabel}</span>
          </div>
        ) : (
          <Select value={branch} onValueChange={setBranch} disabled={!branches.length}>
            <SelectTrigger className="min-h-11 w-full sm:w-48">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {branchAdmin ? (
        <div>
          <div className="planner-v2-tabs mb-3" role="toolbar" aria-label="Merch family">
            {MERCH_FAMILIES.map((fam) => (
              <button
                key={fam.id}
                type="button"
                className={merchFamilyFilter === fam.id ? 'is-on' : ''}
                aria-pressed={merchFamilyFilter === fam.id}
                onClick={() => setMerchFamilyFilter(fam.id)}
              >
                {fam.label}
              </button>
            ))}
          </div>
          <p className="mb-3 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Merch / items ({merchItems.length})
          </p>
          <CatalogGrid
            items={merchItems}
            onAdd={addToCart}
            birthdayPerk={birthdayPerk}
            empty="No merch items for this branch yet."
          />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="bay" className="min-h-11">
              Services & packages ({bayItems.length})
            </TabsTrigger>
            <TabsTrigger value="detailing" className="min-h-11">
              Detailing ({detailingItems.length})
            </TabsTrigger>
            <TabsTrigger value="merch" className="min-h-11">
              Merch / items ({merchItems.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bay" className="mt-4">
            <CatalogGrid
              items={bayItems}
              onAdd={addToCart}
              birthdayPerk={birthdayPerk}
              empty="No services or packages match."
            />
          </TabsContent>
          <TabsContent value="detailing" className="mt-4">
            <CatalogGrid
              items={detailingItems}
              onAdd={addToCart}
              birthdayPerk={birthdayPerk}
              empty="No detailing services match."
            />
          </TabsContent>
          <TabsContent value="merch" className="mt-4">
            <div className="planner-v2-tabs mb-3" role="toolbar" aria-label="Merch family">
              {MERCH_FAMILIES.map((fam) => (
                <button
                  key={fam.id}
                  type="button"
                  className={merchFamilyFilter === fam.id ? 'is-on' : ''}
                  aria-pressed={merchFamilyFilter === fam.id}
                  onClick={() => setMerchFamilyFilter(fam.id)}
                >
                  {fam.label}
                </button>
              ))}
            </div>
            <CatalogGrid
              items={merchItems}
              onAdd={addToCart}
              birthdayPerk={birthdayPerk}
              empty="No merch items. Add stock under Manage merch."
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )

  const pendingBody = (
    <div className="mt-4 flex flex-col gap-4">
      {handoffs.length === 0 ? (
        <div className="planner-empty">
          <strong>No pending payments</strong>
          <p>Queue tickets land here when a car is ready to pay.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {handoffs.map((row) => {
            const booking = row.bookings || {}
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => { loadHandoff(row); setShellTab('checkout') }}
                className="planner-ticket min-h-[88px] rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-accent/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{booking.customer_name || 'Customer'}</p>
                  <Badge variant="secondary">
                    {booking.queue_number != null ? `Q-${String(booking.queue_number).padStart(3, '0')}` : 'Queue'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{booking.vehicle_plate || '—'}</p>
                <p className="mt-3 text-xl font-semibold tabular-nums">{formatMoney(row.amount_minor || booking.final_price_minor || 0)}</p>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  const expensesBody = (
    <div className="mt-4 flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Submit expense</CardTitle>
        </CardHeader>
        <CardContent>
          {!canWriteFinance(profile) ? (
            <p className="text-sm text-muted-foreground">Expense entry needs Finance write. Super Admin can grant it on People.</p>
          ) : (
          <form onSubmit={submitExpense} className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label htmlFor="pos-exp-title">Description</Label>
              <Input
                id="pos-exp-title"
                required
                placeholder="e.g. ice, supplies, parking"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-exp-amount">Amount (₱)</Label>
              <Input
                id="pos-exp-amount"
                required
                inputMode="decimal"
                placeholder="0.00"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pos-exp-kind">Category</Label>
              <Select value={expenseForm.expense_kind} onValueChange={(v) => setExpenseForm({ ...expenseForm, expense_kind: v })}>
                <SelectTrigger id="pos-exp-kind" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {expenseKinds.map((k) => (
                    <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingExpense} className="min-h-11">
                {savingExpense ? 'Saving…' : 'Record expense'}
              </Button>
            </div>
          </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Today&apos;s expenses · {branchLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {todayExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses recorded today.</p>
          ) : (
            <div className="space-y-2">
              {todayExpenses.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {expenseKinds.find((k) => k.value === row.expense_kind)?.label || row.expense_kind}
                      {' · '}
                      {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">{formatMoney(row.total_minor)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(todayExpenses.filter(expenseCountsOnDailyClose).reduce((s, r) => s + Number(r.total_minor || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const dashboardBody = (
    <div className="mt-4 flex flex-col gap-6">
      <PosDayHero
        sales={formatMoney(todayStats?.total_sales_minor || 0)}
        paid={todayStats?.paid_count ?? 0}
        queue={handoffs.length}
        avg={formatMoney(todayStats?.average_ticket_minor || 0)}
        families={[
          ...familyTiles,
          { label: 'Today expenses', value: formatMoney(todayExpenses.filter(expenseCountsOnDailyClose).reduce((s, r) => s + Number(r.total_minor || 0), 0)) },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setDailyReportOpen(true)}>
          Daily sales report
        </Button>
        {canManageCatalog && (
          <Button type="button" variant="secondary" className="min-h-11" asChild>
            <Link to="/operations/inventory">Inventory Management</Link>
          </Button>
        )}
        {canOpenFinance ? (
        <Button type="button" variant="secondary" className="min-h-11" asChild>
          <Link to="/operations/finance?tab=purchases">Open Finance · expenses</Link>
        </Button>
        ) : null}
        {allowRoute(profile, 'payroll') ? (
          <Button type="button" variant="outline" className="min-h-11" asChild>
            <Link to="/operations/payroll?tab=cash-advance">Cash advances · Payroll</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )

  return (
    <section className={`hakum-pos planner-v2 flex flex-col ${branchAdmin ? 'gap-4' : 'gap-6'}`}>
      <header className="planner-v2-head hakum-pos-head">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
            {branchAdmin ? 'Counter' : 'Point of sale'}
          </p>
          <h1>{branchAdmin ? 'POS' : 'POS'}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span>
              {branchAdmin
                ? `Sell merch, take queue payment, close the day · ${branchLabel}`
                : `Sell, pay queue tickets, expenses, end of shift · ${branchLabel}`}
            </span>
          </p>
        </div>
        <div className="hakum-pos-head-actions">
          {canAccessSettings(profile) ? (
            <Button type="button" variant="outline" className="min-h-11" asChild>
              <Link to="/operations/settings/pos">POS settings</Link>
            </Button>
          ) : null}
          {canSubmitShiftClose(profile) ? (
            <Button
              type="button"
              className="hakum-pos-end-shift min-h-11 gap-2"
              onClick={openEndOfShift}
            >
              <LogOut data-icon="inline-start" aria-hidden />
              End of shift
            </Button>
          ) : null}
          {shellTab === 'checkout' ? (
            <Button onClick={() => setCartOpen(true)} className="min-h-11 gap-2">
              <ShoppingCart data-icon="inline-start" />
              Cart · {cart.length} · {formatMoney(cartTotal)}
            </Button>
          ) : null}
        </div>
      </header>

      <Tabs value={shellTab} onValueChange={setShellTab} className="w-full">
        <TabsList variant="line" className="hakum-pos-tabs planner-v2-tabs">
          <TabsTrigger value="checkout" className="min-h-11">Sell</TabsTrigger>
          <TabsTrigger value="pending" className="min-h-11">Pay queue{handoffs.length ? ` (${handoffs.length})` : ''}</TabsTrigger>
          <TabsTrigger value="expenses" className="min-h-11">Expenses</TabsTrigger>
          <TabsTrigger value="dashboard" className="min-h-11">Today</TabsTrigger>
        </TabsList>
        <TabsContent value="checkout">{checkoutBody}</TabsContent>
        <TabsContent value="pending">{pendingBody}</TabsContent>
        <TabsContent value="expenses">{expensesBody}</TabsContent>
        <TabsContent value="dashboard">{dashboardBody}</TabsContent>
      </Tabs>

      <Sheet
        open={dailyReportOpen}
        onOpenChange={(open) => {
          setDailyReportOpen(open)
          if (!open) {
            setShiftCloseMode(false)
            setShiftWizardStep(0)
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {shiftCloseMode ? 'End of shift' : 'Daily sales report'} · {branchLabel}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
            {shiftCloseMode ? (
              <ShiftCloseWizard
                step={shiftWizardStep}
                onStep={setShiftWizardStep}
                branchLabel={branchLabel}
                shiftEndedAtLocal={shiftEndedAtLocal}
                onShiftEndedAt={(v) => {
                  setShiftEndedAtLocal(v)
                  setShiftEndedError('')
                }}
                shiftEndedError={shiftEndedError}
                dailyReportData={dailyReportData}
                shiftFieldConfig={shiftFieldConfig}
                shiftOverrides={shiftOverrides}
                setShiftOverrides={setShiftOverrides}
                shiftReasons={shiftReasons}
                setShiftReasons={setShiftReasons}
                shiftFieldErrors={shiftFieldErrors}
                setShiftFieldErrors={setShiftFieldErrors}
                salaryDraftExtras={salaryDraftExtras}
                setSalaryDraftExtras={setSalaryDraftExtras}
                staffOptions={(todayAttendance || []).map((row) => ({
                  id: row.staff_id,
                  full_name: row.staff_profiles?.full_name || row.staff_id,
                }))}
                onSubmit={submitEndOfShift}
                shiftSubmitting={shiftSubmitting || !branch}
              />
            ) : (
              <>
            <p className="text-muted-foreground">
              Auto-filled from today’s paid sales. Payment modes: Cash, GCash, Credit Cards.
            </p>
            <div className="rounded-xl border border-border p-3">
              <p className="font-semibold">Payment totals</p>
              <p className="mt-1">All sales · {formatMoney(todayStats?.total_sales_minor || 0)}</p>
              <p>Cash · {formatMoney(todayStats?.cash_sales_minor || 0)}</p>
              <p>GCash · {formatMoney(todayStats?.gcash_sales_minor || 0)}</p>
              <p>Credit Cards · {formatMoney(todayStats?.card_sales_minor || 0)}</p>
              <p className="mt-2 text-xs text-muted-foreground">Paid count · {todayStats?.paid_count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="font-semibold">By job type</p>
              {familyTiles.map((row) => (
                <p key={row.label}>{row.label} · {row.value}</p>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 font-semibold">Daily close report</p>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed">{formatBacoorReportText(dailyReportData, formatMoney)}</pre>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => {
                navigator.clipboard.writeText(formatBacoorReportText(dailyReportData, formatMoney))
                toast.success('Report copied to clipboard')
              }}
            >
              Copy report text
            </Button>
            {canOpenFinance ? (
            <Button type="button" className="min-h-11 w-full" asChild>
              <Link to="/operations/finance?tab=purchases" onClick={() => setDailyReportOpen(false)}>
                Open Finance · expenses
              </Link>
            </Button>
            ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="pos-checkout-sheet flex w-full flex-col gap-0 border-l-0 p-0 sm:max-w-md">
          <div className="pos-checkout-head px-5 pt-5 pb-4">
            <SheetHeader className="gap-1 pr-8 text-left">
              <p className="text-[10px] font-bold tracking-[0.2em] text-white/55 uppercase">Hakum POS · {branchLabel}</p>
              <SheetTitle className="text-xl text-white">{activeHandoff ? 'Pay queue ticket' : 'Checkout'}</SheetTitle>
            </SheetHeader>
            {activeHandoff && (
              <p className="mt-3 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/80">
                Linked to booking {activeHandoff.booking_id?.slice(0, 8)}… · paying closes the handoff.
              </p>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2">
              {cart.length === 0 && <p className="text-sm text-muted-foreground">Cart is empty.</p>}
              {cart.map((line) => (
                <div key={line.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
                  <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} ×{' '}
                      {line.is_loyalty_award || line.is_membership_included ? (
                        <span className="font-medium text-emerald-600">FREE</span>
                      ) : (
                        formatMoney(line.unit_price_minor)
                      )}{' '}
                      · {line.catalog_kind || line.item_type}
                      {line.from_handoff ? ' · queue job' : ''}
                      {line.is_loyalty_award ? ' · loyalty' : ''}
                      {line.is_membership_included ? ' · member include' : ''}
                      {line.membership_discount_applied ? ' · member discount' : ''}
                      {line.adhoc_discount_applied ? ' · discount' : ''}
                    </p>
                    {line.from_handoff ? (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                        Ask Team Lead to change the wash/detailing job.
                      </p>
                    ) : null}
                  </div>
                  {canRemovePosCartLine(line) ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => setCart((c) => removePosCartLine(c, line.key))}
                      aria-label="Remove"
                    >
                      <Trash2 />
                    </Button>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Locked</span>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Ad-hoc discount</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  className="min-h-10"
                  placeholder="% off"
                  inputMode="decimal"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                />
                <Input
                  className="min-h-10"
                  placeholder="₱ amount"
                  inputMode="decimal"
                  value={discountAmountPesos}
                  onChange={(e) => setDiscountAmountPesos(e.target.value)}
                />
              </div>
              <Input
                className="min-h-10"
                placeholder="Reason (required)"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
              <Button type="button" variant="secondary" className="min-h-10 w-full" onClick={applyCartDiscount}>
                Apply discount
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/25 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Customer</p>
                {linkedCustomer ? (
                  <Badge variant="secondary" className="gap-1">
                    <Link2 className="size-3" aria-hidden /> Loyalty linked
                  </Badge>
                ) : (
                  <Badge variant="outline">Walk-in</Badge>
                )}
              </div>

              {linkedCustomer ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{linkedCustomer.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[linkedCustomer.phone, linkedCustomer.plate].filter(Boolean).join(' · ') || 'Account linked'}
                    </p>
                    {birthdayPerk ? (
                      <p className="mt-1 text-xs font-medium text-primary">Birthday free service available</p>
                    ) : null}
                    {activeMembership ? (
                      <p className="mt-1 text-xs font-medium text-primary">
                        {activeMembership.name}
                        {activeMembership.discount_percent > 0
                          ? ` · ${activeMembership.discount_percent}% off services`
                          : ''}
                        {(activeMembership.included_services || []).length
                          ? ` · ${(activeMembership.included_services || []).length} included`
                          : ''}
                      </p>
                    ) : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="min-h-10 min-w-10 shrink-0" onClick={clearCustomerLink} aria-label="Unlink customer">
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="min-h-11 pl-9"
                        placeholder="Name, phone, or plate"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            runCustomerSearch()
                          }
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <Button type="button" variant="secondary" className="min-h-11 shrink-0 px-4" disabled={searchingCustomer} onClick={runCustomerSearch}>
                      {searchingCustomer ? '…' : 'Search'}
                    </Button>
                  </div>
                  {customerHits.length > 0 && (
                    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-1">
                      {customerHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            className="flex w-full min-h-11 flex-col items-start rounded-md px-3 py-2 text-left hover:bg-accent"
                            onClick={() => attachCustomer(hit)}
                          >
                            <span className="font-medium">{hit.full_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {[hit.phone, hit.plate, hit.source === 'plate' ? 'plate match' : null].filter(Boolean).join(' · ')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-guest-first" className="text-xs text-muted-foreground">
                        First name
                      </Label>
                      <Input
                        id="pos-guest-first"
                        className="min-h-11"
                        placeholder="First"
                        value={guestFirstName}
                        onChange={(e) => {
                          setGuestFirstName(e.target.value)
                          setGuestName([e.target.value, guestLastName].filter(Boolean).join(' '))
                        }}
                        autoComplete="given-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-guest-last" className="text-xs text-muted-foreground">
                        Last name
                      </Label>
                      <Input
                        id="pos-guest-last"
                        className="min-h-11"
                        placeholder="Last"
                        value={guestLastName}
                        onChange={(e) => {
                          setGuestLastName(e.target.value)
                          setGuestName([guestFirstName, e.target.value].filter(Boolean).join(' '))
                        }}
                        autoComplete="family-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-guest-phone" className="text-xs text-muted-foreground">
                        Number
                      </Label>
                      <Input
                        id="pos-guest-phone"
                        className="min-h-11"
                        placeholder="09…"
                        inputMode="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        autoComplete="tel"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-guest-email" className="text-xs text-muted-foreground">
                        Email <span className="font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="pos-guest-email"
                        className="min-h-11"
                        placeholder="name@…"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Search to link an existing account. With a phone number, Admin / Super Admin creates a customer on payment if none exists.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Payment method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="min-h-11 w-full">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  {paymentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ceramicPreview ? (
            <div className="space-y-2 rounded-xl border border-border bg-muted/25 p-3">
              <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">Compensation toggles</p>
              {[
                { key: 'freeShirt', label: 'Free shirt included' },
                { key: 'cardPayment', label: 'Credit/debit card payment' },
                { key: 'crewAssisted', label: 'Car wash crew assisted' },
                { key: 'detailerAssigned', label: 'Detailer assigned' },
              ].map((t) => (
                <label key={t.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      t.key === 'cardPayment'
                        ? effectiveCeramicToggles(compToggles, paymentMethod).cardPayment
                        : compToggles[t.key]
                    }
                    disabled={t.key === 'cardPayment' && (paymentMethod === 'card' || paymentMethod === 'credit')}
                    onChange={(e) => setCompToggles((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                  />
                  {t.label}
                </label>
              ))}
              <p className="text-xs tabular-nums text-muted-foreground">
                Crew {formatMoney(ceramicPreview.crew_minor)}
                {' · '}
                Detailer {formatMoney(ceramicPreview.detailer_minor)} posts as Finance drafts on pay
              </p>
            </div>
            ) : null}
          </div>

          <div className="pos-checkout-footer mt-auto space-y-3 border-t border-border px-5 py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">Receipt total</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(cartTotal)}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound className="size-3.5" aria-hidden />
                {linkedCustomer ? 'Loyalty' : 'Walk-in'}
              </div>
            </div>
            <Button className="min-h-12 w-full text-base" disabled={!cart.length || !branch || saving || posCartBlocksCheckout(cart)} onClick={checkout}>
              {saving ? 'Processing…' : posCartBlocksCheckout(cart) ? 'Ticket missing service' : 'Complete payment'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function CatalogGrid({ items, onAdd, empty, birthdayPerk }) {
  const [sizeByKey, setSizeByKey] = useState({})
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>

  function pricedItem(item) {
    const options = item.size_options || []
    if (!options.length) return item
    const slug = sizeByKey[item.key] || options.find((o) => o.slug === 'medium')?.slug || options[0].slug
    const price_minor =
      item.size_prices?.[slug] != null ? Number(item.size_prices[slug]) : item.price_minor
    const label = PRICING_SIZES.find((x) => x.slug === slug)?.label || slug
    return {
      ...item,
      key: `${item.key}-${slug}`,
      price_minor,
      meta: [item.meta, `Size ${label}`].filter(Boolean).join(' · '),
      vehicle_size: slug,
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => {
        const options = item.size_options || []
        const selected =
          sizeByKey[item.key] || options.find((o) => o.slug === 'medium')?.slug || options[0]?.slug || ''
        return (
          <div key={item.key} className="min-h-[100px]">
            <Card className="planner-ticket h-full transition hover:border-primary/50 hover:bg-accent/30">
              <button type="button" onClick={() => onAdd(pricedItem(item))} className="w-full text-left">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <Badge variant="secondary">{item.catalog_kind || item.item_type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatMoney(
                      options.length && selected && item.size_prices?.[selected] != null
                        ? item.size_prices[selected]
                        : item.price_minor,
                    )}
                  </p>
                  {item.meta && <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>}
                </CardContent>
              </button>
              {options.length > 0 ? (
                <div className="border-t border-border px-4 py-2" onClick={(e) => e.stopPropagation()}>
                  <Select
                    value={selected}
                    onValueChange={(slug) => setSizeByKey((cur) => ({ ...cur, [item.key]: slug }))}
                  >
                    <SelectTrigger className="min-h-10">
                      <SelectValue placeholder="Pick size" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((sz) => (
                        <SelectItem key={sz.slug} value={sz.slug}>
                          {sz.label} · {formatMoney(item.size_prices?.[sz.slug] ?? item.price_minor)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-1 border-t border-border px-4 py-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-11 gap-1.5 px-2 text-xs text-muted-foreground"
                  onClick={() => onAdd(pricedItem(item), { loyaltyAward: true })}
                >
                  <Gift className="size-3.5" aria-hidden />
                  Loyalty / free
                </Button>
                {birthdayPerk ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 gap-1.5 px-2 text-xs text-primary"
                    onClick={() => onAdd(pricedItem(item), { birthdayAward: true })}
                  >
                    <Cake className="size-3.5" aria-hidden />
                    Birthday
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

function PosDayHero({ sales, paid, queue, avg, families = [] }) {
  return (
    <>
      <div className="hakum-pos-hero planner-ticket">
        <p>Sales today</p>
        <strong>{sales}</strong>
        <dl>
          <div>
            <dt>Paid</dt>
            <dd>{paid}</dd>
          </div>
          <div>
            <dt>Queue to pay</dt>
            <dd>{queue}</dd>
          </div>
          <div>
            <dt>Avg ticket</dt>
            <dd>{avg}</dd>
          </div>
        </dl>
      </div>
      {families.length ? (
        <div className="hakum-pos-families" role="list">
          {families.map((row) => (
            <div key={row.label} role="listitem">
              <span>{row.label}</span>
              <b>{row.value}</b>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

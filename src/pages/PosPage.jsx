import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams, Link } from 'react-router-dom'
import { Cake, Check, Gift, Link2, MapPin, Search, ShoppingCart, Trash2, UserRound, X, XCircle } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos, canManageServices, canSeeAllBranches, getBranchScopeList, isAdmin, isBranchAdmin, isSuperAdmin, isAssistantSuperAdmin } from '@/auth/permissions'
import { listBranches, getLoyaltyProgramSettings } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { buildHandoffCartLine, buildPosSalePayload, priceCartForMembership } from '@/lib/posSale'
import { PRICING_SIZES, resolveServicePriceMinor, formatSizePriceRange } from '@/lib/servicePricing'
import { supabase } from '@/lib/supabase'
import { filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { formatMoney, searchPosCustomer } from '@/queue/queueApi'
import { buildBacoorDailyReport, formatBacoorReportText } from '@/lib/bacoorDailyReport'
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
import { accumulatePosCategoryTotals, emptyPosCategoryTotals, productIsPosSellable } from '@/lib/posSellables'

const PAYMENT_OPTIONS = PAYMENT_METHODS

const EXPENSE_KINDS = [
  { value: 'daily', label: 'Daily expense' },
  { value: 'salary_carwash', label: 'Carwash salary' },
  { value: 'salary_detailer', label: 'Detailer salary' },
  { value: 'salary_tinter', label: 'Tinter salary' },
  { value: 'monthly', label: 'Monthly expense' },
  { value: 'other_branch', label: 'Other branch expense' },
  { value: 'other', label: 'Other' },
]

const SHELL_TABS = ['checkout', 'pending', 'expenses', 'cash-advance', 'dashboard', 'services', 'merch']

export default function PosPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const branchAdmin = isBranchAdmin(profile)
  const canManageCatalog = canManageServices(profile)
  const requestedShellTab = SHELL_TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'checkout'
  // Branch Admin (and anyone without catalog CRUD) can't access services/merch manage tabs.
  const manageTabs = ['services', 'merch']
  const shellTab = !canManageCatalog && manageTabs.includes(requestedShellTab) ? 'checkout' : requestedShellTab
  const scopeList = getBranchScopeList(profile)
  const canPickPosBranch = canSeeAllBranches(profile) || (Array.isArray(scopeList) && scopeList.length > 1)
  const branchLocked = !canPickPosBranch
  const assignedBranch = pickDefaultBranchSlug(profile, [])
  const canProvisionCustomer = isAdmin(profile)

  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  // Branch Admin sells merch + pays queue tickets only — not freeform service catalog.
  const [tab, setTab] = useState(() => (isBranchAdmin(profile) ? 'merch' : 'services'))

  useEffect(() => {
    if (branchAdmin && tab !== 'merch') setTab('merch')
  }, [branchAdmin, tab])

  useEffect(() => {
    if (!canManageCatalog && manageTabs.includes(searchParams.get('tab'))) {
      setSearchParams({}, { replace: true })
    }
  }, [canManageCatalog, searchParams, setSearchParams])
  const [cart, setCart] = useState([])
  const [branch, setBranch] = useState(assignedBranch)
  const [branches, setBranches] = useState([])
  const [carSize, setCarSize] = useState('medium')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [linkedCustomer, setLinkedCustomer] = useState(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerHits, setCustomerHits] = useState([])
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [compToggles, setCompToggles] = useState({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
  const [todayStats, setTodayStats] = useState(null)
  const [categoryTotals, setCategoryTotals] = useState(emptyPosCategoryTotals())
  const [dailyReportOpen, setDailyReportOpen] = useState(false)
  const [handoffs, setHandoffs] = useState([])
  const [activeHandoff, setActiveHandoff] = useState(null)
  const [activeMembership, setActiveMembership] = useState(null)
  const [birthdayPerk, setBirthdayPerk] = useState(null)
  const [membershipsEnabled, setMembershipsEnabled] = useState(true)

  // Expenses tab
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', expense_kind: 'daily' })
  const [savingExpense, setSavingExpense] = useState(false)
  const [todayExpenses, setTodayExpenses] = useState([])

  // Cash-advance tab
  const [caSubmissions, setCaSubmissions] = useState([])
  const [caLoading, setCaLoading] = useState(false)

  const canApproveCa = isSuperAdmin(profile) || isAssistantSuperAdmin(profile) || isBranchAdmin(profile)

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

  const load = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const startIso = `${today}T00:00:00+08:00`
    const endIso = `${today}T23:59:59.999+08:00`
    const [svc, prod, stats, handoffRes, salesRes] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, slug, pay_category, price_minor, service_size_prices(size_slug, price_minor)')
        .eq('is_active', true)
        .eq('is_archived', false),
      supabase
        .from('products')
        .select('id, name, price_minor, category, stock_qty, sku, tags')
        .eq('is_active', true)
        .eq('is_archived', false),
      supabase.from('daily_sales_summary').select('*').eq('sale_date', today).eq('branch', branch).maybeSingle(),
      supabase
        .from('pos_handoffs')
        .select('id, booking_id, branch, status, amount_minor, created_at, bookings(id, customer_id, customer_name, vehicle_plate, service_id, final_price_minor, vehicle_type, status, queue_number)')
        .eq('status', 'pending')
        .eq('branch', branch)
        .order('created_at', { ascending: true }),
      supabase
        .from('sales')
        .select(
          'id, total_minor, payment_method, booking_id, sale_line_items(item_type, line_total_minor, service_id, product_id, services(name, slug, pay_category))',
        )
        .eq('status', 'paid')
        .eq('branch', branch)
        .gte('occurred_at', startIso)
        .lte('occurred_at', endIso)
        .limit(500),
    ])
    if (svc.error) toast.error(svc.error.message)
    if (prod.error) toast.error(prod.error.message)
    if (stats.error) toast.error(stats.error.message)
    if (handoffRes.error) toast.error(handoffRes.error.message)
    if (salesRes.error) toast.error(salesRes.error.message)
    setServices(
      (svc.data || []).map((row) => ({
        ...row,
        size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
      })),
    )
    const productRows = (prod.data || []).filter((p) => (branchAdmin ? productIsPosSellable(p) : true))
    setProducts(productRows)
    setTodayStats(stats.data)
    setHandoffs(handoffRes.data || [])

    const catRows = []
    for (const sale of salesRes.data || []) {
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

  const loadExpenses = useCallback(async () => {
    if (!branch) return
    const today = getLocalCalendarDate()
    const { data, error } = await supabase
      .from('expenses')
      .select('id, title, total_minor, expense_kind, branch, created_at')
      .eq('branch', branch)
      .gte('created_at', `${today}T00:00:00+08:00`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) toast.error(error.message)
    setTodayExpenses(data || [])
  }, [branch])

  const loadCashAdvances = useCallback(async () => {
    if (!branch) return
    setCaLoading(true)
    const { data, error } = await supabase
      .from('ops_form_submissions')
      .select('id, form_id, payload, status, respondent_label, created_at, ops_forms ( name, kind, slug )')
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(100)
    setCaLoading(false)
    if (error) { toast.error(error.message); return }
    // Filter to cash_advance kind + branch scope
    const filtered = (data || []).filter((row) => {
      if (row.ops_forms?.kind !== 'cash_advance') return false
      const subBranch = row.payload?.branch || ''
      if (!subBranch) return true
      const scope = getBranchScopeList(profile)
      if (scope === null) return true
      return scope.includes(subBranch)
    })
    setCaSubmissions(filtered)
  }, [branch, profile])

  useEffect(() => {
    if (!branch) return
    load()
    loadExpenses()
    loadCashAdvances()
    const channel = supabase
      .channel(`pos-sales:${branch}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_handoffs' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, loadExpenses)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, loadExpenses, loadCashAdvances, branch])

  const serviceItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (services || [])
      .map((s) => {
        const price_minor = resolveServicePriceMinor(s, carSize)
        return {
          key: `service-${s.id}-${carSize}`,
          item_type: 'service',
          id: s.id,
          name: s.name,
          price_minor,
          meta: `Size: ${PRICING_SIZES.find((x) => x.slug === carSize)?.label || carSize} · range ${formatSizePriceRange(s, formatMoney)}`,
        }
      })
      .filter((item) => !q || item.name.toLowerCase().includes(q))
  }, [services, query, carSize])

  const merchItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (products || [])
      .map((p) => ({
        key: `product-${p.id}`,
        item_type: 'product',
        id: p.id,
        name: p.name,
        price_minor: p.price_minor,
        meta: `Stock ${p.stock_qty}${p.sku ? ` · ${p.sku}` : ''}`,
      }))
      .filter((item) => !q || item.name.toLowerCase().includes(q) || (item.meta || '').toLowerCase().includes(q))
  }, [products, query])

  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * line.unit_price_minor, 0)

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
    setGuestPhone('')
    setPaymentMethod('cash')
  }

  function addToCart(item, { loyaltyAward = false, birthdayAward = false } = {}) {
    setActiveHandoff(null)
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

  function loadHandoff(row) {
    const booking = row.bookings || {}
    const serviceId = booking.service_id
    const svc = serviceId ? services.find((s) => s.id === serviceId) : null
    if (booking.vehicle_type) setCarSize(booking.vehicle_type)
    const amount =
      row.amount_minor ??
      booking.final_price_minor ??
      resolveServicePriceMinor(svc, booking.vehicle_type || carSize) ??
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
    setTab('services')
    const line = buildHandoffCartLine({ handoff: row, services, amountMinor: amount })
    setCart([line])
    if (line.missing_service) {
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
              customer_name: guestName.trim() || 'Walk-in customer',
              customer_phone: guestPhone.trim(),
              site_origin: window.location.origin,
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
    if (!resolvedCustomerId && (guestName.trim() || guestPhone.trim())) {
      noteParts.push(`Walk-in: ${[guestName.trim(), guestPhone.trim()].filter(Boolean).join(' · ')}`)
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
    toast.success(
      handoff
        ? `Ticket paid · ${formatMoney(data?.total_minor || cartTotal)}`
        : `Sale complete · ${formatMoney(data?.total_minor || cartTotal)}${loyalty ? ' · loyalty updated' : ''}`,
    )
    setCart([])
    setActiveHandoff(null)
    resetCheckoutExtras()
    setCompToggles({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
    setCartOpen(false)
    load()
  }

  if (!canAccessPos(profile)) return <Navigate to="/operations/access-denied" replace />

  const catalog = tab === 'services' ? serviceItems : merchItems
  const catalogTab = branchAdmin ? 'merch' : tab

  function setShellTab(next) {
    if (!canManageCatalog && manageTabs.includes(next)) return
    setSearchParams(next === 'checkout' ? {} : { tab: next }, { replace: true })
  }

  async function submitExpense(e) {
    e.preventDefault()
    const pesos = Number(String(expenseForm.amount).replace(/,/g, '').trim())
    if (!expenseForm.title.trim() || !Number.isFinite(pesos) || pesos <= 0) {
      return toast.error('Enter a title and valid amount')
    }
    setSavingExpense(true)
    const total = Math.round(pesos * 100)
    const { error } = await supabase.from('expenses').insert({
      title: expenseForm.title.trim(),
      total_minor: total,
      unit_cost_minor: total,
      quantity: 1,
      expense_kind: expenseForm.expense_kind,
      branch,
      status: 'draft',
    })
    setSavingExpense(false)
    if (error) return toast.error(error.message)
    toast.success('Expense recorded')
    setExpenseForm({ title: '', amount: '', expense_kind: 'daily' })
    loadExpenses()
  }

  async function updateCaStatus(id, status) {
    const { error } = await supabase.from('ops_form_submissions').update({ status }).eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success(`Cash advance ${status === 'resolved' ? 'approved' : 'declined'}`)
      loadCashAdvances()
    }
  }

  const checkoutBody = (
    <div className="mt-6 flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={formatMoney(todayStats?.total_sales_minor || 0)} />
        <Stat label="Paid" value={todayStats?.paid_count ?? 0} />
        <Stat label="Queue to pay" value={handoffs.length} />
        <Stat label="Avg ticket" value={formatMoney(todayStats?.average_ticket_minor || 0)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Car wash jobs" value={formatMoney(categoryTotals.car_wash)} />
        <Stat label="Ceramic coating" value={formatMoney(categoryTotals.ceramic_coating)} />
        <Stat label="Nano ceramic tint" value={formatMoney(categoryTotals.nano_tint)} />
        <Stat label="PPF jobs" value={formatMoney(categoryTotals.ppf)} />
      </div>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Waiting for payment</CardTitle>
            <p className="text-sm text-muted-foreground">
              {branchAdmin
                ? 'Cars from the queue — open one to take payment.'
                : 'Tickets from the floor — open one to close the visit.'}
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {handoffs.map((row) => {
              const booking = row.bookings || {}
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => loadHandoff(row)}
                  className="min-h-[88px] rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-accent/30"
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
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-11 pl-9"
            placeholder={branchAdmin || catalogTab === 'merch' ? 'Search merch / items' : 'Search services'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!branchAdmin && catalogTab === 'services' && (
          <Select value={carSize} onValueChange={setCarSize}>
            <SelectTrigger className="min-h-11 w-full sm:w-48">
              <SelectValue placeholder="Car size" />
            </SelectTrigger>
            <SelectContent>
              {PRICING_SIZES.map((sz) => (
                <SelectItem key={sz.slug} value={sz.slug}>
                  {sz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="services" className="min-h-10">
              Services ({serviceItems.length})
            </TabsTrigger>
            <TabsTrigger value="merch" className="min-h-10">
              Merch / items ({merchItems.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="mt-4">
            <CatalogGrid items={catalog} onAdd={addToCart} birthdayPerk={birthdayPerk} empty="No services match." />
          </TabsContent>
          <TabsContent value="merch" className="mt-4">
            <CatalogGrid items={catalog} onAdd={addToCart} birthdayPerk={birthdayPerk} empty="No merch items. Add stock under Manage merch." />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )

  const dailyReportData = useMemo(() => {
    return buildBacoorDailyReport({
      branch: branch || 'bacoor',
      date: getLocalCalendarDate(),
      sales: [],
      expenses: todayExpenses.map((e) => ({
        expense_kind: e.expense_kind,
        amount_minor: e.total_minor,
        label: e.title,
      })),
      cashAdvances: caSubmissions
        .filter((r) => r.status === 'resolved')
        .map((r) => ({
          status: 'approved',
          amount_minor: Number(r.payload?.amount || 0) * 100,
          employee_name: r.payload?.employee_name || r.respondent_label || 'Employee',
        })),
    })
  }, [branch, todayExpenses, caSubmissions])

  const pendingBody = (
    <div className="mt-4 flex flex-col gap-4">
      {handoffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending payments right now.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {handoffs.map((row) => {
            const booking = row.bookings || {}
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => { loadHandoff(row); setShellTab('checkout') }}
                className="min-h-[88px] rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-accent/30"
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
                  {EXPENSE_KINDS.map((k) => (
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Today's expenses · {branchLabel}</CardTitle>
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
                      {EXPENSE_KINDS.find((k) => k.value === row.expense_kind)?.label || row.expense_kind}
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
                  {formatMoney(todayExpenses.reduce((s, r) => s + Number(r.total_minor || 0), 0))}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const cashAdvanceBody = (
    <div className="mt-4 flex flex-col gap-4">
      {caLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : caSubmissions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pending cash advance requests.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {caSubmissions.map((row) => {
            const p = row.payload || {}
            return (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.employee_name || row.respondent_label || 'Employee'}</CardTitle>
                    <Badge variant="outline">{row.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold tabular-nums">{formatMoney(Number(p.amount || 0) * 100)}</p>
                  {p.branch && <p className="text-xs text-muted-foreground">Branch: {p.branch}</p>}
                  {p.needed_by && <p className="text-xs text-muted-foreground">Needed by: {p.needed_by}</p>}
                  {p.reason && <p className="text-sm">{p.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                  {canApproveCa && (
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="gap-1.5" onClick={() => updateCaStatus(row.id, 'resolved')}>
                        <Check className="size-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => updateCaStatus(row.id, 'archived')}>
                        <XCircle className="size-3.5" /> Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  const dashboardBody = (
    <div className="mt-4 flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={formatMoney(todayStats?.total_sales_minor || 0)} />
        <Stat label="Paid" value={todayStats?.paid_count ?? 0} />
        <Stat label="Queue to pay" value={handoffs.length} />
        <Stat label="Avg ticket" value={formatMoney(todayStats?.average_ticket_minor || 0)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Car wash" value={formatMoney(categoryTotals.car_wash)} />
        <Stat label="Ceramic coating" value={formatMoney(categoryTotals.ceramic_coating)} />
        <Stat label="Nano ceramic tint" value={formatMoney(categoryTotals.nano_tint)} />
        <Stat label="PPF" value={formatMoney(categoryTotals.ppf)} />
        <Stat label="Sellables" value={formatMoney(categoryTotals.sellables)} />
        <Stat label="Today expenses" value={formatMoney(todayExpenses.reduce((s, r) => s + Number(r.total_minor || 0), 0))} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setDailyReportOpen(true)}>
          Daily sales report
        </Button>
        {canManageCatalog && (
          <Button type="button" variant="secondary" className="min-h-11" asChild>
            <Link to="/operations/inventory">Inventory Management</Link>
          </Button>
        )}
        <Button type="button" variant="secondary" className="min-h-11" asChild>
          <Link to="/operations/finance?tab=expenses">Open Finance · expenses</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <section className={`flex flex-col ${branchAdmin ? 'gap-4' : 'gap-6'}`}>
      <div className="floor-compact-header flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">
            {branchAdmin ? 'Branch Admin' : 'Point of sale'}
          </p>
          <h1 className={`font-semibold tracking-tight ${branchAdmin ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'}`}>
            {branchAdmin ? 'POS' : 'POS hub'}
          </h1>
          {!branchAdmin && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              <span>
                Checkout, services catalog, and merch inventory
                {branchLocked ? ' · your assigned branch' : ' · all branches'}
              </span>
            </p>
          )}
          {branchAdmin && (
            <p className="floor-desc mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
              <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
              <span>Queue payment + merch · {branchLocked ? 'your branch' : 'all branches'}</span>
            </p>
          )}
        </div>
        {shellTab === 'checkout' && (
          <Button onClick={() => setCartOpen(true)} className="min-h-11 gap-2">
            <ShoppingCart data-icon="inline-start" />
            Cart · {cart.length} · {formatMoney(cartTotal)}
          </Button>
        )}
      </div>

      <Tabs value={shellTab} onValueChange={setShellTab} className="w-full">
        <TabsList className="flex w-full max-w-2xl flex-wrap gap-1">
          <TabsTrigger value="checkout" className="min-h-10">Checkout</TabsTrigger>
          <TabsTrigger value="pending" className="min-h-10">Pending{handoffs.length ? ` (${handoffs.length})` : ''}</TabsTrigger>
          <TabsTrigger value="expenses" className="min-h-10">Expenses</TabsTrigger>
          <TabsTrigger value="cash-advance" className="min-h-10">Cash Advance{caSubmissions.length ? ` (${caSubmissions.length})` : ''}</TabsTrigger>
          <TabsTrigger value="dashboard" className="min-h-10">Dashboard</TabsTrigger>
          {canManageCatalog && <TabsTrigger value="services" className="min-h-10">Services</TabsTrigger>}
          {canManageCatalog && <TabsTrigger value="merch" className="min-h-10">Merch</TabsTrigger>}
        </TabsList>
        <TabsContent value="checkout">{checkoutBody}</TabsContent>
        <TabsContent value="pending">{pendingBody}</TabsContent>
        <TabsContent value="expenses">{expensesBody}</TabsContent>
        <TabsContent value="cash-advance">{cashAdvanceBody}</TabsContent>
        <TabsContent value="dashboard">{dashboardBody}</TabsContent>
        {canManageCatalog && <TabsContent value="services">{checkoutBody}</TabsContent>}
        {canManageCatalog && <TabsContent value="merch">{checkoutBody}</TabsContent>}
      </Tabs>

      <Sheet open={dailyReportOpen} onOpenChange={setDailyReportOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Daily sales report · {branchLabel}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3 text-sm">
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
              <p>Car wash · {formatMoney(categoryTotals.car_wash)}</p>
              <p>Ceramic coating · {formatMoney(categoryTotals.ceramic_coating)}</p>
              <p>Nano ceramic tint · {formatMoney(categoryTotals.nano_tint)}</p>
              <p>PPF · {formatMoney(categoryTotals.ppf)}</p>
              <p>Sellables · {formatMoney(categoryTotals.sellables)}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 font-semibold">Bacoor-style report</p>
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
            <Button type="button" className="min-h-11 w-full" asChild>
              <Link to="/operations/finance?tab=expenses" onClick={() => setDailyReportOpen(false)}>
                Open Finance · expenses
              </Link>
            </Button>
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
                      · {line.item_type}
                      {line.is_loyalty_award ? ' · loyalty' : ''}
                      {line.is_membership_included ? ' · member include' : ''}
                      {line.membership_discount_applied ? ' · member discount' : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="min-h-11 min-w-11"
                    onClick={() => setCart((c) => c.filter((x) => x.key !== line.key))}
                    aria-label="Remove"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
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
                      <Label htmlFor="pos-guest-name" className="text-xs text-muted-foreground">
                        Name <span className="font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="pos-guest-name"
                        className="min-h-11"
                        placeholder="Walk-in name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-guest-phone" className="text-xs text-muted-foreground">
                        Number <span className="font-normal">(optional)</span>
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
                  {PAYMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                    checked={compToggles[t.key]}
                    onChange={(e) => setCompToggles((prev) => ({ ...prev, [t.key]: e.target.checked }))}
                  />
                  {t.label}
                </label>
              ))}
            </div>
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
            <Button className="min-h-12 w-full text-base" disabled={!cart.length || !branch || saving} onClick={checkout}>
              {saving ? 'Processing…' : 'Complete payment'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}

function CatalogGrid({ items, onAdd, empty, birthdayPerk }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="min-h-[100px]">
          <Card className="h-full transition hover:border-primary/50 hover:bg-accent/30">
            <button type="button" onClick={() => onAdd(item)} className="w-full text-left">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                  <Badge variant="secondary">{item.item_type}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{formatMoney(item.price_minor)}</p>
                {item.meta && <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>}
              </CardContent>
            </button>
            <div className="flex flex-wrap gap-1 border-t border-border px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => onAdd(item, { loyaltyAward: true })}
              >
                <Gift className="size-3.5" aria-hidden />
                Loyalty / free
              </Button>
              {birthdayPerk ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-primary"
                  onClick={() => onAdd(item, { birthdayAward: true })}
                >
                  <Cake className="size-3.5" aria-hidden />
                  Birthday
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

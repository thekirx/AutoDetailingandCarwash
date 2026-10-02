import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Cake, CarFront, ClipboardList, Gift, Link2, Lock, MapPin, Minus, Plus, Search, Settings2, ShoppingBag, ShoppingCart, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos, canDiscountPosSale, canSeeAllBranches, canWriteFinance, canWritePosSettings, getBranchScopeList, isAdmin, isBranchAdmin } from '@/auth/permissions'
import { listBranches, getLoyaltyProgramSettings } from '@/lib/adminApi'
import { writeAudit } from '@/lib/audit'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { applyAdHocDiscount, buildPosSalePayload, buildVisitHandoffCartLines, canChangePosCartLineQuantity, canRedeemLoyaltyAward, canRemovePosCartLine, cashTenderCoversTotal, clearPosDraft, detachHandoffFromCart, isAllowedPosPaymentMethod, isValidPaymentRef, keepQueueHandoffWhenAdding, openHandoffInCart, posCartBlocksCheckout, priceCartForMembership, readPosDraft, stepPosCartLineQuantity, summarizePosCart, validatePosSaleCart, writePosDraft, POS_MAX_LINE_QUANTITY } from '@/lib/posSale'
import { PRICING_SIZES, resolveServicePriceMinor, formatSizePriceRange, availablePricingSizes, serviceHasSizePricing } from '@/lib/servicePricing'
import { filterPosBayCatalog, filterPosDetailingCatalog, serviceKindFromPayCategory } from '@/lib/serviceKinds'
import { supabase } from '@/lib/supabase'
import { filterBranchesForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { formatMoney, searchPosCustomer } from '@/queue/queueApi'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { PAYMENT_METHODS } from '@/lib/paymentMethods'
import { normalizePosSettings } from '@/lib/posSettings'
import { MERCH_FAMILIES, productIsPosSellable, productMatchesMerchFamily } from '@/lib/posSellables'
import { getAccessTokenFresh } from '@/lib/authToken'
import { announcePayment, announceTest, readAnnouncerOn, unlockAudio, useAnnouncerDevice, writeAnnouncerOn } from '@/lib/posAnnouncer'
import { parsePesosToMinor } from '@/lib/shiftClose'
import {
  DEFAULT_COMPENSATION_RULES,
  normalizeCompensationSettings,
  detailingAmountMinor,
  buildCeramicCompensationExpenses,
  computeCeramicPay,
  effectiveCeramicToggles,
} from '@/lib/compensation'
import {
  POS_SETTINGS_TAB,
  formatQueueTicket,
  resolvePosShellTab,
  summarizePendingHandoffs,
  summarizeTodayPos,
} from '@/lib/posInsights'
import { canEditDailySheet } from '@/lib/dailySheet'
import PosSettingsPanel from '@/pages/pos/PosSettingsPanel'
import DailySheetPanel from '@/pages/pos/DailySheetPanel'
import PosTodayPanel from '@/pages/pos/PosTodayPanel'
import { PosGuideCard, PosOpenTickets, PosStatsBoard } from '@/pages/pos/PosPanels'

/**
 * The order panel sits beside the catalogue from 1024px up. Below that the
 * cashier is on a phone, so it stays a sheet behind the Cart button.
 */
const POS_SPLIT_QUERY = '(min-width: 1024px)'

function usePosSplitView() {
  const [split, setSplit] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(POS_SPLIT_QUERY).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mql = window.matchMedia(POS_SPLIT_QUERY)
    const onChange = (e) => setSplit(e.matches)
    setSplit(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return split
}

export default function PosPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const branchAdmin = isBranchAdmin(profile)
  const showSettingsTab = canWritePosSettings(profile)
  const canSheet = canEditDailySheet(profile)
  const shellTab = resolvePosShellTab(searchParams.get('tab'), { canSettings: showSettingsTab, canSheet })
  const scopeList = getBranchScopeList(profile)
  const canPickPosBranch = canSeeAllBranches(profile) || (Array.isArray(scopeList) && scopeList.length > 1)
  const branchLocked = !canPickPosBranch
  const assignedBranch = pickDefaultBranchSlug(profile, [])
  const canProvisionCustomer = isAdmin(profile)
  const canDiscount = canDiscountPosSale(profile)

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
  const posSplitView = usePosSplitView()
  const [cashTendered, setCashTendered] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [loyaltyStamps, setLoyaltyStamps] = useState(0)
  const [loyaltyMilestones, setLoyaltyMilestones] = useState([])
  const [catalogReady, setCatalogReady] = useState(false)
  // State, not a ref: the save effect must wait until the restored draft has rendered.
  const [draftBranch, setDraftBranch] = useState('')
  const [saving, setSaving] = useState(false)
  const [compToggles, setCompToggles] = useState({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
  const [compRules, setCompRules] = useState(DEFAULT_COMPENSATION_RULES)
  const [paymentOptions, setPaymentOptions] = useState(() => PAYMENT_METHODS.map((m) => ({ ...m })))
  useEffect(() => {
    if (!paymentOptions.length) return
    if (!isAllowedPosPaymentMethod(paymentMethod, paymentOptions)) {
      setPaymentMethod(paymentOptions[0].value)
    }
  }, [paymentOptions, paymentMethod])
  const [todayStats, setTodayStats] = useState(null)
  const [handoffs, setHandoffs] = useState([])
  const [activeHandoff, setActiveHandoff] = useState(null)
  const [announcerOn, setAnnouncerOn] = useState(readAnnouncerOn)
  const announcerOnRef = useRef(announcerOn)
  announcerOnRef.current = announcerOn
  const seenHandoffsRef = useRef({ branch: null, ids: new Set() })
  useAnnouncerDevice(announcerOn)
  const [activeMembership, setActiveMembership] = useState(null)
  const [birthdayPerk, setBirthdayPerk] = useState(null)
  const [membershipsEnabled, setMembershipsEnabled] = useState(true)

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

  const todaySummary = useMemo(() => summarizeTodayPos({ todayStats, handoffs }), [todayStats, handoffs])

  const pendingSummary = useMemo(() => summarizePendingHandoffs(handoffs), [handoffs])

  // Another counter (or a stale draft) may have settled the open ticket — never charge it twice.
  useEffect(() => {
    if (!catalogReady || saving || !activeHandoff) return
    if (handoffs.some((row) => row.id === activeHandoff.id)) return
    setActiveHandoff(null)
    setCart((current) => detachHandoffFromCart(current))
    toast.message(`${formatQueueTicket(activeHandoff.bookings)} is already settled — it was taken off the order.`)
  }, [catalogReady, saving, handoffs, activeHandoff])

  const load = useCallback(async () => {
    if (!branch) return
    setCatalogReady(false)
    const today = getLocalCalendarDate()
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
        .select('id, booking_id, branch, status, amount_minor, created_at, bookings(id, customer_id, customer_name, vehicle_plate, vehicle_make, vehicle_model, service_id, final_price_minor, price_minor, vehicle_type, status, queue_number, visit_group_id)')
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
    if (svc.error) toast.error(svc.error.message)
    if (prod.error) toast.error(prod.error.message)
    if (stats.error) toast.error(stats.error.message)
    if (handoffRes.error) toast.error(handoffRes.error.message)
    if (compRes.error) toast.error(compRes.error.message)
    else setCompRules(normalizeCompensationSettings(compRes.data))
    if (!posSettingsRes.error && posSettingsRes.data) {
      const normalized = normalizePosSettings(posSettingsRes.data)
      setPaymentOptions(normalized.payment_methods)
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
    setHandoffs(handoffRes.data || [])
    if (!handoffRes.error) {
      const rows = handoffRes.data || []
      const seen = seenHandoffsRef.current
      // First load of a branch is the baseline — only tickets that show up afterwards are announced.
      const fresh = seen.branch === branch ? rows.filter((row) => !seen.ids.has(row.id)) : []
      seenHandoffsRef.current = { branch, ids: new Set(rows.map((row) => row.id)) }
      if (announcerOnRef.current) fresh.forEach(announcePayment)
    }

    setCatalogReady(true)
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
    const draft = branch ? readPosDraft(branch) : null
    setDraftBranch(branch)
    setActiveHandoff(draft?.cart?.length ? draft.activeHandoff || null : null)
    if (draft?.cart?.length) {
      // Locked ticket lines without their ticket would post unlinked — drop them.
      setCart(draft.activeHandoff ? draft.cart : detachHandoffFromCart(draft.cart))
      setCustomerId(draft.customerId || '')
      setLinkedCustomer(draft.linkedCustomer || null)
      if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod)
      setCashTendered(draft.cashTendered || '')
      setPaymentRef(draft.paymentRef || '')
      setDiscountPercent(draft.discountPercent || '')
      setDiscountAmountPesos(draft.discountAmountPesos || '')
      setDiscountReason(draft.discountReason || '')
    } else {
      setCart([])
    }
  }, [branch])

  useEffect(() => {
    if (!branch || draftBranch !== branch) return
    writePosDraft(branch, {
      cart,
      customerId,
      linkedCustomer,
      activeHandoff,
      paymentMethod,
      cashTendered,
      paymentRef,
      discountPercent,
      discountAmountPesos,
      discountReason,
    })
  }, [
    branch,
    draftBranch,
    cart,
    customerId,
    linkedCustomer,
    activeHandoff,
    paymentMethod,
    cashTendered,
    paymentRef,
    discountPercent,
    discountAmountPesos,
    discountReason,
  ])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(() => createCoalescedReload(() => loadRef.current(), 400), [])

  useEffect(() => {
    if (!branch) return
    load()
    const channel = supabase
      .channel(`pos-${branch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `branch=eq.${branch}` }, scheduleReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_handoffs', filter: `branch=eq.${branch}` }, scheduleReload)
      .subscribe()
    return () => {
      scheduleReload.cancel()
      supabase.removeChannel(channel)
    }
  }, [load, branch, scheduleReload])

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

  /**
   * One flat category rail replaces the bay/detailing/merch tabs plus the merch
   * family toolbar — services, detailing and each merch family are peers.
   */
  const catalogCategories = useMemo(() => {
    const merch = MERCH_FAMILIES.map((fam) => ({
      id: `merch:${fam.id}`,
      label: fam.label,
      tab: 'merch',
      family: fam.id,
      count: (products || []).filter((p) => productMatchesMerchFamily(p, fam.id)).length,
    }))
    if (branchAdmin) return merch
    return [
      { id: 'bay', label: 'Services & packages', tab: 'bay', family: 'all', count: bayItems.length },
      { id: 'detailing', label: 'Detailing', tab: 'detailing', family: 'all', count: detailingItems.length },
      ...merch,
    ]
  }, [branchAdmin, products, bayItems.length, detailingItems.length])

  const activeCategoryId = tab === 'merch' ? `merch:${merchFamilyFilter}` : tab
  const activeCategoryLabel =
    catalogCategories.find((c) => c.id === activeCategoryId)?.label || ''

  function selectCatalogCategory(id) {
    const next = catalogCategories.find((c) => c.id === id)
    if (!next) return
    setTab(next.tab)
    setMerchFamilyFilter(next.family)
  }

  const catalogItems = tab === 'detailing' ? detailingItems : tab === 'merch' ? merchItems : bayItems

  // Size choice lives on the page so the tile can badge the chosen price.
  const [sizeByKey, setSizeByKey] = useState({})
  function pickItemSize(itemKey, slug) {
    setSizeByKey((current) => ({ ...current, [itemKey]: slug }))
  }

  // Running quantity per catalog item, so a tile shows what is already in the order.
  const cartQuantityByItemKey = useMemo(() => {
    const out = {}
    for (const line of cart) {
      const base = String(line.catalog_item_key || line.key || '')
      if (!base) continue
      out[base] = (out[base] || 0) + Number(line.quantity || 0)
    }
    return out
  }, [cart])

  const cartCount = cart.reduce((sum, line) => sum + Number(line.quantity || 0), 0)

  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * line.unit_price_minor, 0)
  const cartSummary = useMemo(() => summarizePosCart(cart), [cart])
  const ticketBooking = activeHandoff?.bookings || null
  // A ticket's customer comes from the booking — keep the sale on that customer and plate.
  const customerLockedToTicket = Boolean(activeHandoff && ticketBooking?.customer_id)

  // Cash tendered → change due, and the quick-cash chips a cashier reaches for.
  const cashTenderedMinor = parsePesosToMinor(cashTendered)
  const changeMinor = (Number.isFinite(cashTenderedMinor) ? cashTenderedMinor : 0) - cartTotal
  const quickCashAmounts = useMemo(() => {
    if (cartTotal <= 0) return []
    const notes = [20000, 50000, 100000, 200000, 500000, 1000000]
    return [cartTotal, ...notes.filter((n) => n > cartTotal)].slice(0, 4)
  }, [cartTotal])

  const chargeBlocked = posCartBlocksCheckout(cart)
  const cashCovered = cashTenderCoversTotal(paymentMethod, cashTenderedMinor, cartTotal)
  const refReady = isValidPaymentRef(paymentMethod, paymentRef)
  const chargeDisabled = !cart.length || !branch || saving || chargeBlocked || !cashCovered || !refReady
  const chargeHint = !cart.length
    ? 'Add an item to charge'
    : chargeBlocked
      ? 'This queue ticket has no linked service'
      : !cashCovered
        ? 'Enter cash received that covers the total'
        : !refReady
          ? 'Enter the GCash / card reference'
          : ''
  const chargeLabel = saving
    ? 'Processing…'
    : chargeBlocked
      ? 'Ticket missing service'
      : cart.length
        ? `Charge ${formatMoney(cartTotal)}`
        : 'Charge'
  const loyaltyReady = canRedeemLoyaltyAward({
    customerId,
    stamps: loyaltyStamps,
    milestones: loyaltyMilestones,
    cart,
  })

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
        enabled && tier && tier.is_active !== false && !expired && !memRes.error
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

  async function refreshLoyaltyReady(customerIdValue) {
    if (!customerIdValue) {
      setLoyaltyStamps(0)
      setLoyaltyMilestones([])
      return
    }
    const [cust, miles] = await Promise.all([
      supabase.from('customers').select('loyalty_stamps').eq('id', customerIdValue).maybeSingle(),
      supabase.from('loyalty_milestones').select('threshold_points, is_active, reward_label'),
    ])
    setLoyaltyStamps(Number(cust.data?.loyalty_stamps) || 0)
    setLoyaltyMilestones(miles.data || [])
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
    setLoyaltyStamps(0)
    setLoyaltyMilestones([])
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
    if (!canDiscount) return
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
    if (loyaltyAward && !canRedeemLoyaltyAward({
      customerId,
      stamps: loyaltyStamps,
      milestones: loyaltyMilestones,
      cart,
    })) {
      toast.error('Link a customer with a redeemable loyalty reward first.')
      return
    }
    if (birthdayAward && !birthdayPerk) {
      toast.error('No birthday perk available for this customer.')
      return
    }
    if (activeHandoff && !keepQueueHandoffWhenAdding(item)) {
      toast.message(`${formatQueueTicket(ticketBooking)} set aside — this is now a walk-in order.`)
      detachHandoff()
    }
    const listPrice = item.price_minor
    const free = loyaltyAward || birthdayAward
    const priced = priceCartForMembership(
      [
        {
          ...item,
          key: birthdayAward ? `${item.key}-birthday` : loyaltyAward ? `${item.key}-loyalty` : item.key,
          // Base catalog key (before size / award suffixes) so the tile can badge its running count.
          catalog_item_key: item.catalog_item_key || item.key,
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
  }

  /** Take the ticket off the order; merch rung up so far stays as a walk-in sale. */
  function detachHandoff() {
    setActiveHandoff(null)
    setCart((current) => detachHandoffFromCart(current))
    clearCustomerLink()
  }

  /** Clear the walk-in lines; a queue handoff keeps its locked line. */
  function clearCart() {
    if (!cart.length) return
    if (!window.confirm(activeHandoff ? 'Remove the add-ons from this ticket?' : 'Clear the current order?')) return
    setCart((current) => current.filter((line) => !canRemovePosCartLine(line)))
    setDiscountPercent('')
    setDiscountAmountPesos('')
    setDiscountReason('')
    setCashTendered('')
  }

  function toggleAnnouncer() {
    const next = !announcerOn
    writeAnnouncerOn(next)
    setAnnouncerOn(next)
    if (next) {
      unlockAudio()
      announceTest()
      toast.success('Voice on for this device — cars ready for payment will be announced.')
    } else {
      toast.message('Voice off for this device.')
    }
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
    setCart((current) => openHandoffInCart(current, lines))
    if (lines.some((line) => line.missing_service)) {
      toast.message('Queue ticket has no linked service — checkout will record the amount without loyalty stamps.')
    }
    setCartOpen(true)
    if (cid) {
      refreshMembershipForCustomer(cid)
      refreshBirthdayPerk(cid)
      refreshLoyaltyReady(cid)
    } else {
      setActiveMembership(null)
      setBirthdayPerk(null)
      setLoyaltyStamps(0)
      setLoyaltyMilestones([])
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
    refreshLoyaltyReady(hit.id)
  }

  async function checkout() {
    if (!cart.length || !branch) return
    if (!cashCovered) {
      toast.error('Enter cash received that covers the order total.')
      return
    }
    if (posCartBlocksCheckout(cart)) {
      toast.error('This queue ticket has no linked service. Ask a Team Lead to set the service on the booking, then send it to payment again.')
      return
    }
    if (!isAllowedPosPaymentMethod(paymentMethod, paymentOptions)) {
      toast.error('Choose a payment method from the list.')
      return
    }
    const gate = validatePosSaleCart(cart, {
      customerId,
      birthdayPerk,
      stamps: loyaltyStamps,
      milestones: loyaltyMilestones,
      paymentMethod,
      paymentRef,
      catalog: { services, products },
      isHandoff: Boolean(activeHandoff),
    })
    if (!gate.ok) {
      toast.error(gate.error)
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
        paymentRef,
        discountReason: cart.some((l) => l.adhoc_discount_applied) ? discountReason : '',
        discountMinor: cart.reduce((sum, line) => {
          const list = Math.max(Math.floor(Number(line.list_price_minor ?? line.unit_price_minor) || 0), 0)
          const unit = Math.max(Math.floor(Number(line.unit_price_minor) || 0), 0)
          return sum + Math.max(0, list - unit) * Math.max(1, Number(line.quantity) || 1)
        }, 0),
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
    setPaymentRef('')
    clearPosDraft()
    resetCheckoutExtras()
    setCompToggles({ freeShirt: false, cardPayment: false, crewAssisted: true, detailerAssigned: false })
    setCartOpen(false)
    load()
  }

  if (!canAccessPos(profile)) return <Navigate to="/operations/access-denied" replace />


  function setShellTab(next) {
    setSearchParams(next === 'checkout' ? {} : { tab: next }, { replace: true })
  }

  /**
   * The order panel — lines, totals, tender and Charge. Rendered twice: pinned
   * beside the catalogue on large screens, and inside the sheet on phones.
   */
  /** One receipt row: ticket lines are locked; add-ons get a stepper. */
  function renderOrderLine(line) {
    const free = line.is_loyalty_award || line.is_membership_included
    const canStep = canChangePosCartLineQuantity(line)
    const tags = [
      line.from_handoff ? null : line.catalog_kind || line.item_type,
      line.is_loyalty_award && !line.is_birthday_award ? 'loyalty' : null,
      line.is_birthday_award ? 'birthday' : null,
      line.is_membership_included ? 'member include' : null,
      line.membership_discount_applied ? 'member discount' : null,
      line.adhoc_discount_applied ? 'discount' : null,
    ].filter(Boolean)
    return (
      <li key={line.key} className="py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 flex-1 text-sm leading-snug font-medium">{line.name}</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums">
            {free ? <span className="text-emerald-700 dark:text-emerald-400">FREE</span> : formatMoney(line.quantity * line.unit_price_minor)}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-muted-foreground">
          {free ? 'Included' : `${formatMoney(line.unit_price_minor)} ea`}
          {tags.length ? ` · ${tags.join(' · ')}` : ''}
        </p>
        {canStep ? (
          <div className="flex shrink-0 items-center rounded-full border border-border">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              onClick={() => setCart((c) => stepPosCartLineQuantity(c, line.key, -1))}
              aria-label={line.quantity > 1 ? `One fewer ${line.name}` : `Remove ${line.name}`}
            >
              {line.quantity > 1 ? <Minus /> : <Trash2 />}
            </Button>
            <span className="min-w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {line.quantity}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              disabled={line.quantity >= POS_MAX_LINE_QUANTITY}
              onClick={() => setCart((c) => stepPosCartLineQuantity(c, line.key, 1))}
              aria-label={`One more ${line.name}`}
            >
              <Plus />
            </Button>
          </div>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground tabular-nums">
            <Lock className="size-3.5" aria-hidden />
            {line.quantity}×<span className="sr-only"> locked</span>
          </span>
        )}
        </div>
      </li>
    )
  }

  const ticketLines = cart.filter((line) => line.from_handoff)
  const addOnLines = cart.filter((line) => !line.from_handoff)
  const customerPerks =
    birthdayPerk || activeMembership ? (
      <>
        {birthdayPerk ? <p className="mt-1 text-xs font-medium text-primary">Birthday free service available</p> : null}
        {activeMembership ? (
          <p className="mt-1 text-xs font-medium text-primary">
            {activeMembership.name}
            {activeMembership.discount_percent > 0 ? ` · ${activeMembership.discount_percent}% off services` : ''}
            {(activeMembership.included_services || []).length
              ? ` · ${(activeMembership.included_services || []).length} included`
              : ''}
          </p>
        ) : null}
      </>
    ) : null
  const savingsNote = [
    cartSummary.discountMinor ? `${formatMoney(cartSummary.discountMinor)} discount` : null,
    cartSummary.memberMinor ? `${formatMoney(cartSummary.memberMinor)} member savings` : null,
  ].filter(Boolean)

  const orderPanelBody = (
    <>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {activeHandoff ? (
            <section aria-label="Queue ticket" className="shrink-0 overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-start gap-3 border-b border-border bg-muted/40 px-3 py-2.5">
                <CarFront className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
                    <span className="font-mono tabular-nums">{formatQueueTicket(ticketBooking)}</span>
                    <span className="font-mono tracking-wide uppercase">{ticketBooking?.vehicle_plate || 'No plate'}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ticketBooking?.customer_name || 'Customer'} · payment links to this booking
                  </p>
                  {customerLockedToTicket ? customerPerks : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 shrink-0 px-2 text-xs"
                  onClick={detachHandoff}
                  aria-label={`Set aside ${formatQueueTicket(ticketBooking)} — it stays waiting to pay`}
                >
                  Set aside
                </Button>
              </div>
              <ul className="divide-y divide-border px-3">{ticketLines.map(renderOrderLine)}</ul>
              <p className="flex items-center gap-1.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                <Lock className="size-3 shrink-0" aria-hidden />
                Set by the Team Lead. Ask them to change the job or price.
              </p>
            </section>
          ) : null}

          <section aria-label={activeHandoff ? 'Add-ons' : 'Items'} className="flex flex-col">
            <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {activeHandoff ? 'Add-ons on this ticket' : 'Items'}
            </p>
            {addOnLines.length ? (
              <ul className="divide-y divide-border">{addOnLines.map(renderOrderLine)}</ul>
            ) : (
              <div className="mt-2 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                <p className="max-w-[28ch]">
                  {activeHandoff
                    ? 'Selling merch or coffee too? Tap it in the catalogue and it joins this ticket.'
                    : 'Nothing rung up yet. Tap an item, or open a car that is waiting to pay.'}
                </p>
                {!posSplitView ? (
                  <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setCartOpen(false)}>
                    <ShoppingBag data-icon="inline-start" aria-hidden />
                    Browse catalogue
                  </Button>
                ) : null}
              </div>
            )}
          </section>

          {canDiscount ? (
          <details className="rounded-xl border border-border bg-muted/20 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-foreground">
              Discount
              <span className="text-xs font-normal text-muted-foreground tabular-nums">
                {cartSummary.discountMinor ? `−${formatMoney(cartSummary.discountMinor)}` : 'None'}
              </span>
            </summary>
            <div className="px-3 pt-1 pb-3">
            <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">Ad-hoc discount</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pos-discount-pct" className="text-xs text-muted-foreground">Percent off</Label>
                  <Input
                    id="pos-discount-pct"
                    className="min-h-10"
                    placeholder="0"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pos-discount-peso" className="text-xs text-muted-foreground">₱ amount</Label>
                  <Input
                    id="pos-discount-peso"
                    className="min-h-10"
                    placeholder="0.00"
                    inputMode="decimal"
                    value={discountAmountPesos}
                    onChange={(e) => setDiscountAmountPesos(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pos-discount-reason" className="text-xs text-muted-foreground">Reason</Label>
                <Input
                  id="pos-discount-reason"
                  className="min-h-10"
                  placeholder="Required · 3+ characters"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" className="min-h-10 w-full" onClick={applyCartDiscount}>
                Apply discount
              </Button>
            </div>
            </div>
          </details>
          ) : null}

          {customerLockedToTicket ? null : (
          <details className="rounded-xl border border-border bg-muted/20 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold text-foreground">
              Customer
              <span className="inline-flex min-w-0 items-center gap-1 text-xs font-normal text-muted-foreground">
                {linkedCustomer ? <Link2 className="size-3 shrink-0" aria-hidden /> : null}
                <span className="truncate">{linkedCustomer ? linkedCustomer.full_name : 'Walk-in · optional'}</span>
              </span>
            </summary>
            <div className="space-y-3 px-3 pt-1 pb-3">
              {linkedCustomer ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{linkedCustomer.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[linkedCustomer.phone, linkedCustomer.plate].filter(Boolean).join(' · ') || 'Account linked'}
                    </p>
                    {customerPerks}
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
          </details>
          )}

          {cart.length ? (
            <dl className="space-y-1.5 rounded-xl bg-muted/40 px-4 py-3 text-sm">
              {cartSummary.ticketCount ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">Queue ticket</dt>
                  <dd className="font-medium tabular-nums">{formatMoney(cartSummary.ticketMinor)}</dd>
                </div>
              ) : null}
              {cartSummary.addOnCount ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground">
                    {activeHandoff ? 'Add-ons' : 'Items'} · {cartSummary.addOnCount}
                  </dt>
                  <dd className="font-medium tabular-nums">{formatMoney(cartSummary.addOnMinor)}</dd>
                </div>
              ) : null}
              {savingsNote.length ? (
                <div className="pt-0.5">
                  <dt className="sr-only">Savings</dt>
                  <dd className="text-xs text-emerald-700 dark:text-emerald-400">Includes {savingsNote.join(' and ')}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="space-y-2">
            <Label className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Tender
            </Label>
            <div
              role="group"
              aria-label="Payment method"
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, paymentOptions.length))}, minmax(0, 1fr))` }}
            >
              {paymentOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={paymentMethod === opt.value ? 'default' : 'outline'}
                  aria-pressed={paymentMethod === opt.value}
                  className="min-h-12"
                  onClick={() => setPaymentMethod(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {paymentMethod === 'cash' ? (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <div className="flex flex-wrap gap-2">
                  {quickCashAmounts.map((amount) => (
                    <Button
                      key={amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-10"
                      onClick={() => setCashTendered(String(amount / 100))}
                    >
                      {amount === cartTotal ? 'Exact' : formatMoney(amount)}
                    </Button>
                  ))}
                </div>
                <Label htmlFor="pos-cash-received" className="text-xs text-muted-foreground">Cash received</Label>
                <Input
                  id="pos-cash-received"
                  className="min-h-11"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                />
                {cashTendered.trim() && cartTotal > 0 ? (
                  <p className="flex items-center justify-between text-sm font-semibold">
                    <span>{changeMinor >= 0 ? 'Change' : 'Still due'}</span>
                    <span
                      className={
                        changeMinor >= 0
                          ? 'tabular-nums text-emerald-600'
                          : 'tabular-nums text-rose-600'
                      }
                    >
                      {formatMoney(Math.abs(changeMinor))}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="pos-payment-ref" className="text-xs text-muted-foreground">
                  {paymentOptions.find((o) => o.value === paymentMethod)?.label || 'Payment'} reference
                </Label>
                <Input
                  id="pos-payment-ref"
                  className="min-h-11"
                  placeholder="Wallet / card reference"
                  autoComplete="off"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                />
              </div>
            )}
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
              <p className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground uppercase">Total</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">{formatMoney(cartTotal)}</p>
            </div>
            <p className="flex min-w-0 items-center gap-1.5 pb-1 text-xs text-muted-foreground">
              {activeHandoff || linkedCustomer ? <Link2 className="size-3.5 shrink-0" aria-hidden /> : null}
              <span className="truncate">
                {activeHandoff
                  ? `${formatQueueTicket(ticketBooking)} · ${ticketBooking?.vehicle_plate || 'No plate'}`
                  : linkedCustomer
                    ? linkedCustomer.full_name
                    : 'Walk-in'}
              </span>
            </p>
          </div>
          {chargeDisabled && chargeHint ? (
            <p className="text-xs text-muted-foreground">{chargeHint}</p>
          ) : null}
          <Button className="min-h-12 w-full text-base" disabled={chargeDisabled} onClick={checkout}>
            {chargeLabel}
          </Button>
        </div>
    </>
  )

  const checkoutBody = (
    <div className="flex flex-col gap-6">
      <PosStatsBoard stats={todaySummary} compact />

      <div className="pos-counter grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <PosOpenTickets
            tickets={handoffs}
            activeId={activeHandoff?.id || null}
            totalMinor={pendingSummary.totalMinor}
            onOpen={loadHandoff}
            onReplay={announcePayment}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-[12rem] flex-1">
              <Label htmlFor="pos-catalog-search" className="sr-only">Search catalogue</Label>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pos-catalog-search"
                type="search"
                className="min-h-11 pl-9"
                placeholder="Search the whole catalogue"
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

          <PosCategoryRail
            categories={catalogCategories}
            active={activeCategoryId}
            onSelect={selectCatalogCategory}
          />

          <PosTileGrid
            items={catalogItems}
            onAdd={addToCart}
            sizeByKey={sizeByKey}
            onPickSize={pickItemSize}
            quantityByKey={cartQuantityByItemKey}
            birthdayPerk={birthdayPerk}
            loyaltyReady={loyaltyReady}
            empty={
              !catalogReady
                ? 'Loading catalogue…'
                : query.trim()
                  ? `Nothing in the catalogue matches “${query.trim()}”.`
                  : activeCategoryLabel
                    ? `No items under ${activeCategoryLabel} yet.`
                    : 'No items to sell yet.'
            }
          />
        </div>

        {/*
          The order stays on screen from 1024px up; phones keep the sheet. Only one
          copy is ever mounted — the panel carries form ids that must stay unique.
        */}
        {posSplitView ? (
        <aside
          className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card"
          aria-label="Current order"
        >
          <div className="pos-order-head flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.18em] text-white/55 uppercase">
                {activeHandoff ? `Ticket ${formatQueueTicket(ticketBooking)}` : 'Walk-in order'}
              </p>
              <p className="truncate text-sm font-semibold text-white">
                {cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'} · ${formatMoney(cartTotal)}` : 'Nothing rung up yet'}
              </p>
            </div>
            {addOnLines.length ? (
              <Button type="button" variant="ghost" size="sm" className="min-h-9 text-white/85 hover:bg-white/10 hover:text-white" onClick={clearCart}>
                Clear
              </Button>
            ) : null}
          </div>
          {orderPanelBody}
        </aside>
        ) : null}
      </div>
    </div>
  )

  const settingsBody = showSettingsTab ? <PosSettingsPanel embedded /> : null

  return (
    <OpsPageShell
      className="hakum-pos"
      eyebrow={branchAdmin ? 'Counter' : 'Point of sale'}
      title="POS"
      description={
        branchAdmin
          ? `Merch, coffee and cars waiting to pay — one counter · ${branchLabel}`
          : `Sell, cars waiting to pay, daily sheet · ${branchLabel}`
      }
      meta={
        <>
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <span>{branchLabel}</span>
        </>
      }
      actions={
        <>
          <Button
            type="button"
            variant={announcerOn ? 'default' : 'outline'}
            aria-pressed={announcerOn}
            title="Say each car out loud on this device when it is ready for payment"
            className="min-h-11 gap-2"
            onClick={toggleAnnouncer}
          >
            {announcerOn ? <Volume2 data-icon="inline-start" aria-hidden /> : <VolumeX data-icon="inline-start" aria-hidden />}
            {announcerOn ? 'Voice on' : 'Voice off'}
          </Button>
          {shellTab === 'checkout' && !posSplitView ? (
            <Button onClick={() => setCartOpen(true)} className="min-h-11 gap-2">
              <ShoppingCart data-icon="inline-start" />
              Cart · {cartCount} · {formatMoney(cartTotal)}
            </Button>
          ) : null}
        </>
      }
    >
      <PosGuideCard defaultOpen={false} />

      <Tabs value={shellTab} onValueChange={setShellTab} className="flex w-full flex-col gap-5">
        <OpsTabList
          aria-label="POS sections"
          tabs={[
            { id: 'checkout', label: 'Sell', icon: ShoppingBag, badge: handoffs.length || undefined },
            ...(canSheet ? [{ id: 'sheet', label: 'Daily sheet', icon: ClipboardList }] : []),
            { id: 'dashboard', label: 'Today' },
            ...(showSettingsTab ? [{ id: POS_SETTINGS_TAB, label: 'Settings', icon: Settings2 }] : []),
          ]}
        />
        <TabsContent value="checkout" className="mt-0 outline-none">
          {checkoutBody}
        </TabsContent>
        {canSheet ? (
          <TabsContent value="sheet" className="mt-0 outline-none">
            {shellTab === 'sheet' && branch ? <DailySheetPanel branch={branch} branchLabel={branchLabel} profile={profile} initialDate={searchParams.get('date')} /> : null}
          </TabsContent>
        ) : null}
        <TabsContent value="dashboard" className="mt-0 outline-none">
          {shellTab === 'dashboard' && branch ? (
            <PosTodayPanel
              branch={branch}
              branchLabel={branchLabel}
              waitingCount={pendingSummary.count}
              waitingMinor={pendingSummary.totalMinor}
              refreshKey={todayStats?.paid_count}
              onOpenSheet={canSheet ? () => setShellTab('sheet') : undefined}
            />
          ) : null}
        </TabsContent>
        {showSettingsTab ? (
          <TabsContent value={POS_SETTINGS_TAB} className="mt-0 outline-none">
            {settingsBody}
          </TabsContent>
        ) : null}
      </Tabs>

      <Sheet open={cartOpen && !posSplitView} onOpenChange={setCartOpen}>
        <SheetContent className="pos-checkout-sheet flex w-full flex-col gap-0 border-l-0 p-0 data-[side=right]:w-full sm:max-w-md">
          <div className="pos-checkout-head px-5 pt-5 pb-4">
            <SheetHeader className="gap-1 pr-8 text-left">
              <p className="text-[10px] font-bold tracking-[0.2em] text-white/55 uppercase">Hakum POS · {branchLabel}</p>
              <SheetTitle className="text-xl text-white">
                {activeHandoff ? `Ticket ${formatQueueTicket(ticketBooking)}` : 'Walk-in order'}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/70">
              <span>{cartCount ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Nothing rung up yet'}</span>
              {addOnLines.length ? (
                <button
                  type="button"
                  onClick={clearCart}
                  className="min-h-9 rounded-lg px-2 font-semibold text-white/85 underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {orderPanelBody}
        </SheetContent>
      </Sheet>
    </OpsPageShell>
  )
}

/** One flat category rail — services, detailing and each merch family as peers. */
function PosCategoryRail({ categories, active, onSelect }) {
  if (!categories?.length) return null
  const visible = categories.filter((cat) => cat.count > 0 || cat.id === active)
  if (!visible.length) return null
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Catalogue category">
      {visible.map((cat) => (
        <Button
          key={cat.id}
          type="button"
          variant={active === cat.id ? 'default' : 'outline'}
          aria-pressed={active === cat.id}
          className="min-h-11 shrink-0 rounded-full"
          onClick={() => onSelect(cat.id)}
        >
          {cat.label}
          <span className="ml-1.5 tabular-nums opacity-70">{cat.count}</span>
        </Button>
      ))}
    </div>
  )
}

/**
 * Dense tap-to-add tiles. Size picks sit on the tile itself rather than behind a
 * dropdown, and the running quantity is badged so the cashier sees the order
 * without looking away from the catalogue.
 */
function PosTileGrid({ items, onAdd, empty, birthdayPerk, loyaltyReady, sizeByKey, onPickSize, quantityByKey }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>

  function selectedSize(item) {
    const options = item.size_options || []
    if (!options.length) return ''
    return sizeByKey[item.key] || options.find((o) => o.slug === 'medium')?.slug || options[0].slug
  }

  function priceFor(item) {
    const slug = selectedSize(item)
    if (slug && item.size_prices?.[slug] != null) return Number(item.size_prices[slug])
    return item.price_minor
  }

  /** Catalog tile → the priced line addToCart expects. */
  function pricedItem(item) {
    const slug = selectedSize(item)
    if (!slug) return { ...item, catalog_item_key: item.key }
    const label = PRICING_SIZES.find((x) => x.slug === slug)?.label || slug
    return {
      ...item,
      key: `${item.key}-${slug}`,
      catalog_item_key: item.key,
      price_minor: priceFor(item),
      meta: [item.meta, `Size ${label}`].filter(Boolean).join(' · '),
      vehicle_size: slug,
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const options = item.size_options || []
        const slug = selectedSize(item)
        const qty = quantityByKey[item.key] || 0
        return (
          <div
            key={item.key}
            className={`relative flex min-h-[6.5rem] flex-col rounded-xl border transition ${
              qty > 0 ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {qty > 0 ? (
              <span
                className="absolute top-1.5 right-1.5 z-10 inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold tabular-nums text-primary-foreground"
                aria-label={`${qty} in the order`}
              >
                {qty}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onAdd(pricedItem(item))}
              className="flex flex-1 flex-col gap-1 p-3 text-left"
              aria-label={`Add ${item.name}`}
            >
              <span className="pr-6 text-sm leading-tight font-semibold">{item.name}</span>
              {slug ? (
                <span className="text-[11px] text-muted-foreground">
                  Size {PRICING_SIZES.find((x) => x.slug === slug)?.label || slug}
                </span>
              ) : item.meta ? (
                <span className="line-clamp-1 text-[11px] text-muted-foreground">{item.meta}</span>
              ) : null}
              <span className="mt-auto pt-1 text-base font-semibold tabular-nums">
                {formatMoney(priceFor(item))}
              </span>
            </button>
            {options.length > 0 ? (
              <div className="flex gap-1 border-t border-border p-1.5" role="group" aria-label={`${item.name} size`}>
                {options.map((sz) => (
                  <Button
                    key={sz.slug}
                    type="button"
                    size="sm"
                    variant={slug === sz.slug ? 'secondary' : 'ghost'}
                    aria-pressed={slug === sz.slug}
                    className="min-h-9 flex-1 px-1 text-[11px] font-bold"
                    onClick={() => onPickSize(item.key, sz.slug)}
                  >
                    {sz.label}
                  </Button>
                ))}
              </div>
            ) : null}
            {loyaltyReady || birthdayPerk ? (
            <div className="flex gap-1 border-t border-border px-1.5 py-1">
              {loyaltyReady ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="min-h-9 flex-1 gap-1 px-1 text-[11px] text-muted-foreground"
                onClick={() => onAdd(pricedItem(item), { loyaltyAward: true })}
              >
                <Gift className="size-3.5" aria-hidden />
                Loyalty
              </Button>
              ) : null}
              {birthdayPerk ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-9 flex-1 gap-1 px-1 text-[11px] text-primary"
                  onClick={() => onAdd(pricedItem(item), { birthdayAward: true })}
                >
                  <Cake className="size-3.5" aria-hidden />
                  Birthday
                </Button>
              ) : null}
            </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

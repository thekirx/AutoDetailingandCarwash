import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Link2, MapPin, Search, ShoppingCart, Trash2, UserRound, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos, canManageServices, isSuperAdmin } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { buildPosSalePayload } from '@/lib/posSale'
import { supabase } from '@/lib/supabase'
import { getBranchScope } from '@/queue/queueLogic'
import { formatMoney, searchPosCustomer } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'online', label: 'Online transfer' },
]

export default function PosPage() {
  const { profile } = useAuth()
  const branchLocked = !isSuperAdmin(profile)
  const assignedBranch = getBranchScope(profile) || profile?.branch_slug || ''

  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('services')
  const [cart, setCart] = useState([])
  const [branch, setBranch] = useState(assignedBranch)
  const [branches, setBranches] = useState([])
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
  const [todayStats, setTodayStats] = useState(null)
  const [handoffs, setHandoffs] = useState([])
  const [activeHandoff, setActiveHandoff] = useState(null)

  const branchLabel = useMemo(
    () => branches.find((b) => b.slug === branch)?.name || branch || '—',
    [branches, branch],
  )

  const load = useCallback(async () => {
    if (!branch) return
    const today = new Date().toISOString().slice(0, 10)
    const [svc, prod, stats, handoffRes] = await Promise.all([
      supabase.from('services').select('id, name, price_minor').eq('is_active', true).eq('is_archived', false),
      supabase.from('products').select('id, name, price_minor, category, stock_qty, sku').eq('is_active', true).eq('is_archived', false),
      supabase.from('daily_sales_summary').select('*').eq('sale_date', today).eq('branch', branch).maybeSingle(),
      supabase
        .from('pos_handoffs')
        .select('id, booking_id, branch, status, amount_minor, created_at, bookings(id, customer_id, customer_name, vehicle_plate, service_id, final_price_minor, status, queue_number)')
        .eq('status', 'pending')
        .eq('branch', branch)
        .order('created_at', { ascending: true }),
    ])
    if (svc.error) toast.error(svc.error.message)
    if (prod.error) toast.error(prod.error.message)
    if (handoffRes.error) toast.error(handoffRes.error.message)
    setServices(svc.data || [])
    setProducts(prod.data || [])
    setTodayStats(stats.data)
    setHandoffs(handoffRes.data || [])
  }, [branch])

  useEffect(() => {
    listBranches()
      .then((rows) => {
        setBranches(rows)
        setBranch((current) => {
          if (branchLocked && assignedBranch) return assignedBranch
          return current || assignedBranch || rows[0]?.slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [assignedBranch, branchLocked])

  useEffect(() => {
    if (branchLocked && assignedBranch && branch !== assignedBranch) {
      setBranch(assignedBranch)
    }
  }, [assignedBranch, branchLocked, branch])

  useEffect(() => {
    if (!branch) return
    load()
    const channel = supabase
      .channel('pos-sales')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_handoffs' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, branch])

  const serviceItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (services || [])
      .map((s) => ({
        key: `service-${s.id}`,
        item_type: 'service',
        id: s.id,
        name: s.name,
        price_minor: s.price_minor,
        meta: null,
      }))
      .filter((item) => !q || item.name.toLowerCase().includes(q))
  }, [services, query])

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

  function clearCustomerLink() {
    setCustomerId('')
    setLinkedCustomer(null)
    setCustomerHits([])
    setCustomerSearch('')
  }

  function resetCheckoutExtras() {
    clearCustomerLink()
    setGuestName('')
    setGuestPhone('')
    setPaymentMethod('cash')
  }

  function addToCart(item) {
    setActiveHandoff(null)
    setCart((current) => {
      const existing = current.find((line) => line.key === item.key)
      if (existing) {
        return current.map((line) => (line.key === item.key ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [...current, { ...item, quantity: 1, unit_price_minor: item.price_minor }]
    })
    setCartOpen(true)
  }

  function loadHandoff(row) {
    const booking = row.bookings || {}
    const serviceId = booking.service_id
    const svc = services.find((s) => s.id === serviceId)
    const amount = row.amount_minor ?? booking.final_price_minor ?? svc?.price_minor ?? 0
    const name = svc?.name || `Queue · ${booking.vehicle_plate || 'ticket'}`
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
    setCart([
      {
        key: `handoff-${row.id}`,
        item_type: 'service',
        id: serviceId || row.id,
        name,
        quantity: 1,
        unit_price_minor: amount,
        price_minor: amount,
      },
    ])
    setCartOpen(true)
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
  }

  async function checkout() {
    if (!cart.length || !branch) return
    setSaving(true)
    const handoff = activeHandoff
    const noteParts = []
    if (!customerId && (guestName.trim() || guestPhone.trim())) {
      noteParts.push(`Walk-in: ${[guestName.trim(), guestPhone.trim()].filter(Boolean).join(' · ')}`)
    }
    if (linkedCustomer?.plate) noteParts.push(`Plate ${linkedCustomer.plate}`)
    const { data, error } = await supabase.rpc('complete_pos_sale', {
      payload: buildPosSalePayload({
        branch,
        customerId,
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
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (token) {
          await fetch('/api/notify-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ booking_id: handoff.booking_id, status: 'completed' }),
          })
        }
      } catch {
        /* ignore */
      }
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
    setCartOpen(false)
    load()
  }

  if (!canAccessPos(profile)) return <Navigate to="/operations/access-denied" replace />

  const catalog = tab === 'services' ? serviceItems : merchItems

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Point of sale</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fast checkout</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Walk-ins and queue tickets for <strong className="text-foreground">{branchLabel}</strong>
              {branchLocked ? ' · your assigned branch' : ' · Super Admin can switch'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageServices(profile) && (
            <Link to="/operations/products" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
              Manage merch
            </Link>
          )}
          <Button onClick={() => setCartOpen(true)} className="min-h-11 gap-2">
            <ShoppingCart data-icon="inline-start" />
            Cart · {cart.length} · {formatMoney(cartTotal)}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={formatMoney(todayStats?.total_sales_minor || 0)} />
        <Stat label="Paid" value={todayStats?.paid_count ?? 0} />
        <Stat label="Queue to pay" value={handoffs.length} />
        <Stat label="Avg ticket" value={formatMoney(todayStats?.average_ticket_minor || 0)} />
      </div>

      {handoffs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Waiting for payment</CardTitle>
            <p className="text-sm text-muted-foreground">Tickets from the floor — open one to close the visit.</p>
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

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="min-h-11 pl-9"
            placeholder={tab === 'services' ? 'Search services' : 'Search merch / items'}
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
          <CatalogGrid items={catalog} onAdd={addToCart} empty="No services match." />
        </TabsContent>
        <TabsContent value="merch" className="mt-4">
          <CatalogGrid items={catalog} onAdd={addToCart} empty="No merch items. Add stock under Manage merch." />
        </TabsContent>
      </Tabs>

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
                      {line.quantity} × {formatMoney(line.unit_price_minor)} · {line.item_type}
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
                    Walk-in stays unlinked unless you Search and attach a customer — loyalty stamps need a linked account.
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

function CatalogGrid({ items, onAdd, empty }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((item) => (
        <button key={item.key} type="button" onClick={() => onAdd(item)} className="min-h-[100px] text-left">
          <Card className="h-full transition hover:border-primary/50 hover:bg-accent/30">
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
          </Card>
        </button>
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

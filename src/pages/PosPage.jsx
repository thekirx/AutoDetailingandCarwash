import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos, canManageServices } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { buildPosSalePayload } from '@/lib/posSale'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export default function PosPage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('services')
  const [cart, setCart] = useState([])
  const [branch, setBranch] = useState(profile?.branch_slug || '')
  const [branches, setBranches] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [todayStats, setTodayStats] = useState(null)
  const [handoffs, setHandoffs] = useState([])
  const [activeHandoff, setActiveHandoff] = useState(null)

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [svc, prod, cust, stats, handoffRes] = await Promise.all([
      supabase.from('services').select('id, name, price_minor').eq('is_active', true).eq('is_archived', false),
      supabase.from('products').select('id, name, price_minor, category, stock_qty, sku').eq('is_active', true).eq('is_archived', false),
      supabase.from('customers').select('id, full_name, phone').eq('is_archived', false).eq('role', 'customer').limit(100),
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
    setCustomers(cust.data || [])
    setTodayStats(stats.data)
    setHandoffs(handoffRes.data || [])
  }, [branch])

  useEffect(() => {
    listBranches()
      .then((rows) => {
        setBranches(rows)
        setBranch((current) => current || profile?.branch_slug || rows[0]?.slug || '')
      })
      .catch((err) => toast.error(err.message))
  }, [profile?.branch_slug])

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
    setBranch(row.branch || branch)
    setCustomerId(booking.customer_id || '')
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

  async function checkout() {
    if (!cart.length) return
    setSaving(true)
    const handoff = activeHandoff
    const { data, error } = await supabase.rpc('complete_pos_sale', {
      payload: buildPosSalePayload({
        branch,
        customerId,
        paymentMethod,
        cart,
        activeHandoff: handoff,
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
    toast.success(
      handoff
        ? `Ticket paid · ${formatMoney(data?.total_minor || cartTotal)}`
        : `Sale complete · ${formatMoney(data?.total_minor || cartTotal)}`,
    )
    setCart([])
    setActiveHandoff(null)
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
          <p className="mt-2 text-muted-foreground">Services and merch in separate tabs — tap to add, then complete payment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageServices(profile) && (
            <Link to="/operations/products" className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
              Manage merch
            </Link>
          )}
          <Button onClick={() => setCartOpen(true)} className="gap-2">
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
            <p className="text-sm text-muted-foreground">Tickets sent from the floor. Open one to complete checkout and close the visit.</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {handoffs.map((row) => {
              const booking = row.bookings || {}
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => loadHandoff(row)}
                  className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-accent/30"
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
          <Input className="pl-9" placeholder={tab === 'services' ? 'Search services' : 'Search merch / items'} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={branch} onValueChange={setBranch} disabled={!branches.length}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="services">Services ({serviceItems.length})</TabsTrigger>
          <TabsTrigger value="merch">Merch / items ({merchItems.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-4">
          <CatalogGrid items={catalog} onAdd={addToCart} empty="No services match." />
        </TabsContent>
        <TabsContent value="merch" className="mt-4">
          <CatalogGrid items={catalog} onAdd={addToCart} empty="No merch items. Add stock under Manage merch." />
        </TabsContent>
      </Tabs>

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{activeHandoff ? 'Pay queue ticket' : 'Checkout'}</SheetTitle>
          </SheetHeader>
          {activeHandoff && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Linked to booking {activeHandoff.booking_id?.slice(0, 8)}… · paying closes the handoff and marks the visit complete.
            </p>
          )}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Cart is empty.</p>}
            {cart.map((line) => (
              <div key={line.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.quantity} × {formatMoney(line.unit_price_minor)} · {line.item_type}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCart((c) => c.filter((x) => x.key !== line.key))} aria-label="Remove">
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <Select value={customerId || 'walkin'} onValueChange={(v) => setCustomerId(v === 'walkin' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="walkin">Walk-in</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.full_name} · {c.phone}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="gcash">GCash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="online">Online</SelectItem>
            </SelectContent>
          </Select>
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Receipt total</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(cartTotal)}</p>
          </div>
          <Button disabled={!cart.length || saving} onClick={checkout}>
            {saving ? 'Processing…' : 'Complete payment'}
          </Button>
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
        <button key={item.key} type="button" onClick={() => onAdd(item)} className="text-left">
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Search, ShoppingCart, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function PosPage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [products, setProducts] = useState([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [branch, setBranch] = useState(profile?.branch_slug || '')
  const [branches, setBranches] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [todayStats, setTodayStats] = useState(null)

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const [svc, prod, cust, stats] = await Promise.all([
      supabase.from('services').select('id, name, price_minor').eq('is_active', true).eq('is_archived', false),
      supabase.from('products').select('id, name, price_minor, category, stock_qty, sku').eq('is_active', true).eq('is_archived', false),
      supabase.from('customers').select('id, full_name, phone').eq('is_archived', false).eq('role', 'customer').limit(100),
      supabase.from('daily_sales_summary').select('*').eq('sale_date', today).eq('branch', branch).maybeSingle(),
    ])
    if (svc.error) toast.error(svc.error.message)
    if (prod.error) toast.error(prod.error.message)
    setServices(svc.data || [])
    setProducts(prod.data || [])
    setCustomers(cust.data || [])
    setTodayStats(stats.data)
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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load, branch])

  const catalog = useMemo(() => {
    const serviceItems = (services || []).map((s) => ({
      key: `service-${s.id}`,
      item_type: 'service',
      id: s.id,
      name: s.name,
      price_minor: s.price_minor,
      category: 'services',
      meta: null,
    }))
    const productItems = (products || []).map((p) => ({
      key: `product-${p.id}`,
      item_type: 'product',
      id: p.id,
      name: p.name,
      price_minor: p.price_minor,
      category: p.category || 'products',
      meta: `Stock ${p.stock_qty}`,
    }))
    return [...serviceItems, ...productItems].filter((item) => {
      const q = query.trim().toLowerCase()
      const matchesQuery = !q || item.name.toLowerCase().includes(q)
      const matchesCat = category === 'all' || item.category === category || (category === 'services' && item.item_type === 'service')
      return matchesQuery && matchesCat
    })
  }, [services, products, query, category])

  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * line.unit_price_minor, 0)

  function addToCart(item) {
    setCart((current) => {
      const existing = current.find((line) => line.key === item.key)
      if (existing) {
        return current.map((line) => (line.key === item.key ? { ...line, quantity: line.quantity + 1 } : line))
      }
      return [...current, { ...item, quantity: 1, unit_price_minor: item.price_minor }]
    })
    setCartOpen(true)
  }

  async function checkout() {
    if (!cart.length) return
    setSaving(true)
    const { data, error } = await supabase.rpc('complete_pos_sale', {
      payload: {
        branch,
        customer_id: customerId || null,
        payment_method: paymentMethod,
        status: 'paid',
        lines: cart.map((line) => ({
          item_type: line.item_type,
          service_id: line.item_type === 'service' ? line.id : null,
          product_id: line.item_type === 'product' ? line.id : null,
          name: line.name,
          quantity: line.quantity,
          unit_price_minor: line.unit_price_minor,
        })),
      },
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Sale complete · ${formatMoney(data?.total_minor || cartTotal)}`)
    setCart([])
    setCartOpen(false)
    load()
  }

  if (!canAccessPos(profile)) return <Navigate to="/operations/access-denied" replace />

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Point of sale</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Fast checkout</h1>
          <p className="mt-2 text-muted-foreground">Square-style catalog for services and products.</p>
        </div>
        <Button onClick={() => setCartOpen(true)} className="gap-2">
          <ShoppingCart data-icon="inline-start" />
          Cart · {cart.length} · {formatMoney(cartTotal)}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={formatMoney(todayStats?.total_sales_minor || 0)} />
        <Stat label="Paid" value={todayStats?.paid_count ?? 0} />
        <Stat label="Pending" value={todayStats?.pending_count ?? 0} />
        <Stat label="Avg ticket" value={formatMoney(todayStats?.average_ticket_minor || 0)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search products and services" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="services">Services</SelectItem>
            <SelectItem value="products">Products</SelectItem>
            <SelectItem value="general">General</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branch} onValueChange={setBranch} disabled={!branches.length}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {catalog.map((item) => (
          <button key={item.key} type="button" onClick={() => addToCart(item)} className="text-left">
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

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Checkout</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
            {cart.length === 0 && <p className="text-sm text-muted-foreground">Cart is empty.</p>}
            {cart.map((line) => (
              <div key={line.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {line.quantity} × {formatMoney(line.unit_price_minor)}
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

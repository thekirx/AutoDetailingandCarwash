import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Car, Contact, Pencil, Plus, Search, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessCrm, isAdmin } from '@/auth/permissions'
import { listBranches, listMembershipTiers } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

const emptyForm = { first_name: '', last_name: '', phone: '', email: '', plate: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'sedan' }
const emptyVehicle = { plate_number: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'sedan', color: '' }

async function provisionCustomer(body) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/provision-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, site_origin: window.location.origin }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Unable to register customer.')
  return json
}

export default function CrmPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [loyalty, setLoyalty] = useState([])
  const [membership, setMembership] = useState(null)
  const [tiers, setTiers] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, first_name, last_name, phone, email, loyalty_points, loyalty_stamps, created_at')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) toast.error(error.message)
    setCustomers(data || [])
  }, [])

  useEffect(() => {
    if (!canAccessCrm(profile)) return
    loadCustomers()
    listMembershipTiers().then(setTiers).catch(() => {})
    listBranches().then(setBranches).catch(() => {})
  }, [loadCustomers, profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((row) =>
      [row.full_name, row.phone, row.email].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [customers, query])

  async function openCustomer(row) {
    setSelected(row)
    setLoadingDetail(true)
    const [v, b, l, m] = await Promise.all([
      supabase.from('vehicles').select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color').eq('customer_id', row.id).eq('is_archived', false),
      supabase
        .from('bookings')
        .select('id, status, branch, scheduled_start, vehicle_plate, queue_number, final_price_minor, service_id')
        .eq('customer_id', row.id)
        .order('scheduled_start', { ascending: false })
        .limit(30),
      supabase.from('loyalty_ledger').select('id, delta, reason, created_at').eq('customer_id', row.id).order('created_at', { ascending: false }).limit(20),
      supabase
        .from('customer_memberships')
        .select('id, tier_id, starts_at, ends_at, is_active, membership_tiers(name)')
        .eq('customer_id', row.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (v.error) toast.error(v.error.message)
    if (b.error) toast.error(b.error.message)
    setVehicles(v.data || [])
    setBookings(b.data || [])
    setLoyalty(l.data || [])
    setMembership(m.data || null)
    setLoadingDetail(false)
  }

  async function createCustomer(event) {
    event.preventDefault()
    setSaving(true)
    try {
      // Always provision Auth + customers row so portal visits link correctly
      await provisionCustomer({
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email || null,
        plate: form.plate || null,
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        vehicle_type: form.vehicle_type || 'sedan',
      })
      toast.success('Customer registered — account invite queued')
      setForm(emptyForm)
      await loadCustomers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const full_name = `${editing.first_name || ''} ${editing.last_name || ''}`.trim() || editing.full_name
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editing.first_name?.trim() || null,
          last_name: editing.last_name?.trim() || null,
          full_name,
          phone: editing.phone?.trim() || null,
          email: editing.email?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
      if (error) throw error
      toast.success('Customer updated')
      setEditing(null)
      await loadCustomers()
      if (selected?.id === editing.id) {
        const next = { ...selected, ...editing, full_name }
        setSelected(next)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addVehicle(event) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const plate = vehicleForm.plate_number.trim().toUpperCase()
      if (!plate) throw new Error('Plate is required.')
      const { error } = await supabase.from('vehicles').insert({
        customer_id: selected.id,
        plate_number: plate,
        vehicle_make: vehicleForm.vehicle_make.trim() || null,
        vehicle_model: vehicleForm.vehicle_model.trim() || null,
        vehicle_type: vehicleForm.vehicle_type || 'sedan',
        color: vehicleForm.color.trim() || null,
        is_archived: false,
      })
      if (error) throw error
      toast.success('Vehicle added')
      setVehicleForm(emptyVehicle)
      setAddingVehicle(false)
      await openCustomer(selected)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!canAccessCrm(profile)) return <Navigate to="/operations/access-denied" replace />

  const branchName = (slug) => branches.find((b) => b.slug === slug)?.name || slug

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">CRM</p>
          <h1 className="text-3xl font-semibold tracking-tight">Customer relationships</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Register customers with login accounts, track vehicles and visits by branch, and review loyalty.
            {isAdmin(profile) ? ' Super Admin and Admin see every branch.' : ''}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/operations/memberships">Memberships</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus size={18} /> Register customer</CardTitle>
            <CardDescription>Creates a Hakum login so their queue visits appear in the customer portal.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createCustomer} className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>First name</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Last name</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-2"><Label>Phone</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXXX" /></div>
              <div className="flex flex-col gap-2"><Label>Email (optional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Plate (optional)</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="ABC 1234" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Make</Label><Input value={form.vehicle_make} onChange={(e) => setForm({ ...form, vehicle_make: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Model</Label><Input value={form.vehicle_model} onChange={(e) => setForm({ ...form, vehicle_model: e.target.value })} /></div>
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Contact size={18} /> Directory</CardTitle>
              <CardDescription>{filtered.length} customers</CardDescription>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, phone, email" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Loyalty</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className={selected?.id === row.id ? 'bg-muted/40' : ''}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell>{row.phone || '—'}</TableCell>
                    <TableCell className="tabular-nums">{row.loyalty_points ?? 0} pts · {row.loyalty_stamps ?? 0} stamps</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openCustomer(row)}>View</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">No customers match.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{selected ? selected.full_name : 'Customer detail'}</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.phone || 'No phone'} · ${selected.email || 'No email'}`
                : 'Select someone from the directory.'}
            </CardDescription>
          </div>
          {selected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing({
                id: selected.id,
                first_name: selected.first_name || '',
                last_name: selected.last_name || '',
                full_name: selected.full_name,
                phone: selected.phone || '',
                email: selected.email || '',
              })}
            >
              <Pencil className="mr-1 size-4" /> Edit profile
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!selected && <p className="text-sm text-muted-foreground">Choose a customer to view vehicles, visits by branch, loyalty, and membership.</p>}
          {selected && loadingDetail && <p className="text-sm text-muted-foreground">Loading…</p>}
          {selected && !loadingDetail && (
            <Tabs defaultValue="visits">
              <TabsList className="mb-4">
                <TabsTrigger value="visits">Visits</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
              </TabsList>
              <TabsContent value="visits" className="space-y-3">
                {membership && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                    Active membership: <strong>{membership.membership_tiers?.name || 'Tier'}</strong>
                  </div>
                )}
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
                    <div>
                      <p className="font-medium">
                        {b.vehicle_plate || '—'} · {branchName(b.branch)}
                        {b.queue_number != null ? ` · Q-${String(b.queue_number).padStart(3, '0')}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(b.scheduled_start).toLocaleString('en-PH')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">{formatMoney(b.final_price_minor)}</span>
                      <Badge variant="secondary">{b.status}</Badge>
                      {(profile?.role === 'BossMich' || profile?.role === 'team_lead' || profile?.role === 'admin') && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/operations/queue/${b.id}`}>Ticket</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!bookings.length && <p className="text-sm text-muted-foreground">No visits yet.</p>}
              </TabsContent>
              <TabsContent value="vehicles" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAddingVehicle(true)}>
                    <Plus className="mr-1 size-4" /> Add vehicle
                  </Button>
                </div>
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
                    <Car className="mt-0.5 size-4 text-primary" />
                    <div>
                      <p className="font-medium">{v.plate_number}</p>
                      <p className="text-muted-foreground">
                        {[v.vehicle_make, v.vehicle_model, v.vehicle_type, v.color].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
                {!vehicles.length && <p className="text-sm text-muted-foreground">No vehicles on file.</p>}
              </TabsContent>
              <TabsContent value="loyalty" className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Points" value={selected.loyalty_points ?? 0} />
                  <Stat label="Stamps" value={selected.loyalty_stamps ?? 0} />
                  <Stat label="Tiers on file" value={tiers.length} />
                </div>
                {loyalty.map((row) => (
                  <div key={row.id} className="flex justify-between rounded-xl border border-border p-3 text-sm">
                    <div>
                      <p>{row.reason}</p>
                      <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('en-PH')}</p>
                    </div>
                    <span className="tabular-nums font-medium">{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
                  </div>
                ))}
                {!loyalty.length && <p className="text-sm text-muted-foreground">No loyalty ledger entries.</p>}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>First name</Label><Input value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Last name</Label><Input value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-2"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Email</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addingVehicle} onOpenChange={(open) => !open && setAddingVehicle(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
          <form onSubmit={addVehicle} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2"><Label>Plate</Label><Input required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label>Make</Label><Input value={vehicleForm.vehicle_make} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_make: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Model</Label><Input value={vehicleForm.vehicle_model} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={vehicleForm.vehicle_type} onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other'].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2"><Label>Color</Label><Input value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddingVehicle(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add vehicle'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

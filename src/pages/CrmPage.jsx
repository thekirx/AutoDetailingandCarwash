import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessCrm } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function CrmPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [loyalty, setLoyalty] = useState([])
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' })

  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('id, full_name, first_name, last_name, phone, email, loyalty_points, created_at')
      .eq('role', 'customer')
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) toast.error(error.message)
    setCustomers(data || [])
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  async function openCustomer(row) {
    setSelected(row)
    const [v, b, l] = await Promise.all([
      supabase.from('vehicles').select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color').eq('customer_id', row.id).eq('is_archived', false),
      supabase.from('bookings').select('id, status, branch, scheduled_start, customer_name').eq('customer_id', row.id).order('scheduled_start', { ascending: false }).limit(20),
      supabase.from('loyalty_ledger').select('id, delta, reason, created_at').eq('customer_id', row.id).order('created_at', { ascending: false }).limit(20),
    ])
    setVehicles(v.data || [])
    setBookings(b.data || [])
    setLoyalty(l.data || [])
  }

  async function createCustomer(event) {
    event.preventDefault()
    const { error } = await supabase.from('customers').insert({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      role: 'customer',
      full_name: `${form.first_name.trim()} ${form.last_name.trim()}`.trim(),
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Customer created')
    setForm({ first_name: '', last_name: '', phone: '', email: '' })
    loadCustomers()
  }

  if (!canAccessCrm(profile)) return <Navigate to="/operations/access-denied" replace />

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">CRM</p>
        <h1 className="text-3xl font-semibold tracking-tight">Customers & loyalty</h1>
        <p className="mt-2 text-muted-foreground">Contact, vehicles, booking history — no finance columns.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Register customer</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createCustomer} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2"><Label>First name</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Last name</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Phone</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Email (optional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <Button type="submit" className="md:col-span-2">Save customer</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Customer list</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Loyalty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openCustomer(row)}>
                    <TableCell>{row.full_name}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.loyalty_points}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selected ? selected.full_name : 'Select a customer'}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {!selected && <p className="text-sm text-muted-foreground">Choose a customer to view vehicles, bookings, and loyalty.</p>}
            {selected && (
              <>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Vehicles</h3>
                  <div className="flex flex-col gap-2">
                    {vehicles.map((v) => (
                      <div key={v.id} className="rounded-lg border border-border p-3 text-sm">
                        {v.plate_number} · {v.vehicle_make} {v.vehicle_model} · {v.vehicle_type}
                        {v.color ? ` · ${v.color}` : ''}
                      </div>
                    ))}
                    {!vehicles.length && <p className="text-sm text-muted-foreground">No vehicles.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Bookings</h3>
                  <div className="flex flex-col gap-2">
                    {bookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                        <span>{b.branch} · {new Date(b.scheduled_start).toLocaleString()}</span>
                        <Badge variant="secondary">{b.status}</Badge>
                      </div>
                    ))}
                    {!bookings.length && <p className="text-sm text-muted-foreground">No bookings.</p>}
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Loyalty ledger</h3>
                  <div className="flex flex-col gap-2">
                    {loyalty.map((row) => (
                      <div key={row.id} className="flex justify-between rounded-lg border border-border p-3 text-sm">
                        <span>{row.reason}</span>
                        <span className="tabular-nums">{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
                      </div>
                    ))}
                    {!loyalty.length && <p className="text-sm text-muted-foreground">No loyalty activity.</p>}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

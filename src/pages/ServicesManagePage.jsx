import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export default function ServicesManagePage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [form, setForm] = useState({ name: '', price: '', duration_minutes: '60', slug: '' })

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('services').select('id, name, slug, price_minor, duration_minutes, is_active, is_archived').order('display_order')
    if (error) toast.error(error.message)
    setServices(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canManageServices(profile)) return <Navigate to="/operations/access-denied" replace />

  async function createService(event) {
    event.preventDefault()
    const slug = form.slug.trim() || form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { error } = await supabase.from('services').insert({
      name: form.name.trim(),
      slug,
      price_minor: Math.round(Number(form.price) * 100),
      duration_minutes: Number(form.duration_minutes),
      is_active: true,
      is_archived: false,
    })
    if (error) toast.error(error.message)
    else {
      toast.success('Service created')
      setForm({ name: '', price: '', duration_minutes: '60', slug: '' })
      load()
    }
  }

  async function archiveService(id) {
    const { error } = await supabase.from('services').update({ is_archived: true, is_active: false }).eq('id', id)
    if (error) toast.error(error.message)
    else {
      toast.success('Service archived')
      load()
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Catalog</p>
        <h1 className="text-3xl font-semibold tracking-tight">Service management</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Add service</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={createService} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-from-name" /></div>
            <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Duration (min)</Label><Input type="number" required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            <Button type="submit" className="md:col-span-2">Create service</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Services</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.filter((s) => !s.is_archived).map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{formatMoney(s.price_minor)}</TableCell>
                  <TableCell>{s.duration_minutes}m</TableCell>
                  <TableCell>{s.is_active ? 'Yes' : 'No'}</TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => archiveService(s.id)}>Archive</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

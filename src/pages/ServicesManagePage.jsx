import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { archiveService, createService, listServices, updateService } from '@/lib/adminApi'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const empty = { name: '', price: '', duration_minutes: '60', slug: '', display_order: '0' }

export default function ServicesManagePage() {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setServices(await listServices({ includeArchived: false }))
    } catch (err) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    if (canManageServices(profile)) load()
  }, [load, profile])

  if (!canManageServices(profile)) return <Navigate to="/operations/access-denied" replace />

  async function onCreate(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await createService(form)
      toast.success('Service created')
      setForm(empty)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSaveEdit(event) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      await updateService(editing.id, {
        name: editing.name,
        slug: editing.slug,
        price: editing.price,
        duration_minutes: editing.duration_minutes,
        display_order: editing.display_order,
        is_active: editing.is_active,
      })
      toast.success('Service updated')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row) {
    try {
      await updateService(row.id, {
        name: row.name,
        slug: row.slug,
        price: Number(row.price_minor) / 100,
        duration_minutes: row.duration_minutes,
        display_order: row.display_order,
        is_active: !row.is_active,
      })
      toast.success(row.is_active ? 'Service deactivated' : 'Service activated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onArchive(id) {
    if (!window.confirm('Archive this service?')) return
    try {
      await archiveService(id)
      toast.success('Service archived')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Catalog</p>
        <h1 className="text-3xl font-semibold tracking-tight">Service management</h1>
        <p className="mt-2 text-sm text-muted-foreground">Create, edit prices/duration, activate, or archive services used on the floor.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Add service</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2"><Label>Name</Label><Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Slug</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="auto-from-name" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></div>
            <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
            <div className="flex flex-col gap-2"><Label>Duration (min)</Label><Input type="number" min="1" step="1" required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            <Button type="submit" className="md:col-span-2" disabled={saving}>{saving ? 'Saving…' : 'Create service'}</Button>
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.slug}</div>
                  </TableCell>
                  <TableCell>{formatMoney(s.price_minor)}</TableCell>
                  <TableCell>{s.duration_minutes}m</TableCell>
                  <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            id: s.id,
                            name: s.name,
                            slug: s.slug,
                            price: String(Number(s.price_minor) / 100),
                            duration_minutes: String(s.duration_minutes),
                            display_order: String(s.display_order ?? 0),
                            is_active: s.is_active,
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(s)}>
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onArchive(s.id)}>Archive</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit service</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={editing.name} onChange={(e) => setEditing((r) => ({ ...r, name: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing((r) => ({ ...r, slug: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required value={editing.price} onChange={(e) => setEditing((r) => ({ ...r, price: e.target.value }))} /></div>
              <div className="flex flex-col gap-2"><Label>Duration (min)</Label><Input type="number" required value={editing.duration_minutes} onChange={(e) => setEditing((r) => ({ ...r, duration_minutes: e.target.value }))} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

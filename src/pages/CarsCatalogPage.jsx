import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { clearVehicleCatalogCache } from '@/components/VehicleMakeModelFields'
import { writeAudit } from '@/lib/audit'
import { supabase } from '@/lib/supabase'

const emptyForm = { make: '', model: '' }

export default function CarsCatalogPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [addForm, setAddForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .select('id, make, model, is_active, sort_order, updated_at')
      .order('make')
      .order('model')
    if (error) toast.error(error.message)
    else setRows(data || [])
  }, [])

  useEffect(() => {
    if (isSuperAdmin(profile)) load()
  }, [load, profile])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (activeFilter === 'active' && !row.is_active) return false
      if (activeFilter === 'hidden' && row.is_active) return false
      if (!q) return true
      return `${row.make} ${row.model}`.toLowerCase().includes(q)
    })
  }, [rows, search, activeFilter])

  if (!isSuperAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  function openEdit(row) {
    setEditing(row)
    setEditForm({ make: row.make, model: row.model })
  }

  function closeEdit() {
    setEditing(null)
    setEditForm(emptyForm)
  }

  async function addRow(e) {
    e.preventDefault()
    const make = addForm.make.trim()
    const model = addForm.model.trim()
    if (!make || !model) return
    setSaving(true)
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .insert({ make, model, is_active: true, sort_order: 0 })
      .select('id')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    await writeAudit({
      action: 'create',
      entityType: 'vehicle_catalog',
      entityId: data.id,
      summary: `Added master car ${make} ${model}`,
      meta: { make, model },
    })
    clearVehicleCatalogCache()
    toast.success('Added')
    setAddForm(emptyForm)
    load()
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editing) return
    const make = editForm.make.trim()
    const model = editForm.model.trim()
    if (!make || !model) return
    setSaving(true)
    const { error } = await supabase
      .from('vehicle_catalog')
      .update({ make, model, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
      .select('id')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    await writeAudit({
      action: 'update',
      entityType: 'vehicle_catalog',
      entityId: editing.id,
      summary: `Updated master car to ${make} ${model}`,
      meta: { make, model, previous: { make: editing.make, model: editing.model } },
    })
    clearVehicleCatalogCache()
    toast.success('Saved')
    closeEdit()
    load()
  }

  async function toggleActive(row) {
    const { error } = await supabase
      .from('vehicle_catalog')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .select('id')
      .single()
    if (error) toast.error(error.message)
    else {
      await writeAudit({
        action: row.is_active ? 'deactivate' : 'activate',
        entityType: 'vehicle_catalog',
        entityId: row.id,
        summary: `${row.is_active ? 'Hid' : 'Showed'} master car ${row.make} ${row.model}`,
        meta: { make: row.make, model: row.model },
      })
      clearVehicleCatalogCache()
      load()
    }
  }

  async function removeRow(row) {
    if (!window.confirm(`Delete ${row.make} ${row.model}?`)) return
    const { error } = await supabase.from('vehicle_catalog').delete().eq('id', row.id)
    if (error) toast.error(error.message)
    else {
      await writeAudit({
        action: 'delete',
        entityType: 'vehicle_catalog',
        entityId: row.id,
        summary: `Deleted master car ${row.make} ${row.model}`,
        meta: { make: row.make, model: row.model },
      })
      clearVehicleCatalogCache()
      toast.success('Deleted')
      if (editing?.id === row.id) closeEdit()
      load()
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Masterlist</p>
        <h1 className="text-3xl font-semibold tracking-tight">Cars catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Super Admin CRUD for the TL queue picker. PH makes/models (1990s–present) seed the list; edit opens in a modal.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add make / model</CardTitle>
          <CardDescription>Used by VehicleMakeModelFields on the floor for Team Lead and staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addRow} className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-2">
              <Label>Make</Label>
              <Input required value={addForm.make} onChange={(e) => setAddForm({ ...addForm, make: e.target.value })} placeholder="Toyota" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Model</Label>
              <Input required value={addForm.model} onChange={(e) => setAddForm({ ...addForm, model: e.target.value })} placeholder="Vios" />
            </div>
            <Button type="submit" className="self-end" disabled={saving}>
              {saving && !editing ? 'Saving…' : 'Add'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {filtered.length} of {rows.length} entries
          </CardTitle>
          <CardDescription>Search and filter the master list. Active models appear in the TL picker immediately.</CardDescription>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="cars-search">Search</Label>
              <Input
                id="cars-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Make or model…"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cars-active">Visibility</Label>
              <select
                id="cars-active"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                className="flex h-9 min-w-[8rem] rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Make</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.make}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>{row.is_active ? 'Yes' : 'Hidden'}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                      {row.is_active ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeRow(row)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    {rows.length ? 'No entries match this search/filter.' : 'Catalog empty — TL uses static PH list.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit make / model</DialogTitle>
            <DialogDescription>
              Update the catalog entry used on the floor picker.
              {editing ? ` Currently ${editing.make} ${editing.model}.` : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-make">Make</Label>
              <Input
                id="edit-make"
                required
                value={editForm.make}
                onChange={(e) => setEditForm({ ...editForm, make: e.target.value })}
                placeholder="Toyota"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-model">Model</Label>
              <Input
                id="edit-model"
                required
                value={editForm.model}
                onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                placeholder="Vios"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

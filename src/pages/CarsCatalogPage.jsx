import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
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
import { inferPhPricingSize } from '@/lib/phVehicleSizes'
import { PRICING_SIZES } from '@/lib/servicePricing'
import { supabase } from '@/lib/supabase'

const emptyForm = { make: '', model: '', size_slug: 'medium' }

function sizeLabel(slug) {
  return PRICING_SIZES.find((s) => s.slug === slug)?.label || slug || 'Medium'
}

function SizeSelect({ id, value, onChange }) {
  return (
    <select
      id={id}
      value={value || 'medium'}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 min-w-[9rem] rounded-md border border-input bg-transparent px-3 text-sm"
    >
      {PRICING_SIZES.map((sz) => (
        <option key={sz.slug} value={sz.slug}>
          {sz.label}
        </option>
      ))}
    </select>
  )
}

export default function CarsCatalogPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [addForm, setAddForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [sizeFilter, setSizeFilter] = useState('all')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .select('id, make, model, size_slug, is_active, sort_order, updated_at')
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
      if (sizeFilter !== 'all' && (row.size_slug || 'medium') !== sizeFilter) return false
      if (!q) return true
      return `${row.make} ${row.model}`.toLowerCase().includes(q)
    })
  }, [rows, search, activeFilter, sizeFilter])

  if (!isSuperAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  function openEdit(row) {
    setEditing(row)
    setEditForm({
      make: row.make,
      model: row.model,
      size_slug: row.size_slug || inferPhPricingSize(row.make, row.model),
    })
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
    const size_slug = addForm.size_slug || inferPhPricingSize(make, model)
    setSaving(true)
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .insert({ make, model, size_slug, is_active: true, sort_order: 0 })
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
      summary: `Added master car ${make} ${model} (${sizeLabel(size_slug)})`,
      meta: { make, model, size_slug },
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
    const size_slug = editForm.size_slug || inferPhPricingSize(make, model)
    setSaving(true)
    const { error } = await supabase
      .from('vehicle_catalog')
      .update({ make, model, size_slug, updated_at: new Date().toISOString() })
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
      summary: `Updated master car to ${make} ${model} (${sizeLabel(size_slug)})`,
      meta: { make, model, size_slug, previous: { make: editing.make, model: editing.model, size_slug: editing.size_slug } },
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
    <OpsPageShell
      className="hakum-cars"
      eyebrow="Masterlist"
      title="Cars catalog"
      description="Super Admin CRUD for the TL queue picker. Each make/model has a bay size (Small–XL) so bookings and packages auto-price; staff can override on the ticket."
    >

      <Card>
        <CardHeader>
          <CardTitle>Add make / model</CardTitle>
          <CardDescription>Used by VehicleMakeModelFields on the floor for Team Lead and staff. Size seeds from the PH market chart; change it if this shop prices the car differently.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addRow} className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-2">
              <Label>Make</Label>
              <Input
                required
                value={addForm.make}
                onChange={(e) => {
                  const make = e.target.value
                  setAddForm({ ...addForm, make, size_slug: inferPhPricingSize(make, addForm.model) })
                }}
                placeholder="Toyota"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Model</Label>
              <Input
                required
                value={addForm.model}
                onChange={(e) => {
                  const model = e.target.value
                  setAddForm({ ...addForm, model, size_slug: inferPhPricingSize(addForm.make, model) })
                }}
                placeholder="Vios"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-size">Size</Label>
              <SizeSelect id="add-size" value={addForm.size_slug} onChange={(size_slug) => setAddForm({ ...addForm, size_slug })} />
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
          <CardDescription>Search and filter the master list. Active models appear in the TL picker immediately with this size.</CardDescription>
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
              <Label htmlFor="cars-size">Size</Label>
              <select
                id="cars-size"
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="flex h-9 min-w-[8rem] rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="all">All</option>
                {PRICING_SIZES.map((sz) => (
                  <option key={sz.slug} value={sz.slug}>
                    {sz.label}
                  </option>
                ))}
              </select>
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
                <TableHead>Size</TableHead>
                <TableHead>Active</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.make}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>{sizeLabel(row.size_slug)}</TableCell>
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
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {rows.length ? 'No entries match this search/filter.' : 'Catalog empty — add a make and model above.'}
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
                onChange={(e) => {
                  const make = e.target.value
                  setEditForm({ ...editForm, make, size_slug: inferPhPricingSize(make, editForm.model) })
                }}
                placeholder="Toyota"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-model">Model</Label>
              <Input
                id="edit-model"
                required
                value={editForm.model}
                onChange={(e) => {
                  const model = e.target.value
                  setEditForm({ ...editForm, model, size_slug: inferPhPricingSize(editForm.make, model) })
                }}
                placeholder="Vios"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-size">Size</Label>
              <SizeSelect id="edit-size" value={editForm.size_slug} onChange={(size_slug) => setEditForm({ ...editForm, size_slug })} />
              <p className="text-xs text-muted-foreground">Auto-fills from the PH chart when make or model changes. Override if this bay prices it differently.</p>
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
    </OpsPageShell>
  )
}

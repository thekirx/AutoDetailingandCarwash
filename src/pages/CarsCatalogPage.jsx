import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import { writeAudit } from '@/lib/audit'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

/** Super Admin CRUD for TL make/model picker (vehicle_catalog). */
export default function CarsCatalogPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ make: '', model: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .select('id, make, model, is_active, sort_order')
      .order('make')
      .order('sort_order')
    if (error) toast.error(error.message)
    setRows(data || [])
  }, [])

  useEffect(() => {
    if (isSuperAdmin(profile)) load()
  }, [load, profile])

  if (!isSuperAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  async function addRow(e) {
    e.preventDefault()
    const make = form.make.trim()
    const model = form.model.trim()
    if (!make || !model) return
    setSaving(true)
    const { data, error } = await supabase
      .from('vehicle_catalog')
      .insert({ make, model, sort_order: rows.filter((r) => r.make === make).length })
      .select('id, make, model')
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
    toast.success('Added')
    setForm({ make: '', model: '' })
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
      toast.success('Deleted')
      load()
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Masterlist</p>
        <h1 className="text-3xl font-semibold tracking-tight">Cars catalog</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Super Admin make/model list for TL queue picker. Static PH fallback remains if catalog is empty.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add make / model</CardTitle>
          <CardDescription>Used by VehicleMakeModelFields on the floor.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={addRow} className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-2">
              <Label>Make</Label>
              <Input required value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Model</Label>
              <Input required value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Vios" />
            </div>
            <Button type="submit" className="self-end" disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{rows.length} entries</CardTitle></CardHeader>
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
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.make}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>{row.is_active ? 'Yes' : 'Hidden'}</TableCell>
                  <TableCell className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
                      {row.is_active ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => removeRow(row)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Catalog empty — TL uses static PH list.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { isSuperAdmin } from '@/auth/permissions'
import { deactivateVehicleSize, listVehicleSizes, upsertVehicleSize } from '@/lib/adminApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

export default function VehicleSizesPanel() {
  const { profile } = useAuth()
  const canEdit = isSuperAdmin(profile)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState({ slug: '', label: '', sort_order: '0' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(await listVehicleSizes({ activeOnly: false }))
    } catch (err) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e) {
    e.preventDefault()
    if (!canEdit) return
    setSaving(true)
    try {
      await upsertVehicleSize(form)
      toast.success('Vehicle size added')
      setForm({ slug: '', label: '', sort_order: '0' })
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vehicle sizes</CardTitle>
        <CardDescription>
          Used on queue / booking forms. {canEdit ? 'Super Admin can CRUD.' : 'View only — ask Super Admin to edit.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit && (
          <form onSubmit={onCreate} className="grid gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-1"><Label>Slug</Label><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="suv" /></div>
            <div className="flex flex-col gap-1"><Label>Label</Label><Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="SUV" /></div>
            <div className="flex flex-col gap-1"><Label>Order</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            <div className="flex items-end"><Button type="submit" disabled={saving} className="w-full">{saving ? '…' : 'Add size'}</Button></div>
          </form>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-muted-foreground">{r.slug}</TableCell>
                <TableCell>{r.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Off</Badge>}</TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    {r.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => deactivateVehicleSize(r.id).then(load).catch((e) => toast.error(e.message))}>
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

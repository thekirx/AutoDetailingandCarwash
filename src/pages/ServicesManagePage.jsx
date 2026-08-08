import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { archiveService, createService, listServices, updateService } from '@/lib/adminApi'
import { formatSizePriceRange, PRICING_SIZES, sizePricesFromService, emptySizePriceForm } from '@/lib/servicePricing'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import VehicleSizesPanel from '@/components/VehicleSizesPanel'
import { PAY_CATEGORY_OPTIONS, serviceKindFromPayCategory } from '@/lib/serviceKinds'

const PAY_CATEGORIES = PAY_CATEGORY_OPTIONS

const empty = {
  name: '',
  slug: '',
  display_order: '0',
  pay_category: 'general',
  size_prices: emptySizePriceForm(''),
}

function SizePriceFields({ value, onChange }) {
  return (
    <div className="md:col-span-2 space-y-2">
      <Label>Pricing by car size *</Label>
      <p className="text-xs text-muted-foreground">Small · Medium · Large · Extra Large (₱)</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_SIZES.map((size) => (
          <div key={size.slug} className="flex flex-col gap-1">
            <Label className="text-xs font-medium">{size.label}</Label>
            <Input
              required
              type="number"
              min="0"
              step="0.01"
              value={value[size.slug] ?? ''}
              onChange={(e) => onChange({ ...value, [size.slug]: e.target.value })}
              placeholder="0.00"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ServicesManagePage({ embedded = false }) {
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

  if (!canManageServices(profile)) {
    if (embedded) return null
    return <Navigate to="/operations/access-denied" replace />
  }

  async function onCreate(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await createService({
        ...form,
        price: form.size_prices.medium,
        size_prices: form.size_prices,
      })
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
        price: editing.size_prices.medium,
        size_prices: editing.size_prices,
        pay_category: editing.pay_category,
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
        size_prices: sizePricesFromService(row),
        pay_category: row.pay_category || 'general',
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
    <section className={`flex flex-col gap-8 ${embedded ? '' : ''}`}>
      {!embedded && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Catalog</p>
          <h1 className="text-3xl font-semibold tracking-tight">Service management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add Services, Packages, or Detailing (multi-day). Same-day kinds reset queue numbers daily; detailing keeps its number until finished.
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-muted-foreground">
          Set a price for each car size. Queue and POS use the selected size automatically.
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Add catalog item</CardTitle>
          <CardDescription>
            Choose category carefully. Detailing (multi-day) stays on the floor across days and uses a D- queue number.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input required minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="auto-from-name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category</Label>
              <Select value={form.pay_category} onValueChange={(pay_category) => setForm({ ...form, pay_category })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Team Lead form groups these as Service / Package / Detailing.
              </p>
            </div>
            <SizePriceFields
              value={form.size_prices}
              onChange={(size_prices) => setForm({ ...form, size_prices })}
            />
            <Button type="submit" className="md:col-span-2" disabled={saving}>
              {saving ? 'Saving…' : 'Create service'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price by size</TableHead>
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
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline">{PAY_CATEGORIES.find((c) => c.value === (s.pay_category || 'general'))?.label || s.pay_category}</Badge>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {serviceKindFromPayCategory(s.pay_category)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm tabular-nums">{formatSizePriceRange(s, formatMoney)}</div>
                    <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                      {PRICING_SIZES.map((sz) => (
                        <span key={sz.slug}>
                          {sz.label[0]} {formatMoney(s.size_prices?.[sz.slug] ?? s.price_minor)}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setEditing({
                            ...s,
                            size_prices: sizePricesFromService(s),
                            pay_category: s.pay_category || 'general',
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(s)}>
                        {s.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onArchive(s.id)}>
                        Archive
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <VehicleSizesPanel />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit service</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select
                  value={editing.pay_category || 'general'}
                  onValueChange={(pay_category) => setEditing({ ...editing, pay_category })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SizePriceFields
                value={editing.size_prices}
                onChange={(size_prices) => setEditing({ ...editing, size_prices })}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

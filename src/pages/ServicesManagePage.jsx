import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { archiveService, createService, listServices, updateService } from '@/lib/adminApi'
import {
  availablePricingSizes,
  formatSizePriceRange,
  PRICING_SIZES,
  serviceHasSizePricing,
  sizePricesFromService,
  emptySizePriceForm,
} from '@/lib/servicePricing'
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
import {
  PAY_CATEGORY_OPTIONS,
  defaultPayCategoryForCatalogScope,
  filterPosBayCatalog,
  filterPosDetailingCatalog,
  payCategoryOptionsForCatalogScope,
  serviceKindFromPayCategory,
} from '@/lib/serviceKinds'

function emptyForm(catalogScope = 'all') {
  return {
    name: '',
    slug: '',
    description: '',
    display_order: '0',
    pay_category: defaultPayCategoryForCatalogScope(catalogScope),
    price: '',
    use_size_pricing: false,
    size_prices: emptySizePriceForm(''),
    size_enabled: { small: false, medium: true, large: false, extra_large: false },
    included_service_ids: [],
  }
}

function OptionalSizePriceFields({ enabled, sizeEnabled, sizePrices, onEnabledChange, onSizeEnabledChange, onPricesChange }) {
  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-border p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Optional size pricing (multi-select)
      </label>
      <p className="text-xs text-muted-foreground">
        Off = one flat price for all cars. On = set prices only for the sizes you enable.
      </p>
      {enabled ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING_SIZES.map((size) => (
            <div key={size.slug} className="flex flex-col gap-1 rounded-lg border border-border p-2">
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={Boolean(sizeEnabled[size.slug])}
                  onChange={(e) =>
                    onSizeEnabledChange({ ...sizeEnabled, [size.slug]: e.target.checked })
                  }
                />
                {size.label}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!sizeEnabled[size.slug]}
                value={sizePrices[size.slug] ?? ''}
                onChange={(e) => onPricesChange({ ...sizePrices, [size.slug]: e.target.value })}
                placeholder="0.00"
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PackageIncludesField({ services, value, onChange, selfId }) {
  const options = (services || []).filter(
    (s) =>
      s.id !== selfId &&
      s.is_active &&
      !s.is_archived &&
      serviceKindFromPayCategory(s.pay_category) === 'service',
  )
  const selected = new Set(value || [])
  return (
    <div className="md:col-span-2 space-y-2">
      <Label>Included services (packages)</Label>
      <p className="text-xs text-muted-foreground">
        Mixed bundle of bay services. Leave empty for a custom package with its own price.
      </p>
      <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-border p-3 sm:grid-cols-2">
        {options.map((svc) => (
          <label key={svc.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(svc.id)}
              onChange={(e) => {
                const next = new Set(selected)
                if (e.target.checked) next.add(svc.id)
                else next.delete(svc.id)
                onChange([...next])
              }}
            />
            {svc.name}
          </label>
        ))}
        {!options.length ? (
          <p className="text-xs text-muted-foreground">Create bay services first, then attach them here.</p>
        ) : null}
      </div>
    </div>
  )
}

function sizePayloadFromForm(form) {
  if (!form.use_size_pricing) return {}
  const out = {}
  for (const size of PRICING_SIZES) {
    if (!form.size_enabled?.[size.slug]) continue
    out[size.slug] = form.size_prices?.[size.slug] ?? ''
  }
  return out
}

function formFromService(row) {
  const sized = serviceHasSizePricing(row)
  const prices = sizePricesFromService(row)
  const size_enabled = Object.fromEntries(
    PRICING_SIZES.map((sz) => [sz.slug, sized && prices[sz.slug] !== '']),
  )
  return {
    ...row,
    price: String(Number(row.price_minor || 0) / 100),
    description: row.description || '',
    use_size_pricing: sized,
    size_prices: prices,
    size_enabled,
    included_service_ids: row.included_service_ids || [],
    pay_category: row.pay_category || 'general',
  }
}

export default function ServicesManagePage({ embedded = false, catalogScope = 'all' }) {
  const { profile } = useAuth()
  const [services, setServices] = useState([])
  const [form, setForm] = useState(() => emptyForm(catalogScope))
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const categoryOptions = useMemo(
    () => payCategoryOptionsForCatalogScope(catalogScope),
    [catalogScope],
  )

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

  useEffect(() => {
    setForm(emptyForm(catalogScope))
    setEditing(null)
  }, [catalogScope])

  const scopedRows = useMemo(() => {
    if (catalogScope === 'bay') return filterPosBayCatalog(services)
    if (catalogScope === 'detailing') return filterPosDetailingCatalog(services)
    return services || []
  }, [services, catalogScope])

  const nameById = useMemo(() => Object.fromEntries((services || []).map((s) => [s.id, s.name])), [services])

  if (!canManageServices(profile)) {
    if (embedded) return null
    return <Navigate to="/operations/access-denied" replace />
  }

  async function onCreate(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const size_prices = sizePayloadFromForm(form)
      await createService({
        ...form,
        price: form.price,
        size_prices,
        included_service_ids:
          serviceKindFromPayCategory(form.pay_category) === 'package' ? form.included_service_ids : [],
      })
      toast.success('Catalog item created')
      setForm(emptyForm(catalogScope))
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
      const size_prices = sizePayloadFromForm(editing)
      await updateService(editing.id, {
        name: editing.name,
        slug: editing.slug,
        description: editing.description,
        price: editing.price,
        size_prices,
        pay_category: editing.pay_category,
        display_order: editing.display_order,
        is_active: editing.is_active,
        included_service_ids:
          serviceKindFromPayCategory(editing.pay_category) === 'package'
            ? editing.included_service_ids || []
            : [],
      })
      toast.success('Updated')
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
      const edit = formFromService(row)
      await updateService(row.id, {
        name: row.name,
        slug: row.slug,
        price: edit.price,
        size_prices: sizePayloadFromForm(edit),
        pay_category: row.pay_category || 'general',
        display_order: row.display_order,
        is_active: !row.is_active,
        included_service_ids: row.included_service_ids || [],
      })
      toast.success(row.is_active ? 'Deactivated' : 'Activated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onArchive(id) {
    if (!window.confirm('Archive this catalog item?')) return
    try {
      await archiveService(id)
      toast.success('Archived')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const isPackage = serviceKindFromPayCategory(form.pay_category) === 'package'
  const editingIsPackage = editing && serviceKindFromPayCategory(editing.pay_category) === 'package'
  const scopeTitle =
    catalogScope === 'detailing'
      ? 'Detailing'
      : catalogScope === 'bay'
        ? 'Services & packages'
        : 'Catalog'
  const createLabel =
    catalogScope === 'detailing'
      ? 'Add detailing service'
      : catalogScope === 'bay'
        ? 'Add service or package'
        : 'Add catalog item'

  return (
    <section className={`flex flex-col gap-8 ${embedded ? '' : ''}`}>
      {!embedded && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Catalog</p>
          <h1 className="text-3xl font-semibold tracking-tight">Service management</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Services and packages share the POS bay tab. Detailing is separate (multi-day). Size pricing is
            optional per item.
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-muted-foreground">
          {catalogScope === 'detailing'
            ? 'Multi-day jobs (Ceramic, Tint, PPF, Paint Maintenance). Optional size pricing when rates differ by car size.'
            : 'Same-day bay work. Packages can bundle services or use a custom price. Flat price by default; size pricing optional.'}
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{createLabel}</CardTitle>
          <CardDescription>
            {catalogScope === 'detailing'
              ? 'Creates rows on the POS Detailing tab and Bookings board.'
              : 'Creates rows on the POS Services & packages tab. Packages = mixed services or custom price.'}
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
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Catalog price (₱)</Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                className="min-h-11"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                disabled={form.use_size_pricing}
              />
              {form.use_size_pricing ? (
                <p className="text-xs text-muted-foreground">Uses Medium (or first enabled size) as catalog price.</p>
              ) : null}
            </div>
            <div className="md:col-span-2 flex flex-col gap-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Shown on packages / custom notes"
              />
            </div>
            {isPackage ? (
              <PackageIncludesField
                services={services}
                value={form.included_service_ids}
                onChange={(included_service_ids) => setForm({ ...form, included_service_ids })}
              />
            ) : null}
            <OptionalSizePriceFields
              enabled={form.use_size_pricing}
              sizeEnabled={form.size_enabled}
              sizePrices={form.size_prices}
              onEnabledChange={(use_size_pricing) => setForm({ ...form, use_size_pricing })}
              onSizeEnabledChange={(size_enabled) => setForm({ ...form, size_enabled })}
              onPricesChange={(size_prices) => setForm({ ...form, size_prices })}
            />
            <Button type="submit" className="min-h-11 md:col-span-2" disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{scopeTitle}</CardTitle>
          <CardDescription>
            {scopedRows.length} active item{scopedRows.length === 1 ? '' : 's'} in this tab
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!scopedRows.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">
                    Nothing here yet — use the form above to create the first item.
                  </TableCell>
                </TableRow>
              ) : (
                scopedRows.map((s) => {
                  const kind = serviceKindFromPayCategory(s.pay_category)
                  const includes = (s.included_service_ids || []).map((id) => nameById[id] || id.slice(0, 6))
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.slug}</div>
                        {kind === 'package' && includes.length ? (
                          <div className="mt-1 text-[10px] text-muted-foreground">Includes: {includes.join(' · ')}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline">
                            {PAY_CATEGORY_OPTIONS.find((c) => c.value === (s.pay_category || 'general'))?.label
                              || s.pay_category}
                          </Badge>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{kind}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm tabular-nums">{formatSizePriceRange(s, formatMoney)}</div>
                        {serviceHasSizePricing(s) ? (
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                            {availablePricingSizes(s).map((sz) => (
                              <span key={sz.slug}>
                                {sz.label[0]} {formatMoney(s.size_prices?.[sz.slug])}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-muted-foreground">Flat</div>
                        )}
                      </TableCell>
                      <TableCell>{s.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="min-h-11" onClick={() => setEditing(formFromService(s))}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => toggleActive(s)}>
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => onArchive(s.id)}>
                            Archive
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {catalogScope !== 'detailing' ? <VehicleSizesPanel /> : null}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {catalogScope === 'detailing' ? 'detailing' : 'catalog'} item</DialogTitle>
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
                  value={editing.pay_category || defaultPayCategoryForCatalogScope(catalogScope)}
                  onValueChange={(pay_category) => setEditing({ ...editing, pay_category })}
                >
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Catalog price (₱)</Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  className="min-h-11"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  disabled={editing.use_size_pricing}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Description</Label>
                <Input
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </div>
              {editingIsPackage ? (
                <PackageIncludesField
                  services={services}
                  selfId={editing.id}
                  value={editing.included_service_ids}
                  onChange={(included_service_ids) => setEditing({ ...editing, included_service_ids })}
                />
              ) : null}
              <OptionalSizePriceFields
                enabled={editing.use_size_pricing}
                sizeEnabled={editing.size_enabled}
                sizePrices={editing.size_prices}
                onEnabledChange={(use_size_pricing) => setEditing({ ...editing, use_size_pricing })}
                onSizeEnabledChange={(size_enabled) => setEditing({ ...editing, size_enabled })}
                onPricesChange={(size_prices) => setEditing({ ...editing, size_prices })}
              />
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="min-h-11" disabled={saving}>
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

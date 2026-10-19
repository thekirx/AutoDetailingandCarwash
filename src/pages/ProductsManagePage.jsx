import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { archiveProduct, createProduct, listBranches, listProducts, updateProduct } from '@/lib/adminApi'
import { applyOwnerSetQty, applyRestockQty } from '@/lib/inventoryBranchStock'
import { formatBranchOnHandSummary, stockRowsByProductId } from '@/lib/inventoryLock'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MERCH_FAMILIES, productMatchesMerchFamily } from '@/lib/posSellables'
import { productSizeRows, sizeDraftFromOptions } from '@/lib/productSizes'
import { toast } from 'sonner'

const empty = { name: '', sku: '', category: 'merch', price: '', stock_qty: '0', branch_slug: '', tags: 'sellable,merch', usage_kind: 'resellable', sizes: [] }

function SizeFields({ rows, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Sizes</Label>
        <Button type="button" size="sm" variant="outline" className="min-h-11" disabled={disabled} onClick={() => onChange([...(rows || []), { label: '', price: '' }])}>
          Add size
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Optional. Leave this empty for one price. Each size has its own name and price, such as 12 oz or XL.</p>
      {(rows || []).map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
          <Input
            value={row.label}
            placeholder="Size name"
            aria-label={`Size ${index + 1} name`}
            disabled={disabled}
            onChange={(e) => onChange(rows.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))}
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            value={row.price}
            placeholder="₱"
            aria-label={`Size ${index + 1} price`}
            disabled={disabled}
            onChange={(e) => onChange(rows.map((item, i) => (i === index ? { ...item, price: e.target.value } : item)))}
          />
          <Button type="button" variant="ghost" className="min-h-11" disabled={disabled} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            Remove
          </Button>
        </div>
      ))}
    </div>
  )
}
const LOCKED_MSG = 'Inventory is locked. Ask Super Admin to unlock.'

export default function ProductsManagePage({ embedded = false, crudLocked = false, canMutate = true } = {}) {
  const { profile, user } = useAuth()
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [stockRows, setStockRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [familyFilter, setFamilyFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [branchQtyDraft, setBranchQtyDraft] = useState({})
  const [restockDraft, setRestockDraft] = useState({})

  const load = useCallback(async () => {
    try {
      const [p, b, stockRes] = await Promise.all([
        listProducts({ includeArchived: false }),
        listBranches(),
        supabase.from('product_branch_stock').select('product_id, branch_slug, qty'),
      ])
      if (stockRes.error) throw stockRes.error
      setProducts(p)
      setBranches(b)
      setStockRows(stockRes.data || [])
    } catch (err) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    if (canManageServices(profile)) load()
  }, [load, profile])

  const stockByProduct = useMemo(() => stockRowsByProductId(stockRows), [stockRows])
  const branchNames = useMemo(() => Object.fromEntries((branches || []).map((b) => [b.slug, b.name])), [branches])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((row) => {
      if (!productMatchesMerchFamily(row, familyFilter)) return false
      if (!q) return true
      const hay = `${row.name} ${row.sku || ''} ${(row.tags || []).join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, familyFilter, query])

  if (!canManageServices(profile)) {
    if (embedded) return null
    return <Navigate to="/operations/access-denied" replace />
  }

  function assertCanMutate() {
    if (canMutate) return true
    toast.error(LOCKED_MSG)
    return false
  }

  async function onCreate(event) {
    event.preventDefault()
    if (!assertCanMutate()) return
    setSaving(true)
    try {
      await createProduct({ ...form, branch_slug: form.branch_slug || null })
      toast.success('Merch item created')
      setForm(empty)
      setCreateOpen(false)
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
    if (!assertCanMutate()) return
    setSaving(true)
    try {
      await updateProduct(editing.id, {
        name: editing.name,
        sku: editing.sku,
        category: editing.category,
        price: editing.price,
        stock_qty: editing.stock_qty,
        branch_slug: editing.branch_slug || null,
        usage_kind: editing.usage_kind || 'resellable',
        tags: editing.tags,
        sizes: editing.sizes,
        is_active: editing.is_active,
        points_price: String(editing.usage_kind || 'resellable').toLowerCase() === 'internal' ? null : editing.points_price,
      })
      toast.success('Merch item updated')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row) {
    if (!assertCanMutate()) return
    try {
      await updateProduct(row.id, {
        name: row.name,
        sku: row.sku,
        category: row.category,
        price: Number(row.price_minor) / 100,
        stock_qty: row.stock_qty,
        branch_slug: row.branch_slug,
        tags: row.tags || [],
        is_active: !row.is_active,
      })
      toast.success(row.is_active ? 'Item deactivated' : 'Item activated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onArchive(id) {
    if (!assertCanMutate()) return
    if (!window.confirm('Archive this merch item?')) return
    try {
      await archiveProduct(id)
      toast.success('Item archived')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openEdit(row) {
    const rows = stockByProduct[row.id] || []
    const qtyDraft = {}
    const addDraft = {}
    for (const b of branches) {
      const hit = rows.find((r) => r.branch_slug === b.slug)
      qtyDraft[b.slug] = hit != null ? String(hit.qty) : ''
      addDraft[b.slug] = ''
    }
    setBranchQtyDraft(qtyDraft)
    setRestockDraft(addDraft)
    setEditing({
      id: row.id,
      name: row.name,
      sku: row.sku || '',
      category: row.category || 'merch',
      price: String(Number(row.price_minor) / 100),
      stock_qty: String(row.stock_qty ?? 0),
      branch_slug: row.branch_slug || '',
      usage_kind: row.usage_kind || 'resellable',
      tags: Array.isArray(row.tags) ? row.tags.join(',') : '',
      is_active: row.is_active,
      points_price: row.points_price == null ? '' : String(row.points_price),
      sizes: sizeDraftFromOptions(row.size_options),
    })
  }

  async function assignBranch(productId, branchSlug) {
    if (!assertCanMutate()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('product_branch_stock').insert({
        product_id: productId,
        branch_slug: branchSlug,
        qty: 0,
      })
      if (error) throw error
      toast.success(`Assigned to ${branchNames[branchSlug] || branchSlug}`)
      await load()
      setBranchQtyDraft((s) => ({ ...s, [branchSlug]: '0' }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function setBranchQty(productId, branchSlug) {
    if (!assertCanMutate()) return
    const next = applyOwnerSetQty(branchQtyDraft[branchSlug])
    setSaving(true)
    try {
      const existing = (stockByProduct[productId] || []).find((r) => r.branch_slug === branchSlug)
      const prev = existing ? Number(existing.qty) || 0 : 0
      if (!existing) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: productId,
          branch_slug: branchSlug,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', productId)
          .eq('branch_slug', branchSlug)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: productId,
        branch_slug: branchSlug,
        delta: next - prev,
        reason: 'owner_set',
        movement_type: 'owner_set',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(`On-hand set to ${next}`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function restockBranch(productId, branchSlug) {
    if (!assertCanMutate()) return
    const add = Math.max(0, Math.floor(Number(restockDraft[branchSlug]) || 0))
    if (add < 1) {
      toast.error('Enter a restock quantity')
      return
    }
    setSaving(true)
    try {
      const existing = (stockByProduct[productId] || []).find((r) => r.branch_slug === branchSlug)
      const current = existing ? Number(existing.qty) || 0 : null
      const next = applyRestockQty(current ?? 0, add)
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: productId,
          branch_slug: branchSlug,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', productId)
          .eq('branch_slug', branchSlug)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: productId,
        branch_slug: branchSlug,
        delta: add,
        reason: 'restock',
        movement_type: 'restock',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(`Restocked +${add}`)
      setRestockDraft((s) => ({ ...s, [branchSlug]: '' }))
      setBranchQtyDraft((s) => ({ ...s, [branchSlug]: String(next) }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      {!embedded ? (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Inventory</p>
            <h1 className="text-3xl font-semibold tracking-tight">Merch & products</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Branch on-hand lives on each product. Same name shares stock automatically (stock group).
            </p>
          </div>
          <Link to="/operations/pos" className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
            Open POS
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Edit branch on-hand on each row. POS sells only when that branch has a stock row.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add merch item</DialogTitle>
            <DialogDescription>Shows under Checkout → Merch on POS. Assign branch stock after create.</DialogDescription>
          </DialogHeader>
            <form onSubmit={onCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Microfiber towel set" disabled={!canMutate} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!canMutate} /></div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="merch-cat">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })} disabled={!canMutate}>
                    <SelectTrigger id="merch-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MERCH_FAMILIES.filter((f) => f.id !== 'all').map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} disabled={!canMutate} /><p className="text-xs text-muted-foreground">Used when this item has no sizes.</p></div>
              <SizeFields rows={form.sizes} onChange={(sizes) => setForm({ ...form, sizes })} disabled={!canMutate} />
              <div className="flex flex-col gap-2">
                <Label>Usage</Label>
                <Select value={form.usage_kind || 'resellable'} onValueChange={(v) => setForm({ ...form, usage_kind: v })} disabled={!canMutate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resellable">Resellable (POS)</SelectItem>
                    <SelectItem value="internal">Internal use (Sunday recon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sellable tags</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="sellable, merch, coffee, scents"
                  disabled={!canMutate}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button type="submit" className="min-h-11" disabled={saving || !canMutate}>{saving ? 'Saving…' : 'Save item'}</Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

        <Card className="planner-ticket">
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>{visible.length} of {products.length} items{crudLocked ? ' · locked' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Input
                className="min-h-11"
                placeholder="Search name, SKU, tag"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search merch"
              />
              <Select value={familyFilter} onValueChange={setFamilyFilter}>
                <SelectTrigger className="min-h-11 sm:w-56" aria-label="Filter merch family"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MERCH_FAMILIES.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" className="min-h-11 shrink-0" onClick={() => setCreateOpen(true)} disabled={!canMutate}>
                <Plus size={16} className="mr-1.5" aria-hidden />
                Add merch item
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Branch on-hand</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.sku || '—'}</TableCell>
                    <TableCell className="max-w-[10rem] truncate text-xs text-muted-foreground">
                      {(row.tags || []).join(', ') || '—'}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {productSizeRows(row).length
                        ? productSizeRows(row).map((s) => `${s.label} ${formatMoney(s.price_minor)}`).join(' · ')
                        : formatMoney(row.price_minor)}
                    </TableCell>
                    <TableCell className="max-w-[14rem] text-xs tabular-nums text-muted-foreground">
                      {formatBranchOnHandSummary(stockByProduct[row.id], branchNames)}
                    </TableCell>
                    <TableCell><Badge variant={row.is_active ? 'secondary' : 'outline'}>{row.is_active ? 'Active' : 'Off'}</Badge></TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>Edit</Button>
                      <Button size="sm" variant="ghost" disabled={!canMutate} onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</Button>
                      <Button size="sm" variant="ghost" disabled={!canMutate} onClick={() => onArchive(row.id)}>Archive</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!visible.length && (
                  <TableRow><TableCell colSpan={7} className="text-muted-foreground">No merch items match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit merch item</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} disabled={!canMutate} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>SKU</Label><Input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} disabled={!canMutate} /></div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-merch-cat">Category</Label>
                  <Select
                    value={['coffee', 'accessories', 'clothing', 'merch'].includes(editing.category) ? editing.category : 'merch'}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
                    disabled={!canMutate}
                  >
                    <SelectTrigger id="edit-merch-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MERCH_FAMILIES.filter((f) => f.id !== 'all').map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} disabled={!canMutate} /><p className="text-xs text-muted-foreground">Used when this item has no sizes.</p></div>
              <SizeFields rows={editing.sizes} onChange={(sizes) => setEditing({ ...editing, sizes })} disabled={!canMutate} />
              {String(editing.usage_kind || 'resellable').toLowerCase() !== 'internal' ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-merch-points">Points to buy</Label>
                  <Input
                    id="edit-merch-points"
                    type="number"
                    min="0"
                    step="1"
                    value={editing.points_price}
                    onChange={(e) => setEditing({ ...editing, points_price: e.target.value })}
                    disabled={!canMutate}
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label>Usage</Label>
                <Select
                  value={editing.usage_kind || 'resellable'}
                  onValueChange={(v) => setEditing({ ...editing, usage_kind: v })}
                  disabled={!canMutate}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resellable">Resellable (POS)</SelectItem>
                    <SelectItem value="internal">Internal use (Sunday recon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sellable tags</Label>
                <Input
                  value={editing.tags || ''}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="sellable, merch, coffee"
                  disabled={!canMutate}
                />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Branch on-hand</p>
                <p className="text-xs text-muted-foreground">POS sells only at branches with a stock row. Restock adds; Set writes absolute qty.</p>
                {branches.map((b) => {
                  const assigned = (stockByProduct[editing.id] || []).some((r) => r.branch_slug === b.slug)
                  return (
                    <div key={b.slug} className="flex flex-col gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{b.name}</span>
                        {!assigned ? (
                          <Button type="button" size="sm" variant="outline" disabled={saving || !canMutate} onClick={() => assignBranch(editing.id, b.slug)}>
                            Assign to branch
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Assigned</span>
                        )}
                      </div>
                      {assigned ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="0"
                              className="min-h-11"
                              aria-label={`${b.name} on-hand`}
                              value={branchQtyDraft[b.slug] ?? ''}
                              onChange={(e) => setBranchQtyDraft((s) => ({ ...s, [b.slug]: e.target.value }))}
                              disabled={!canMutate}
                            />
                            <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={saving || !canMutate} onClick={() => setBranchQty(editing.id, b.slug)}>
                              Set
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              min="1"
                              className="min-h-11"
                              aria-label={`${b.name} restock`}
                              placeholder="+ qty"
                              value={restockDraft[b.slug] ?? ''}
                              onChange={(e) => setRestockDraft((s) => ({ ...s, [b.slug]: e.target.value }))}
                              disabled={!canMutate}
                            />
                            <Button type="button" className="min-h-11 shrink-0" disabled={saving || !canMutate} onClick={() => restockBranch(editing.id, b.slug)}>
                              Restock
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving || !canMutate}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices } from '@/auth/permissions'
import { archiveProduct, createProduct, listBranches, listProducts, updateProduct } from '@/lib/adminApi'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MERCH_FAMILIES, productMatchesMerchFamily } from '@/lib/posSellables'
import { toast } from 'sonner'

const empty = { name: '', sku: '', category: 'merch', price: '', stock_qty: '0', branch_slug: '', tags: 'sellable,merch' }

export default function ProductsManagePage({ embedded = false }) {
  const { profile } = useAuth()
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [familyFilter, setFamilyFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const [p, b] = await Promise.all([listProducts({ includeArchived: false }), listBranches()])
      setProducts(p)
      setBranches(b)
    } catch (err) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    if (canManageServices(profile)) load()
  }, [load, profile])

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

  async function onCreate(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await createProduct({ ...form, branch_slug: form.branch_slug || null })
      toast.success('Merch item created')
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
      await updateProduct(editing.id, {
        name: editing.name,
        sku: editing.sku,
        category: editing.category,
        price: editing.price,
        stock_qty: editing.stock_qty,
        branch_slug: editing.branch_slug || null,
        is_active: editing.is_active,
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
    if (!window.confirm('Archive this merch item?')) return
    try {
      await archiveProduct(id)
      toast.success('Item archived')
      await load()
    } catch (err) {
      toast.error(err.message)
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
              Same product name shares stock automatically (stock group). Distinct SKU allowed for variants.
            </p>
          </div>
          <Link to="/operations/pos?tab=merch" className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted">
            Open POS merch
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Same name → shared stock pool. Different SKUs can still share stock when names match.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="planner-ticket">
          <CardHeader>
            <CardTitle>Add merch item</CardTitle>
            <CardDescription>Shows under Checkout → Merch on POS.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="flex flex-col gap-3">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Microfiber towel set" /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="merch-cat">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger id="merch-cat"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MERCH_FAMILIES.filter((f) => f.id !== 'all').map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Stock</Label><Input required type="number" min="0" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Branch (optional)</Label>
                <Select value={form.branch_slug || 'all'} onValueChange={(v) => setForm({ ...form, branch_slug: v === 'all' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sellable tags</Label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="sellable, merch, coffee, scents"
                />
                <p className="text-xs text-muted-foreground">
                  Branch Admin POS only sells tagged items (sellable, coffee, accessories, scents…).
                </p>
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save item'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="planner-ticket">
          <CardHeader>
            <CardTitle>Catalog</CardTitle>
            <CardDescription>{visible.length} of {products.length} items</CardDescription>
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
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
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
                    <TableCell className="tabular-nums">{formatMoney(row.price_minor)}</TableCell>
                    <TableCell className="tabular-nums">{row.stock_qty}</TableCell>
                    <TableCell><Badge variant={row.is_active ? 'secondary' : 'outline'}>{row.is_active ? 'Active' : 'Off'}</Badge></TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => setEditing({
                        id: row.id,
                        name: row.name,
                        sku: row.sku || '',
                        category: row.category || 'merch',
                        price: String(Number(row.price_minor) / 100),
                        stock_qty: String(row.stock_qty ?? 0),
                        branch_slug: row.branch_slug || '',
                        tags: Array.isArray(row.tags) ? row.tags.join(',') : '',
                        is_active: row.is_active,
                      })}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => onArchive(row.id)}>Archive</Button>
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
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit merch item</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2"><Label>Name</Label><Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>SKU</Label><Input value={editing.sku} onChange={(e) => setEditing({ ...editing, sku: e.target.value })} /></div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-merch-cat">Category</Label>
                  <Select
                    value={['coffee', 'accessories', 'clothing', 'merch'].includes(editing.category) ? editing.category : 'merch'}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>Price (₱)</Label><Input required type="number" min="0" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Stock</Label><Input required type="number" min="0" value={editing.stock_qty} onChange={(e) => setEditing({ ...editing, stock_qty: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Sellable tags</Label>
                <Input
                  value={editing.tags || ''}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="sellable, merch, coffee"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** BA restock + Sunday recon; SA/ASA also approve recon and set absolute qty. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices, canRestockInventory, getBranchScopeList } from '@/auth/permissions'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { BRANCH_STOCK_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { applyOwnerSetQty, applyReconLine, applyRestockQty, reconUsageQty } from '@/lib/inventoryBranchStock'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { supabase } from '@/lib/supabase'
import { fetchBranches } from '@/queue/queueApi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'

const BRANCH_STOCK_TABS = [
  { id: 'restock', label: 'Restock', icon: Package },
  { id: 'recon', label: 'Sunday Recon', icon: ClipboardCheck },
]

function mostRecentSunday(isoDate = getLocalCalendarDate()) {
  const d = new Date(`${isoDate}T12:00:00+08:00`)
  const day = d.getDay() // 0 Sun
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export default function BranchInventoryPage({ embedded = false } = {}) {
  const { profile, user } = useAuth()
  const canCatalog = canManageServices(profile)
  const scopeList = getBranchScopeList(profile)
  const [tab, setTab] = useState('restock')
  const [branches, setBranches] = useState([])
  const [branch, setBranch] = useState('')
  const [products, setProducts] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [restockQty, setRestockQty] = useState({})
  const [ownerQty, setOwnerQty] = useState({})
  const [leftoverQty, setLeftoverQty] = useState({})
  const [recons, setRecons] = useState([])
  const [saving, setSaving] = useState(false)

  const branchOptions = useMemo(() => {
    if (scopeList === null) return branches
    const allowed = new Set(scopeList || [])
    return branches.filter((b) => allowed.has(b.slug))
  }, [branches, scopeList])

  const load = useCallback(async () => {
    if (!branch) return
    try {
      const [prodRes, stockRes, reconRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, category, tags, usage_kind, is_active')
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('name'),
        supabase.from('product_branch_stock').select('product_id, qty').eq('branch_slug', branch),
        supabase
          .from('inventory_recons')
          .select('id, branch_slug, week_of, status, submitted_at, notes, inventory_recon_lines(id, product_id, previous_qty, leftover_qty)')
          .eq('branch_slug', branch)
          .order('submitted_at', { ascending: false })
          .limit(20),
      ])
      if (prodRes.error) throw prodRes.error
      if (stockRes.error) throw stockRes.error
      if (reconRes.error) throw reconRes.error
      setProducts(prodRes.data || [])
      const map = {}
      for (const row of stockRes.data || []) map[row.product_id] = Number(row.qty) || 0
      setStockByProduct(map)
      setRecons(reconRes.data || [])
    } catch (err) {
      toast.error(err.message)
    }
  }, [branch])

  useEffect(() => {
    if (!canRestockInventory(profile)) return
    fetchBranches()
      .then((rows) => {
        setBranches(rows || [])
        setBranch((cur) => {
          if (cur) return cur
          const opts = scopeList === null ? rows : (rows || []).filter((b) => (scopeList || []).includes(b.slug))
          return opts[0]?.slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [profile, scopeList])

  useEffect(() => {
    load()
  }, [load])

  const internalProducts = useMemo(
    () => products.filter((p) => String(p.usage_kind || '').toLowerCase() === 'internal'),
    [products],
  )

  async function onRestock(product) {
    const add = Math.max(0, Math.floor(Number(restockQty[product.id]) || 0))
    if (add < 1) {
      toast.error('Enter a restock quantity')
      return
    }
    setSaving(true)
    try {
      const current = stockByProduct[product.id]
      const next = applyRestockQty(current ?? 0, add)
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: product.id,
          branch_slug: branch,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', product.id)
          .eq('branch_slug', branch)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: product.id,
        branch_slug: branch,
        delta: add,
        reason: 'restock',
        movement_type: 'restock',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(`Restocked ${product.name} (+${add})`)
      setRestockQty((s) => ({ ...s, [product.id]: '' }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onOwnerSet(product) {
    if (!canCatalog) return
    const next = applyOwnerSetQty(ownerQty[product.id])
    setSaving(true)
    try {
      const current = stockByProduct[product.id]
      const prev = current ?? 0
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: product.id,
          branch_slug: branch,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', product.id)
          .eq('branch_slug', branch)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: product.id,
        branch_slug: branch,
        delta: next - prev,
        reason: 'owner_set',
        movement_type: 'owner_set',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(`Set ${product.name} to ${next}`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSubmitRecon() {
    if (!internalProducts.length) {
      toast.error('No internal-use products to reconcile')
      return
    }
    setSaving(true)
    try {
      const weekOf = mostRecentSunday()
      const { data: recon, error } = await supabase
        .from('inventory_recons')
        .insert({
          branch_slug: branch,
          week_of: weekOf,
          status: 'submitted',
          submitted_by: profile?.id || user?.id,
          notes: 'Sunday recon',
        })
        .select('id')
        .single()
      if (error) throw error
      const lines = internalProducts.map((p) => {
        const previous = Number(stockByProduct[p.id]) || 0
        const leftover = Math.max(0, Math.floor(Number(leftoverQty[p.id] ?? previous) || 0))
        return {
          recon_id: recon.id,
          product_id: p.id,
          previous_qty: previous,
          leftover_qty: leftover,
        }
      })
      const { error: lineErr } = await supabase.from('inventory_recon_lines').insert(lines)
      if (lineErr) throw lineErr
      toast.success('Sunday recon submitted')
      setLeftoverQty({})
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onApproveRecon(recon) {
    if (!canCatalog) return
    setSaving(true)
    try {
      const lines = recon.inventory_recon_lines || []
      for (const line of lines) {
        const { nextQty, delta } = applyReconLine({
          previousQty: line.previous_qty,
          leftoverQty: line.leftover_qty,
        })
        const { data: existing } = await supabase
          .from('product_branch_stock')
          .select('id, qty')
          .eq('product_id', line.product_id)
          .eq('branch_slug', recon.branch_slug)
          .maybeSingle()
        if (!existing) {
          const { error } = await supabase.from('product_branch_stock').insert({
            product_id: line.product_id,
            branch_slug: recon.branch_slug,
            qty: nextQty,
          })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('product_branch_stock')
            .update({ qty: nextQty })
            .eq('id', existing.id)
          if (error) throw error
        }
        const { error: movErr } = await supabase.from('product_stock_movements').insert({
          product_id: line.product_id,
          branch_slug: recon.branch_slug,
          delta,
          reason: 'recon_adjust',
          movement_type: 'recon_adjust',
          created_by: user?.id || profile?.id,
        })
        if (movErr) throw movErr
      }
      const { error: upErr } = await supabase
        .from('inventory_recons')
        .update({
          status: 'approved',
          reviewed_by: profile?.id || user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', recon.id)
      if (upErr) throw upErr
      toast.success('Recon approved — branch stock updated')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onRejectRecon(recon) {
    if (!canCatalog) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('inventory_recons')
        .update({
          status: 'rejected',
          reviewed_by: profile?.id || user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', recon.id)
      if (error) throw error
      toast.success('Recon rejected')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!canRestockInventory(profile)) return null

  const branchStockStepIcons = {
    restock: Package,
    recon: ClipboardCheck,
    pos: Package,
    approve: ClipboardCheck,
  }

  const body = (
    <>
      {!embedded ? (
        <OpsGuideCard
          title="How branch stock works"
          description="Restock when shipment arrives. Submit Sunday recon for owner approval."
          steps={BRANCH_STOCK_WORKFLOW_STEPS}
          stepIcons={branchStockStepIcons}
          defaultOpen={tab === 'restock'}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[12rem] flex-col gap-1">
          <Label>Branch</Label>
          <Select value={branch} onValueChange={setBranch} disabled={!branchOptions.length}>
            <SelectTrigger>
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branchOptions.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.name || b.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <OpsTabList tabs={BRANCH_STOCK_TABS} aria-label="Branch stock" />

        <TabsContent value="restock" className="mt-0 outline-none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead>Add</TableHead>
                {canCatalog && <TableHead>Set qty</TableHead>}
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-medium">{p.name}</div>
                    {p.sku ? <div className="text-xs text-muted-foreground">{p.sku}</div> : null}
                  </TableCell>
                  <TableCell className="capitalize">{p.usage_kind || 'resellable'}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {stockByProduct[p.id] == null ? '—' : stockByProduct[p.id]}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      className="w-24"
                      value={restockQty[p.id] ?? ''}
                      onChange={(e) => setRestockQty((s) => ({ ...s, [p.id]: e.target.value }))}
                    />
                  </TableCell>
                  {canCatalog && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={ownerQty[p.id] ?? ''}
                          onChange={(e) => setOwnerQty((s) => ({ ...s, [p.id]: e.target.value }))}
                        />
                        <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => onOwnerSet(p)}>
                          Set
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Button type="button" size="sm" disabled={saving} onClick={() => onRestock(p)}>
                      Restock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="recon" className="mt-0 outline-none space-y-6">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Enter leftover qty for internal-use items (week of {mostRecentSunday()}). Usage = previous − leftover.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Internal product</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead>Leftover</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {internalProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No products tagged usage_kind = internal.
                    </TableCell>
                  </TableRow>
                ) : (
                  internalProducts.map((p) => {
                    const prev = Number(stockByProduct[p.id]) || 0
                    const left = leftoverQty[p.id] ?? String(prev)
                    return (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{prev}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            className="w-28"
                            value={left}
                            onChange={(e) => setLeftoverQty((s) => ({ ...s, [p.id]: e.target.value }))}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{reconUsageQty(prev, left)}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            <Button className="mt-3" type="button" disabled={saving || !internalProducts.length} onClick={onSubmitRecon}>
              Submit Sunday recon
            </Button>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold tracking-wide uppercase">Recent recons</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {recons.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.week_of}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                    <TableCell>{(r.inventory_recon_lines || []).length}</TableCell>
                    <TableCell className="space-x-2">
                      {canCatalog && r.status === 'submitted' ? (
                        <>
                          <Button type="button" size="sm" disabled={saving} onClick={() => onApproveRecon(r)}>
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onRejectRecon(r)}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )

  if (embedded) return body

  return (
    <OpsPageShell
      className="hakum-inventory-branch"
      eyebrow="Branch stock"
      title="Inventory"
      description="Restock arrivals and Sunday leftover recon for your branch."
    >
      {body}
    </OpsPageShell>
  )
}

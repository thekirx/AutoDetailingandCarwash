/** BA restock + Sunday recon; SA/ASA also approve recon and set absolute qty. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, Info, Package, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices, canModifyStock, canRestockInventory, getBranchScopeList } from '@/auth/permissions'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { BRANCH_STOCK_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import {
  aggregateBranchStockMap,
  applyOwnerSetQty,
  applyReconLine,
  applyRestockQty,
  branchAssignmentRows,
  buildReconApprovalMutations,
  filterOperationalBranches,
  reconUsageQty,
} from '@/lib/inventoryBranchStock'
import { LOW_STOCK_THRESHOLD, RESTOCK_POLICY_NOTICE, STOCK_CATEGORIES, materialRoleLabel, stockCategoryLabel } from '@/lib/inventoryCatalog'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { fetchBranches } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const LOCKED_MSG = 'Inventory is locked. Ask Super Admin to unlock.'

export default function BranchInventoryPage({
  embedded = false,
  defaultTab = 'restock',
  crudLocked = false,
  canMutate = true,
} = {}) {
  const { profile, user } = useAuth()
  const canCatalog = canManageServices(profile)
  const canEditStock = canModifyStock(profile)
  const scopeList = getBranchScopeList(profile)
  const [tab, setTab] = useState(defaultTab === 'recon' ? 'recon' : 'restock')
  const [stockFilter, setStockFilter] = useState('assigned')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [branches, setBranches] = useState([])
  const [branch, setBranch] = useState('')
  const [products, setProducts] = useState([])
  const [stockByProduct, setStockByProduct] = useState({})
  const [unsizedStockByProduct, setUnsizedStockByProduct] = useState({})
  const [restockQty, setRestockQty] = useState({})
  const [pointPrice, setPointPrice] = useState({})
  const [ownerQty, setOwnerQty] = useState({})
  const [moveTo, setMoveTo] = useState({})
  const [leftoverQty, setLeftoverQty] = useState({})
  const [recons, setRecons] = useState([])
  const [pendingRestocks, setPendingRestocks] = useState([])
  const [saving, setSaving] = useState(false)

  const branchOptions = useMemo(() => {
    if (scopeList === null) return branches
    const allowed = new Set(scopeList || [])
    return branches.filter((b) => allowed.has(b.slug))
  }, [branches, scopeList])

  const load = useCallback(async () => {
    if (!branch) return
    try {
      const [prodRes, stockRes, reconRes, restockRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, sku, category, tags, usage_kind, stock_category, material_role, show_in_pos, is_active, points_price')
          .eq('is_active', true)
          .eq('is_archived', false)
          .order('name'),
        supabase.from('product_branch_stock').select('product_id, qty, size_key').eq('branch_slug', branch),
        supabase
          .from('inventory_recons')
          .select('id, branch_slug, week_of, status, submitted_at, notes, inventory_recon_lines(id, product_id, previous_qty, leftover_qty)')
          .eq('branch_slug', branch)
          .order('submitted_at', { ascending: false })
          .limit(20),
        supabase
          .from('restock_requests')
          .select('id, product_id, add_qty, branch_slug, created_at, status, products(name)')
          .eq('branch_slug', branch)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ])
      if (prodRes.error) throw prodRes.error
      if (stockRes.error) throw stockRes.error
      if (reconRes.error) throw reconRes.error
      if (restockRes.error) throw restockRes.error
      setProducts(prodRes.data || [])
      const points = {}
      for (const row of prodRes.data || []) {
        if (String(row.usage_kind || '').toLowerCase() === 'internal') continue
        points[row.id] = row.points_price == null ? '' : String(row.points_price)
      }
      setPointPrice(points)
      const agg = aggregateBranchStockMap(stockRes.data || [])
      setStockByProduct(agg.totalsByProductId)
      setUnsizedStockByProduct(agg.unsizedByProductId)
      setRecons(reconRes.data || [])
      setPendingRestocks(restockRes.data || [])
    } catch (err) {
      toast.error(err.message)
    }
  }, [branch])

  useEffect(() => {
    if (!canRestockInventory(profile)) return
    fetchBranches()
      .then((rows) => {
        const opRows = filterOperationalBranches(rows || [])
        setBranches(opRows)
        setBranch((cur) => {
          if (cur && opRows.some((b) => b.slug === cur)) return cur
          const opts = scopeList === null ? opRows : opRows.filter((b) => (scopeList || []).includes(b.slug))
          return opts[0]?.slug || ''
        })
      })
      .catch((err) => toast.error(err.message))
  }, [profile, scopeList])

  useEffect(() => {
    load()
  }, [load])

  const internalProducts = useMemo(
    () => products.filter((p) => String(p.usage_kind || '').toLowerCase() === 'internal' || p.stock_category === 'chemical'),
    [products],
  )

  const branchKpis = useMemo(() => {
    let totalUnits = 0
    let lowStockCount = 0
    let chemUnits = 0
    for (const p of products) {
      const qty = Number(stockByProduct[p.id]) || 0
      totalUnits += qty
      if (p.stock_category === 'chemical') chemUnits += qty
      if (qty <= LOW_STOCK_THRESHOLD) lowStockCount++
    }
    return { totalUnits, lowStockCount, chemUnits }
  }, [products, stockByProduct])

  const visibleProducts = useMemo(() => {
    const baseFilter =
      stockFilter === 'needs_restock' || stockFilter === 'out_of_stock'
        ? 'assigned'
        : stockFilter
    const rows = branchAssignmentRows(products, stockByProduct, baseFilter)
    let filtered = rows
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((r) => (r.stock_category || 'merchandise') === categoryFilter)
    }
    if (stockFilter === 'needs_restock') {
      filtered = filtered.filter((r) => (Number(r.on_hand) || 0) <= LOW_STOCK_THRESHOLD)
    } else if (stockFilter === 'out_of_stock') {
      filtered = filtered.filter((r) => (Number(r.on_hand) || 0) <= 0)
    }
    return filtered
  }, [products, stockByProduct, stockFilter, categoryFilter])

  const pointItems = useMemo(
    () => branchAssignmentRows(products, stockByProduct, 'assigned'),
    [products, stockByProduct],
  )

  async function saveAccessoryPoints(product) {
    if (!assertCanMutate()) return
    const points = Math.floor(Number(pointPrice[product.id]))
    if (!Number.isFinite(points) || points < 0) {
      toast.error('Enter a point price, or 0 to hide it from the shop.')
      return
    }
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/accessory-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ product_id: product.id, points_price: points }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not save points')
      toast.success(`${product.name} is ${points === 0 ? 'hidden from the shop' : `${points} points`}`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function assertCanMutate() {
    if (canMutate) return true
    toast.error(LOCKED_MSG)
    return false
  }

  async function assignToBranch(product) {
    if (!branch || stockByProduct[product.id] != null) return
    if (!assertCanMutate()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('product_branch_stock').insert({
        product_id: product.id,
        branch_slug: branch,
        size_key: '',
        qty: 0,
      })
      if (error) throw error
      toast.success(`${product.name} is on this branch`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeFromBranch(product) {
    if (!canCatalog) return
    if (!assertCanMutate()) return
    const onHand = Number(stockByProduct[product.id]) || 0
    if (onHand > 0) {
      toast.error('Set on-hand to 0 before removing it from this branch.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('product_branch_stock')
        .delete()
        .eq('product_id', product.id)
        .eq('branch_slug', branch)
      if (error) throw error
      toast.success(`${product.name} is off this branch`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onRestock(product) {
    if (!assertCanMutate()) return
    const add = Math.max(0, Math.floor(Number(restockQty[product.id]) || 0))
    if (add < 1) {
      toast.error('Enter a restock quantity')
      return
    }

    if (!canEditStock) {
      setSaving(true)
      try {
        const { error } = await supabase.rpc('request_restock', {
          p_product: product.id,
          p_branch: branch,
          p_qty: add,
        })
        if (error) throw error
        toast.success(`Restock request for ${add} ${product.name} submitted. Sent to Super Admin for approval before reconciling.`)
        setRestockQty((s) => ({ ...s, [product.id]: '' }))
        await load()
      } catch (err) {
        toast.error(err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      const current = unsizedStockByProduct[product.id]
      const next = applyRestockQty(current ?? 0, add)
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: product.id,
          branch_slug: branch,
          size_key: '',
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', product.id)
          .eq('branch_slug', branch)
          .eq('size_key', '')
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: product.id,
        branch_slug: branch,
        size_key: '',
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

  async function onTransfer(product) {
    if (!canCatalog) return
    if (!assertCanMutate()) return
    const qty = Number(restockQty[product.id])
    const dest = moveTo[product.id]
    if (!dest || dest === branch) {
      toast.error('Pick another branch.')
      return
    }
    if (!Number.isInteger(qty) || qty < 1) {
      toast.error('Enter how many to move in the add box.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('transfer_branch_stock', {
        p_product: product.id,
        p_from: branch,
        p_to: dest,
        p_qty: qty,
      })
      if (error) throw error
      toast.success(`Moved ${qty} of ${product.name}`)
      setRestockQty((s) => ({ ...s, [product.id]: '' }))
      setMoveTo((s) => ({ ...s, [product.id]: '' }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onOwnerSet(product) {
    if (!canEditStock) {
      toast.error('Only Owner, Lucy, and Robert can modify stock counts directly.')
      return
    }
    if (!assertCanMutate()) return
    const next = applyOwnerSetQty(ownerQty[product.id])
    setSaving(true)
    try {
      const current = unsizedStockByProduct[product.id]
      const prev = current ?? 0
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: product.id,
          branch_slug: branch,
          size_key: '',
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', product.id)
          .eq('branch_slug', branch)
          .eq('size_key', '')
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: product.id,
        branch_slug: branch,
        size_key: '',
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

  async function onApproveRestock(request) {
    if (!canEditStock) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('review_restock', {
        p_id: request.id,
        p_decision: 'approved',
      })
      if (error) throw error
      toast.success(`Restock approved for ${request.products?.name || 'item'} (+${request.add_qty})`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onRejectRestock(request) {
    if (!canEditStock) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('review_restock', {
        p_id: request.id,
        p_decision: 'rejected',
      })
      if (error) throw error
      toast.success('Restock request declined')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onSubmitRecon() {
    if (!assertCanMutate()) return
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
    if (!assertCanMutate()) return
    if (!canCatalog) return
    setSaving(true)
    try {
      const lines = recon.inventory_recon_lines || []
      const { stockUpserts, movements } = buildReconApprovalMutations(lines, unsizedStockByProduct, {
        branchSlug: recon.branch_slug,
        userId: user?.id || profile?.id,
      })
      if (stockUpserts.length > 0) {
        const { error: upStockErr } = await supabase
          .from('product_branch_stock')
          .upsert(stockUpserts, { onConflict: 'product_id,branch_slug,size_key' })
        if (upStockErr) throw upStockErr
      }
      if (movements.length > 0) {
        const { error: movErr } = await supabase
          .from('product_stock_movements')
          .insert(movements)
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
    if (!assertCanMutate()) return
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
      {crudLocked ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" role="status">
          Inventory is locked.{canMutate ? ' You can still edit as Super Admin.' : ' Ask Super Admin to unlock before restock or recon.'}
        </p>
      ) : null}

      {!embedded ? (
        <OpsGuideCard
          title="How branch stock works"
          description="Branch admin restocks wait for Super Admin approval before reconciling to total inventory. Sunday recon covers internal materials."
          steps={BRANCH_STOCK_WORKFLOW_STEPS}
          stepIcons={branchStockStepIcons}
          defaultOpen={tab === 'restock'}
        />
      ) : null}

      {/* Inventory Restock Policy Callout */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4 text-foreground">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
            Inventory Restock &amp; Bulk Purchasing Policy
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {RESTOCK_POLICY_NOTICE}
          </p>
        </div>
      </div>

      {/* Branch KPI Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Branch Total Units
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {branchKpis.totalUnits.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">On-hand at this branch</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Package size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer border-border transition-colors hover:border-amber-500/60 ${
            stockFilter === 'needs_restock' ? 'ring-2 ring-amber-500' : ''
          }`}
          onClick={() => setStockFilter((cur) => (cur === 'needs_restock' ? 'assigned' : 'needs_restock'))}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Needs Restock
              </p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {branchKpis.lowStockCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stockFilter === 'needs_restock' ? 'Filtered (click to reset)' : `≤ ${LOW_STOCK_THRESHOLD} units on-hand`}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer border-border transition-colors hover:border-blue-500/60 ${
            categoryFilter === 'chemical' ? 'ring-2 ring-blue-500' : ''
          }`}
          onClick={() => setCategoryFilter((cur) => (cur === 'chemical' ? 'all' : 'chemical'))}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Chemicals On-Hand
              </p>
              <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {branchKpis.chemUnits.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {categoryFilter === 'chemical' ? 'Filtered (click to reset)' : 'Bulk purchase in Finance'}
              </p>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
              <Sparkles size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pending Restocks
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {pendingRestocks.length}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {canEditStock ? 'Waiting for review below' : 'Awaiting Super Admin'}
              </p>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 text-foreground">
              <Clock size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch and Filters Bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-[12rem] flex-col gap-1">
          <Label htmlFor="branch-stock-branch">Branch</Label>
          <Select value={branch} onValueChange={setBranch} disabled={!branchOptions.length}>
            <SelectTrigger id="branch-stock-branch">
              <SelectValue placeholder="Choose a branch" />
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

        <div className="flex min-w-[10rem] flex-col gap-1">
          <Label htmlFor="branch-stock-category">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="branch-stock-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {STOCK_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-[10rem] flex-col gap-1">
          <Label htmlFor="branch-stock-filter">Show</Label>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger id="branch-stock-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="assigned">At this branch</SelectItem>
              <SelectItem value="needs_restock">Needs Restock (≤ {LOW_STOCK_THRESHOLD} units)</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock (0 units)</SelectItem>
              <SelectItem value="unassigned">Not at this branch</SelectItem>
              <SelectItem value="accessories">Accessories</SelectItem>
              <SelectItem value="sellables">Sellables</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <OpsTabList tabs={BRANCH_STOCK_TABS} aria-label="Branch stock" />

        <TabsContent value="restock" className="mt-0 outline-none space-y-6">
          {/* Pending Restocks Approval Card */}
          {pendingRestocks.length ? (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-amber-600 dark:text-amber-400" />
                    <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-200">
                      Restock Requests Waiting for Approval ({pendingRestocks.length})
                    </CardTitle>
                  </div>
                  <Badge variant="outline" className="border-amber-500/40 text-xs text-amber-700 dark:text-amber-300">
                    {canEditStock ? 'Review required' : 'Pending Super Admin'}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  {canEditStock
                    ? 'Branch Admins requested to restock these items. Approving will reconcile the quantity directly into branch on-hand.'
                    : 'Your submitted restock requests are waiting for approval by Owner, Lucy, or Robert before reconciling.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y divide-border/60" aria-label="Restock waiting">
                  {pendingRestocks.map((row) => (
                    <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium text-foreground">{row.products?.name || 'Item'}</div>
                        <p className="text-xs text-muted-foreground">
                          Add: <strong className="text-foreground">+{row.add_qty} units</strong> · Submitted {new Date(row.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {canEditStock ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={saving}
                            onClick={() => onApproveRestock(row)}
                          >
                            <CheckCircle2 size={14} /> Approve (+{row.add_qty})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 text-destructive hover:bg-destructive/10"
                            disabled={saving}
                            onClick={() => onRejectRestock(row)}
                          >
                            <XCircle size={14} /> Decline
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="self-start text-xs text-amber-700 dark:text-amber-300">
                          Awaiting approval
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead>Add (+)</TableHead>
                {canEditStock && <TableHead>Set Qty</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEditStock ? 6 : 5} className="text-muted-foreground">
                    {stockFilter === 'unassigned'
                      ? 'Every item in this category is already on this branch.'
                      : 'Nothing on this branch matches the current filters.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {p.sku ? <span>{p.sku}</span> : null}
                        {p.stock_category === 'coffee_menu' ? (
                          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">
                            Recipe: 1 Cup + 20g Beans
                          </Badge>
                        ) : null}
                        {p.material_role ? (
                          <Badge variant="outline" className="border-orange-500/40 text-[10px] text-orange-600 dark:text-orange-400">
                            Role: {materialRoleLabel(p.material_role)}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {stockCategoryLabel(p.stock_category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {p.on_hand == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : p.on_hand > LOW_STOCK_THRESHOLD ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.on_hand}</span>
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                            In Stock
                          </Badge>
                        </div>
                      ) : p.on_hand > 0 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-amber-600 dark:text-amber-400 font-bold">{p.on_hand}</span>
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
                            Low Stock
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-destructive font-bold">0</span>
                          <Badge variant="destructive" className="text-[10px] uppercase">
                            Out
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        className="w-24"
                        placeholder="+ qty"
                        value={restockQty[p.id] ?? ''}
                        disabled={!p.assigned}
                        onChange={(e) => setRestockQty((s) => ({ ...s, [p.id]: e.target.value }))}
                      />
                    </TableCell>
                    {canEditStock && (
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            placeholder="Set"
                            value={ownerQty[p.id] ?? ''}
                            disabled={!p.assigned}
                            onChange={(e) => setOwnerQty((s) => ({ ...s, [p.id]: e.target.value }))}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saving || !p.assigned}
                            onClick={() => onOwnerSet(p)}
                          >
                            Set
                          </Button>
                          <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                            aria-label={`Move ${p.name} to another branch`}
                            value={moveTo[p.id] || ''}
                            disabled={!p.assigned || saving}
                            onChange={(e) => setMoveTo((s) => ({ ...s, [p.id]: e.target.value }))}
                          >
                            <option value="">Move to</option>
                            {branches
                              .filter((b) => b.slug !== branch)
                              .map((b) => (
                                <option key={b.slug} value={b.slug}>
                                  {b.name}
                                </option>
                              ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saving || !p.assigned}
                            onClick={() => onTransfer(p)}
                          >
                            Move
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {p.assigned ? (
                          <Button
                            type="button"
                            size="sm"
                            className="min-h-9"
                            disabled={saving}
                            onClick={() => onRestock(p)}
                          >
                            {canEditStock ? 'Restock' : 'Request Restock'}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            disabled={saving || !branch}
                            onClick={() => assignToBranch(p)}
                          >
                            Assign to branch
                          </Button>
                        )}
                        {canCatalog && p.assigned ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={saving}
                            onClick={() => removeFromBranch(p)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Point Prices Section */}
          <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-semibold text-foreground">Point Prices (Voucher Shop)</h2>
            <p className="text-sm text-muted-foreground">
              When a customer redeems an accessory or merchandise item for points, the item is automatically deducted from this branch&apos;s inventory. Point price 0 hides it from the voucher shop.
            </p>
            {pointItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing is assigned to this branch yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pointItems.map((product) => (
                  <div key={product.id} className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-foreground">{product.name}</span>
                      <span className="text-xs text-muted-foreground">On-hand: {product.on_hand ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`points-${product.id}`}
                        type="number"
                        min="0"
                        className="h-9 w-24 text-xs"
                        placeholder="Points"
                        value={pointPrice[product.id] ?? ''}
                        onChange={(e) => setPointPrice((s) => ({ ...s, [product.id]: e.target.value }))}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 text-xs"
                        disabled={saving}
                        onClick={() => saveAccessoryPoints(product)}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                      No products tagged usage_kind = internal or stock_category = chemical.
                    </TableCell>
                  </TableRow>
                ) : (
                  internalProducts.map((p) => {
                    const prev = Number(stockByProduct[p.id]) || 0
                    const left = leftoverQty[p.id] ?? String(prev)
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted-foreground">{stockCategoryLabel(p.stock_category)}</div>
                        </TableCell>
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
            <Button
              className="mt-3"
              type="button"
              disabled={saving || !internalProducts.length}
              onClick={onSubmitRecon}
            >
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recons.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.week_of}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                    <TableCell>{(r.inventory_recon_lines || []).length}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      {canCatalog && r.status === 'submitted' ? (
                        <>
                          <Button type="button" size="sm" disabled={saving} onClick={() => onApproveRecon(r)}>
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => onRejectRecon(r)}
                          >
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
      description="Restock arrivals and Sunday leftover recon for your branch. Restocks require Super Admin approval."
    >
      {body}
    </OpsPageShell>
  )
}

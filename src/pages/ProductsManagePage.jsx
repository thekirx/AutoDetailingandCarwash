import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canManageServices, canModifyStock } from '@/auth/permissions'
import { archiveProduct, createProduct, listBranches, listProducts, updateProduct } from '@/lib/adminApi'
import { applyOwnerSetQty, applyRestockQty } from '@/lib/inventoryBranchStock'
import { formatBranchOnHandSummary, stockRowsByProductId } from '@/lib/inventoryLock'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Clock, Coffee, Info, Layers, Package, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MERCH_FAMILIES, productMatchesMerchFamily } from '@/lib/posSellables'
import {
  LOW_STOCK_THRESHOLD,
  MATERIAL_ROLES,
  RESTOCK_POLICY_NOTICE,
  STOCK_CATEGORIES,
  computeProductTotalOnHand,
  evaluateStockStatus,
  materialRoleLabel,
  stockCategoryHidesFromPos,
} from '@/lib/inventoryCatalog'
import {
  branchAssignedForProduct,
  findBranchSizeStock,
  productSizeKey,
  productSizeRows,
  productStockSizeKeys,
  sizeDraftFromOptions,
} from '@/lib/productSizes'
import { toast } from 'sonner'

const empty = {
  name: '',
  sku: '',
  category: 'merch',
  price: '',
  stock_qty: '0',
  branch_slug: '',
  tags: 'sellable,merch',
  usage_kind: 'resellable',
  stock_category: 'merchandise',
  show_in_pos: true,
  material_role: '',
  sizes: [],
}

function SizeFields({ rows, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Sizes</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={() => onChange([...(rows || []), { label: '', price: '' }])}
        >
          Add size
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Optional. Leave empty for one price. Each size has its own name, price, and branch on-hand (12 oz, M, XL).
      </p>
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
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            disabled={disabled}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
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
  const canEditStock = canModifyStock(profile)
  const [products, setProducts] = useState([])
  const [branches, setBranches] = useState([])
  const [stockRows, setStockRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [branchQtyDraft, setBranchQtyDraft] = useState({})
  const [restockDraft, setRestockDraft] = useState({})
  const [inlineQuickDraft, setInlineQuickDraft] = useState({})
  const [pendingRestocksCount, setPendingRestocksCount] = useState(0)

  const load = useCallback(async () => {
    try {
      const [p, b, stockRes, restockRes] = await Promise.all([
        listProducts({ includeArchived: false }),
        listBranches(),
        supabase.from('product_branch_stock').select('product_id, branch_slug, qty, size_key'),
        supabase.from('restock_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ])
      if (stockRes.error) throw stockRes.error
      setProducts(p)
      setBranches(b)
      setStockRows(stockRes.data || [])
      setPendingRestocksCount(restockRes.error ? 0 : Number(restockRes.count) || 0)
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
      if (categoryFilter !== 'all') {
        const cat = row.stock_category || 'merchandise'
        if (cat !== categoryFilter) return false
      }
      if (!productMatchesMerchFamily(row, familyFilter)) return false
      if (q) {
        const hay = `${row.name} ${row.sku || ''} ${(row.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      const rows = stockByProduct[row.id] || []
      const totalQty = computeProductTotalOnHand(rows)

      if (selectedBranch === 'all') {
        if (availabilityFilter === 'in_stock') {
          if (totalQty <= LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'low_stock') {
          if (totalQty <= 0 || totalQty > LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'needs_restock') {
          if (totalQty > LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'out_of_stock') {
          if (totalQty > 0) return false
        }
      } else {
        const branchMatches = rows.filter((r) => r.branch_slug === selectedBranch)
        const isAssigned = branchMatches.length > 0
        const branchQty = branchMatches.reduce((acc, r) => acc + (Number(r.qty) || 0), 0)

        if (availabilityFilter === 'in_stock') {
          if (!isAssigned || branchQty <= LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'low_stock') {
          if (!isAssigned || branchQty <= 0 || branchQty > LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'needs_restock') {
          if (!isAssigned || branchQty > LOW_STOCK_THRESHOLD) return false
        } else if (availabilityFilter === 'out_of_stock') {
          if (!isAssigned || branchQty > 0) return false
        } else if (availabilityFilter === 'unassigned') {
          if (isAssigned) return false
        }
      }
      return true
    })
  }, [products, categoryFilter, familyFilter, query, selectedBranch, stockByProduct, availabilityFilter])

  const categoryCounts = useMemo(() => {
    const counts = { all: products.length, merchandise: 0, coffee_menu: 0, coffee_material: 0, chemical: 0 }
    for (const p of products) {
      const cat = p.stock_category || 'merchandise'
      if (counts[cat] !== undefined) counts[cat]++
    }
    return counts
  }, [products])

  const inventoryKpis = useMemo(() => {
    let totalUnits = 0
    let needsRestockCount = 0
    let chemicalUnits = 0

    for (const p of products) {
      const rows = stockByProduct[p.id] || []
      const branchRows = selectedBranch === 'all'
        ? rows
        : rows.filter((r) => r.branch_slug === selectedBranch)
      const qty = branchRows.reduce((acc, r) => acc + Math.max(0, Number(r.qty) || 0), 0)
      totalUnits += qty

      if (p.stock_category === 'chemical') {
        chemicalUnits += qty
      }

      if (selectedBranch === 'all') {
        if (qty <= LOW_STOCK_THRESHOLD) needsRestockCount++
      } else {
        const isAssigned = branchRows.length > 0
        if (isAssigned && qty <= LOW_STOCK_THRESHOLD) needsRestockCount++
      }
    }

    return { totalUnits, needsRestockCount, chemicalUnits }
  }, [products, stockByProduct, selectedBranch])

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
      await createProduct({
        ...form,
        branch_slug: form.branch_slug || null,
        material_role: form.stock_category === 'coffee_material' ? form.material_role || null : null,
      })
      toast.success('Product created')
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
        stock_category: editing.stock_category,
        show_in_pos: editing.show_in_pos,
        material_role: editing.stock_category === 'coffee_material' ? editing.material_role || null : null,
        is_active: editing.is_active,
        points_price: String(editing.usage_kind || 'resellable').toLowerCase() === 'internal' ? null : editing.points_price,
      })
      toast.success('Product updated')
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
    if (!window.confirm('Archive this item?')) return
    try {
      await archiveProduct(id)
      toast.success('Item archived')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function stockDraftKey(branchSlug, sizeKey = '') {
    return sizeKey ? `${branchSlug}::${sizeKey}` : branchSlug
  }

  function openEdit(row) {
    const rows = stockByProduct[row.id] || []
    const keys = productStockSizeKeys(row)
    const qtyDraft = {}
    const addDraft = {}
    for (const b of branches) {
      for (const sizeKey of keys) {
        const hit = findBranchSizeStock(rows, b.slug, sizeKey)
        const dk = stockDraftKey(b.slug, sizeKey)
        qtyDraft[dk] = hit != null ? String(hit.qty) : ''
        addDraft[dk] = ''
      }
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
      stock_category: row.stock_category || 'merchandise',
      show_in_pos: row.show_in_pos !== false,
      material_role: row.material_role || '',
      tags: Array.isArray(row.tags) ? row.tags.join(',') : '',
      is_active: row.is_active,
      points_price: row.points_price == null ? '' : String(row.points_price),
      sizes: sizeDraftFromOptions(row.size_options),
      size_options: row.size_options,
    })
  }

  async function assignBranch(productId, branchSlug) {
    if (!assertCanMutate()) return
    const product = products.find((p) => p.id === productId) || editing
    const keys = productStockSizeKeys(product)
    setSaving(true)
    try {
      const { error } = await supabase.from('product_branch_stock').insert(
        keys.map((size_key) => ({
          product_id: productId,
          branch_slug: branchSlug,
          size_key,
          qty: 0,
        })),
      )
      if (error) throw error
      toast.success(`Assigned to ${branchNames[branchSlug] || branchSlug}`)
      await load()
      setBranchQtyDraft((s) => {
        const next = { ...s }
        for (const sizeKey of keys) next[stockDraftKey(branchSlug, sizeKey)] = '0'
        return next
      })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function setBranchQty(productId, branchSlug, sizeKey = '') {
    if (!assertCanMutate()) return
    const dk = stockDraftKey(branchSlug, sizeKey)
    const next = applyOwnerSetQty(branchQtyDraft[dk])
    const key = productSizeKey(sizeKey)
    setSaving(true)
    try {
      const existing = findBranchSizeStock(stockByProduct[productId] || [], branchSlug, key)
      const prev = existing ? Number(existing.qty) || 0 : 0
      if (!existing) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: productId,
          branch_slug: branchSlug,
          size_key: key,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', productId)
          .eq('branch_slug', branchSlug)
          .eq('size_key', key)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: productId,
        branch_slug: branchSlug,
        size_key: key,
        delta: next - prev,
        reason: 'owner_set',
        movement_type: 'owner_set',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(key ? `On-hand ${key} set to ${next}` : `On-hand set to ${next}`)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function restockBranch(productId, branchSlug, sizeKey = '') {
    if (!assertCanMutate()) return
    const dk = stockDraftKey(branchSlug, sizeKey)
    const key = productSizeKey(sizeKey)
    const add = Math.max(0, Math.floor(Number(restockDraft[dk]) || 0))
    if (add < 1) {
      toast.error('Enter a restock quantity')
      return
    }
    const product = products.find((p) => p.id === productId) || editing
    if (!canEditStock) {
      setSaving(true)
      try {
        const { error } = await supabase.rpc('request_restock', {
          p_product: productId,
          p_branch: branchSlug,
          p_qty: add,
        })
        if (error) throw error
        toast.success(`Restock request for ${add} ${product?.name || 'items'} submitted. Waiting for Super Admin approval.`)
        setRestockDraft((s) => ({ ...s, [dk]: '' }))
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
      const existing = findBranchSizeStock(stockByProduct[productId] || [], branchSlug, key)
      const current = existing ? Number(existing.qty) || 0 : null
      const next = applyRestockQty(current ?? 0, add)
      if (current == null) {
        const { error } = await supabase.from('product_branch_stock').insert({
          product_id: productId,
          branch_slug: branchSlug,
          size_key: key,
          qty: next,
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('product_branch_stock')
          .update({ qty: next })
          .eq('product_id', productId)
          .eq('branch_slug', branchSlug)
          .eq('size_key', key)
        if (error) throw error
      }
      const { error: movErr } = await supabase.from('product_stock_movements').insert({
        product_id: productId,
        branch_slug: branchSlug,
        size_key: key,
        delta: add,
        reason: 'restock',
        movement_type: 'restock',
        created_by: user?.id || profile?.id,
      })
      if (movErr) throw movErr
      toast.success(key ? `Restocked ${key} +${add}` : `Restocked +${add}`)
      setRestockDraft((s) => ({ ...s, [dk]: '' }))
      setBranchQtyDraft((s) => ({ ...s, [dk]: String(next) }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickBranchAction(productId, branchSlug, actionType) {
    if (!assertCanMutate()) return
    const draftVal = inlineQuickDraft[productId]
    const num = Math.floor(Number(draftVal))
    if (!Number.isFinite(num) || num < 0) {
      toast.error('Enter a valid quantity')
      return
    }

    const product = products.find((p) => p.id === productId)
    if (!product) return

    if (actionType === 'restock') {
      if (num < 1) {
        toast.error('Enter at least 1 to restock')
        return
      }
      if (!canEditStock) {
        setSaving(true)
        try {
          const { error } = await supabase.rpc('request_restock', {
            p_product: productId,
            p_branch: branchSlug,
            p_qty: num,
          })
          if (error) throw error
          toast.success(`Restock request for ${num} ${product.name} submitted. Waiting for Super Admin approval.`)
          setInlineQuickDraft((s) => ({ ...s, [productId]: '' }))
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
        const existing = findBranchSizeStock(stockByProduct[productId] || [], branchSlug, '')
        const current = existing ? Number(existing.qty) || 0 : 0
        const next = applyRestockQty(current, num)
        if (!existing) {
          const { error } = await supabase.from('product_branch_stock').insert({
            product_id: productId,
            branch_slug: branchSlug,
            size_key: '',
            qty: next,
          })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('product_branch_stock')
            .update({ qty: next })
            .eq('product_id', productId)
            .eq('branch_slug', branchSlug)
            .eq('size_key', '')
          if (error) throw error
        }
        await supabase.from('product_stock_movements').insert({
          product_id: productId,
          branch_slug: branchSlug,
          size_key: '',
          delta: num,
          reason: 'restock',
          movement_type: 'restock',
          created_by: user?.id || profile?.id,
        })
        toast.success(`Restocked ${product.name} (+${num})`)
        setInlineQuickDraft((s) => ({ ...s, [productId]: '' }))
        await load()
      } catch (err) {
        toast.error(err.message)
      } finally {
        setSaving(false)
      }
    } else if (actionType === 'set') {
      if (!canEditStock) {
        toast.error('Only Owner, Lucy, and Robert can modify stock counts directly.')
        return
      }
      setSaving(true)
      try {
        const existing = findBranchSizeStock(stockByProduct[productId] || [], branchSlug, '')
        const prev = existing ? Number(existing.qty) || 0 : 0
        if (!existing) {
          const { error } = await supabase.from('product_branch_stock').insert({
            product_id: productId,
            branch_slug: branchSlug,
            size_key: '',
            qty: num,
          })
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('product_branch_stock')
            .update({ qty: num })
            .eq('product_id', productId)
            .eq('branch_slug', branchSlug)
            .eq('size_key', '')
          if (error) throw error
        }
        await supabase.from('product_stock_movements').insert({
          product_id: productId,
          branch_slug: branchSlug,
          size_key: '',
          delta: num - prev,
          reason: 'owner_set',
          movement_type: 'owner_set',
          created_by: user?.id || profile?.id,
        })
        toast.success(`Set on-hand for ${product.name} to ${num}`)
        setInlineQuickDraft((s) => ({ ...s, [productId]: '' }))
        await load()
      } catch (err) {
        toast.error(err.message)
      } finally {
        setSaving(false)
      }
    }
  }

  function renderCategoryBadge(cat) {
    switch (cat) {
      case 'coffee_menu':
        return (
          <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            <Coffee size={12} aria-hidden /> Coffee Menu
          </Badge>
        )
      case 'coffee_material':
        return (
          <Badge variant="outline" className="gap-1 border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300">
            <Layers size={12} aria-hidden /> Coffee Materials
          </Badge>
        )
      case 'chemical':
        return (
          <Badge variant="outline" className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
            <Sparkles size={12} aria-hidden /> Chemicals
          </Badge>
        )
      case 'merchandise':
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Package size={12} aria-hidden /> Merchandise
          </Badge>
        )
    }
  }

  function renderVisibilityBadge(product) {
    const hidden = stockCategoryHidesFromPos(product.stock_category) || product.show_in_pos === false
    if (hidden) {
      return (
        <Badge variant="outline" className="text-xs text-muted-foreground">
          Back of House
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs">
        Shows on POS
      </Badge>
    )
  }

  return (
    <section className="flex flex-col gap-8">
      {!embedded ? (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Inventory</p>
            <h1 className="text-3xl font-semibold tracking-tight">Merch & Products</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Per-branch stock availability and catalog governance. Restock requests wait for Super Admin approval before reconciling.
            </p>
          </div>
          <Link
            to="/operations/pos"
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Open POS
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Branch on-hand determines what POS can sell. Super Admin (Owner, Lucy, Robert) can modify stock directly; Branch Admins submit restock requests for approval.
        </p>
      )}

      {/* Restock & Bulk Purchasing Policy Callout */}
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

      {/* KPI Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {selectedBranch === 'all' ? 'Total Network Units' : 'Branch Total Units'}
              </p>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {inventoryKpis.totalUnits.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Physical on-hand stock</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Package size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer border-border transition-colors hover:border-amber-500/60 ${
            availabilityFilter === 'needs_restock' ? 'ring-2 ring-amber-500' : ''
          }`}
          onClick={() => setAvailabilityFilter((cur) => (cur === 'needs_restock' ? 'all' : 'needs_restock'))}
        >
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Needs Reorder / Restock
              </p>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {inventoryKpis.needsRestockCount}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {availabilityFilter === 'needs_restock' ? 'Filtered (click to reset)' : `≤ ${LOW_STOCK_THRESHOLD} units on-hand`}
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
                {inventoryKpis.chemicalUnits.toLocaleString()}
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
                {pendingRestocksCount}
              </p>
              <Link
                to="/operations/approvals"
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Review in Approvals &rarr;
              </Link>
            </div>
            <div className="rounded-xl bg-secondary p-2.5 text-foreground">
              <Clock size={22} aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Filter Controls */}
      <div className={`grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 ${categoryFilter === 'merchandise' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        {/* Branch Selector */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="branch-filter" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Branch Scope
          </Label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger id="branch-filter" className="min-h-11">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches (Overview)</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.slug} value={b.slug}>
                  {b.name || b.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Filter */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category-filter" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Category
          </Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger id="category-filter" className="min-h-11">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories ({categoryCounts.all})</SelectItem>
              <SelectItem value="merchandise">Merchandise ({categoryCounts.merchandise})</SelectItem>
              <SelectItem value="coffee_menu">Coffee Menu ({categoryCounts.coffee_menu})</SelectItem>
              <SelectItem value="coffee_material">Coffee Materials ({categoryCounts.coffee_material})</SelectItem>
              <SelectItem value="chemical">Chemicals Inventory ({categoryCounts.chemical})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Merch Family Filter when Merchandise selected */}
        {categoryFilter === 'merchandise' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="family-filter" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Merch Family
            </Label>
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger id="family-filter" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MERCH_FAMILIES.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Stock Level Filter (both All Branches and Branch Scope) */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avail-filter" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Stock Level
          </Label>
          <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
            <SelectTrigger id="avail-filter" className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stock Levels</SelectItem>
              <SelectItem value="needs_restock">Needs Purchase / Reorder (≤ {LOW_STOCK_THRESHOLD})</SelectItem>
              <SelectItem value="out_of_stock">Out of Stock (0 units)</SelectItem>
              <SelectItem value="low_stock">Low Stock (1 - {LOW_STOCK_THRESHOLD} units)</SelectItem>
              <SelectItem value="in_stock">Adequate Stock (&gt; {LOW_STOCK_THRESHOLD})</SelectItem>
              {selectedBranch !== 'all' ? (
                <SelectItem value="unassigned">Not Assigned to Branch</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="merch-search" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Search
          </Label>
          <Input
            id="merch-search"
            className="min-h-11"
            placeholder="Search name, SKU, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Quick Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          className="rounded-full text-xs"
          onClick={() => setCategoryFilter('all')}
        >
          All ({categoryCounts.all})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={categoryFilter === 'merchandise' ? 'default' : 'outline'}
          className="rounded-full text-xs"
          onClick={() => setCategoryFilter('merchandise')}
        >
          Merchandise ({categoryCounts.merchandise})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={categoryFilter === 'coffee_menu' ? 'default' : 'outline'}
          className="rounded-full text-xs"
          onClick={() => setCategoryFilter('coffee_menu')}
        >
          Coffee Menu ({categoryCounts.coffee_menu})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={categoryFilter === 'coffee_material' ? 'default' : 'outline'}
          className="rounded-full text-xs"
          onClick={() => setCategoryFilter('coffee_material')}
        >
          Coffee Materials ({categoryCounts.coffee_material})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={categoryFilter === 'chemical' ? 'default' : 'outline'}
          className="rounded-full text-xs"
          onClick={() => setCategoryFilter('chemical')}
        >
          Chemicals Inventory ({categoryCounts.chemical})
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Assign category and branch stock. Restocks by Branch Admins will require Super Admin approval.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Microfiber towel set, Cold Brew, Paper Cups..."
                disabled={!canMutate}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} disabled={!canMutate} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="merch-stock-cat">Inventory Category</Label>
                <Select
                  value={form.stock_category || 'merchandise'}
                  onValueChange={(v) => {
                    const hides = stockCategoryHidesFromPos(v)
                    setForm({
                      ...form,
                      stock_category: v,
                      show_in_pos: hides ? false : true,
                      usage_kind: v === 'chemical' ? 'internal' : form.usage_kind,
                      material_role: v === 'coffee_material' ? form.material_role : '',
                    })
                  }}
                  disabled={!canMutate}
                >
                  <SelectTrigger id="merch-stock-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_CATEGORIES.map((row) => (
                      <SelectItem key={row.id} value={row.id}>
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Coffee Material Role selector */}
            {form.stock_category === 'coffee_material' ? (
              <div className="flex flex-col gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                <Label htmlFor="create-material-role" className="font-semibold text-orange-800 dark:text-orange-200">
                  Coffee Material Role
                </Label>
                <Select
                  value={form.material_role || 'none'}
                  onValueChange={(v) => setForm({ ...form, material_role: v === 'none' ? '' : v })}
                  disabled={!canMutate}
                >
                  <SelectTrigger id="create-material-role">
                    <SelectValue placeholder="Standard Material" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard Material (General)</SelectItem>
                    {MATERIAL_ROLES.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each Coffee Menu drink sale automatically deducts 1 cup and 20g beans from this branch&apos;s stock.
                </p>
              </div>
            ) : null}

            {/* Coffee Menu Info banner */}
            {form.stock_category === 'coffee_menu' ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                <strong>Coffee Menu:</strong> Shows up on POS to choose from to sell. Every sale automatically deducts 1 cup and 20 grams of beans from this branch&apos;s inventory.
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label>Price (₱)</Label>
              <Input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                disabled={!canMutate}
              />
              <p className="text-xs text-muted-foreground">Used when this item has no sizes.</p>
            </div>

            <SizeFields rows={form.sizes} onChange={(sizes) => setForm({ ...form, sizes })} disabled={!canMutate} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Usage Kind</Label>
                <Select
                  value={form.usage_kind || 'resellable'}
                  onValueChange={(v) => setForm({ ...form, usage_kind: v })}
                  disabled={!canMutate}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resellable">Resellable (POS / Customer)</SelectItem>
                    <SelectItem value="internal">Internal use (Sunday Recon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="merch-cat">Merch Family</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                  disabled={!canMutate}
                >
                  <SelectTrigger id="merch-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCH_FAMILIES.filter((f) => f.id !== 'all').map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={stockCategoryHidesFromPos(form.stock_category) ? false : form.show_in_pos !== false}
                disabled={!canMutate || stockCategoryHidesFromPos(form.stock_category)}
                onChange={(e) => setForm({ ...form, show_in_pos: e.target.checked })}
              />
              Show in POS
            </label>

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
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-11" disabled={saving || !canMutate}>
                {saving ? 'Saving…' : 'Save item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Main Catalog Card */}
      <Card className="planner-ticket">
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle>Catalog Items</CardTitle>
            <CardDescription>
              {visible.length} of {products.length} items
              {selectedBranch !== 'all' ? ` · Branch: ${branchNames[selectedBranch] || selectedBranch}` : ' · All Branches'}
              {crudLocked ? ' · locked' : ''}
            </CardDescription>
          </div>
          <Button
            type="button"
            className="min-h-11 shrink-0"
            onClick={() => setCreateOpen(true)}
            disabled={!canMutate}
          >
            <Plus size={16} className="mr-1.5" aria-hidden />
            Add Inventory Item
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>POS Visibility</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Total On-Hand</TableHead>
                <TableHead>
                  {selectedBranch !== 'all' ? `${branchNames[selectedBranch] || selectedBranch} On-Hand` : 'Branch Breakdown'}
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => {
                const isSelected = selectedBranch !== 'all'
                const stockItems = stockByProduct[row.id] || []
                const totalOnHand = computeProductTotalOnHand(stockItems)
                const totalEval = evaluateStockStatus(totalOnHand)
                const branchStockRow = isSelected ? findBranchSizeStock(stockItems, selectedBranch, '') : null
                const isAssigned = isSelected ? branchAssignedForProduct(stockItems, selectedBranch) : true
                const onHandQty = isSelected && branchStockRow ? Number(branchStockRow.qty) || 0 : 0
                const isSized = productSizeRows(row).length > 0

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {row.sku ? <span>SKU: {row.sku}</span> : null}
                        {row.stock_category === 'coffee_menu' ? (
                          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">
                            Recipe: 1 Cup + 20g Beans
                          </Badge>
                        ) : null}
                        {row.material_role ? (
                          <Badge variant="outline" className="border-orange-500/40 text-[10px] text-orange-600 dark:text-orange-400">
                            Role: {materialRoleLabel(row.material_role)}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{renderCategoryBadge(row.stock_category)}</TableCell>
                    <TableCell>{renderVisibilityBadge(row)}</TableCell>
                    <TableCell className="tabular-nums">
                      {isSized
                        ? productSizeRows(row)
                            .map((s) => `${s.label} ${formatMoney(s.price_minor)}`)
                            .join(' · ')
                        : formatMoney(row.price_minor)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-foreground">{totalOnHand}</span>
                          {totalEval.status === 'out_of_stock' ? (
                            <Badge variant="destructive" className="text-[10px] font-semibold uppercase">
                              Reorder Needed
                            </Badge>
                          ) : totalEval.status === 'low_stock' ? (
                            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              Low (Order Soon)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold">
                              In Stock
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">across company</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {!isSelected ? (
                        <span className="max-w-[14rem] text-xs tabular-nums text-muted-foreground">
                          {formatBranchOnHandSummary(stockItems, branchNames)}
                        </span>
                      ) : !isAssigned ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Not assigned
                          </Badge>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={saving || !canMutate}
                            onClick={() => assignBranch(row.id, selectedBranch)}
                          >
                            Assign here
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            {onHandQty > 5 ? (
                              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                                {onHandQty} in stock
                              </Badge>
                            ) : onHandQty > 0 ? (
                              <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                {onHandQty} low stock
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                0 out of stock
                              </Badge>
                            )}
                          </div>
                          {!isSized ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0"
                                className="h-8 w-20 text-xs"
                                placeholder="Qty"
                                value={inlineQuickDraft[row.id] ?? ''}
                                onChange={(e) => setInlineQuickDraft({ ...inlineQuickDraft, [row.id]: e.target.value })}
                                disabled={!canMutate}
                              />
                              {canEditStock ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2 text-xs"
                                  disabled={saving || !canMutate}
                                  onClick={() => handleQuickBranchAction(row.id, selectedBranch, 'set')}
                                >
                                  Set
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                disabled={saving || !canMutate}
                                onClick={() => handleQuickBranchAction(row.id, selectedBranch, 'restock')}
                              >
                                {canEditStock ? '+ Restock' : 'Request'}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              {productSizeRows(row)
                                .map((s) => {
                                  const hit = findBranchSizeStock(stockItems, selectedBranch, productSizeKey(s.label))
                                  return `${s.label}: ${hit ? hit.qty : 0}`
                                })
                                .join(' · ')}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? 'secondary' : 'outline'}>{row.is_active ? 'Active' : 'Off'}</Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canMutate}
                        onClick={() => toggleActive(row)}
                      >
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!canMutate} onClick={() => onArchive(row.id)}>
                        Archive
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
              {!visible.length && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No items match the chosen branch and filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSaveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Name</Label>
                <Input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  disabled={!canMutate}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>SKU</Label>
                  <Input
                    value={editing.sku}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    disabled={!canMutate}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-stock-cat">Inventory Category</Label>
                  <Select
                    value={editing.stock_category || 'merchandise'}
                    onValueChange={(v) => {
                      const hides = stockCategoryHidesFromPos(v)
                      setEditing({
                        ...editing,
                        stock_category: v,
                        show_in_pos: hides ? false : editing.show_in_pos,
                        usage_kind: v === 'chemical' ? 'internal' : editing.usage_kind,
                        material_role: v === 'coffee_material' ? editing.material_role : '',
                      })
                    }}
                    disabled={!canMutate}
                  >
                    <SelectTrigger id="edit-stock-cat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_CATEGORIES.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Coffee Material Role */}
              {editing.stock_category === 'coffee_material' ? (
                <div className="flex flex-col gap-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                  <Label htmlFor="edit-material-role" className="font-semibold text-orange-800 dark:text-orange-200">
                    Coffee Material Role
                  </Label>
                  <Select
                    value={editing.material_role || 'none'}
                    onValueChange={(v) => setEditing({ ...editing, material_role: v === 'none' ? '' : v })}
                    disabled={!canMutate}
                  >
                    <SelectTrigger id="edit-material-role">
                      <SelectValue placeholder="Standard Material" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Standard Material (General)</SelectItem>
                      {MATERIAL_ROLES.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Coffee Menu drink sales automatically deduct 1 cup and 20g beans from this branch&apos;s stock.
                  </p>
                </div>
              ) : null}

              {/* Coffee Menu Info banner */}
              {editing.stock_category === 'coffee_menu' ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <strong>Coffee Menu:</strong> Shows up on POS to choose from to sell. Every sale automatically deducts 1 cup and 20 grams of beans from this branch&apos;s inventory.
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Label>Price (₱)</Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                  disabled={!canMutate}
                />
                <p className="text-xs text-muted-foreground">Used when this item has no sizes.</p>
              </div>

              <SizeFields rows={editing.sizes} onChange={(sizes) => setEditing({ ...editing, sizes })} disabled={!canMutate} />

              {String(editing.usage_kind || 'resellable').toLowerCase() !== 'internal' ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-merch-points">Points to buy (Voucher Shop)</Label>
                  <Input
                    id="edit-merch-points"
                    type="number"
                    min="0"
                    step="1"
                    value={editing.points_price}
                    onChange={(e) => setEditing({ ...editing, points_price: e.target.value })}
                    disabled={!canMutate}
                  />
                  <p className="text-xs text-muted-foreground">
                    Points required to claim in customer shop. Redemptions automatically deduct from pickup branch on-hand.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Usage Kind</Label>
                  <Select
                    value={editing.usage_kind || 'resellable'}
                    onValueChange={(v) => setEditing({ ...editing, usage_kind: v })}
                    disabled={!canMutate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resellable">Resellable (POS / Customer)</SelectItem>
                      <SelectItem value="internal">Internal use (Sunday Recon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-merch-cat">Merch Family</Label>
                  <Select
                    value={['coffee', 'accessories', 'clothing', 'merch'].includes(editing.category) ? editing.category : 'merch'}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
                    disabled={!canMutate}
                  >
                    <SelectTrigger id="edit-merch-cat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MERCH_FAMILIES.filter((f) => f.id !== 'all').map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={stockCategoryHidesFromPos(editing.stock_category) ? false : editing.show_in_pos !== false}
                  disabled={!canMutate || stockCategoryHidesFromPos(editing.stock_category)}
                  onChange={(e) => setEditing({ ...editing, show_in_pos: e.target.checked })}
                />
                Show in POS
              </label>

              <div className="flex flex-col gap-2">
                <Label>Sellable tags</Label>
                <Input
                  value={editing.tags || ''}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                  placeholder="sellable, merch, coffee"
                  disabled={!canMutate}
                />
              </div>

              {/* Branch On-Hand Section */}
              <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Branch On-Hand Management</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ShieldCheck size={14} className="text-primary" />
                    {canEditStock ? 'Direct set enabled (Super Admin / Lucy / Robert)' : 'Restock requests require approval'}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  POS sells only when that branch has stock. Restock adds to count (Branch Admin restock goes to Super Admin approval).
                </p>
                {branches.map((b) => {
                  const stockRows = stockByProduct[editing.id] || []
                  const assigned = branchAssignedForProduct(stockRows, b.slug)
                  const draftSized = (editing.sizes || []).filter((s) => String(s.label || '').trim())
                  const sizeKeys = draftSized.length
                    ? draftSized.map((s) => productSizeKey(s.label))
                    : productStockSizeKeys({ size_options: editing.size_options })
                  return (
                    <div key={b.slug} className="flex flex-col gap-2 border-t border-border pt-2 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{b.name}</span>
                        {!assigned ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={saving || !canMutate}
                            onClick={() => assignBranch(editing.id, b.slug)}
                          >
                            Assign to branch
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Assigned</span>
                        )}
                      </div>
                      {assigned
                        ? sizeKeys.map((sizeKey) => {
                            const dk = stockDraftKey(b.slug, sizeKey)
                            const sizeLabel = sizeKey || 'Default'
                            return (
                              <div
                                key={dk}
                                className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center"
                              >
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {sizeLabel}
                                </span>
                                {canEditStock ? (
                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      className="min-h-11"
                                      aria-label={`${b.name} ${sizeLabel} on-hand`}
                                      value={branchQtyDraft[dk] ?? ''}
                                      onChange={(e) => setBranchQtyDraft((s) => ({ ...s, [dk]: e.target.value }))}
                                      disabled={!canMutate}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      className="min-h-11 shrink-0"
                                      disabled={saving || !canMutate}
                                      onClick={() => setBranchQty(editing.id, b.slug, sizeKey)}
                                    >
                                      Set
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="text-xs text-muted-foreground">
                                    On-hand: {branchQtyDraft[dk] || 0}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <Input
                                    type="number"
                                    min="1"
                                    className="min-h-11"
                                    aria-label={`${b.name} ${sizeLabel} restock`}
                                    placeholder="+ qty"
                                    value={restockDraft[dk] ?? ''}
                                    onChange={(e) => setRestockDraft((s) => ({ ...s, [dk]: e.target.value }))}
                                    disabled={!canMutate}
                                  />
                                  <Button
                                    type="button"
                                    className="min-h-11 shrink-0"
                                    disabled={saving || !canMutate}
                                    onClick={() => restockBranch(editing.id, b.slug, sizeKey)}
                                  >
                                    {canEditStock ? 'Restock' : 'Request'}
                                  </Button>
                                </div>
                              </div>
                            )
                          })
                        : null}
                    </div>
                  )
                })}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !canMutate}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Lock, LockOpen, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canManageMerchShop, getBranchScopeList, isSuperAdmin } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { PickupHandover } from '@/components/merch/PickupHandover'
import ProductsManagePage from '@/pages/ProductsManagePage'
import { getInventoryCrudLocked, listBranches, setInventoryCrudLocked } from '@/lib/adminApi'
import { canMutateInventoryCrud } from '@/lib/inventoryLock'
import { merchPhoto, pickupDate, PICKUP_MASK } from '@/lib/pointsShop'
import { pickupAction } from '@/lib/pointsShopClient'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const monthKey = (value) => value ? new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7) : ''
export default function MerchShopPage() {
  const { profile } = useAuth()
  const allowed = canManageMerchShop(profile)
  const [branches, setBranches] = useState([])
  const [branch, setBranch] = useState('all')
  const [products, setProducts] = useState([])
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('items')
  const [pickup, setPickup] = useState(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(true)
  const [lockReady, setLockReady] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)
  const scope = getBranchScopeList(profile)
  const availableBranches = branches.filter((b) => !scope || scope.includes(b.slug))
  const load = useCallback(async () => {
    if (!allowed) return
    try {
      const data = await pickupAction('list', { branch_slug: branch === 'all' ? '' : branch })
      setRows(data.redemptions || []); setError('')
    } catch (err) { setError(err.message) }
  }, [allowed, branch])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!allowed) return
    Promise.all([listBranches(), getInventoryCrudLocked()]).then(([b, l]) => { setBranches(b); setLocked(l); setLockReady(true) }).catch((err) => setError(err.message))
  }, [allowed])
  if (!allowed) return <Navigate to="/operations/access-denied" replace />
  async function toggleLock() {
    setLockBusy(true)
    try { await setInventoryCrudLocked(!locked, { actorName: profile.full_name }); setLocked(!locked) }
    catch (err) { toast.error(err.message) }
    finally { setLockBusy(false) }
  }
  const waiting = rows.filter((r) => r.status === 'pending')
  const history = rows.filter((r) => r.status !== 'pending')
  const thisMonth = monthKey(new Date())
  const cards = [
    ['In the app', products.filter((p) => p.show_in_app && p.is_active).length, 'Items customers can claim'],
    ['Waiting for pickup', waiting.length, 'Customers have a code'],
    ['Picked up this month', history.filter((r) => r.status === 'fulfilled' && monthKey(r.fulfilled_at) === thisMonth).length, 'Handed over with a code'],
    ['Expired this month', history.filter((r) => r.status === 'expired' && monthKey(r.expired_at) === thisMonth).length, 'Points went back'],
  ]
  const visible = (tab === 'waiting' ? waiting : history).filter((r) => String(r.customers?.full_name || '').toLowerCase().includes(query.trim().toLowerCase()))
  return <OpsPageShell eyebrow="Customers" title="Merch shop" description="What customers can get with points in the Hakum app. They claim it in the app and pick it up at the counter with their code."
    actions={isSuperAdmin(profile) ? <Button type="button" variant="outline" disabled={!lockReady || lockBusy} onClick={toggleLock}>{locked ? <LockOpen /> : <Lock />}{locked ? 'Unlock merch' : 'Lock merch'}</Button> : null}>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, sub]) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p><p className="text-[11px] text-muted-foreground">{sub}</p>
    </div><Package className="size-6 text-primary" /></CardContent></Card>)}</div>
    <div className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5"><Label htmlFor="shop-branch">Branch scope</Label><select id="shop-branch" className="min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="all">All Branches</option>{availableBranches.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="shop-customer">Search customer name</Label><Input id="shop-customer" placeholder="Search customer name…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
    </div>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Merch shop">{[['items',`Items (${products.length})`],['waiting',`Waiting for pickup (${waiting.length})`],['history','History']].map(([key,label]) => <Button type="button" key={key} role="tab" aria-selected={tab === key} variant={tab === key ? 'default' : 'outline'} className="rounded-full" onClick={() => setTab(key)}>{label}</Button>)}</div>
    <div hidden={tab !== 'items'}><ProductsManagePage embedded merchShop shopBranch={branch} onProductsLoaded={setProducts} crudLocked={locked} canMutate={lockReady && canMutateInventoryCrud(profile, locked)} /></div>
    {tab !== 'items' ? <Card><CardContent className="p-4"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Item</TableHead><TableHead>Branch</TableHead><TableHead>Keep until</TableHead><TableHead>Pickup code</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
      {visible.map((r) => <TableRow key={r.id}><TableCell>{r.customers?.full_name || 'Customer'}</TableCell><TableCell><div className="flex items-center gap-2"><img src={merchPhoto(r.products)} alt="" className="size-10 rounded-lg object-cover" /><span>{r.products?.name}{r.size_key ? ` · ${r.size_key.toUpperCase()}` : ''}</span></div></TableCell>
        <TableCell>{branches.find((b) => b.slug === r.branch_slug)?.name || r.branch_slug}</TableCell><TableCell>{pickupDate(r.expires_at)}</TableCell><TableCell className="font-mono">{PICKUP_MASK}</TableCell><TableCell>{r.status === 'fulfilled' ? 'Picked up' : r.status === 'expired' ? 'Expired' : 'Waiting'}</TableCell><TableCell>{r.status === 'pending' ? <Button type="button" variant="outline" disabled={new Date(r.expires_at) <= new Date()} onClick={() => setPickup(r)}>Enter code</Button> : pickupDate(r.fulfilled_at || r.expired_at)}</TableCell></TableRow>)}
      {!visible.length ? <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">No pickups match.</TableCell></TableRow> : null}
    </TableBody></Table></CardContent></Card> : null}
    <Dialog open={Boolean(pickup)} onOpenChange={(open) => { if (!open) setPickup(null) }}><DialogContent><DialogHeader><DialogTitle>Points shop pickup</DialogTitle></DialogHeader>{pickup ? <PickupHandover key={pickup.id} row={pickup} onHandedOver={() => { setPickup(null); load() }} /> : null}</DialogContent></Dialog>
  </OpsPageShell>
}

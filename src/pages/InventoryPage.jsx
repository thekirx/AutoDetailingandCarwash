/** Inventory — SA/ASA catalog tabs; BA restock/recon; merch owns branch on-hand (C7); SA CRUD lock (C8). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Car, ClipboardCheck, Lock, LockOpen, ShoppingBag, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInventory, canManageServices, canRestockInventory, isSuperAdmin } from '@/auth/permissions'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { INVENTORY_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { getInventoryCrudLocked, setInventoryCrudLocked } from '@/lib/adminApi'
import { canMutateInventoryCrud } from '@/lib/inventoryLock'
import { opsTabSearchParams } from '@/lib/opsShell'
import ServicesManagePage from '@/pages/ServicesManagePage'
import ProductsManagePage from '@/pages/ProductsManagePage'
import BranchInventoryPage from '@/pages/BranchInventoryPage'
import ReferralProgramCard from '@/components/ops/ReferralProgramCard'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent } from '@/components/ui/tabs'

const CATALOG_TABS = ['bay', 'detailing', 'merch', 'recon']
const BA_TABS = ['restock', 'recon']

/** Source-scan contract — keep literal ids for ops shell tests. */
const INVENTORY_SHELL_TABS = [
  { id: 'bay', label: 'Services & packages', icon: Car },
  { id: 'detailing', label: 'Detailing', icon: Sparkles },
  { id: 'merch', label: 'Merch / sellables', icon: ShoppingBag },
  { id: 'recon', label: 'Sunday recon', icon: ClipboardCheck },
]

function resolveInventoryTab(raw) {
  if (CATALOG_TABS.includes(raw)) return raw
  if (raw === 'services') return 'bay'
  if (raw === 'stock' || raw === 'restock') return 'merch'
  if (BA_TABS.includes(raw)) return raw
  return 'bay'
}

export default function InventoryPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCatalog = canManageServices(profile)
  const canStock = canRestockInventory(profile)
  const raw = searchParams.get('tab')
  const tab = resolveInventoryTab(raw)
  const [crudLocked, setCrudLocked] = useState(false)
  const [lockBusy, setLockBusy] = useState(false)

  const refreshLock = useCallback(async () => {
    try {
      setCrudLocked(await getInventoryCrudLocked())
    } catch (err) {
      toast.error(err.message)
    }
  }, [])

  useEffect(() => {
    if (canAccessInventory(profile)) refreshLock()
  }, [profile, refreshLock])

  const canMutate = canMutateInventoryCrud(profile, crudLocked)
  const saLockToggle = isSuperAdmin(profile)

  const visibleTabs = useMemo(
    () => INVENTORY_SHELL_TABS.filter((t) => t.id !== 'recon' || canStock),
    [canStock],
  )

  if (!canAccessInventory(profile)) {
    return <Navigate to="/operations/pos" replace />
  }

  // BA-only: restock/recon via BranchInventoryPage (its own tabs).
  if (!canCatalog && canStock) {
    return <BranchInventoryPage crudLocked={crudLocked} canMutate={canMutate} />
  }

  function setTab(next) {
    setSearchParams(opsTabSearchParams(next, 'bay'), { replace: true })
  }

  async function toggleLock() {
    if (!saLockToggle) return
    setLockBusy(true)
    try {
      await setInventoryCrudLocked(!crudLocked, { actorName: profile?.full_name || 'Super Admin' })
      setCrudLocked(!crudLocked)
      toast.success(!crudLocked ? 'Inventory locked' : 'Inventory unlocked')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLockBusy(false)
    }
  }

  const inventoryStepIcons = {
    bay: Car,
    detailing: Sparkles,
    merch: ShoppingBag,
    recon: ClipboardCheck,
  }

  return (
    <OpsPageShell
      className="hakum-inventory"
      eyebrow="Catalog"
      title="Inventory"
      description="The catalog is shared. Branch on-hand on each merch row decides what POS can sell. Sunday recon covers internal chemicals."
      actions={
        saLockToggle ? (
          <Button
            type="button"
            variant={crudLocked ? 'default' : 'outline'}
            className="min-h-11"
            disabled={lockBusy}
            onClick={toggleLock}
            aria-label={crudLocked ? 'Unlock inventory CRUD' : 'Lock inventory CRUD'}
          >
            {crudLocked ? <LockOpen size={16} className="mr-1.5" aria-hidden /> : <Lock size={16} className="mr-1.5" aria-hidden />}
            {lockBusy ? 'Saving…' : crudLocked ? 'Unlock inventory' : 'Lock inventory'}
          </Button>
        ) : null
      }
    >
      {crudLocked ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground" role="status">
          Inventory is locked. Only Super Admin can edit the catalog or restock until unlock.
          {!canMutate ? ' Ask Super Admin if you need a change.' : null}
        </p>
      ) : null}

      <OpsGuideCard
        title="How inventory works"
        description="Catalog tabs feed POS and Bookings. Merch rows carry branch on-hand. Sunday recon is chemicals only."
        steps={INVENTORY_WORKFLOW_STEPS.filter((s) => s.id !== 'recon' || canStock)}
        stepIcons={inventoryStepIcons}
        defaultOpen={tab === 'bay'}
      />

      {canCatalog ? <ReferralProgramCard /> : null}

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <OpsTabList tabs={visibleTabs} aria-label="Inventory catalog" />

        <TabsContent value="bay" className="mt-0 outline-none">
          <ServicesManagePage embedded catalogScope="bay" crudLocked={crudLocked} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="detailing" className="mt-0 outline-none">
          <ServicesManagePage embedded catalogScope="detailing" crudLocked={crudLocked} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="merch" className="mt-0 outline-none">
          <ProductsManagePage embedded crudLocked={crudLocked} canMutate={canMutate} />
        </TabsContent>
        {canStock ? (
          <TabsContent value="recon" className="mt-0 outline-none">
            <BranchInventoryPage embedded defaultTab="recon" crudLocked={crudLocked} canMutate={canMutate} />
          </TabsContent>
        ) : null}
      </Tabs>
    </OpsPageShell>
  )
}

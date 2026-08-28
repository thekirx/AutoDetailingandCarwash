/** Inventory — SA/ASA catalog tabs; BA (and SA) branch restock / Sunday recon. */
import { useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Car, Package, ShoppingBag, Sparkles } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInventory, canManageServices, canRestockInventory } from '@/auth/permissions'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { INVENTORY_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { opsTabSearchParams } from '@/lib/opsShell'
import ServicesManagePage from '@/pages/ServicesManagePage'
import ProductsManagePage from '@/pages/ProductsManagePage'
import BranchInventoryPage from '@/pages/BranchInventoryPage'
import { Tabs, TabsContent } from '@/components/ui/tabs'

const CATALOG_TABS = ['bay', 'detailing', 'merch', 'stock']
const BA_TABS = ['restock', 'recon']

/** Source-scan contract — keep literal ids for ops shell tests. */
const INVENTORY_SHELL_TABS = [
  { id: 'bay', label: 'Services & packages', icon: Car },
  { id: 'detailing', label: 'Detailing', icon: Sparkles },
  { id: 'merch', label: 'Merch / sellables', icon: ShoppingBag },
  { id: 'stock', label: 'Branch stock', icon: Package },
]

function resolveInventoryTab(raw) {
  if (CATALOG_TABS.includes(raw)) return raw
  if (raw === 'services') return 'bay'
  if (BA_TABS.includes(raw)) return 'stock'
  return 'bay'
}

export default function InventoryPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCatalog = canManageServices(profile)
  const canStock = canRestockInventory(profile)
  const raw = searchParams.get('tab')
  const tab = resolveInventoryTab(raw)

  const visibleTabs = useMemo(
    () => INVENTORY_SHELL_TABS.filter((t) => t.id !== 'stock' || canStock),
    [canStock],
  )

  if (!canAccessInventory(profile)) {
    return <Navigate to="/operations/pos" replace />
  }

  // BA-only: restock/recon via BranchInventoryPage (its own tabs).
  if (!canCatalog && canStock) {
    return <BranchInventoryPage />
  }

  function setTab(next) {
    setSearchParams(opsTabSearchParams(next, 'bay'), { replace: true })
  }

  const inventoryStepIcons = {
    bay: Car,
    detailing: Sparkles,
    merch: ShoppingBag,
    stock: Package,
  }

  return (
    <OpsPageShell
      className="hakum-inventory"
      eyebrow="Catalog"
      title="Inventory"
      description="Create bay services and packages, multi-day detailing, merch stock, and branch restock / Sunday recon."
    >
      <OpsGuideCard
        title="How inventory works"
        description="Catalog tabs feed POS and Bookings. Branch stock keeps merch counts honest."
        steps={INVENTORY_WORKFLOW_STEPS.filter((s) => s.id !== 'stock' || canStock)}
        stepIcons={inventoryStepIcons}
        defaultOpen={tab === 'bay'}
      />

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <OpsTabList tabs={visibleTabs} aria-label="Inventory catalog" />

        <TabsContent value="bay" className="mt-0 outline-none">
          <ServicesManagePage embedded catalogScope="bay" />
        </TabsContent>
        <TabsContent value="detailing" className="mt-0 outline-none">
          <ServicesManagePage embedded catalogScope="detailing" />
        </TabsContent>
        <TabsContent value="merch" className="mt-0 outline-none">
          <ProductsManagePage embedded />
        </TabsContent>
        {canStock ? (
          <TabsContent value="stock" className="mt-0 outline-none">
            <BranchInventoryPage embedded />
          </TabsContent>
        ) : null}
      </Tabs>
    </OpsPageShell>
  )
}

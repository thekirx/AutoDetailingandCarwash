/** Inventory — SA/ASA catalog tabs; BA (and SA) branch restock / Sunday recon. */
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInventory, canManageServices, canRestockInventory } from '@/auth/permissions'
import ServicesManagePage from '@/pages/ServicesManagePage'
import ProductsManagePage from '@/pages/ProductsManagePage'
import BranchInventoryPage from '@/pages/BranchInventoryPage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const CATALOG_TABS = ['bay', 'detailing', 'merch', 'stock']
const BA_TABS = ['restock', 'recon']

export default function InventoryPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canCatalog = canManageServices(profile)
  const canStock = canRestockInventory(profile)
  const raw = searchParams.get('tab')

  if (!canAccessInventory(profile)) {
    return <Navigate to="/operations/pos" replace />
  }

  // BA-only: restock/recon via BranchInventoryPage (its own tabs).
  if (!canCatalog && canStock) {
    return <BranchInventoryPage />
  }

  const tab = CATALOG_TABS.includes(raw)
    ? raw
    : raw === 'services'
      ? 'bay'
      : BA_TABS.includes(raw)
        ? 'stock'
        : 'bay'

  function setTab(next) {
    setSearchParams(next === 'bay' ? {} : { tab: next }, { replace: true })
  }

  return (
    <section className="planner-v2 pb-8">
      <header className="planner-v2-head mb-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-primary uppercase">Catalog</p>
          <h1>Inventory</h1>
          <p>
            Create bay services and packages, multi-day detailing, merch stock, and branch restock / Sunday recon.
          </p>
        </div>
      </header>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList
          variant="line"
          className="hakum-pos-tabs planner-v2-tabs mb-4 flex h-auto w-full flex-wrap gap-2"
          aria-label="Inventory catalog"
        >
          <TabsTrigger value="bay" className="min-h-11 min-w-[7rem] flex-1">
            Services & packages
          </TabsTrigger>
          <TabsTrigger value="detailing" className="min-h-11 min-w-[7rem] flex-1">
            Detailing
          </TabsTrigger>
          <TabsTrigger value="merch" className="min-h-11 min-w-[7rem] flex-1">
            Merch / sellables
          </TabsTrigger>
          {canStock ? (
            <TabsTrigger value="stock" className="min-h-11 min-w-[7rem] flex-1">
              Branch stock
            </TabsTrigger>
          ) : null}
        </TabsList>
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
    </section>
  )
}

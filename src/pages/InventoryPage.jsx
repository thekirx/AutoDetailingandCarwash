/** Super Admin inventory — bay services/packages, detailing, and merch. */
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInventory } from '@/auth/permissions'
import ServicesManagePage from '@/pages/ServicesManagePage'
import ProductsManagePage from '@/pages/ProductsManagePage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const INVENTORY_TABS = ['bay', 'detailing', 'merch']

export default function InventoryPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('tab')
  // Legacy ?tab=services → bay
  const tab = INVENTORY_TABS.includes(raw)
    ? raw
    : raw === 'services'
      ? 'bay'
      : 'bay'

  if (!canAccessInventory(profile)) {
    return <Navigate to="/operations/pos" replace />
  }

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
            Create bay services and packages, multi-day detailing, and merch stock — same split as POS Sell.
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
      </Tabs>
    </section>
  )
}

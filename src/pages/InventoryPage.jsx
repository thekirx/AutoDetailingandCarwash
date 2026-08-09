import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessInventory } from '@/auth/permissions'
import ServicesManagePage from '@/pages/ServicesManagePage'
import ProductsManagePage from '@/pages/ProductsManagePage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/** Super Admin inventory area — services + merch (not Branch Admin POS). */
export default function InventoryPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['services', 'merch'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'services'

  if (!canAccessInventory(profile)) {
    return <Navigate to="/operations/pos" replace />
  }

  return (
    <section className="pb-8">
      <header className="mb-4 border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Catalog</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inventory Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Services and merch stock. Branch Admin POS can only sell tagged sellables onto jobs.
        </p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(next) => setSearchParams(next === 'services' ? {} : { tab: next }, { replace: true })}
      >
        <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="services" className="min-h-11">Services</TabsTrigger>
          <TabsTrigger value="merch" className="min-h-11">Merch / sellables</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <ServicesManagePage embedded />
        </TabsContent>
        <TabsContent value="merch">
          <ProductsManagePage embedded />
        </TabsContent>
      </Tabs>
    </section>
  )
}

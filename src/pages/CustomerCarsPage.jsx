import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell from '@/components/NotificationBell'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_CARS_PATH, CUSTOMER_MORE_PATH } from '@/lib/customerAccountNav'
import { usePageMeta } from '@/lib/pageMeta'
import { GarageSection } from './CustomerMorePage'
import fleetPhoto from '@/assets/services/wash-detailing/fleet-collage.webp'

/** /account/cars — the Cars tab (took Me's place in the dock). `?add=1` opens the add form, `?vehicle=<id>` edits a car. */
export default function CustomerCarsPage() {
  const [params, setParams] = useSearchParams()
  const [portal, setPortal] = useState(null)
  usePageMeta({ title: 'My cars', description: 'Your saved cars, sizes and photos.', path: CUSTOMER_CARS_PATH })

  const load = useCallback(() => fetchPortal().then(setPortal).catch((err) => toast.error(err.message)), [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <CustomerAppFrame
      title="Your fleet"
      subtitle="Tap a photo to change it, or a plate to book or edit."
      navTitle="Your fleet"
      banner={{ src: fleetPhoto, position: '50% 50%' }}
      actions={
        <>
          <button type="button" className="capp-icon-btn" aria-label="Add a car" onClick={() => setParams({ add: '1' }, { replace: true })}>
            <Plus size={20} strokeWidth={2} aria-hidden />
          </button>
          <NotificationBell variant="capp" homeUrl={`${CUSTOMER_MORE_PATH}?tab=alerts`} homeLabel="Notifications" />
        </>
      }
      cols
    >
      <GarageSection
        vehicles={portal?.vehicles || []}
        loaded={Boolean(portal)}
        editId={params.get('vehicle') || ''}
        startAdding={params.get('add') === '1'}
        onEdit={(id) => setParams(id ? { vehicle: id } : {}, { replace: true })}
        onUpdated={load}
      />
    </CustomerAppFrame>
  )
}

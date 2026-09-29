import { lazy, Suspense, useMemo, useState } from 'react'
import { MapPin } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { branchDistanceKm, nearestBranchSlug } from '@/lib/branchGeo'
import { formatDistanceKm, saveCustomerPin } from '@/lib/customerLocation'
import { readBrowserLocation } from '@/lib/phPlaces'

const BranchLocationPicker = lazy(() => import('@/components/BranchLocationPicker'))

export default function CustomerPinControl({ branches, currentSlug, pin, onPin, onChoose }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')

  const nearest = useMemo(() => (pin ? nearestBranchSlug(pin, branches) : null), [pin, branches])
  const current = branches.find((row) => row.slug === currentSlug) || null
  const hereKm = pin && current ? branchDistanceKm(pin, current) : null
  const isNearest = Boolean(nearest?.slug && nearest.slug === currentSlug)

  function commit(next) {
    const saved = saveCustomerPin(next)
    if (!saved) {
      setError('That pin is not a valid location.')
      return
    }
    setError('')
    onPin?.(saved)
    const found = nearestBranchSlug(saved, branches)
    if (found?.slug) onChoose?.(found.slug)
    setOpen(false)
  }

  async function pinHere() {
    setLocating(true)
    setError('')
    try {
      commit(await readBrowserLocation())
    } catch (err) {
      setError(err.message || 'Location is off. Drop a pin on the map instead.')
      setDraft(pin)
      setOpen(true)
    } finally {
      setLocating(false)
    }
  }

  function openMap() {
    setDraft(pin)
    setOpen(true)
  }

  let status = 'Pin where you are. The queue opens the closest branch.'
  if (pin && !branches.length) {
    status = 'Finding the closest branch…'
  } else if (pin && nearest && (!currentSlug || isNearest)) {
    status = `Nearest branch · ${formatDistanceKm(nearest.distanceKm)} from your pin`
  } else if (pin && hereKm != null) {
    status = `Your pin is ${formatDistanceKm(hereKm)} from this branch.`
  } else if (pin && nearest) {
    status = 'This is not the closest branch to your pin.'
  }

  return (
    <div className="capp-pin">
      <p className="capp-pin-status" aria-live="polite">{status}</p>
      <div className="capp-pin-actions">
        <button type="button" className="capp-btn capp-btn-fill" onClick={pinHere} disabled={locating} aria-busy={locating}>
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          {locating ? 'Finding you…' : pin ? 'Update location' : 'Pin my location'}
        </button>
        <button type="button" className="capp-btn capp-btn-ghost" onClick={openMap}>
          {pin ? 'Move pin' : 'Drop a pin'}
        </button>
        {pin && currentSlug && nearest?.slug && !isNearest ? (
          <button type="button" className="capp-btn capp-btn-ghost capp-pin-nearest" onClick={() => onChoose?.(nearest.slug)}>
            Show nearest
          </button>
        ) : null}
      </div>
      {error ? <p className="capp-pin-error" role="alert">{error}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="capp-pin-dialog text-base sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pin your location</DialogTitle>
            <DialogDescription>Search or tap the map. The live queue switches to the closest Hakum branch.</DialogDescription>
          </DialogHeader>
          <Suspense fallback={<p className="capp-meta">Loading map…</p>}>
            {open ? (
              <BranchLocationPicker
                latitude={draft?.lat}
                longitude={draft?.lng}
                onChange={({ latitude, longitude }) => {
                  const lat = Number(latitude)
                  const lng = Number(longitude)
                  if (Number.isFinite(lat) && Number.isFinite(lng)) setDraft({ lat, lng })
                }}
              />
            ) : null}
          </Suspense>
          <button type="button" className="capp-btn capp-btn-fill" disabled={!draft} onClick={() => commit(draft)}>
            Use this pin
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

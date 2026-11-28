import { useEffect, useMemo, useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import Sheet from '@/components/customer/Sheet'
import PhilippinesSmartPinField from '@/components/PhilippinesSmartPinField'
import { nearestBranchSlug } from '@/lib/branchGeo'
import { formatCustomerLocationLabel, formatDistanceKm } from '@/lib/customerLocation'

function branchShortName(name) {
  return String(name || '').replace(/^Hakum Auto Care\s*/i, '') || name || ''
}

/**
 * Interactive Customer App location chooser sheet:
 * Type any Philippines place, auto-detect GPS, or drop/drag a smart pin on the map,
 * showing live resolved place text and the nearest Hakum branch before confirming.
 */
export default function CustomerLocationSheet({
  open,
  onClose,
  pin = null,
  branches = [],
  onApply,
}) {
  const [draft, setDraft] = useState(pin)

  useEffect(() => {
    if (open) setDraft(pin)
  }, [open, pin])

  const nearest = useMemo(() => (draft ? nearestBranchSlug(draft, branches) : null), [draft, branches])
  const nearestBranch = useMemo(
    () => (nearest?.slug ? branches.find((b) => b.slug === nearest.slug) || null : null),
    [branches, nearest],
  )
  const draftLabel = formatCustomerLocationLabel(draft) || (draft ? `${draft.lat.toFixed(4)}, ${draft.lng.toFixed(4)}` : '')

  function handleSave() {
    if (!draft) return
    onApply?.(draft)
    onClose?.()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your location"
      label="Set your Philippines location"
      full
      footer={
        <div className="capp-loc-sheet-foot">
          <button type="button" className="capp-btn capp-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="capp-btn capp-btn-fill" disabled={!draft} onClick={handleSave}>
            Use this location
          </button>
        </div>
      }
    >
      <div className="capp-loc-sheet-body">
        <PhilippinesSmartPinField
          variant="capp"
          value={draft}
          branches={branches}
          onChange={setDraft}
          inputId="capp-ph-location-search"
          mapHeight={220}
        />

        <div className="capp-loc-preview" aria-live="polite">
          {draft ? (
            <>
              <div className="capp-loc-preview-row">
                <span className="capp-row-icon" aria-hidden>
                  <MapPin size={17} strokeWidth={1.85} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="capp-loc-preview-k">Pinned location</span>
                  <strong>{draftLabel}</strong>
                  <small className="tabular-nums">
                    {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
                  </small>
                </div>
              </div>
              {nearestBranch ? (
                <div className="capp-loc-preview-branch">
                  <Navigation size={14} strokeWidth={1.9} aria-hidden />
                  <span>
                    Nearest Hakum branch: <strong>{branchShortName(nearestBranch.name)}</strong>
                    {nearest?.distanceKm != null ? ` · ${formatDistanceKm(nearest.distanceKm)} away` : ''}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="capp-meta" style={{ margin: 0 }}>
              Search any barangay, city, or landmark in the Philippines, tap <strong>Use GPS</strong>, or drop a pin on the map.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  )
}

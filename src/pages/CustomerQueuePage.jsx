import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Clock, MapPin } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { QueueStats, Row, Skeleton } from '@/components/customer/CustomerUi'
import CustomerLocationSheet from '@/components/customer/CustomerLocationSheet'
import Sheet from '@/components/customer/Sheet'
import { usePublicBranches } from '@/lib/branches'
import { branchDistanceKm } from '@/lib/branchGeo'
import { formatDistanceKm } from '@/lib/customerLocation'
import { useCustomerBranch } from '@/lib/useCustomerBranch'
import { CUSTOMER_QUEUE_PATH, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePageMeta } from '@/lib/pageMeta'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'
import carwashPhoto from '@/assets/services/carwash.webp'

function branchShortName(name) {
  return String(name || '').replace(/^Hakum Auto Care\s*/i, '') || name || ''
}

/**
 * /account/queue — banner, the closest branch, a "Not your branch? Change" sheet, then the live
 * queue. Coming-soon branches are listed with a tag; picking one shows when its queue starts.
 * Car wash is walk-in: drive in and join the queue.
 */
export default function CustomerQueuePage() {
  const [params, setParams] = useSearchParams()
  const wanted = String(params.get('branch') || '').trim()
  const { branches: allBranches, loading: branchesLoading, error: branchesError } = usePublicBranches({ mode: 'visible' })
  const openBranches = useMemo(() => allBranches.filter((b) => !b.coming_soon), [allBranches])
  const soonBranches = useMemo(() => allBranches.filter((b) => b.coming_soon), [allBranches])
  const { countsBySlug, loading, error, updatedAt, reload } = usePublicQueueCounts()
  const {
    branches,
    selectedBranch: selectedSlug,
    nearestSlug,
    nearestDistanceKm,
    pin,
    locationLabel,
    locating,
    locationError,
    selectBranch,
    updatePin,
    locateNearest,
  } = useCustomerBranch(openBranches, { wanted })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)
  const [soonSlug, setSoonSlug] = useState('')

  // A link to a coming-soon branch (?branch=imus) opens on its "opens soon" state.
  useEffect(() => {
    if (wanted && soonBranches.some((b) => b.slug === wanted)) setSoonSlug(wanted)
  }, [wanted, soonBranches])

  // Find the closest branch once, as soon as the Queue opens (asks for location the first time).
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || pin || wanted || !branches.length) return
    asked.current = true
    locateNearest({ autoSelectNearest: true }).catch(() => {})
  }, [pin, wanted, branches.length, locateNearest])

  const soonBranch = soonBranches.find((b) => b.slug === soonSlug) || null
  const selectedBranch = branches.find((b) => b.slug === selectedSlug) || null
  const shown = soonBranch || selectedBranch
  const nearestBranch = branches.find((b) => b.slug === nearestSlug) || null

  usePageMeta({
    title: shown ? `Queue · ${branchShortName(shown.name)}` : 'Live queue',
    description: 'Live Hakum bay counts at your closest branch.',
    path: CUSTOMER_QUEUE_PATH,
  })

  const selectedCounts = countsBySlug[selectedSlug] || queueCountsFromRow(null)
  const clock = updatedAt ? updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''
  const isClosest = !soonBranch && Boolean(selectedSlug) && selectedSlug === nearestSlug
  const kmTo = (b) => (pin && b ? branchDistanceKm(pin, b) : null)
  const shownKm = kmTo(shown)

  function choose(b) {
    setSheetOpen(false)
    if (b.coming_soon) {
      setSoonSlug(b.slug)
      setParams({ branch: b.slug }, { replace: true })
      return
    }
    setSoonSlug('')
    if (b.slug !== selectedSlug) selectBranch(b.slug)
    setParams({ branch: b.slug }, { replace: true })
  }

  const sheetRows = [...branches, ...soonBranches]

  return (
    <CustomerAppFrame
      title="Live queue"
      subtitle="Car wash is walk-in. Drive in and join the queue."
      banner={{ src: carwashPhoto, position: '50% 45%' }}
      onRefresh={reload}
      cols
    >
      <div className="capp-branch-card capp-branch-card--closest capp-span">
        <div className="capp-branch-card-top">
          <span className="capp-row-icon" aria-hidden>
            <MapPin size={18} strokeWidth={1.75} />
          </span>
          <div className="capp-row-body">
            <p className="capp-eyebrow">{soonBranch ? 'Your pick' : isClosest ? 'Closest branch' : 'Your branch'}</p>
            <strong>{shown ? branchShortName(shown.name) : locating ? 'Finding your branch…' : 'Branch'}</strong>
            <em>
              {isClosest && nearestDistanceKm != null
                ? `About ${formatDistanceKm(nearestDistanceKm)} away · ${locationLabel ? `from ${locationLabel}` : 'from your location'}`
                : [
                    shownKm != null ? `${formatDistanceKm(shownKm)} away` : '',
                    locationLabel && shownKm != null ? `from ${locationLabel}` : '',
                    shown?.address,
                  ]
                    .filter(Boolean)
                    .join(' · ') ||
                  locationError ||
                  'Pick the branch you are going to.'}
            </em>
            {soonBranch ? <span className="capp-soon-tag capp-soon-tag--block">Coming soon</span> : null}
          </div>
          <button
            type="button"
            className="capp-btn capp-btn-ghost capp-queue-loc-btn"
            onClick={() => setLocationSheetOpen(true)}
          >
            {locationLabel ? 'Edit pin' : 'Use my location'}
          </button>
        </div>
      </div>

      {sheetRows.length > 1 || (!branchesLoading && sheetRows.length) ? (
        <div className="capp-span">
          <button type="button" className="capp-btn capp-btn-ghost capp-btn-block capp-branch-change" onClick={() => setSheetOpen(true)}>
            <span>Not your branch? Change</span>
            <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      ) : null}

      {branchesError || error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{branchesError || error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="capp-section capp-queue-counts capp-span" aria-label="Live queue">
        <div className="capp-sect">
          <h2>Live queue</h2>
        </div>
        {soonBranch ? (
          <div className="capp-soon-box">
            <Clock size={22} strokeWidth={1.75} aria-hidden />
            <strong>{branchShortName(soonBranch.name)} opens soon</strong>
            <p>
              The live queue starts here the day {branchShortName(soonBranch.name)} opens.
              {nearestBranch
                ? ` For now, ${branchShortName(nearestBranch.name)} is ${nearestDistanceKm != null ? `${formatDistanceKm(nearestDistanceKm)} away` : 'open'}.`
                : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="capp-livebar" aria-live="polite">
              <span className="capp-live">
                <span className="capp-live-dot" aria-hidden />
                Live
              </span>
              <span>{clock ? `Updated ${clock}` : 'Updating counts'}</span>
            </div>
            {loading && !Object.keys(countsBySlug).length ? <Skeleton /> : <QueueStats counts={selectedCounts} />}
            {!loading && selectedCounts.total === 0 ? <p className="capp-meta">Bay is clear at this branch right now.</p> : null}
          </>
        )}
      </section>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Pick your branch" label="Pick your branch">
        <div className="capp-group">
          {sheetRows.map((b) => {
            const km = kmTo(b)
            const on = b.slug === (soonBranch ? soonSlug : selectedSlug)
            return (
              <Row
                key={b.slug}
                icon={MapPin}
                className={on ? 'is-on' : ''}
                title={branchShortName(b.name)}
                sub={[km != null ? formatDistanceKm(km) : '', b.slug === nearestSlug ? 'Closest to you' : b.address].filter(Boolean).join(' · ')}
                end={
                  b.coming_soon ? (
                    <span className="capp-soon-tag">Coming soon</span>
                  ) : on ? (
                    <Check size={18} strokeWidth={2.2} aria-label="Selected" />
                  ) : null
                }
                onClick={() => choose(b)}
              />
            )
          })}
        </div>
      </Sheet>

      <CustomerLocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        pin={pin}
        branches={branches}
        onApply={(nextPin) => {
          const res = updatePin(nextPin, { autoSelectNearest: true })
          if (res?.nearest?.slug) {
            setSoonSlug('')
            setParams({ branch: res.nearest.slug }, { replace: true })
          }
        }}
      />
    </CustomerAppFrame>
  )
}

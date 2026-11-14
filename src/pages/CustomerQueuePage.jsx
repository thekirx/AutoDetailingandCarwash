import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { QueueStats, Skeleton } from '@/components/customer/CustomerUi'
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
 * /account/queue — live bay counts for one branch. The closest branch is picked from the
 * customer's location; a dropdown changes it. Walk-ins (wash & detailing) just drive in.
 */
export default function CustomerQueuePage() {
  const [params, setParams] = useSearchParams()
  const wanted = String(params.get('branch') || '').trim()
  const { branches: rawBranches, loading: branchesLoading, error: branchesError } = usePublicBranches()
  const { countsBySlug, loading, error, updatedAt, reload } = usePublicQueueCounts()
  const { branches, selectedBranch: selectedSlug, nearestSlug, nearestDistanceKm, pin, locating, locationError, selectBranch, locateNearest } =
    useCustomerBranch(rawBranches, { wanted })

  // Find the closest branch once, as soon as the Queue opens (asks for location the first time).
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current || pin || wanted || !branches.length) return
    asked.current = true
    locateNearest({ autoSelectNearest: true }).catch(() => {})
  }, [pin, wanted, branches.length, locateNearest])

  const selectedBranch = branches.find((b) => b.slug === selectedSlug) || null

  usePageMeta({
    title: selectedBranch ? `Queue · ${branchShortName(selectedBranch.name)}` : 'Live queue',
    description: 'Live Hakum bay counts at your closest branch.',
    path: CUSTOMER_QUEUE_PATH,
  })

  const selectedCounts = countsBySlug[selectedSlug] || queueCountsFromRow(null)
  const clock = updatedAt ? updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''
  const isClosest = Boolean(selectedSlug) && selectedSlug === nearestSlug

  function choose(slug) {
    if (!slug || slug === selectedSlug) return
    selectBranch(slug)
    setParams({ branch: slug }, { replace: true })
  }

  return (
    <CustomerAppFrame title="Live queue" subtitle="Cars on the floor right now." onRefresh={reload} cols>
      <div className="capp-branch-card capp-branch-card--closest capp-span">
        <div className="capp-branch-card-top">
          <span className="capp-row-icon" aria-hidden>
            <MapPin size={18} strokeWidth={1.75} />
          </span>
          <div className="capp-row-body">
            <p className="capp-eyebrow">{isClosest ? 'Closest branch' : 'Your branch'}</p>
            <strong>{selectedBranch ? branchShortName(selectedBranch.name) : locating ? 'Finding your branch…' : 'Branch'}</strong>
            <em>
              {isClosest && nearestDistanceKm != null
                ? `About ${formatDistanceKm(nearestDistanceKm)} away · from your location`
                : selectedBranch?.address || locationError || 'Pick the branch you are going to.'}
            </em>
          </div>
        </div>
        {branches.length > 1 || (!branchesLoading && branches.length) ? (
          <label className="capp-field">
            <span>Not right? Pick your branch</span>
            <select className="capp-select" aria-label="Branch" value={selectedSlug} onChange={(e) => choose(e.target.value)}>
              {branches.map((b) => {
                const km = pin ? branchDistanceKm(pin, b) : null
                return (
                  <option key={b.slug} value={b.slug}>
                    {branchShortName(b.name)}
                    {km == null ? '' : ` · ${formatDistanceKm(km)}`}
                  </option>
                )
              })}
            </select>
          </label>
        ) : null}
      </div>

      {branchesError || error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{branchesError || error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="capp-section capp-queue-counts capp-span" aria-label="Bay counts">
        <div className="capp-livebar" aria-live="polite">
          <span className="capp-live">
            <span className="capp-live-dot" aria-hidden />
            Live
          </span>
          <span>{clock ? `Updated ${clock}` : 'Updating counts'}</span>
        </div>
        {loading && !Object.keys(countsBySlug).length ? <Skeleton /> : <QueueStats counts={selectedCounts} />}
        {!loading && selectedCounts.total === 0 ? <p className="capp-meta">Bay is clear at this branch right now.</p> : null}
      </section>

      <div className="capp-svc-list capp-span">
        <div className="capp-svc capp-svc--walkin" role="note">
          <img className="capp-svc-bg" src={carwashPhoto} alt="" loading="lazy" />
          <span className="capp-svc-in">
            <span className="min-w-0">
              <strong>Car wash</strong>
              <em>Walk-in only. No booking needed.</em>
            </span>
            <span className="capp-svc-from">
              Drive in
              <b>Join the queue</b>
            </span>
          </span>
        </div>
      </div>
    </CustomerAppFrame>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Car, MapPin } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { Badge, QueueStats, Row, SectionHead, Skeleton } from '@/components/customer/CustomerUi'
import VisitProgress from '@/components/customer/VisitProgress'
import { usePublicBranches } from '@/lib/branches'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_QUEUE_PATH, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePageMeta } from '@/lib/pageMeta'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'

function branchShortName(name) {
  return String(name || '').replace(/^Hakum Auto Care\s*/i, '') || name || ''
}

export default function CustomerQueuePage() {
  const [params, setParams] = useSearchParams()
  const wanted = String(params.get('branch') || '').trim()
  const { branches, loading: branchesLoading, error: branchesError } = usePublicBranches()
  const { countsBySlug, loading, error, updatedAt, reload } = usePublicQueueCounts()
  const [myCars, setMyCars] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchPortal()
      .then((data) => {
        if (!cancelled) setMyCars(data.bookings || [])
      })
      .catch(() => {
        if (!cancelled) setMyCars([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectedSlug = useMemo(() => {
    if (wanted && branches.some((b) => b.slug === wanted)) return wanted
    return branches[0]?.slug || ''
  }, [wanted, branches])

  const selectedBranch = branches.find((b) => b.slug === selectedSlug) || null

  usePageMeta({
    title: selectedBranch ? `Queue · ${branchShortName(selectedBranch.name)}` : 'Live queue',
    description: 'Live Hakum bay counts. Switch branches anytime.',
    path: CUSTOMER_QUEUE_PATH,
  })

  const selectedCounts = countsBySlug[selectedSlug] || queueCountsFromRow(null)
  const clock = updatedAt ? updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : ''
  const others = branches.filter((b) => b.slug !== selectedSlug)
  const carsHere = (myCars || []).filter((b) => b.branch === selectedSlug)

  function selectBranch(slug) {
    if (!slug || slug === selectedSlug) return
    setParams({ branch: slug }, { replace: true })
  }

  return (
    <CustomerAppFrame title="Live queue" subtitle="Real-time view of the current queue." backTo="/account" cols>
      <label className="capp-row is-static capp-span" style={{ cursor: 'default' }}>
        <span className="capp-row-icon" aria-hidden>
          <MapPin size={18} strokeWidth={1.75} />
        </span>
        <span className="capp-row-body">
          <strong>{selectedBranch ? branchShortName(selectedBranch.name) : 'Branch'}</strong>
          <em>{selectedBranch?.address || 'Pick a branch to plan your arrival.'}</em>
          {branchesLoading && !branches.length ? null : (
            <select className="capp-select mt-2" aria-label="Branch" value={selectedSlug} onChange={(e) => selectBranch(e.target.value)}>
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </span>
      </label>

      {branchesError || error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{branchesError || error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="capp-section" aria-label="Bay counts">
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

      <section className="capp-section" aria-label="Your cars">
        <SectionHead title="Your cars" note={selectedBranch ? branchShortName(selectedBranch.name) : ''} />
        {myCars === null ? (
          <Skeleton />
        ) : carsHere.length ? (
          <div className="capp-list">
            {carsHere.map((b) => (
              <article key={b.id} className="capp-card">
                <div className="capp-card-row">
                  <div className="min-w-0">
                    <p className="capp-eyebrow">{b.queue_label || 'Ticket'}</p>
                    <h3 className="capp-title" style={{ fontSize: '1.05rem' }}>
                      {b.vehicle_plate || b.service_name || 'Visit'}
                    </h3>
                    <p className="capp-meta">{[b.service_name, [b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Badge status={b.status} label={b.visit?.label || b.status} />
                </div>
                <VisitProgress visit={b.visit} />
              </article>
            ))}
          </div>
        ) : (
          <div className="capp-empty">
            <Car size={18} strokeWidth={1.75} aria-hidden />
            <strong>None of your cars are on this floor</strong>
            Book a visit and your ticket shows up here.
          </div>
        )}
      </section>

      <section className="capp-section capp-span" aria-label="Other branches">
        <SectionHead title="Other branches" />
        <div className="capp-list">
          {others.map((b) => {
            const counts = countsBySlug[b.slug] || queueCountsFromRow(null)
            return (
              <Row
                key={b.slug}
                icon={MapPin}
                title={branchShortName(b.name)}
                sub={`${counts.waiting} waiting · ${counts.in_progress} in wash`}
                end={<b>{counts.total} on floor</b>}
                chevron
                onClick={() => selectBranch(b.slug)}
              />
            )
          })}
          {!branchesLoading && others.length === 0 ? <div className="capp-empty">Only one live branch is on the board.</div> : null}
        </div>
      </section>
    </CustomerAppFrame>
  )
}

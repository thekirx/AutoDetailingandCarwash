import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { usePublicBranches } from '@/lib/branches'
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
  const clock = updatedAt
    ? updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
    : ''
  const others = branches.filter((b) => b.slug !== selectedSlug)

  function selectBranch(slug) {
    if (!slug || slug === selectedSlug) return
    setParams({ branch: slug }, { replace: true })
  }

  return (
    <CustomerAppFrame
      title="Live queue"
      subtitle={selectedBranch ? branchShortName(selectedBranch.name) : 'Pick a branch to plan your arrival.'}
      backTo="/account"
    >
      <div className="capp-livebar" aria-live="polite">
        <span className="capp-live">
          <span className="capp-live-dot" aria-hidden />
          Live
        </span>
        <span>{clock ? `Updated ${clock}` : 'Updating counts'}</span>
      </div>

      {branchesError || error ? (
        <div className="capp-empty" role="alert">
          <strong>{branchesError || error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={reload}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="capp-section" aria-label="Branches">
        <p className="capp-label">Branches</p>
        {branchesLoading && !branches.length ? (
          <div className="capp-skel" aria-hidden />
        ) : (
          <div className="capp-chips" role="tablist" aria-label="Choose branch">
            {branches.map((b, index) => {
              const counts = countsBySlug[b.slug] || queueCountsFromRow(null)
              const active = b.slug === selectedSlug
              return (
                <button
                  key={b.slug}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`capp-chip capp-chip-btn${active ? ' is-active' : ''}`}
                  style={{ '--i': index }}
                  onClick={() => selectBranch(b.slug)}
                >
                  <strong>{branchShortName(b.name)}</strong>
                  <em>{counts.total} on floor</em>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="capp-ticket" aria-label={`${branchShortName(selectedBranch?.name || 'Branch')} counts`}>
        <p className="capp-label">{branchShortName(selectedBranch?.name || 'This branch')}</p>
        {selectedBranch?.address ? <p className="capp-meta">{selectedBranch.address}</p> : null}
        {loading && !Object.keys(countsBySlug).length ? (
          <div className="capp-skel" style={{ marginTop: '0.75rem' }} aria-hidden />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ['Waiting', selectedCounts.waiting],
              ['In wash', selectedCounts.in_progress],
              ['Checking', selectedCounts.final_checking],
              ['On floor', selectedCounts.total],
            ].map(([label, value]) => (
              <div key={label} className="account-stat">
                <p className="account-stat-value">{value}</p>
                <p className="account-stat-label">{label}</p>
              </div>
            ))}
          </div>
        )}
        {!loading && selectedCounts.total === 0 ? (
          <p className="capp-meta" style={{ marginTop: '0.75rem' }}>
            Bay is clear at this branch right now.
          </p>
        ) : null}
      </section>

      <section className="capp-section" aria-label="Other branches">
        <p className="capp-label">Other branches</p>
        <div className="grid gap-2">
          {others.map((b, index) => {
            const counts = countsBySlug[b.slug] || queueCountsFromRow(null)
            return (
              <button
                key={b.slug}
                type="button"
                className="capp-row"
                style={{ '--i': index }}
                onClick={() => selectBranch(b.slug)}
              >
                <span className="min-w-0 flex-1">
                  <strong>{branchShortName(b.name)}</strong>
                  <em>
                    {counts.waiting} waiting · {counts.in_progress} in wash
                  </em>
                </span>
                <span className="capp-q" style={{ fontSize: '1.25rem' }}>
                  {counts.total}
                  <span>floor</span>
                </span>
              </button>
            )
          })}
        </div>
        {!branchesLoading && others.length === 0 ? (
          <div className="capp-empty">Only one live branch is on the board.</div>
        ) : null}
      </section>
    </CustomerAppFrame>
  )
}

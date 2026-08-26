import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import { fetchPublicBranches } from '../lib/branches'
import { customerQueuePath, PUBLIC_QUEUE_POLL_MS } from '../lib/liveQueuePath'
import { usePageMeta } from '../lib/pageMeta'
import {
  ACTIVE_QUEUE_STATUSES,
  STATUS_LABELS,
  buildPublicFloorModel,
} from '../queue/queueLogic'
import { createCoalescedReload } from '../lib/coalesceReload'

const STAT_META = [
  { key: 'waiting', label: 'Waiting', tone: 'wait' },
  { key: 'in_progress', label: 'In progress', tone: 'work' },
  { key: 'final_checking', label: 'Final check', tone: 'check' },
  { key: 'total', label: 'Active total', tone: 'total' },
]

const LANE_META = {
  waiting: { tone: 'wait', hint: 'Ready for bay' },
  in_progress: { tone: 'work', hint: 'On the floor' },
  final_checking: { tone: 'check', hint: 'QC pass' },
}

function LivePulse({ label = 'Live' }) {
  return (
    <span className="lq-pulse">
      <span className="lq-pulse-dot" aria-hidden />
      {label}
    </span>
  )
}

/**
 * @param {{ mode?: 'customer' | 'tv' }} props
 * customer = counts only (branch admin / guest kiosk)
 * tv = shop TV with plate + service/package/detailing
 */
export default function PublicQueuePage({ mode = 'customer' }) {
  const isTv = mode === 'tv'
  const { branch } = useParams()
  const { user, profile, loading: authLoading } = useAuth()
  const [branchDetails, setBranchDetails] = useState(null)
  const [branchValid, setBranchValid] = useState(null)
  const [countsRow, setCountsRow] = useState(null)
  const [floorRows, setFloorRows] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fallbackSlug, setFallbackSlug] = useState(null)

  usePageMeta({
    title: branchDetails?.name
      ? isTv
        ? `Shop TV · ${branchDetails.name}`
        : `Live queue · ${branchDetails.name}`
      : isTv
        ? 'Shop TV queue'
        : 'Live queue',
    description: isTv
      ? 'Shop floor TV board with plate and service kind. For in-store display.'
      : 'Customer-safe live queue counts at Hakum Auto Care. Counts only.',
    path: branch ? (isTv ? `/queue/${branch}/tv` : `/queue/${branch}`) : '/queue',
  })

  const loadQueue = useCallback(async () => {
    if (!branch) return
    setError('')

    const branchQuery = supabase
      .from('branches')
      .select('slug, name, address')
      .eq('slug', branch)
      .eq('is_active', true)
      .eq('is_archived', false)
      .maybeSingle()

    const countsQuery = supabase
      .from('public_queue_counts')
      .select('branch, waiting_count, in_progress_count, final_checking_count, total_active_count')
      .eq('branch', branch)
      .maybeSingle()

    // Customer board: counts only. Shop TV: floor view (plate + service, no phone/name).
    const floorQuery = isTv
      ? supabase
          .from('public_queue_floor')
          .select('branch, queue_number, status, vehicle_plate, service_name, service_pay_category')
          .eq('branch', branch)
          .in('status', ACTIVE_QUEUE_STATUSES)
          .order('queue_number')
      : Promise.resolve({ data: [], error: null })

    const [branchResult, countsResult, floorResult] = await Promise.all([
      branchQuery,
      countsQuery,
      floorQuery,
    ])

    if (branchResult.error || countsResult.error || floorResult.error) {
      setError(
        branchResult.error?.message ||
          countsResult.error?.message ||
          floorResult.error?.message ||
          'Unable to load queue.',
      )
      setLoading(false)
      return
    }

    setBranchValid(!!branchResult.data)
    setBranchDetails(branchResult.data)
    setCountsRow(countsResult.data)
    setFloorRows(floorResult.data || [])
    setLoading(false)
  }, [branch, isTv])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!branch || branchValid === false) return undefined
    const scheduleReload = createCoalescedReload(() => loadQueue(), 400)
    const timer = window.setInterval(() => scheduleReload(), PUBLIC_QUEUE_POLL_MS)
    return () => {
      scheduleReload.cancel()
      window.clearInterval(timer)
    }
  }, [branch, loadQueue, branchValid])

  useEffect(() => {
    if (!branch) return
    fetchPublicBranches()
      .then((rows) => {
        const first = (rows || []).find((b) => b?.slug)?.slug || ''
        setFallbackSlug(first)
      })
      .catch(() => setFallbackSlug(''))
  }, [branch])

  const floorModel = useMemo(() => buildPublicFloorModel(floorRows, branch), [floorRows, branch])
  const counts = useMemo(
    () => ({
      waiting: countsRow?.waiting_count ?? 0,
      in_progress: countsRow?.in_progress_count ?? 0,
      final_checking: countsRow?.final_checking_count ?? 0,
      total: countsRow?.total_active_count ?? 0,
    }),
    [countsRow],
  )

  const timeLabel = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  if (!isTv && authLoading) return null
  if (!isTv && user && profile?.role === 'customer' && branch) {
    return <Navigate to={customerQueuePath(branch)} replace />
  }

  if (!branch) {
    return <Navigate to={fallbackSlug ? `/queue/${fallbackSlug}` : '/queue'} replace />
  }
  if (!loading && branchValid === false) {
    return <Navigate to={fallbackSlug ? `/queue/${fallbackSlug}` : '/queue'} replace />
  }

  return (
    <div className={`lq-board${isTv ? ' lq-board-tv' : ' lq-board-customer'}`}>
      <div className="lq-board-bg" aria-hidden />
      <div className="lq-board-noise" aria-hidden />

      <div className="lq-board-shell">
        <header className="lq-board-top">
          <Link to="/" className="lq-brand" aria-label="Hakum Auto Care home">
            <img src="/branding/hakum-lw-ow.png" alt="" className="lq-brand-mark" width={148} height={84} />
          </Link>

          <div className="lq-board-meta">
            <div className="lq-chip">
              <span className="lq-chip-label">Local time</span>
              <strong className="lq-chip-value tabular-nums">{timeLabel}</strong>
            </div>
            <div className="lq-chip lq-chip-live">
              <span className="lq-chip-label">Board</span>
              <strong className="lq-chip-value">
                <LivePulse label={isTv ? 'Shop TV' : 'Customer'} />
              </strong>
            </div>
          </div>
        </header>

        <div className="lq-board-intro">
          <p className="lq-kicker">
            <LivePulse label={isTv ? 'Shop floor display' : 'Live queue'} />
          </p>
          <h1 className="lq-board-title">{branchDetails?.name || branch}</h1>
          <p className="lq-board-address">
            {isTv
              ? 'Plate and service on the floor. For in-store TV only.'
              : branchDetails?.address || 'Counts update every few seconds. No plate numbers shown.'}
          </p>
          <nav className="lq-board-nav" aria-label="Queue links">
            <Link className="lq-text-link" to="/queue">
              Change branch
            </Link>
            {isTv ? (
              <Link className="lq-text-link" to={`/queue/${branch}`}>
                Customer view
              </Link>
            ) : (
              <Link className="lq-text-link" to={`/queue/${branch}/tv`}>
                Shop TV
              </Link>
            )}
            {!isTv ? (
              <Link className="lq-text-link" to="/book">
                Book a service
              </Link>
            ) : null}
            <Link className="lq-text-link" to="/">
              Home
            </Link>
          </nav>
        </div>

        {error ? (
          <div className="lq-error" role="alert">
            <p>{error}</p>
            <button type="button" className="lq-btn" onClick={loadQueue}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className={`lq-stat-row${isTv ? '' : ' lq-stat-row-hero'}`} aria-label="Queue counts">
              {STAT_META.map(({ key, label, tone }) => (
                <article key={key} className={`lq-stat lq-stat-${tone}`}>
                  <p className="lq-stat-label">{label}</p>
                  {loading ? (
                    <div className="lq-skeleton lq-skeleton-num" />
                  ) : (
                    <p className="lq-stat-num tabular-nums">{counts[key]}</p>
                  )}
                  <p className="lq-stat-sub">{counts[key] === 1 ? 'Vehicle' : 'Vehicles'}</p>
                </article>
              ))}
            </div>

            {!isTv ? (
              <section className="lq-customer-note" aria-live="polite">
                {loading ? (
                  <div className="lq-skeleton lq-skeleton-lane" />
                ) : counts.total === 0 ? (
                  <div className="lq-empty lq-empty-customer">
                    <img src="/branding/hakum-wm-ow.png" alt="" className="lq-empty-mark" width={160} height={40} />
                    <p className="lq-empty-title">Bay is clear</p>
                    <p className="lq-empty-copy">No vehicles in the live queue right now.</p>
                    <Link className="lq-btn" to="/book">
                      Book a visit
                    </Link>
                  </div>
                ) : (
                  <p className="lq-customer-hint">
                    {counts.waiting} waiting · {counts.in_progress} in progress · {counts.final_checking} in final check
                  </p>
                )}
              </section>
            ) : (
              <section className="lq-floor" aria-labelledby="lq-floor-heading">
                <div className="lq-floor-head">
                  <div>
                    <p className="lq-kicker lq-kicker-tight">Floor board</p>
                    <h2 id="lq-floor-heading" className="lq-floor-title">
                      Plate · Service
                    </h2>
                  </div>
                  <img src="/branding/hakum-mark-ow.png" alt="" className="lq-floor-mark" width={48} height={48} />
                </div>

                {loading ? (
                  <div className="lq-floor-skel">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="lq-skeleton lq-skeleton-lane" />
                    ))}
                  </div>
                ) : counts.total === 0 ? (
                  <div className="lq-empty">
                    <img src="/branding/hakum-wm-ow.png" alt="" className="lq-empty-mark" width={160} height={40} />
                    <p className="lq-empty-title">This bay is clear</p>
                    <p className="lq-empty-copy">No vehicles on the live floor right now.</p>
                  </div>
                ) : (
                  <div className="lq-lanes">
                    {ACTIVE_QUEUE_STATUSES.map((status) => {
                      const lane = LANE_META[status]
                      const items = floorModel.groups[status]
                      return (
                        <section key={status} className={`lq-lane lq-lane-${lane.tone}`}>
                          <header className="lq-lane-head">
                            <h3>{STATUS_LABELS[status]}</h3>
                            <span>{lane.hint}</span>
                          </header>
                          <ul className="lq-tickets">
                            {items.length ? (
                              items.map((item) => (
                                <li key={`${status}-${item.queueNumber}-${item.plate}`} className="lq-ticket lq-ticket-tv">
                                  <div className="lq-ticket-main">
                                    <span className="lq-ticket-num tabular-nums">{item.queueNumber}</span>
                                    <span className="lq-ticket-plate tabular-nums">{item.plate}</span>
                                  </div>
                                  <div className="lq-ticket-meta">
                                    <span className={`lq-kind lq-kind-${item.kind}`}>{item.kindLabel}</span>
                                    <span className="lq-ticket-svc">{item.serviceName}</span>
                                  </div>
                                </li>
                              ))
                            ) : (
                              <li className="lq-lane-empty">No active tickets</li>
                            )}
                          </ul>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function PublicQueueTvPage() {
  return <PublicQueuePage mode="tv" />
}

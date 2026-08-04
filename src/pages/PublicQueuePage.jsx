import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchPublicBranches } from '../lib/branches'
import { usePageMeta } from '../lib/pageMeta'
import { ACTIVE_QUEUE_STATUSES, STATUS_LABELS, buildPublicQueueModel } from '../queue/queueLogic'
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

/** Poll safe public_queue_* views only — never Realtime WAL on bookings (full-row PII). */
const PUBLIC_QUEUE_POLL_MS = 8_000

function LivePulse({ label = 'Live' }) {
  return (
    <span className="lq-pulse">
      <span className="lq-pulse-dot" aria-hidden />
      {label}
    </span>
  )
}

export default function PublicQueuePage() {
  const { branch } = useParams()
  const [branchDetails, setBranchDetails] = useState(null)
  const [branchValid, setBranchValid] = useState(null)
  const [countsRow, setCountsRow] = useState(null)
  const [numberRows, setNumberRows] = useState([])
  const [now, setNow] = useState(() => new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fallbackSlug, setFallbackSlug] = useState(null)

  usePageMeta({
    title: branchDetails?.name ? `Live queue · ${branchDetails.name}` : 'Live queue',
    description: 'Customer-safe live service queue at Hakum Auto Care. Queue numbers and bay status only.',
    path: branch ? `/queue/${branch}` : '/queue',
  })

  const loadQueue = useCallback(async () => {
    if (!branch) return
    setError('')

    const [branchResult, countsResult, numbersResult] = await Promise.all([
      supabase
        .from('branches')
        .select('slug, name, address')
        .eq('slug', branch)
        .eq('is_active', true)
        .eq('is_archived', false)
        .maybeSingle(),
      supabase
        .from('public_queue_counts')
        .select('branch, waiting_count, in_progress_count, final_checking_count, total_active_count')
        .eq('branch', branch)
        .maybeSingle(),
      supabase
        .from('public_queue_numbers')
        .select('branch, queue_number, status')
        .eq('branch', branch)
        .in('status', ACTIVE_QUEUE_STATUSES)
        .order('queue_number'),
    ])

    if (branchResult.error || countsResult.error || numbersResult.error) {
      setError(
        branchResult.error?.message ||
          countsResult.error?.message ||
          numbersResult.error?.message ||
          'Unable to load queue.',
      )
      setLoading(false)
      return
    }

    setBranchValid(!!branchResult.data)
    setBranchDetails(branchResult.data)
    setCountsRow(countsResult.data)
    setNumberRows(numbersResult.data || [])
    setLoading(false)
  }, [branch])

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
      .then((rows) => setFallbackSlug(rows[0]?.slug || 'bacoor'))
      .catch(() => setFallbackSlug('bacoor'))
  }, [branch])

  const publicModel = useMemo(() => buildPublicQueueModel(numberRows, branch), [numberRows, branch])
  const counts = useMemo(
    () => ({
      waiting: countsRow?.waiting_count ?? publicModel.counts.waiting,
      in_progress: countsRow?.in_progress_count ?? publicModel.counts.in_progress,
      final_checking: countsRow?.final_checking_count ?? publicModel.counts.final_checking,
      total: countsRow?.total_active_count ?? publicModel.counts.total,
    }),
    [countsRow, publicModel],
  )

  const timeLabel = now.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

  if (!branch) {
    return <Navigate to={fallbackSlug ? `/queue/${fallbackSlug}` : '/queue'} replace />
  }
  if (!loading && branchValid === false) {
    return <Navigate to={fallbackSlug ? `/queue/${fallbackSlug}` : '/queue'} replace />
  }

  return (
    <div className="lq-board">
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
              <span className="lq-chip-label">Status</span>
              <strong className="lq-chip-value">
                <LivePulse label="Online" />
              </strong>
            </div>
          </div>
        </header>

        <div className="lq-board-intro">
          <p className="lq-kicker">
            <LivePulse label="Live queue" />
          </p>
          <h1 className="lq-board-title">{branchDetails?.name || branch}</h1>
          <p className="lq-board-address">{branchDetails?.address || 'Queue numbers update every few seconds.'}</p>
          <nav className="lq-board-nav" aria-label="Queue links">
            <Link className="lq-text-link" to="/queue">
              Change branch
            </Link>
            <Link className="lq-text-link" to="/book">
              Book a service
            </Link>
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
            <div className="lq-stat-row" aria-label="Queue counts">
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

            <section className="lq-floor" aria-labelledby="lq-floor-heading">
              <div className="lq-floor-head">
                <div>
                  <p className="lq-kicker lq-kicker-tight">Queue numbers</p>
                  <h2 id="lq-floor-heading" className="lq-floor-title">
                    Now on the floor
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
                  <p className="lq-empty-copy">No vehicles in the live queue right now. Book ahead or check back soon.</p>
                  <Link className="lq-btn" to="/book">
                    Book a visit
                  </Link>
                </div>
              ) : (
                <div className="lq-lanes">
                  {ACTIVE_QUEUE_STATUSES.map((status) => {
                    const lane = LANE_META[status]
                    const items = publicModel.groups[status]
                    return (
                      <section key={status} className={`lq-lane lq-lane-${lane.tone}`}>
                        <header className="lq-lane-head">
                          <h3>{STATUS_LABELS[status]}</h3>
                          <span>{lane.hint}</span>
                        </header>
                        <ul className="lq-tickets">
                          {items.length ? (
                            items.map((item) => (
                              <li key={`${status}-${item.queueNumber}`} className="lq-ticket">
                                <span className="lq-ticket-num tabular-nums">{item.queueNumber}</span>
                                <span className="lq-ticket-dot" aria-hidden />
                              </li>
                            ))
                          ) : (
                            <li className="lq-lane-empty">No active numbers</li>
                          )}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

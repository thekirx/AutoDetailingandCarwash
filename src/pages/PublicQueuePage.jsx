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
import { SERVICES, WASH_SERVICES } from '../components/public/bredesign/content'
import { MAIN_LINE, branchDirections, branchPhone } from '../lib/homeBranches'

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

/* The header loops through the service photos from the /services cards: the
   work itself, never one branch's own storefront, so it reads right at every
   branch. */
const QUEUE_PHOTOGRAPHY = [...new Set([...SERVICES, ...WASH_SERVICES].map((service) => service.image))]

/* The customer board names each stage in plain words and says what it means,
   instead of the shop's own labels. */
const CUSTOMER_STAGES = [
  { key: 'waiting', label: 'Waiting', tone: 'wait', hint: 'Checked in, waiting for a free bay.' },
  { key: 'in_progress', label: 'On the bay', tone: 'work', hint: 'Being washed or detailed right now.' },
  { key: 'final_checking', label: 'Final check', tone: 'check', hint: 'Last look before handover.' },
]

/* One plain answer to "should I come now?", from the counts alone. The page
   has no timing data, so it says how many cars are ahead, never a wait time. */
function queueStatus(counts) {
  const active = counts.waiting + counts.in_progress + counts.final_checking
  const level = active === 0 ? 'clear' : active <= 3 ? 'short' : active <= 6 ? 'moderate' : 'busy'
  const bars = { clear: 0, short: 1, moderate: 2, busy: 4 }[level]
  const label = { clear: 'Clear', short: 'Short', moderate: 'Moderate', busy: 'Busy' }[level]
  const cars = (n) => `${n} car${n === 1 ? '' : 's'}`
  const ahead = `${cars(counts.waiting)} waiting ahead of you if you arrive now.`
  if (level === 'clear') {
    return { level, bars, label, headline: 'Bay is clear.', detail: 'No cars in line right now. Drive in and we will start on yours.' }
  }
  if (counts.waiting === 0) {
    const onFloor = counts.in_progress + counts.final_checking
    return { level, bars, label, headline: 'No line to wait in.', detail: `Nobody is waiting. ${cars(onFloor)} ${onFloor === 1 ? 'is' : 'are'} already being worked on.` }
  }
  if (level === 'short') return { level, bars, label, headline: 'Short line right now.', detail: ahead }
  if (level === 'moderate') return { level, bars, label, headline: 'Steady, not packed.', detail: ahead }
  return { level, bars, label, headline: 'Busy right now.', detail: `${ahead} Booking a time saves you the wait.` }
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
  const [photoIndex, setPhotoIndex] = useState(0)

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
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return undefined
    const timer = window.setInterval(
      () => setPhotoIndex((index) => (index + 1) % QUEUE_PHOTOGRAPHY.length),
      5500,
    )
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
  const status = queueStatus(counts)
  const branchShort = String(branchDetails?.name || '').replace(/^Hakum Auto Care\s*/i, '') || branch
  const phone = branchPhone(branch) || MAIN_LINE
  const directions = branchDirections({ slug: branch })

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
            <span className="lq-brand-copy">
              <strong>HAKUM</strong>
              <small>AUTO CARE</small>
            </span>
          </Link>

          <div className="lq-board-meta">
            <div className="lq-chip">
              <span className="lq-chip-label">Local time</span>
              <strong className="lq-chip-value tabular-nums">{timeLabel}</strong>
            </div>
            <div className="lq-chip lq-chip-live">
              <span className="lq-chip-label">{isTv ? 'Board' : 'Queue'}</span>
              <strong className="lq-chip-value">
                <LivePulse label={isTv ? 'Shop TV' : 'Live'} />
              </strong>
            </div>
          </div>
        </header>

        <section className="lq-board-hero" aria-labelledby="lq-board-title">
          <div className="lq-board-media" aria-hidden="true">
            {QUEUE_PHOTOGRAPHY.map((photo, index) => (
              <img
                key={photo}
                className={`lq-board-media-slide${index === photoIndex ? ' is-active' : ''}`}
                src={photo}
                alt=""
                loading={index < 2 ? 'eager' : 'lazy'}
              />
            ))}
          </div>
          {isTv ? (
            <div className="lq-board-intro">
              <p className="lq-kicker">
                <LivePulse label={isTv ? 'Shop floor display' : 'Live queue'} />
              </p>
              <h1 id="lq-board-title" className="lq-board-title">{branchDetails?.name || branch}</h1>
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
          ) : (
            <div className="lq-board-intro lq-status">
              <p className="lq-kicker">
                <LivePulse label={`Live queue · ${branchShort}`} />
              </p>
              <h1 id="lq-board-title" className="lq-board-title" aria-live="polite">
                {loading ? 'Checking the line…' : error ? 'Queue unavailable.' : status.headline}
              </h1>
              {!loading && !error ? <p className="lq-status-detail">{status.detail}</p> : null}
              {!loading && !error ? (
                <div className={`lq-meter lq-meter-${status.level}`} aria-label={`The line is ${status.label.toLowerCase()}`}>
                  <div className="lq-meter-track" aria-hidden>
                    {[1, 2, 3, 4].map((bar) => (
                      <i key={bar} className={bar <= status.bars ? 'is-on' : undefined} />
                    ))}
                  </div>
                  <div className="lq-meter-scale" aria-hidden>
                    <span>Clear</span>
                    <strong>{status.label}</strong>
                    <span>Busy</span>
                  </div>
                </div>
              ) : null}
              <nav className="lq-board-nav" aria-label="Queue links">
                <Link className="lq-text-link" to="/queue">
                  Change branch
                </Link>
                <Link className="lq-text-link" to="/">
                  Home
                </Link>
              </nav>
            </div>
          )}
        </section>

        {error ? (
          <div className="lq-error" role="alert">
            <p>{error}</p>
            <button type="button" className="lq-btn" onClick={loadQueue}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {isTv ? (
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
            ) : null}

            {!isTv ? (
              <>
                <div className="lq-stat-row lq-stages" aria-label="Queue counts">
                  {CUSTOMER_STAGES.map(({ key, label, tone, hint }) => (
                    <article key={key} className={`lq-stat lq-stat-${tone}`}>
                      <p className="lq-stat-label">{label}</p>
                      {loading ? (
                        <div className="lq-skeleton lq-skeleton-num" />
                      ) : (
                        <p className="lq-stat-num tabular-nums">{counts[key]}</p>
                      )}
                      <p className="lq-stat-sub">{hint}</p>
                    </article>
                  ))}
                </div>

                {/* Contact sits right under the numbers: once the customer
                    knows the line, the next step is to book, go, or call. */}
                <section className="lq-contact" aria-label={`Contact ${branchDetails?.name || 'this branch'}`}>
                  <div className="lq-contact-branch">
                    <strong>{branchDetails?.name || branch}</strong>
                    {branchDetails?.address ? <span>{branchDetails.address}</span> : null}
                  </div>
                  <div className="lq-contact-actions">
                    <Link className="lq-action lq-action-primary" to="/book" aria-label="Book a service">
                      Book<span className="lq-action-more">a service</span>
                    </Link>
                    {directions ? (
                      <a className="lq-action" href={directions.google} target="_blank" rel="noreferrer">
                        Directions
                      </a>
                    ) : null}
                    <a className="lq-action" href={phone.href} aria-label={`Call ${phone.display}`}>
                      Call<span className="lq-action-more">{phone.display}</span>
                    </a>
                  </div>
                  <p className="lq-contact-note">
                    Counts only. No plate numbers or names are shown. Updates every few seconds.
                  </p>
                </section>
              </>
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

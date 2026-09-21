import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Bike, Car } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchPublicBranches } from '../lib/branches'
import { publicBranchName } from '../lib/homeBranches'
import { PUBLIC_TV_POLL_MS } from '../lib/liveQueuePath'
import { usePageMeta } from '../lib/pageMeta'
import { createCoalescedReload } from '../lib/coalesceReload'
import {
  TV_BOARD_LANES,
  buildPublicTvBoardModel,
  formatTvClock,
} from '../queue/queueLogic'
import shopfront from '../assets/about/hakum-shopfront-dusk-wide.webp'

const TV_FLOOR_SELECT =
  'booking_id, visit_group_id, branch, queue_number, status, vehicle_plate, vehicle_make, vehicle_model, vehicle_type, service_name, service_pay_category, crew_names'
const TV_FLOOR_SELECT_LEGACY = 'branch, queue_number, status, vehicle_plate, service_name, service_pay_category'
const TV_MAX_DENSITY = 5

function floorFingerprint(rows) {
  return (rows || [])
    .map((row) =>
      [row.booking_id || row.queue_number, row.status, row.crew_names || '', row.service_name || '', row.vehicle_plate || ''].join(':'),
    )
    .join('|')
}

function useTvFitDensity(baseDensity, totalCards) {
  const lanesRef = useRef(null)
  const [fit, setFit] = useState(baseDensity)

  useLayoutEffect(() => {
    setFit(baseDensity)
  }, [baseDensity, totalCards])

  useLayoutEffect(() => {
    const root = lanesRef.current
    if (!root) return undefined
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = window.requestAnimationFrame(() => {
        const overflowing = [...root.querySelectorAll('.tv-lane-body')].some(
          (el) => el.scrollHeight - el.clientHeight > 4,
        )
        if (!overflowing) return
        setFit((current) => {
          const next = Math.min(TV_MAX_DENSITY, Math.max(current, baseDensity) + 1)
          return next === current ? current : next
        })
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    measure()
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [baseDensity, totalCards, fit])

  return [Math.max(baseDensity, fit), lanesRef]
}

const TvClock = memo(function TvClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <p className="tv-clock tabular-nums" aria-live="off">
      {formatTvClock(now)}
    </p>
  )
})

const TvCard = memo(function TvCard({ card }) {
  const Icon = card.isMotorcycle ? Bike : Car
  return (
    <article className="tv-card">
      <div className="tv-card-main">
        <span className="tv-card-icon" aria-hidden>
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="tv-card-copy">
          <p className="tv-card-plate">{card.plate}</p>
          {card.vehicleLine ? <p className="tv-card-car">{card.vehicleLine}</p> : null}
          <ul className="tv-card-services">
            {card.services.map((svc) => (
              <li key={svc}>{svc}</li>
            ))}
          </ul>
        </div>
      </div>
      {card.crew ? <p className="tv-card-crew">{card.crew}</p> : null}
    </article>
  )
})

export default function PublicQueueTvPage() {
  const { branch } = useParams()
  const [branchDetails, setBranchDetails] = useState(null)
  const [floorRows, setFloorRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const floorKeyRef = useRef('')

  usePageMeta({
    title: branchDetails?.name ? `Shop TV · ${branchDetails.name}` : 'Shop TV queue',
    description: 'In-store landscape board: waiting, in progress, and ready for payment. No sign-in.',
    path: branch ? `/queue/${branch}/tv` : '/queue',
  })

  const loadQueue = useCallback(async () => {
    if (!branch) return
    let floorResult = await supabase
      .from('public_queue_floor')
      .select(TV_FLOOR_SELECT)
      .eq('branch', branch)
      .order('queue_number')

    if (floorResult.error) {
      floorResult = await supabase
        .from('public_queue_floor')
        .select(TV_FLOOR_SELECT_LEGACY)
        .eq('branch', branch)
        .order('queue_number')
    }

    if (floorResult.error) {
      setError(floorResult.error.message || 'Unable to load shop TV.')
      setLoading(false)
      return
    }

    const nextRows = floorResult.data || []
    const nextKey = floorFingerprint(nextRows)
    setError((prev) => (prev ? '' : prev))
    if (nextKey !== floorKeyRef.current) {
      floorKeyRef.current = nextKey
      setFloorRows(nextRows)
    }
    setLoading(false)
  }, [branch])

  useEffect(() => {
    loadQueue()
  }, [loadQueue])

  useEffect(() => {
    if (!branch) return undefined
    const scheduleReload = createCoalescedReload(() => loadQueue(), 180)
    const poll = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      scheduleReload()
    }
    const timer = window.setInterval(poll, PUBLIC_TV_POLL_MS)
    const onVisible = () => {
      if (!document.hidden) scheduleReload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      scheduleReload.cancel()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [branch, loadQueue])

  useEffect(() => {
    let cancelled = false
    fetchPublicBranches({ mode: 'visible' })
      .then((rows) => {
        if (cancelled) return
        const match = (rows || []).find((item) => item.slug === branch) || null
        setBranchDetails(match)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [branch])

  const board = useMemo(() => buildPublicTvBoardModel(floorRows, branch), [floorRows, branch])
  const [density, lanesRef] = useTvFitDensity(board.density, board.counts.total)
  const branchTitle = `Hakum Auto Care ${publicBranchName(branchDetails || { slug: branch, name: branchDetails?.name || branch })}`.toUpperCase()

  if (!branch) {
    return <Navigate to="/queue" replace />
  }

  return (
    <div className="tv-board" data-density={density} data-loading={loading ? '1' : '0'}>
      <img
        className="tv-board-bg"
        src={shopfront}
        alt=""
        width={1920}
        height={1080}
        decoding="async"
        fetchPriority="high"
      />
      <div className="tv-board-scrim" aria-hidden />

      <header className="tv-head">
        <h1 className="tv-brand">{branchTitle}</h1>
        <div className="tv-head-meta">
          <span className="tv-live">
            <span className="tv-live-dot" aria-hidden />
            Live queue
          </span>
          <TvClock />
        </div>
      </header>

      {error ? (
        <div className="tv-error" role="alert">
          <p>{error}</p>
          <button type="button" className="tv-retry" onClick={loadQueue}>
            Try again
          </button>
        </div>
      ) : (
        <div ref={lanesRef} className="tv-lanes" style={{ '--tv-lane-count': TV_BOARD_LANES.length }}>
          {TV_BOARD_LANES.map((lane) => {
            const cards = board.lanes[lane.id] || []
            return (
              <section key={lane.id} className={`tv-lane tv-lane-${lane.tone}`} aria-label={lane.label}>
                <header className="tv-lane-head">
                  <h2>{lane.label}</h2>
                  <span className="tv-lane-count tabular-nums">{loading ? '—' : cards.length}</span>
                </header>
                <div className="tv-lane-body">
                  {loading ? (
                    <>
                      <div className="tv-skel" />
                      <div className="tv-skel" />
                    </>
                  ) : cards.length ? (
                    cards.map((card) => <TvCard key={card.id} card={card} />)
                  ) : (
                    <p className="tv-empty">No vehicles here</p>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

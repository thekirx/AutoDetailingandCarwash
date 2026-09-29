import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Cake, CalendarDays, CalendarPlus, Car, Plus, Receipt, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { formatMoney } from '@/queue/queueApi'
import { customerQueuePath, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'
import { supabase } from '@/lib/supabase'
import { CUSTOMER_BOOK_PATH, CUSTOMER_LOYALTY_PATH, CUSTOMER_MORE_PATH } from '@/lib/customerAccountNav'
import CustomerPinControl from '@/components/customer/CustomerPinControl'
import { branchDistanceKm } from '@/lib/branchGeo'
import { branchLabel, fetchPortal, greeting, initials, portalAction } from '@/lib/customerPortalClient'
import { formatDistanceKm, loadCustomerPin, resolveCustomerQueueBranch } from '@/lib/customerLocation'
import { buildThumbReview } from '@/lib/serviceReviews'
import { latestFinishedVisit, latestReviewableVisit, reviewDelayRemainingMs } from '@/lib/visitReviewDelay'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell from '@/components/NotificationBell'
import ActiveVisitCard from '@/components/customer/ActiveVisitCard'
import BranchWeather from '@/components/customer/BranchWeather'
import StampTrack from '@/components/customer/StampTrack'
import { Badge, Pills, QueueStats, Row, SectionHead, Skeleton, Tile } from '@/components/customer/CustomerUi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

const EMPTY_LIST = []

function formatWhen(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return '-'
  }
}

function formatVisitDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

const ACTIVITY_TABS = [
  { id: 'history', label: 'Past visits' },
  { id: 'purchases', label: 'Purchases' },
]

export default function CustomerAccountPage() {
  const { profile: authProfile, user, session, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pin, setPin] = useState(() => loadCustomerPin())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingVote, setRatingVote] = useState('')
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingDone, setRatingDone] = useState(false)
  const [reviewNow, setReviewNow] = useState(() => Date.now())
  const { countsBySlug } = usePublicQueueCounts()

  const branches = data?.branches || EMPTY_LIST
  const bookings = data?.bookings || EMPTY_LIST
  const history = data?.history || EMPTY_LIST
  const purchases = data?.purchases || []
  const vehicles = data?.vehicles || []
  const loyalty = data?.loyalty
  const birthday = data?.birthday
  const dueMaintenance = data?.maintenanceDue || []

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const next = await fetchPortal()
      setData(next)
      const latest = latestFinishedVisit([...(next.history || []), ...(next.bookings || [])])
      if (latest?.id) {
        const { data: existing } = await supabase.from('service_reviews').select('id').eq('booking_id', latest.id).maybeSingle()
        setRatingDone(Boolean(existing))
      } else {
        setRatingDone(false)
      }
      setSelectedBranch((current) => {
        const list = next.branches || []
        if (current && list.some((b) => b.slug === current)) return current
        const resolved = resolveCustomerQueueBranch({ pin: loadCustomerPin(), branches: list })
        return resolved.source === 'nearest' ? resolved.slug : ''
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !session?.access_token) return
    if (authProfile?.role === 'customer') load()
  }, [load, authProfile, session?.access_token, authLoading])

  const selectedCounts = countsBySlug[selectedBranch] || queueCountsFromRow(null)
  const queueHref = customerQueuePath(selectedBranch)
  const fullName = data?.profile?.full_name || authProfile?.full_name || ''
  const firstName = fullName.split(' ')[0] || ''
  const activeVisit = bookings[0]
  const reviewVisit = latestReviewableVisit([...history, ...bookings], reviewNow)
  const reviewBranch = branches.find((b) => b.slug === reviewVisit?.branch)
  const weatherBranch =
    branches.find((b) => b.slug === selectedBranch) ||
    branches.find((b) => b.slug === activeVisit?.branch) ||
    branches[0]
  const stampsLine = useMemo(() => {
    if (!loyalty || loyalty.stampsEnabled === false) return 'Rewards and perks'
    return `${loyalty.completed ?? 0}/${loyalty.cardSlots ?? 10} stamps`
  }, [loyalty])
  const nearestSlug = useMemo(() => {
    if (!pin) return ''
    const resolved = resolveCustomerQueueBranch({ pin, branches })
    return resolved.source === 'nearest' ? resolved.slug : ''
  }, [pin, branches])

  useEffect(() => {
    const remaining = reviewDelayRemainingMs([...history, ...bookings], reviewNow)
    if (remaining == null) return undefined
    const id = window.setTimeout(() => setReviewNow(Date.now()), remaining + 250)
    return () => window.clearTimeout(id)
  }, [history, bookings, reviewNow])

  useEffect(() => {
    if (selectedBranch || !nearestSlug) return
    setSelectedBranch(nearestSlug)
  }, [selectedBranch, nearestSlug])

  if (authLoading) {
    return (
      <div className="capp">
        <div className="capp-stage">
          <div className="capp-scroll">
            <Skeleton n={3} />
          </div>
        </div>
      </div>
    )
  }

  if (!user || !authProfile || authProfile.role !== 'customer') {
    return <Navigate to="/signin" replace />
  }

  async function submitReview(vote) {
    const scores = buildThumbReview(vote, ratingComment)
    if (!scores || !reviewVisit?.id) return
    setRatingVote(vote)
    setRatingSaving(true)
    try {
      const body = await portalAction('submit-review', { booking_id: reviewVisit.id, ...scores })
      setRatingDone(true)
      setRatingOpen(false)
      const link = body.google_review_url || reviewBranch?.google_review_url || ''
      if (vote === 'up' && link) {
        window.open(link, '_blank', 'noopener,noreferrer')
        toast.success('Thanks — Google reviews is open so you can share it there.')
      } else if (vote === 'up') {
        toast.success('Thanks. This branch has no Google review link yet.')
      } else {
        toast.success(body.already ? 'Already rated this visit' : 'Thanks — we will look into it.')
      }
    } catch (err) {
      toast.error(err.message || 'Could not submit review')
    } finally {
      setRatingSaving(false)
    }
  }

  return (
    <CustomerAppFrame
      cols
      className="capp-account-home"
      hero={
        <header className="capp-hero">
          <div className="capp-hero-bar">
            <div className="min-w-0">
              <div className="capp-brand">
                <img
                  className="capp-brand-logo capp-brand-logo--light"
                  src="/branding/hakum-lw-blue.png"
                  alt="Hakum Auto Care"
                  width="148"
                  height="40"
                  decoding="async"
                />
                <img
                  className="capp-brand-logo capp-brand-logo--dark"
                  src="/branding/hakum-lw-ow.png"
                  alt=""
                  width="148"
                  height="40"
                  decoding="async"
                  aria-hidden
                />
              </div>
              <div className="capp-hero-greet">
                <p className="capp-greet">{greeting()},</p>
                <BranchWeather branch={weatherBranch} />
              </div>
              <h1>{firstName || 'there'}</h1>
              <p className="capp-hero-sub">
                {activeVisit
                  ? `${activeVisit.vehicle_plate || 'Your car'} is ${String(activeVisit.visit?.label || activeVisit.status).toLowerCase()}.`
                  : 'Your car deserves a great day too.'}
              </p>
            </div>
            <div className="capp-icon-row account-mobile-only">
              <NotificationBell variant="capp" homeUrl={`${CUSTOMER_MORE_PATH}?tab=alerts`} homeLabel="Notifications" />
              <Link className="capp-avatar" to={CUSTOMER_MORE_PATH} aria-label="Settings">
                {initials(fullName) || <Car size={18} strokeWidth={1.75} aria-hidden />}
              </Link>
            </div>
          </div>
        </header>
      }
    >
      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="capp-span">
          <Skeleton />
        </div>
      ) : activeVisit ? (
        <ActiveVisitCard visit={activeVisit} branchName={branchLabel(branches, activeVisit.branch)} />
      ) : null}

      {dueMaintenance.length ? (
        <div className="capp-card capp-span" role="status">
          <div className="capp-card-row">
            <span className="capp-row-icon" aria-hidden>
              <Wrench size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <strong>Paint maintenance due</strong>
              <p className="text-sm text-muted-foreground">
                {dueMaintenance.map((row) => row.plate_number || 'Your car').join(', ')} should come in for maintenance. Book a paint maintenance visit.
              </p>
            </div>
          </div>
          <Link
            className="capp-btn capp-btn-fill mt-3"
            to={`${CUSTOMER_BOOK_PATH}?service=paint-maintenance&plate=${encodeURIComponent(dueMaintenance[0].plate_number || '')}`}
          >
            Book maintenance
          </Link>
        </div>
      ) : null}

      <div className={`capp-tiles capp-span${!activeVisit ? ' capp-home-quick' : ''}`}>
        <Tile icon={CalendarPlus} title="Book a service" sub="Schedule your visit" to={CUSTOMER_BOOK_PATH} />
        <Tile
          icon={vehicles.length ? Car : Plus}
          title={vehicles.length ? 'My cars' : 'Add a car'}
          sub={vehicles.length ? `${vehicles.length} saved` : 'Save a plate'}
          to={vehicles.length ? `${CUSTOMER_MORE_PATH}?tab=garage` : `${CUSTOMER_MORE_PATH}?tab=garage&add=1`}
        />
        <Tile icon={CalendarDays} title="Events" sub="Meets and promos" to="/account/events" />
      </div>

      {loyalty && loyalty.stampsEnabled !== false ? (
        <Link className="capp-card capp-loyalty-home capp-span" to={CUSTOMER_LOYALTY_PATH}>
          <div className="capp-card-row">
            <div className="min-w-0">
              <p className="capp-eyebrow">Loyalty</p>
              <h2 className="capp-title">Loyalty program</h2>
              <p className="capp-meta">{stampsLine}</p>
              {loyalty.pointsEnabled !== false ? (
                <p className="capp-meta">{loyalty.loyaltyPoints ?? 0} points</p>
              ) : null}
            </div>
          </div>
          <StampTrack
            slots={loyalty.cardSlots}
            completed={loyalty.completed}
            gifts={(loyalty.milestones || []).map((m) => m.threshold_points)}
          />
          <span className="capp-loyalty-link">View rewards <span aria-hidden="true">↗</span></span>
        </Link>
      ) : (
        <Link className="capp-card capp-span" to={CUSTOMER_LOYALTY_PATH}>
          <p className="capp-eyebrow">Loyalty</p>
          <h2 className="capp-title">Loyalty program</h2>
          <p className="capp-meta">Rewards and perks</p>
        </Link>
      )}

      <section className="capp-section" aria-label="Live queue">
        <SectionHead
          title="Live queue"
          note={selectedBranch ? (nearestSlug === selectedBranch ? 'Nearest to you' : branchLabel(branches, selectedBranch)) : 'Choose a branch'}
          to={selectedBranch ? queueHref : undefined}
        />
        <label className="capp-field">
          <span>Branch</span>
          <select
            className="capp-select"
            aria-label="Choose a branch to check the live queue"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {pin ? null : <option value="">Select a branch first</option>}
            {branches.map((b) => {
              const km = pin ? branchDistanceKm(pin, b) : null
              const away = km == null ? '' : ` · ${formatDistanceKm(km)}`
              return (
                <option key={b.slug} value={b.slug}>
                  {b.name}{away}
                </option>
              )
            })}
          </select>
        </label>
        <CustomerPinControl
          branches={branches}
          currentSlug={selectedBranch}
          pin={pin}
          onPin={setPin}
          onChoose={setSelectedBranch}
        />
        {selectedBranch ? (
          <QueueStats counts={selectedCounts} />
        ) : (
          <p className="capp-meta">Pick a branch to see waiting, in-progress, and checking counts.</p>
        )}
      </section>

      {birthday?.perk ? (
        <div className="capp-note">
          <strong>
            <Cake className="mr-1 inline size-4" aria-hidden /> Birthday treat: one free service
          </strong>
          <p>
            Show this at any Hakum branch. Valid until{' '}
            {birthday.perk.expires_at
              ? new Date(birthday.perk.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
              : 'this month'}
            .
          </p>
        </div>
      ) : !loading && birthday && !birthday.date_of_birth ? (
        <Row
          icon={Cake}
          title="Add your birthday"
          sub="Free carwash on your day."
          chevron
          to={`${CUSTOMER_MORE_PATH}?tab=account`}
        />
      ) : null}

      {!loading && !ratingDone && reviewVisit ? (
        <section className="capp-card capp-span" aria-label="Rate your last visit">
          <div className="capp-card-row flex-wrap items-center">
            <div className="min-w-0">
              <h2 className="capp-title">Rate your last visit</h2>
              <p className="capp-meta">
                {formatVisitDate(reviewVisit.scheduled_start || reviewVisit.created_at) || 'Completed visit'}
                {reviewVisit.service_name ? ` · ${reviewVisit.service_name}` : ''}
                {branchLabel(branches, reviewVisit.branch) ? ` · ${branchLabel(branches, reviewVisit.branch)}` : ''}
              </p>
            </div>
            <button type="button" className="capp-btn capp-btn-fill min-h-11 shrink-0" onClick={() => setRatingOpen(true)}>
              Rate visit
            </button>
          </div>
          <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
            <DialogContent className="capp sm:max-w-md">
              <DialogHeader>
                <DialogTitle>How was your visit?</DialogTitle>
                <DialogDescription>
                  {formatVisitDate(reviewVisit.scheduled_start || reviewVisit.created_at)}
                  {reviewVisit.service_name ? ` · ${reviewVisit.service_name}` : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="capp-thumbs" role="group" aria-label="How was your visit?">
                <button
                  type="button"
                  className={`capp-thumb${ratingVote === 'up' ? ' is-on' : ''}`}
                  disabled={ratingSaving}
                  onClick={() => submitReview('up')}
                >
                  <ThumbsUp size={22} strokeWidth={1.75} aria-hidden />
                  Thumbs up
                </button>
                <button
                  type="button"
                  className={`capp-thumb${ratingVote === 'down' ? ' is-on' : ''}`}
                  disabled={ratingSaving}
                  onClick={() => submitReview('down')}
                >
                  <ThumbsDown size={22} strokeWidth={1.75} aria-hidden />
                  Thumbs down
                </button>
              </div>
              <label className="capp-field">
                <span>Note (optional)</span>
                <textarea rows={2} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Tell us what stood out" />
              </label>
              <p className="capp-meta">A thumbs up opens this branch&apos;s Google review page.</p>
            </DialogContent>
          </Dialog>
        </section>
      ) : null}

      <section className="capp-section capp-span" aria-labelledby="activity-heading">
        <SectionHead title={<span id="activity-heading">Recent activity</span>} />
        <Pills items={ACTIVITY_TABS} value={tab} onChange={setTab} label="Activity" />
        <div className="capp-list">
          {loading ? (
            <Skeleton n={2} />
          ) : tab === 'history' ? (
            history.length === 0 ? (
              <div className="capp-empty">
                <strong>No past visits yet</strong>
                Completed services show up here.
              </div>
            ) : (
              history.slice(0, 8).map((row) => (
                <Row
                  key={row.id}
                  as="article"
                  icon={CalendarDays}
                  title={row.vehicle_plate || 'Visit'}
                  sub={`${formatWhen(row.created_at || row.scheduled_start)} · ${branchLabel(branches, row.branch) || row.branch}`}
                  end={
                    <>
                      <b>{formatMoney(row.final_price_minor)}</b>
                      <Badge status={row.status} label={row.status} />
                    </>
                  }
                />
              ))
            )
          ) : purchases.length === 0 ? (
            <div className="capp-empty">
              <strong>No store purchases linked</strong>
              Ask the shop to search your name or plate at checkout.
            </div>
          ) : (
            purchases.slice(0, 8).map((row) => (
              <Row
                key={row.id}
                as="article"
                icon={Receipt}
                title="Store purchase"
                sub={`${formatWhen(row.occurred_at)} · ${row.payment_method || 'paid'}`}
                end={<b>{formatMoney(row.total_minor)}</b>}
              />
            ))
          )}
        </div>
      </section>
    </CustomerAppFrame>
  )
}

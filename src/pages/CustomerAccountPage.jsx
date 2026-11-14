import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, CalendarPlus, Check, ChevronDown, Clock, Droplets, MapPin, Radio, Receipt, Settings, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { formatMoney } from '@/queue/queueApi'
import { customerQueuePath, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'
import { supabase } from '@/lib/supabase'
import { CUSTOMER_BOOK_PATH, CUSTOMER_CARS_PATH, CUSTOMER_MORE_PATH, CUSTOMER_SETTINGS_PATH, customerVisitPath } from '@/lib/customerAccountNav'
import { DAY_MS, activityInRange, isoDay } from '@/lib/customerActivity'
import { branchLabel, fetchPortal, greeting, portalAction } from '@/lib/customerPortalClient'
import { formatDistanceKm } from '@/lib/customerLocation'
import { useCustomerBranch } from '@/lib/useCustomerBranch'
import { buildThumbReview } from '@/lib/serviceReviews'
import { COMPLAINT_CATEGORIES, thumbDownComplaintPayload } from '@/lib/opsForms'
import { latestFinishedVisit, latestReviewableVisit, reviewDelayRemainingMs } from '@/lib/visitReviewDelay'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell from '@/components/NotificationBell'
import ActiveVisitCard from '@/components/customer/ActiveVisitCard'
import BranchWeather from '@/components/customer/BranchWeather'
import { BirthdayGreetingSheet, BirthdayHomeCard } from '@/components/customer/BirthdayGreeting'
import { ProfileProgressCard } from '@/components/customer/ProfileProgress'
import { Badge, Pills, Row, SectionHead, Skeleton } from '@/components/customer/CustomerUi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  EXISTING_HISTORY_MESSAGE,
  HISTORY_ATTACH_WARNING,
  clearHistoryAccountNoticeFlags,
  readHistoryAccountNotices,
} from '@/lib/vehicleTransfer'

const EMPTY_LIST = []

function carsLabel(n) {
  const count = Number(n) || 0
  return count === 1 ? '1 car' : `${count} cars`
}

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

/* Desktop hero line: "Your car is …" finished from the visit's current stage. */
const STAGE_PHRASES = {
  booked: 'booked in',
  waiting: 'in the queue',
  intake: 'checked in',
  'in progress': 'in progress',
  checking: 'being checked',
  'final checking': 'being checked',
  releasing: 'almost ready',
  payment: 'ready for payment',
  'for payment': 'ready for payment',
  completed: 'done',
}

function stagePhrase(visit) {
  const label = String(visit?.visit?.label || visit?.status || '').toLowerCase()
  return STAGE_PHRASES[label] || label || 'booked in'
}

const ACTIVITY_TABS = [
  { id: 'history', label: 'Past visits' },
  { id: 'purchases', label: 'Purchases' },
]

export default function CustomerAccountPage() {
  const location = useLocation()
  // Capture once per mount. Do not clear sessionStorage during render — Strict Mode
  // remounts would lose the signup banner before paint.
  const [historyNotices] = useState(() =>
    readHistoryAccountNotices({ locationState: location.state, storage: sessionStorage }),
  )
  const existingHistory = historyNotices.existingHistory
  const historyWarning = historyNotices.historyWarning
  useEffect(() => {
    clearHistoryAccountNoticeFlags(sessionStorage)
  }, [])
  const { profile: authProfile, user, session, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [activityOpen, setActivityOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [range, setRange] = useState(null)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingVote, setRatingVote] = useState('')
  const [ratingComment, setRatingComment] = useState('')
  const [ratingCategory, setRatingCategory] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingDone, setRatingDone] = useState(false)
  const [reviewNow, setReviewNow] = useState(() => Date.now())
  const { countsBySlug } = usePublicQueueCounts()

  const { branches, selectedBranch, nearestSlug, nearestDistanceKm, pin, locating, locateNearest } = useCustomerBranch(
    data?.branches || EMPTY_LIST,
  )
  const bookings = data?.bookings || EMPTY_LIST
  const history = data?.history || EMPTY_LIST
  const purchases = data?.purchases || EMPTY_LIST
  const vehicles = data?.vehicles || []
  const birthday = data?.birthday
  const dueMaintenance = data?.maintenanceDue || []
  const maintenanceSchedules = data?.maintenanceSchedules || dueMaintenance

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
  const visitsShown = useMemo(
    () => activityInRange(history, (row) => row.created_at || row.scheduled_start, range),
    [history, range],
  )
  const purchasesShown = useMemo(() => activityInRange(purchases, (row) => row.occurred_at, range), [purchases, range])

  useEffect(() => {
    const remaining = reviewDelayRemainingMs([...history, ...bookings], reviewNow)
    if (remaining == null) return undefined
    const id = window.setTimeout(() => setReviewNow(Date.now()), remaining + 250)
    return () => window.clearTimeout(id)
  }, [history, bookings, reviewNow])

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
    if (vote === 'down') {
      const complaint = thumbDownComplaintPayload({
        name: authProfile.full_name,
        phone: authProfile.phone,
        branch: reviewVisit.branch,
        category: ratingCategory,
        description: ratingComment,
        bookingId: reviewVisit.id,
      })
      if (!complaint) {
        toast.error('Choose what went wrong and tell us what happened.')
        return
      }
    }
    setRatingVote(vote)
    setRatingSaving(true)
    try {
      const body = await portalAction('submit-review', {
        booking_id: reviewVisit.id,
        ...scores,
        category: vote === 'down' ? ratingCategory : undefined,
        description: vote === 'down' ? ratingComment : undefined,
      })
      setRatingDone(true)
      setRatingOpen(false)
      const link = body.google_review_url || reviewBranch?.google_review_url || ''
      if (vote === 'up' && link) {
        window.open(link, '_blank', 'noopener,noreferrer')
        toast.success('Thanks. Google reviews is open so you can share it there.')
      } else if (vote === 'up') {
        toast.success('Thanks. This branch has no Google review link yet.')
      } else {
        toast.success(body.already ? 'Already rated this visit' : 'Thanks. The branch has your complaint.')
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
      navTitle="Home"
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
              </div>
              <h1>{firstName || 'there'}</h1>
              <p className="capp-hero-sub">
                {activeVisit
                  ? `${activeVisit.vehicle_plate || 'Your car'} is ${String(activeVisit.visit?.label || activeVisit.status).toLowerCase()}.`
                  : 'Your car deserves a great day too.'}
              </p>
            </div>
            {/* Right side: bell + gear (Settings), and the weather under them. */}
            <div className="capp-hero-side">
              <div className="capp-icon-row account-mobile-only">
                <NotificationBell variant="capp" homeUrl={`${CUSTOMER_MORE_PATH}?tab=alerts`} homeLabel="Notifications" />
                <Link className="capp-avatar capp-gear" to={CUSTOMER_SETTINGS_PATH} aria-label="Settings">
                  <Settings size={20} strokeWidth={1.75} aria-hidden />
                </Link>
              </div>
              <BranchWeather
                userCoords={pin}
                branch={weatherBranch}
                onLocate={() => locateNearest({ autoSelectNearest: true }).catch(() => {})}
                locating={locating}
                className="capp-weather--side"
              />
            </div>
          </div>
          {/* Desktop: the hero is the visit, like the site's own page heroes —
              the title on the left, the live ticket on the right. */}
          <div className="capp-hero-desk">
            <div className="capp-hero-desk-copy">
              <div className="capp-desk-top-row">
                <p className="capp-desk-eyebrow">
                  {greeting()}, {firstName || 'there'}
                </p>
                <BranchWeather
                  userCoords={pin}
                  branch={weatherBranch}
                  onLocate={() => locateNearest({ autoSelectNearest: true }).catch(() => {})}
                  locating={locating}
                  className="capp-weather--desk"
                />
              </div>
              <h1 className="capp-desk-title">
                {activeVisit ? 'Your car is' : 'Ready when'}
                <em>{activeVisit ? `${stagePhrase(activeVisit)}.` : 'you are.'}</em>
              </h1>
              <p className="capp-desk-lede">
                {activeVisit
                  ? `${activeVisit.service_name || 'Your service'} on the ${[activeVisit.vehicle_make, activeVisit.vehicle_model].filter(Boolean).join(' ') || activeVisit.vehicle_plate || 'car'}. We move it along the board as the team works.`
                  : 'Book a service and follow your car on the floor, live, from any screen.'}
              </p>
              <div className="capp-desk-actions">
                {activeVisit ? (
                  <>
                    <Link className="capp-btn capp-btn-fill" to={customerQueuePath(activeVisit.branch)}>
                      View live queue
                    </Link>
                    <Link className="capp-btn capp-btn-ghost" to={CUSTOMER_BOOK_PATH}>
                      Book another service
                    </Link>
                  </>
                ) : (
                  <Link className="capp-btn capp-btn-fill" to={CUSTOMER_BOOK_PATH}>
                    <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
                    Book a service
                  </Link>
                )}
              </div>
            </div>
            {activeVisit ? (
              <div className="capp-hero-desk-ticket">
                <ActiveVisitCard visit={activeVisit} branchName={branchLabel(branches, activeVisit.branch)} />
              </div>
            ) : null}
          </div>
        </header>
      }
    >
      {historyWarning ? (
        <p className="capp-span rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-medium" role="alert">
          {HISTORY_ATTACH_WARNING}
        </p>
      ) : null}
      {existingHistory ? (
        <p className="capp-span rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium" role="status">
          {EXISTING_HISTORY_MESSAGE}
        </p>
      ) : null}

      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{error}</strong>
          <button type="button" className="capp-btn capp-btn-fill" onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {!loading && birthday?.perk ? (
        <>
          <BirthdayGreetingSheet
            customerId={user?.id}
            firstName={firstName}
            dateOfBirth={birthday.date_of_birth}
            perk={birthday.perk}
            queueHref={queueHref}
          />
          <BirthdayHomeCard dateOfBirth={birthday.date_of_birth} perk={birthday.perk} />
        </>
      ) : null}

      {loading ? (
        <div className="capp-span">
          <Skeleton />
        </div>
      ) : activeVisit ? (
        <ActiveVisitCard variant="live" className="capp-phone-only" visit={activeVisit} branchName={branchLabel(branches, activeVisit.branch)} />
      ) : (
        <div className="capp-live-card is-empty capp-span capp-phone-only">
          <div className="capp-live-top">
            <p className="capp-eyebrow">Your car</p>
            <span className="capp-badge capp-badge--idle">Not on the floor</span>
          </div>
          <h2 className="capp-live-title">No active visit</h2>
          <p className="capp-live-sub">Book PPF, ceramic or tint ahead, or drive in for a wash.</p>
          <Link className="capp-btn capp-btn-light capp-btn-block" to={CUSTOMER_BOOK_PATH}>
            <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
            Book a service
          </Link>
          <Link className="capp-live-alt" to={queueHref}>
            <Radio size={15} strokeWidth={1.9} aria-hidden />
            Walk in? See the live queue
          </Link>
        </div>
      )}

      {maintenanceSchedules.length ? (
        <div className="capp-card capp-span" role="status">
          <div className="capp-card-row">
            <span className="capp-row-icon" aria-hidden>
              <Wrench size={18} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <strong>{dueMaintenance.length ? 'Paint maintenance due' : 'Paint maintenance'}</strong>
              <p className="text-sm text-muted-foreground">
                {dueMaintenance.length
                  ? `${dueMaintenance.map((row) => row.plate_number || 'Your car').join(', ')} should come in. Book the visit and the next reminder starts after it is done.`
                  : `${maintenanceSchedules.map((row) => row.plate_number || 'Your car').join(', ')} is on a maintenance plan. Book when you are ready.`}
              </p>
            </div>
          </div>
          <Link
            className="capp-btn capp-btn-fill mt-3"
            to={`${CUSTOMER_BOOK_PATH}?service=paint-maintenance&plate=${encodeURIComponent((dueMaintenance[0] || maintenanceSchedules[0]).plate_number || '')}`}
          >
            Book maintenance
          </Link>
        </div>
      ) : null}

      {!loading && data?.profile ? <ProfileProgressCard profile={data.profile} vehicles={vehicles} /> : null}

      {/* Desktop: the garage gets its own section, as on the site's pages.
          Adding a car still happens inside My cars. */}
      <section className="capp-desk-garage capp-span" aria-label="Your garage">
        <div className="capp-desk-head">
          <div>
            <p className="capp-eyebrow">Your garage</p>
            <h2 className="capp-desk-section-title">
              {vehicles.length ? `${vehicles.length} ${vehicles.length === 1 ? 'car' : 'cars'}` : 'No cars'}{' '}
              <em>{vehicles.length ? 'saved.' : 'yet.'}</em>
            </h2>
          </div>
          <Link className="capp-btn capp-btn-ghost" to={vehicles.length ? CUSTOMER_CARS_PATH : `${CUSTOMER_CARS_PATH}?add=1`}>
            Open My cars
          </Link>
        </div>
        {vehicles.length ? (
          <div className="capp-desk-cars">
            {vehicles.slice(0, 4).map((v) => (
              <Link key={v.id} className="capp-desk-car" to={`${CUSTOMER_BOOK_PATH}?vehicle=${v.id}`}>
                <strong className="capp-plate">{v.plate_number}</strong>
                <span>{[v.vehicle_make, v.vehicle_model, v.vehicle_year].filter(Boolean).join(' · ') || 'Saved car'}</span>
                <em>Book this car →</em>
              </Link>
            ))}
          </div>
        ) : (
          <p className="capp-meta">Save a plate in My cars so booking and queue tracking are one tap.</p>
        )}
      </section>

      <section className="capp-section capp-span capp-home-queue" aria-label="Live queue">
        <SectionHead title="Live queue" to={queueHref} linkLabel="Open" />
        <div className="capp-group">
          <Row
            icon={MapPin}
            title={branchLabel(branches, selectedBranch) || 'Choose a branch'}
            sub={
              selectedBranch && nearestSlug === selectedBranch
                ? `Closest branch to you${nearestDistanceKm != null ? ` · ${formatDistanceKm(nearestDistanceKm)}` : ''}`
                : 'Change it on the Queue tab'
            }
            to={queueHref}
            chevron
          />
          <Row icon={Clock} title="Waiting" end={<b>{carsLabel(selectedCounts.waiting)}</b>} />
          <Row icon={Droplets} title="In wash" end={<b>{carsLabel(selectedCounts.in_progress)}</b>} />
          <Row icon={Check} title="Final check" end={<b>{carsLabel(selectedCounts.final_checking)}</b>} />
        </div>
      </section>

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
                  onClick={() => setRatingVote('down')}
                >
                  <ThumbsDown size={22} strokeWidth={1.75} aria-hidden />
                  Thumbs down
                </button>
              </div>
              {ratingVote === 'down' ? (
                <>
                  <label className="capp-field">
                    <span>What went wrong</span>
                    <select value={ratingCategory} onChange={(e) => setRatingCategory(e.target.value)}>
                      <option value="">Choose</option>
                      {COMPLAINT_CATEGORIES.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label className="capp-field">
                    <span>What happened</span>
                    <textarea rows={3} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="What should we fix?" />
                  </label>
                  <button type="button" className="capp-btn capp-btn-fill min-h-11" disabled={ratingSaving} onClick={() => submitReview('down')}>
                    Send complaint
                  </button>
                </>
              ) : (
                <label className="capp-field">
                  <span>Note (optional)</span>
                  <textarea rows={2} value={ratingComment} onChange={(e) => setRatingComment(e.target.value)} placeholder="Tell us what stood out" />
                </label>
              )}
              <p className="capp-meta">Thumbs up opens this branch&apos;s Google review page. Thumbs down files a complaint on the planner.</p>
            </DialogContent>
          </Dialog>
        </section>
      ) : null}

      <section className={`capp-section capp-span capp-activity${activityOpen ? ' is-open' : ''}`} aria-labelledby="activity-heading">
        <button
          type="button"
          className="capp-sect capp-activity-toggle"
          aria-expanded={activityOpen}
          aria-controls="activity-panel"
          onClick={() => setActivityOpen((v) => !v)}
        >
          <h2 id="activity-heading">
            Recent activity
            <small>{range ? 'Picked dates' : 'Last month'}</small>
          </h2>
          <span className="capp-link">
            {activityOpen ? 'Hide' : 'Show'}
            <ChevronDown size={16} strokeWidth={2} aria-hidden />
          </span>
        </button>
        {activityOpen ? (
          <div id="activity-panel">
            <Pills items={ACTIVITY_TABS} value={tab} onChange={setTab} label="Activity" />
            <div className="capp-activity-filter" role="group" aria-label="Dates">
              <button
                type="button"
                className={`capp-chip${!range && !picking ? ' is-on' : ''}`}
                onClick={() => {
                  setRange(null)
                  setPicking(false)
                }}
              >
                <CalendarDays size={15} strokeWidth={1.9} aria-hidden />
                Last month
              </button>
              <button type="button" className={`capp-chip${range || picking ? ' is-on' : ''}`} onClick={() => setPicking(true)}>
                Pick dates
              </button>
            </div>
            {picking ? (
              <div className="capp-two capp-activity-dates">
                <label className="capp-field">
                  <span>From</span>
                  <input
                    type="date"
                    max={isoDay(Date.now())}
                    value={range?.from || isoDay(Date.now() - 30 * DAY_MS)}
                    onChange={(e) => setRange((r) => ({ to: r?.to || isoDay(Date.now()), from: e.target.value }))}
                  />
                </label>
                <label className="capp-field">
                  <span>To</span>
                  <input
                    type="date"
                    max={isoDay(Date.now())}
                    value={range?.to || isoDay(Date.now())}
                    onChange={(e) => setRange((r) => ({ from: r?.from || isoDay(Date.now() - 30 * DAY_MS), to: e.target.value }))}
                  />
                </label>
              </div>
            ) : null}
            <div className="capp-group">
              {loading ? (
                <Skeleton n={2} />
              ) : tab === 'history' ? (
                visitsShown.length === 0 ? (
                  <div className="capp-empty">
                    <strong>{history.length ? 'No visits in these dates' : 'No past visits yet'}</strong>
                    {history.length ? 'Pick other dates to see older visits.' : 'Completed services show up here.'}
                  </div>
                ) : (
                  visitsShown.map((row) => (
                    <Row
                      key={row.id}
                      to={customerVisitPath(row.id)}
                      icon={CalendarDays}
                      title={[row.service_name || row.services?.name, row.vehicle_plate].filter(Boolean).join(' · ') || 'Visit'}
                      sub={`${formatWhen(row.created_at || row.scheduled_start)} · ${branchLabel(branches, row.branch) || row.branch}`}
                      end={
                        <>
                          <b>{formatMoney(row.final_price_minor)}</b>
                          <Badge status={row.status} label={row.status} />
                        </>
                      }
                      chevron
                    />
                  ))
                )
              ) : purchasesShown.length === 0 ? (
                <div className="capp-empty">
                  <strong>{purchases.length ? 'No purchases in these dates' : 'No store purchases linked'}</strong>
                  {purchases.length ? 'Pick other dates to see older purchases.' : 'Ask the shop to search your name or plate at checkout.'}
                </div>
              ) : (
                purchasesShown.map((row) => (
                  <Row
                    key={row.id}
                    as="article"
                    icon={Receipt}
                    title="Store purchase"
                    sub={`${formatWhen(row.occurred_at)}${row.branch ? ` · ${branchLabel(branches, row.branch)}` : ''} · ${row.payment_method || 'paid'}`}
                    end={<b>{formatMoney(row.total_minor)}</b>}
                  />
                ))
              )}
            </div>
          </div>
        ) : null}
      </section>
    </CustomerAppFrame>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, CalendarPlus, Car, ChevronRight, Radio, Receipt, ThumbsDown, ThumbsUp, Wrench } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { formatMoney } from '@/queue/queueApi'
import { customerQueuePath, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'
import { supabase } from '@/lib/supabase'
import { CUSTOMER_BOOK_PATH, CUSTOMER_LOYALTY_PATH, CUSTOMER_MORE_PATH, customerVisitPath } from '@/lib/customerAccountNav'
import CustomerPinControl from '@/components/customer/CustomerPinControl'
import { branchDistanceKm } from '@/lib/branchGeo'
import { branchLabel, fetchPortal, greeting, initials, portalAction } from '@/lib/customerPortalClient'
import { formatDistanceKm, loadCustomerPin, resolveCustomerQueueBranch } from '@/lib/customerLocation'
import { buildThumbReview } from '@/lib/serviceReviews'
import { COMPLAINT_CATEGORIES, thumbDownComplaintPayload } from '@/lib/opsForms'
import { latestFinishedVisit, latestReviewableVisit, reviewDelayRemainingMs } from '@/lib/visitReviewDelay'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell from '@/components/NotificationBell'
import ActiveVisitCard from '@/components/customer/ActiveVisitCard'
import BranchWeather from '@/components/customer/BranchWeather'
import StampTrack from '@/components/customer/StampTrack'
import { BirthdayGreetingSheet, BirthdayHomeCard } from '@/components/customer/BirthdayGreeting'
import { ProfileProgressCard } from '@/components/customer/ProfileProgress'
import { Badge, Pills, QueueStats, Row, SectionHead, Skeleton } from '@/components/customer/CustomerUi'
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

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty']

function numberWord(n) {
  return NUMBER_WORDS[n] || String(n)
}

/* Desktop loyalty headline, e.g. "Six down. Nine to go." */
function stampHeadline(completed = 0, slots = 10) {
  const left = Math.max(0, slots - completed)
  if (completed <= 0) return ['Your first stamp', 'is one visit away.']
  if (left === 0) return ['Card full.', 'Claim your reward.']
  return [`${numberWord(completed)} down.`, `${numberWord(left).toLowerCase()} to go.`]
}

const ACTIVITY_TABS = [
  { id: 'history', label: 'Past visits' },
  { id: 'purchases', label: 'Purchases' },
]

/** One round shortcut in the phone's quick-action row. */
function QuickAction({ icon: Icon, title, to }) {
  return (
    <Link className="capp-quick-item" to={to}>
      <span className="capp-quick-icon" aria-hidden>
        <Icon size={22} strokeWidth={1.75} />
      </span>
      {title}
    </Link>
  )
}

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
  const [selectedBranch, setSelectedBranch] = useState('')
  const [pin, setPin] = useState(() => loadCustomerPin())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [ratingOpen, setRatingOpen] = useState(false)
  const [ratingVote, setRatingVote] = useState('')
  const [ratingComment, setRatingComment] = useState('')
  const [ratingCategory, setRatingCategory] = useState('')
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
          {/* Desktop: the hero is the visit, like the site's own page heroes —
              the title on the left, the live ticket on the right. */}
          <div className="capp-hero-desk">
            <div className="capp-hero-desk-copy">
              <p className="capp-desk-eyebrow">
                {greeting()}, {firstName || 'there'}
              </p>
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

      {/* Adding a car lives inside My cars; with none saved, the shortcut opens
          straight on the add form ("Add your first car"). */}
      <nav className="capp-quick capp-span capp-phone-only" aria-label="Shortcuts">
        <QuickAction icon={CalendarPlus} title="Book" to={CUSTOMER_BOOK_PATH} />
        <QuickAction icon={Radio} title="Queue" to={queueHref} />
        <QuickAction
          icon={Car}
          title="My cars"
          to={vehicles.length ? `${CUSTOMER_MORE_PATH}?tab=garage` : `${CUSTOMER_MORE_PATH}?tab=garage&add=1`}
        />
        <QuickAction icon={CalendarDays} title="Events" to="/account/events" />
      </nav>
      {!vehicles.length && !loading ? <p className="capp-quick-note capp-span capp-phone-only">Add your first car in My cars and booking is one tap.</p> : null}

      {loyalty && loyalty.stampsEnabled !== false ? (
        <section className="capp-section capp-span capp-phone-only" aria-label="Rewards">
          <SectionHead title="Rewards" to={CUSTOMER_LOYALTY_PATH} linkLabel="See all" />
          <Link className="capp-pass-mini" to={CUSTOMER_LOYALTY_PATH}>
            <span className="capp-pass-mini-n">
              {loyalty.completed ?? 0}
              <small> / {loyalty.cardSlots ?? 10} stamps</small>
            </span>
            <ChevronRight className="capp-pass-mini-chev" size={20} strokeWidth={2} aria-hidden />
            <span className="capp-pass-mini-p">
              {loyalty.nextMilestone
                ? `${Math.max(0, Number(loyalty.nextMilestone.threshold_points) - Number(loyalty.completed || 0))} more to ${loyalty.nextMilestone.reward_label}`
                : loyalty.encouragement || 'Thanks for coming back.'}
            </span>
            <span className="capp-pass-mini-segs" style={{ '--n': loyalty.cardSlots ?? 10 }} aria-hidden>
              {Array.from({ length: Number(loyalty.cardSlots) || 10 }, (_, i) => {
                const gift = (loyalty.milestones || []).some((m) => Number(m.threshold_points) === i + 1)
                return <i key={i} className={`${i < (loyalty.completed ?? 0) ? 'is-on' : ''}${gift ? ' is-gift' : ''}`} />
              })}
            </span>
          </Link>
        </section>
      ) : null}

      {loyalty && loyalty.stampsEnabled !== false ? (
        <Link className="capp-card capp-loyalty-home capp-span capp-desk-only" to={CUSTOMER_LOYALTY_PATH}>
          <div className="capp-card-row">
            <div className="min-w-0">
              <p className="capp-eyebrow">Loyalty</p>
              <h2 className="capp-title">Loyalty program</h2>
              <p className="capp-meta">{stampsLine}</p>
              {loyalty.pointsEnabled !== false ? (
                <p className="capp-meta">{loyalty.loyaltyPoints ?? 0} points</p>
              ) : null}
              <p className="capp-desk-section-title" aria-hidden="true">
                {stampHeadline(loyalty.completed ?? 0, loyalty.cardSlots ?? 10)[0]}{' '}
                <em>{stampHeadline(loyalty.completed ?? 0, loyalty.cardSlots ?? 10)[1]}</em>
              </p>

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
        <Link className="capp-card capp-span capp-desk-only" to={CUSTOMER_LOYALTY_PATH}>
          <p className="capp-eyebrow">Loyalty</p>
          <h2 className="capp-title">Loyalty program</h2>
          <p className="capp-meta">Rewards and perks</p>
        </Link>
      )}

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
          <Link className="capp-btn capp-btn-ghost" to={vehicles.length ? `${CUSTOMER_MORE_PATH}?tab=garage` : `${CUSTOMER_MORE_PATH}?tab=garage&add=1`}>
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

      <section className="capp-section capp-desk-only" aria-label="Live queue">
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
                  to={customerVisitPath(row.id)}
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

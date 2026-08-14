import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Cake,
  CalendarDays,
  CalendarPlus,
  LogOut,
  Radio,
  Receipt,
  Settings,
  Star,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { getAccessTokenFresh } from '@/lib/authToken'
import { nearestBranchSlug } from '@/lib/branchGeo'
import { formatMoney } from '@/queue/queueApi'
import { customerQueuePath, queueCountsFromRow } from '@/lib/liveQueuePath'
import { usePublicQueueCounts } from '@/lib/usePublicQueueCounts'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import LoyaltyCard from '@/components/LoyaltyCard'
import NotificationBell from '@/components/NotificationBell'
import CustomerBookingModal from '@/components/CustomerBookingModal'
import CustomerSettingsModal from '@/components/CustomerSettingsModal'

async function fetchPortal() {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/customer-portal', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Session expired. Sign in again.')
  if (!res.ok) throw new Error(body.error || 'Unable to load account.')
  return body
}

function formatWhen(iso) {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '-'
  }
}

function branchLabel(branches, slug) {
  if (!slug) return ''
  const row = branches.find((b) => b.slug === slug)
  return row?.name?.replace(/^Hakum Auto Care\s*/i, '') || row?.name || slug
}

export default function CustomerAccountPage() {
  const { profile: authProfile, user, session, signOut, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [history, setHistory] = useState([])
  const [purchases, setPurchases] = useState([])
  const [bookings, setBookings] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [portalProfile, setPortalProfile] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [birthday, setBirthday] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geoNote, setGeoNote] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [bookOpen, setBookOpen] = useState(false)
  const [bookVehicle, setBookVehicle] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('alerts')
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [ratingSaving, setRatingSaving] = useState(false)
  const [ratingDone, setRatingDone] = useState(false)
  const { countsBySlug } = usePublicQueueCounts()

  function openSettings(next = 'alerts') {
    setSettingsTab(next)
    setSettingsOpen(true)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPortal()
      const nextBranches = data.branches || []
      const nextBookings = data.bookings || []
      setBranches(nextBranches)
      setHistory(data.history || [])
      setPurchases(data.purchases || [])
      setBookings(nextBookings)
      setVehicles(data.vehicles || [])
      setPortalProfile(data.profile || null)
      setLoyalty(data.loyalty || null)
      setBirthday(data.birthday || null)
      setSelectedBranch((current) => {
        if (current && nextBranches.some((b) => b.slug === current)) return current
        const fromVisit = nextBookings[0]?.branch
        if (fromVisit && nextBranches.some((b) => b.slug === fromVisit)) return fromVisit
        return nextBranches[0]?.slug || ''
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!session?.access_token) return
    if (authProfile?.role === 'customer') load()
  }, [load, authProfile, session?.access_token, authLoading])

  useEffect(() => {
    if (!branches.length || !navigator.geolocation) return
    if (bookings[0]?.branch) return
    let cancelled = false
    const run = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          const nearest = nearestBranchSlug(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            branches,
          )
          if (nearest) {
            setSelectedBranch(nearest.slug)
            setGeoNote(`Nearest · ${branchLabel(branches, nearest.slug)}`)
          }
        },
        () => {
          if (!cancelled) setGeoNote('Choose a branch')
        },
        { enableHighAccuracy: false, timeout: 8000 },
      )
    }
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (cancelled) return
          if (status.state === 'denied') {
            setGeoNote('Choose a branch')
            return
          }
          run()
        })
        .catch(run)
    } else {
      run()
    }
    return () => {
      cancelled = true
    }
  }, [branches, bookings])

  const selectedCounts = countsBySlug[selectedBranch] || queueCountsFromRow(null)

  const queueHref = customerQueuePath(selectedBranch)
  const firstName = (portalProfile?.full_name || authProfile?.full_name || '').split(' ')[0] || ''
  const carsHere = useMemo(
    () => bookings.filter((b) => !selectedBranch || b.branch === selectedBranch),
    [bookings, selectedBranch],
  )
  const settingsProfile = portalProfile || {
    full_name: authProfile?.full_name,
    phone: authProfile?.phone,
    email: user?.email,
  }
  const activeVisit = bookings[0]

  function pickNearest() {
    if (!navigator.geolocation) {
      setGeoNote('Location unavailable. Pick a branch.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = nearestBranchSlug(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          branches,
        )
        if (nearest) {
          setSelectedBranch(nearest.slug)
          setGeoNote(`Nearest · ${branchLabel(branches, nearest.slug)}`)
        }
      },
      () => setGeoNote('Location blocked. Pick a branch.'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  async function removeVehicle(v) {
    if (!window.confirm(`Remove ${v.plate_number} from your garage?`)) return
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'archive-vehicle', vehicle_id: v.id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Unable to remove car')
      setVehicles((prev) => prev.filter((x) => x.id !== v.id))
    } catch (err) {
      setError(err.message)
    }
  }

  if (authLoading) {
    return (
      <div className="capp">
        <div className="capp-stage">
          <div className="capp-hero">
            <p className="capp-kicker">Hakum</p>
            <h1>My account</h1>
          </div>
          <div className="capp-scroll">
            <div className="capp-skel" aria-hidden />
            <div className="capp-skel" aria-hidden />
          </div>
        </div>
      </div>
    )
  }

  if (!user || !authProfile || authProfile.role !== 'customer') {
    return <Navigate to="/signin" replace />
  }

  const heroLine = activeVisit
    ? `${activeVisit.vehicle_plate || 'Your car'} is ${String(activeVisit.visit?.label || activeVisit.status || 'on the floor').toLowerCase()}`
    : 'Book, track the bay, and open your history.'

  if (settingsOpen) {
    return (
      <>
        <CustomerSettingsModal
          open
          onOpenChange={setSettingsOpen}
          profile={settingsProfile}
          onUpdated={load}
          initialTab={settingsTab}
        />
        <CustomerBookingModal
          open={bookOpen}
          onOpenChange={(next) => {
            setBookOpen(next)
            if (!next) setBookVehicle(null)
          }}
          profile={settingsProfile}
          branches={branches}
          vehicles={vehicles}
          initialVehicle={bookVehicle}
          onBooked={load}
        />
      </>
    )
  }

  return (
    <>
      <CustomerAppFrame
        hero={
          <header className="capp-hero">
            <div className="capp-hero-bar">
              <div className="min-w-0">
                <p className="capp-kicker">Hakum Auto Care</p>
                <h1>Hi{firstName ? `, ${firstName}` : ''}</h1>
                <p className="capp-hero-sub">{heroLine}</p>
              </div>
              {/* Mobile/PWA app chrome — hidden on desktop (landing header owns bell + account) */}
              <div className="capp-icon-row account-mobile-only">
                <button type="button" className="capp-icon-btn" onClick={() => openSettings('alerts')} aria-label="Settings">
                  <Settings size={18} strokeWidth={1.75} />
                </button>
                <NotificationBell variant="capp" homeUrl="/account" homeLabel="Home" />
                <button type="button" className="capp-icon-btn" onClick={() => signOut()} aria-label="Sign out">
                  <LogOut size={18} strokeWidth={1.75} />
                </button>
              </div>
              {/* Desktop web — quiet utilities; no second bell */}
              <div className="capp-web-actions account-desktop-only">
                <button type="button" className="capp-web-link" onClick={() => openSettings('account')}>
                  Settings
                </button>
                <button type="button" className="capp-web-link" onClick={() => signOut()}>
                  Sign out
                </button>
              </div>
            </div>
          </header>
        }
      >
        {error ? (
          <div className="capp-empty" role="alert">
            <strong>{error}</strong>
            <button type="button" className="capp-btn capp-btn-fill" onClick={load}>
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="capp-skel" aria-hidden />
        ) : activeVisit ? (
          <article className="capp-ticket">
            <div className="capp-ticket-row">
              <div className="min-w-0">
                <p className="capp-plate">{activeVisit.vehicle_plate || '-'}</p>
                <p className="capp-meta">
                  {[activeVisit.vehicle_make, activeVisit.vehicle_model].filter(Boolean).join(' ') ||
                    activeVisit.service_name ||
                    'Service visit'}
                </p>
                <span className="capp-pill">{activeVisit.visit?.label || activeVisit.status}</span>
              </div>
              <div>
                <p className="capp-q">
                  {activeVisit.queue_label || '--'}
                  <span>{branchLabel(branches, activeVisit.branch) || 'Queue'}</span>
                </p>
              </div>
            </div>
            {activeVisit.visit?.steps?.length ? (
              <ol className="account-flow" aria-label="Visit progress">
                {activeVisit.visit.steps.map((step, idx) => {
                  const done = activeVisit.visit.isComplete || idx < activeVisit.visit.currentIndex
                  const current = !activeVisit.visit.isComplete && idx === activeVisit.visit.currentIndex
                  return (
                    <li key={step.key} className={`account-flow-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
                      <span className="account-flow-dot" aria-hidden />
                      <span className="account-flow-label">{step.label}</span>
                    </li>
                  )
                })}
              </ol>
            ) : null}
          </article>
        ) : (
          <div className="capp-empty">
            <strong>No active visit</strong>
            Book a service to track your car on the floor.
          </div>
        )}

        {!loading && !ratingDone && history.length > 0 && history[0]?.status === 'completed' && (
          <div className="capp-ticket">
            <p className="capp-label">Rate your last visit</p>
            <p className="capp-meta" style={{ marginBottom: '0.5rem' }}>
              {history[0].vehicle_plate || 'Visit'} · {branchLabel(branches, history[0].branch)}
            </p>
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.6rem' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRatingStars(n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.15rem' }}
                  aria-label={`${n} star`}
                >
                  <Star
                    size={28}
                    className={n <= ratingStars ? 'fill-amber-400 text-amber-400' : 'text-[color:var(--capp-steel)]'}
                  />
                </button>
              ))}
            </div>
            <textarea
              className="account-field"
              rows={2}
              placeholder="Optional comment…"
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              style={{ marginBottom: '0.5rem' }}
            />
            <button
              type="button"
              className="capp-btn capp-btn-fill"
              disabled={!ratingStars || ratingSaving}
              onClick={async () => {
                setRatingSaving(true)
                const { error } = await supabase.from('service_reviews').insert({
                  booking_id: history[0].id,
                  customer_id: user.id,
                  customer_name: portalProfile?.full_name || authProfile?.full_name || 'Customer',
                  branch: history[0].branch || '',
                  overall_rating: ratingStars,
                  comment: ratingComment.trim() || null,
                })
                setRatingSaving(false)
                if (error) {
                  if (error.code === '23505') setRatingDone(true)
                  return
                }
                setRatingDone(true)
              }}
            >
              {ratingSaving ? 'Sending…' : 'Submit review'}
            </button>
          </div>
        )}
        {ratingDone && (
          <div className="capp-note">
            <strong>Thank you for your feedback!</strong>
          </div>
        )}

        <div className="capp-actions">
          <button
            type="button"
            className="capp-btn capp-btn-fill"
            onClick={() => {
              setBookVehicle(null)
              setBookOpen(true)
            }}
          >
            <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
            Book
          </button>
          <Link className="capp-btn capp-btn-ghost" to={queueHref}>
            <Radio size={16} strokeWidth={1.75} aria-hidden />
            Live queue
          </Link>
        </div>

        <section className="capp-section" aria-label="Garage">
          <div className="capp-ticket-row" style={{ marginBottom: '0.45rem' }}>
            <p className="capp-label" style={{ margin: 0 }}>Garage</p>
            <button type="button" className="account-link-btn" onClick={() => openSettings('car')}>
              Manage
            </button>
          </div>
          {vehicles.length ? (
            <div className="capp-chips">
              {vehicles.map((v) => (
                <div key={v.id} className="capp-chip">
                  <strong>{v.plate_number}</strong>
                  <em>{[v.vehicle_make, v.vehicle_model, v.color].filter(Boolean).join(' · ') || 'Saved vehicle'}</em>
                  <div className="capp-actions" style={{ marginTop: '0.65rem' }}>
                    <button type="button" className="capp-btn capp-btn-fill" onClick={() => { setBookVehicle(v); setBookOpen(true) }}>
                      Book
                    </button>
                    <button type="button" className="capp-btn capp-btn-ghost" onClick={() => removeVehicle(v)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="capp-empty">
              <strong>No cars on file yet</strong>
              <button type="button" className="account-link-btn" onClick={() => openSettings('car')}>
                Save a plate
              </button>
            </div>
          )}
        </section>

        <section className="capp-ticket" aria-label="Live queue">
          <p className="capp-label">This branch</p>
          <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--capp-steel)]">
            {geoNote || 'Choose a branch'}
            <select
              className="account-field"
              value={selectedBranch}
              onChange={(e) => {
                const slug = e.target.value
                setSelectedBranch(slug)
                setGeoNote(branchLabel(branches, slug) ? `Branch · ${branchLabel(branches, slug)}` : '')
              }}
            >
              <option value="">Choose branch</option>
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div className="capp-actions" style={{ marginTop: '0.7rem' }}>
            <button type="button" className="capp-btn capp-btn-ghost" onClick={pickNearest}>
              Use nearest
            </button>
            <Link className="capp-btn capp-btn-fill" to={queueHref}>
              Open queue
            </Link>
          </div>
          {!loading ? (
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
          ) : null}
          {carsHere.length > 0 && selectedBranch ? (
            <p className="capp-meta" style={{ marginTop: '0.7rem' }}>
              Your car is on this floor · {carsHere.map((c) => c.vehicle_plate || 'visit').join(', ')}
            </p>
          ) : null}
        </section>

        {birthday?.perk ? (
          <div className="capp-note">
            <p className="capp-kicker" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <Cake className="mr-1 inline size-3.5" aria-hidden /> Birthday treat
            </p>
            <strong>One free service is waiting.</strong>
            <p>
              Show this at any Hakum branch. Valid until{' '}
              {birthday.perk.expires_at
                ? new Date(birthday.perk.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
                : 'this month'}
              .
            </p>
          </div>
        ) : !birthday?.date_of_birth ? (
          <button type="button" className="capp-row" onClick={() => openSettings('account')}>
            <Cake className="capp-thumb" style={{ width: '2.5rem', height: '2.5rem', padding: '0.55rem' }} />
            <span>
              <strong>Add your birthday</strong>
              <em>Free carwash on your day.</em>
            </span>
          </button>
        ) : null}

        {loyalty?.membershipsEnabled && loyalty.membership?.tier_name ? (
          <div className="capp-ticket">
            <p className="capp-label">Membership</p>
            <p className="capp-plate" style={{ fontSize: '1.15rem', letterSpacing: 0 }}>{loyalty.membership.tier_name}</p>
            <p className="capp-meta">
              {loyalty.membership.discount_percent != null
                ? `${loyalty.membership.discount_percent}% member discount`
                : 'Active member'}
              {loyalty.membership.ends_at ? ` · ends ${loyalty.membership.ends_at}` : ''}
            </p>
          </div>
        ) : null}

        {loyalty?.pointsEnabled ? (
          <div className="capp-ticket">
            <p className="capp-label">Spend points</p>
            <p className="capp-q" style={{ textAlign: 'left' }}>{loyalty.loyaltyPoints ?? 0}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="capp-skel" aria-hidden />
        ) : loyalty?.stampsEnabled !== false && loyalty ? (
          <LoyaltyCard
            variant="hakum"
            completed={loyalty.completed}
            cardSlots={loyalty.cardSlots}
            milestones={loyalty.milestones}
            encouragement={loyalty.encouragement}
          />
        ) : (
          <div className="capp-empty">Loyalty stamps appear after your first completed visit.</div>
        )}

        <section className="capp-section" aria-labelledby="history-heading">
          <h2 id="history-heading" className="capp-label">Activity</h2>
          <div className="account-seg account-seg-2" role="tablist" aria-label="History">
            {[
              ['history', 'Past visits'],
              ['purchases', 'Purchases'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`account-seg-btn ${tab === id ? 'is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2">
            {tab === 'history' &&
              (loading ? (
                <div className="capp-skel" aria-hidden />
              ) : history.length === 0 ? (
                <div className="capp-empty">
                  <strong>No past visits yet</strong>
                  Completed services show up here.
                </div>
              ) : (
                history.map((row) => (
                  <article key={row.id} className="capp-row" style={{ cursor: 'default' }}>
                    <span className="capp-thumb" style={{ display: 'grid', placeItems: 'center', width: '2.6rem', height: '2.6rem' }}>
                      <CalendarDays className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong>{row.vehicle_plate || 'Visit'}</strong>
                      <em>
                        {formatWhen(row.created_at || row.scheduled_start)} · {branchLabel(branches, row.branch) || row.branch}
                      </em>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[color:var(--capp-navy)]">
                      {formatMoney(row.final_price_minor)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                  </article>
                ))
              ))}
            {tab === 'purchases' &&
              (loading ? (
                <div className="capp-skel" aria-hidden />
              ) : purchases.length === 0 ? (
                <div className="capp-empty">
                  <strong>No store purchases linked</strong>
                  Ask the shop to search your name or plate at checkout.
                </div>
              ) : (
                purchases.map((row) => (
                  <article key={row.id} className="capp-row" style={{ cursor: 'default' }}>
                    <span className="capp-thumb" style={{ display: 'grid', placeItems: 'center', width: '2.6rem', height: '2.6rem' }}>
                      <Receipt className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong>Store purchase</strong>
                      <em>
                        {formatWhen(row.occurred_at)} · {row.payment_method || 'paid'}
                      </em>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[color:var(--capp-navy)]">
                      {formatMoney(row.total_minor)}
                    </span>
                  </article>
                ))
              ))}
          </div>
        </section>

        <button type="button" className="capp-btn capp-btn-ghost" onClick={() => openSettings('alerts')}>
          Alert settings
        </button>
      </CustomerAppFrame>

      <CustomerBookingModal
        open={bookOpen}
        onOpenChange={(open) => {
          setBookOpen(open)
          if (!open) setBookVehicle(null)
        }}
        profile={settingsProfile}
        branches={branches}
        vehicles={vehicles}
        initialVehicle={bookVehicle}
        onBooked={load}
      />
    </>
  )
}

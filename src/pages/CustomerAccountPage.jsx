import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CalendarDays,
  CarFront,
  Home,
  LogOut,
  MapPin,
  Navigation,
  Plus,
  Radio,
  Receipt,
  CalendarPlus,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { getAccessTokenFresh } from '@/lib/authToken'
import { nearestBranchSlug } from '@/lib/branchGeo'
import { getQueueCounts } from '@/queue/queueLogic'
import { formatMoney } from '@/queue/queueApi'
import { liveQueuePath } from '@/lib/liveQueuePath'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import LoyaltyCard from '@/components/LoyaltyCard'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import InstallGuide from '@/components/InstallGuide'
import CustomerBookingModal from '@/components/CustomerBookingModal'
import CustomerSettingsModal from '@/components/CustomerSettingsModal'

async function fetchPortal() {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/customer-portal', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401) throw new Error('Session expired — please sign in again.')
  if (!res.ok) throw new Error(body.error || 'Unable to load account.')
  return body
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
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
  const [queueCounts, setQueueCounts] = useState({})
  const [history, setHistory] = useState([])
  const [purchases, setPurchases] = useState([])
  const [bookings, setBookings] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [portalProfile, setPortalProfile] = useState(null)
  const [loyalty, setLoyalty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geoNote, setGeoNote] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('history')
  const [bookOpen, setBookOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('alerts')

  function openSettings(tab = 'alerts') {
    setSettingsTab(tab)
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
      setQueueCounts(data.queueCounts || {})
      setLoyalty(data.loyalty || null)
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
    if (authProfile?.role === 'customer' || user?.user_metadata?.role === 'customer') load()
  }, [load, authProfile, user, session?.access_token, authLoading])

  useEffect(() => {
    if (!branches.length || !navigator.geolocation) return
    if (bookings[0]?.branch) return
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
      () => setGeoNote('Choose a branch'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [branches, bookings])

  const selectedCounts = useMemo(
    () => queueCounts[selectedBranch] || getQueueCounts([]),
    [queueCounts, selectedBranch],
  )

  const queueHref = liveQueuePath(selectedBranch)
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

  function pickNearest() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const nearest = nearestBranchSlug(
        { lat: pos.coords.latitude, lng: pos.coords.longitude },
        branches,
      )
      if (nearest) {
        setSelectedBranch(nearest.slug)
        setGeoNote(`Nearest · ${branchLabel(branches, nearest.slug)}`)
      }
    })
  }

  if (authLoading) {
    return (
      <div className="account-app account-app-public flex min-h-[50svh] items-center justify-center p-6">
        <Skeleton className="h-40 w-full max-w-md rounded-2xl" />
      </div>
    )
  }

  if (!user || (authProfile && authProfile.role !== 'customer' && user.user_metadata?.role !== 'customer')) {
    return <Navigate to="/signin" replace />
  }

  return (
    <section className="account-app account-app-public">
      <header className="account-app-hero">
        <div className="public-shell account-app-hero-inner">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="account-eyebrow">My Hakum</p>
              <h1 className="account-title">Hi{firstName ? `, ${firstName}` : ''}</h1>
              <p className="account-sub">Stamps, your car on the floor, and visit alerts.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
                onClick={() => openSettings('alerts')}
                aria-label="Settings"
              >
                <Settings />
              </Button>
              <div className="account-mobile-only items-center gap-1">
                <NotificationBell light homeUrl="/account" homeLabel="My account" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => signOut()}
                  aria-label="Sign out"
                >
                  <LogOut />
                </Button>
              </div>
              <div className="account-desktop-only account-hero-web-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="account-btn account-btn-ghost-light min-h-10"
                  onClick={() => signOut()}
                >
                  <LogOut data-icon="inline-start" />
                  Sign out
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <PushToggle audience="customer" autoPrompt />
            <Button type="button" className="account-btn account-btn-on-navy min-h-10" onClick={() => setBookOpen(true)}>
              <CalendarPlus data-icon="inline-start" />
              Book a service
            </Button>
            <Button asChild className="account-btn account-btn-ghost-light min-h-10">
              <Link to={queueHref}>
                <Radio data-icon="inline-start" />
                Live queue
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="public-shell account-layout">
        {error ? (
          <div className="account-error account-layout-error" role="alert">
            <p>{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="account-btn account-btn-primary" onClick={load}>
                Retry
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
            </div>
          </div>
        ) : null}

        <section className="account-sheet account-sheet-car account-area-car" aria-labelledby="your-car-heading">
          <div className="account-sheet-head">
            <span className="account-sheet-icon" aria-hidden>
              <CarFront className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="your-car-heading" className="account-sheet-title">
                Your car
              </h2>
              <p className="account-sheet-sub">Garage + live status while Hakum works on a visit.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="account-btn shrink-0"
              onClick={() => openSettings('car')}
            >
              <Settings data-icon="inline-start" />
              Manage garage
            </Button>
          </div>

          {loading ? (
            <Skeleton className="mt-4 h-28 w-full rounded-xl" />
          ) : (
            <>
              {vehicles.length > 0 ? (
                <ul className="account-garage mt-4">
                  {vehicles.map((v) => (
                    <li key={v.id} className="account-garage-item">
                      <div className="min-w-0">
                        <p className="account-plate">{v.plate_number}</p>
                        <p className="truncate text-sm text-slate-500">
                          {[v.vehicle_make, v.vehicle_model, v.color].filter(Boolean).join(' · ') || 'Saved vehicle'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button type="button" size="sm" className="account-btn account-btn-primary" onClick={() => setBookOpen(true)}>
                          Book
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
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
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="account-empty account-empty-inset mt-4">
                  No cars on file yet. Plates are usually added at the branch or POS when you visit.{' '}
                  <button type="button" className="font-semibold text-[#052699] underline" onClick={() => openSettings('car')}>
                    Save a plate in settings
                  </button>
                  {' '}if you already know it.
                </div>
              )}

              <div className="mt-5 border-t border-[#052699]/08 pt-4">
                <p className="mb-3 text-[10px] font-extrabold tracking-[0.16em] text-[#052699] uppercase">Active visit</p>
                {bookings.length === 0 ? (
                  <div className="account-empty account-empty-inset">
                    No active visit.{' '}
                    <button type="button" className="font-semibold text-[#052699] underline" onClick={() => setBookOpen(true)}>
                      Book a service
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.map((row) => {
                      const visit = row.visit || { steps: [], currentIndex: 0, label: row.status, isComplete: false }
                      return (
                        <article key={row.id} className="account-car-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="account-plate">{row.vehicle_plate || '—'}</p>
                              <p className="truncate text-sm text-slate-500">
                                {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') ||
                                  row.service_name ||
                                  'Service visit'}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">{branchLabel(branches, row.branch)}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              {row.queue_label ? (
                                <p className="text-2xl font-black tabular-nums text-[#052699]">{row.queue_label}</p>
                              ) : (
                                <p className="text-xs font-semibold text-slate-400">Queue pending</p>
                              )}
                              <Badge variant="secondary" className="mt-1">
                                {visit.label || row.status}
                              </Badge>
                            </div>
                          </div>
                          <ol className="account-flow" aria-label="Visit progress">
                            {visit.steps.map((step, idx) => {
                              const done = visit.isComplete || idx < visit.currentIndex
                              const current = !visit.isComplete && idx === visit.currentIndex
                              return (
                                <li
                                  key={step.key}
                                  className={`account-flow-step ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                                >
                                  <span className="account-flow-dot" aria-hidden />
                                  <span className="account-flow-label">{step.label}</span>
                                </li>
                              )
                            })}
                          </ol>
                          {row.branch ? (
                            <Link className="account-inline-cta" to={liveQueuePath(row.branch)}>
                              <Radio className="size-3.5" aria-hidden />
                              Open live queue at this branch
                            </Link>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="account-sheet account-area-queue" aria-labelledby="live-queue-heading">
          <div className="account-sheet-head">
            <span className="account-sheet-icon" aria-hidden>
              <MapPin className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="live-queue-heading" className="account-sheet-title">
                Live queue
              </h2>
              <p className="account-sheet-sub">{geoNote || 'See waiting and in-progress cars at a branch.'}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Branch
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

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" className="account-btn account-btn-secondary min-h-11" onClick={pickNearest}>
                <Navigation data-icon="inline-start" />
                Use nearest
              </Button>
              <Button asChild className="account-btn account-btn-primary min-h-11">
                <Link to={queueHref}>View live queue</Link>
              </Button>
            </div>
          </div>

          {!loading && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Waiting', selectedCounts.waiting],
                ['In progress', selectedCounts.in_progress],
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

          {carsHere.length > 0 && selectedBranch ? (
            <p className="mt-3 text-xs font-medium text-[#052699]">
              Your car is on this floor · {carsHere.map((c) => c.vehicle_plate || 'visit').join(', ')}
            </p>
          ) : null}
        </section>

        <div className="account-area-loyalty">
          {loading ? (
            <Skeleton className="h-48 w-full rounded-[1.5rem]" />
          ) : loyalty ? (
            <LoyaltyCard
              variant="hakum"
              completed={loyalty.completed}
              cardSlots={loyalty.cardSlots}
              milestones={loyalty.milestones}
              encouragement={loyalty.encouragement}
            />
          ) : (
            <div className="account-empty">Loyalty stamps appear after your first completed visit.</div>
          )}
        </div>

        <div className="account-area-install">
          <InstallGuide variant="panel" audience="customer" />
        </div>

        <div className="account-area-history">
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

          <div className="mt-4 space-y-3">
            {tab === 'history' &&
              (loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : history.length === 0 ? (
                <EmptyBlock>No past visits yet.</EmptyBlock>
              ) : (
                history.map((row) => (
                  <article key={row.id} className="account-tile account-tile-row">
                    <span className="account-tile-icon" aria-hidden>
                      <CalendarDays className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#020a31]">{row.vehicle_plate || 'Visit'}</p>
                          <p className="truncate text-xs text-slate-500">
                            {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || 'Service'}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-[#052699]">
                          {formatMoney(row.final_price_minor)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>{formatWhen(row.created_at || row.scheduled_start)}</span>
                        <span aria-hidden>·</span>
                        <span>{branchLabel(branches, row.branch) || row.branch}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                  </article>
                ))
              ))}

            {tab === 'purchases' &&
              (loading ? (
                <Skeleton className="h-28 w-full rounded-2xl" />
              ) : purchases.length === 0 ? (
                <EmptyBlock>No store purchases linked yet. Ask Admin or POS to search your name or plate at checkout.</EmptyBlock>
              ) : (
                purchases.map((row) => (
                  <article key={row.id} className="account-tile account-tile-row">
                    <span className="account-tile-icon" aria-hidden>
                      <Receipt className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#020a31]">Store purchase</p>
                          <p className="text-xs text-slate-500 capitalize">
                            {row.payment_method || 'paid'} · {branchLabel(branches, row.branch) || row.branch}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-[#052699]">
                          {formatMoney(row.total_minor)}
                        </p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{formatWhen(row.occurred_at)}</p>
                    </div>
                  </article>
                ))
              ))}
          </div>
        </div>

        <aside className="account-desktop-only account-area-actions account-sheet" aria-label="Quick actions">
          <h2 className="account-sheet-title">Quick actions</h2>
          <p className="account-sheet-sub mt-1">Book, queue, settings, and home.</p>
          <div className="mt-4 flex flex-col gap-2">
            <Button type="button" className="account-btn account-btn-primary min-h-11 w-full justify-start" onClick={() => setBookOpen(true)}>
              <CalendarPlus data-icon="inline-start" />
              Book a service
            </Button>
            <Button asChild className="account-btn account-btn-secondary min-h-11 w-full justify-start">
              <Link to={queueHref}>
                <Radio data-icon="inline-start" />
                Open live queue
              </Link>
            </Button>
            <Button type="button" className="account-btn account-btn-secondary min-h-11 w-full justify-start" onClick={() => openSettings('alerts')}>
              <Settings data-icon="inline-start" />
              Settings
            </Button>
            <Button asChild variant="ghost" className="min-h-11 w-full justify-start rounded-xl">
              <Link to="/">
                <Home data-icon="inline-start" />
                Back to home
              </Link>
            </Button>
          </div>
          <div className="mt-4 rounded-xl border border-[#052699]/12 bg-[#f4f6fb] p-3">
            <p className="mb-2 text-xs font-bold text-[#020a31]">Push alerts</p>
            <PushToggle audience="customer" surface="light" />
          </div>
        </aside>
      </div>

      <nav className="account-dock account-mobile-only" aria-label="Primary">
        <button type="button" className="account-dock-item" onClick={() => setBookOpen(true)}>
          <CalendarPlus className="size-5" aria-hidden />
          <span>Book</span>
        </button>
        <Link to={queueHref} className="account-dock-item account-dock-item-primary">
          <Radio className="size-5" aria-hidden />
          <span>Live queue</span>
        </Link>
        <button type="button" className="account-dock-item" onClick={() => openSettings('alerts')}>
          <Settings className="size-5" aria-hidden />
          <span>Settings</span>
        </button>
      </nav>

      <CustomerBookingModal
        open={bookOpen}
        onOpenChange={setBookOpen}
        profile={settingsProfile}
        branches={branches}
        vehicles={vehicles}
        onBooked={load}
      />
      <CustomerSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        profile={settingsProfile}
        onUpdated={load}
        initialTab={settingsTab}
      />
    </section>
  )
}

function EmptyBlock({ children }) {
  return <div className="account-empty">{children}</div>
}

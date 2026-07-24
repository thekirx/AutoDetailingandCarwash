import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CalendarDays, ChevronRight, LogOut, MapPin, Navigation, Receipt } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { getAccessTokenFresh } from '@/lib/authToken'
import { nearestBranchSlug } from '@/lib/branchGeo'
import { getQueueCounts } from '@/queue/queueLogic'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import LoyaltyCard from '@/components/LoyaltyCard'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import InstallGuide from '@/components/InstallGuide'

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

export default function CustomerAccountPage() {
  const { profile, user, session, signOut, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [queueCounts, setQueueCounts] = useState({})
  const [history, setHistory] = useState([])
  const [purchases, setPurchases] = useState([])
  const [bookings, setBookings] = useState([])
  const [loyalty, setLoyalty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geoNote, setGeoNote] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPortal()
      setBranches(data.branches || [])
      setHistory(data.history || [])
      setPurchases(data.purchases || [])
      setBookings(data.bookings || [])
      setQueueCounts(data.queueCounts || {})
      setLoyalty(data.loyalty || null)
      setSelectedBranch((current) => current || data.branches?.[0]?.slug || '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!session?.access_token) return
    if (profile?.role === 'customer' || user?.user_metadata?.role === 'customer') load()
  }, [load, profile, user, session?.access_token, authLoading])

  useEffect(() => {
    if (!branches.length || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = nearestBranchSlug(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          branches,
        )
        if (nearest) {
          setSelectedBranch(nearest.slug)
          setGeoNote(`Nearest · ${nearest.name || nearest.slug}`)
        }
      },
      () => setGeoNote('Pick a branch'),
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }, [branches])

  const selectedCounts = useMemo(
    () => queueCounts[selectedBranch] || getQueueCounts([]),
    [queueCounts, selectedBranch],
  )

  const firstName = profile?.full_name?.split(' ')[0] || ''

  if (authLoading) {
    return (
      <div className="account-app flex min-h-svh items-center justify-center p-6">
        <Skeleton className="h-40 w-full max-w-md rounded-2xl" />
      </div>
    )
  }

  if (!user || (profile && profile.role !== 'customer' && user.user_metadata?.role !== 'customer')) {
    return <Navigate to="/signin" replace />
  }

  return (
    <section className="account-app">
      <header className="account-app-hero">
        <div className="public-shell account-app-hero-inner">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="account-eyebrow">My Hakum</p>
              <h1 className="account-title">Hi{firstName ? `, ${firstName}` : ''}</h1>
              <p className="account-sub">Your visits, stamps, and live queue — in one place.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
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
          </div>
          <div className="mt-5">
            <PushToggle audience="customer" autoPrompt />
          </div>
        </div>
      </header>

      <div className="public-shell account-app-body">
        {error ? (
          <div className="account-error mb-4" role="alert">
            <p>{error}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={load}>
                Retry
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/signin">Sign in</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <Skeleton className="mb-4 h-48 w-full rounded-[1.5rem]" />
        ) : loyalty ? (
          <div className="mb-5">
            <LoyaltyCard
              variant="hakum"
              completed={loyalty.completed}
              cardSlots={loyalty.cardSlots}
              milestones={loyalty.milestones}
              encouragement={loyalty.encouragement}
            />
          </div>
        ) : (
          <div className="account-empty mb-5">Loyalty card loads after your first stamped visit.</div>
        )}

        <InstallGuide variant="panel" audience="customer" className="mb-5" />

        <section className="account-sheet mb-5">
          <div className="mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-[#052699]" aria-hidden />
            <h2 className="text-base font-bold text-[#020a31]">Live queue</h2>
          </div>
          <p className="mb-3 text-xs text-slate-500">{geoNote || 'Choose a branch to see the floor.'}</p>
          <div className="flex flex-col gap-2">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="min-h-11 w-full rounded-xl">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="min-h-11 rounded-xl"
                onClick={() => {
                  if (!navigator.geolocation) return
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const nearest = nearestBranchSlug(
                      { lat: pos.coords.latitude, lng: pos.coords.longitude },
                      branches,
                    )
                    if (nearest) {
                      setSelectedBranch(nearest.slug)
                      setGeoNote(`Nearest · ${nearest.name || nearest.slug}`)
                    }
                  })
                }}
              >
                <Navigation data-icon="inline-start" /> Nearest
              </Button>
              {selectedBranch ? (
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-3 text-sm font-semibold text-[#052699]"
                  to={`/queue/${selectedBranch}`}
                >
                  Open queue
                </Link>
              ) : (
                <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                  Pick branch
                </span>
              )}
            </div>
          </div>
          {!loading && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['Waiting', selectedCounts.waiting],
                ['In progress', selectedCounts.in_progress],
                ['Checking', selectedCounts.final_checking],
                ['Active', selectedCounts.total],
              ].map(([label, value]) => (
                <div key={label} className="account-stat">
                  <p className="account-stat-value">{value}</p>
                  <p className="account-stat-label">{label}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="account-seg" role="tablist" aria-label="Visits">
          {[
            ['active', 'Active'],
            ['history', 'Visits'],
            ['purchases', 'Buys'],
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

        <div className="mt-4 space-y-3 pb-2">
          {tab === 'active' &&
            (loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : bookings.length === 0 ? (
              <EmptyBlock>
                No active visits.{' '}
                <Link className="font-semibold text-[#052699] underline" to="/book">
                  Book a service
                </Link>
              </EmptyBlock>
            ) : (
              bookings.map((row) => {
                const visit = row.visit || { steps: [], currentIndex: 0, label: row.status, isComplete: false }
                return (
                  <article key={row.id} className="account-tile">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-bold tracking-wide text-[#020a31]">{row.vehicle_plate || '—'}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') ||
                            row.service_name ||
                            'Service visit'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{row.branch}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {row.queue_label ? (
                          <p className="text-2xl font-black text-[#052699]">{row.queue_label}</p>
                        ) : (
                          <p className="text-xs text-slate-400">Queue pending</p>
                        )}
                        <Badge variant="secondary" className="mt-1">
                          {visit.label || row.status}
                        </Badge>
                      </div>
                    </div>
                    <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {visit.steps.map((step, idx) => {
                        const done = visit.isComplete || idx < visit.currentIndex
                        const current = !visit.isComplete && idx === visit.currentIndex
                        return (
                          <li
                            key={step.key}
                            className={`rounded-lg border px-2 py-2 text-center text-[11px] leading-tight ${
                              done
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800'
                                : current
                                  ? 'border-[#052699]/40 bg-[#052699]/10 text-[#052699]'
                                  : 'border-border text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </li>
                        )
                      })}
                    </ol>
                  </article>
                )
              })
            ))}

          {tab === 'history' &&
            (loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : history.length === 0 ? (
              <EmptyBlock>No visit history yet.</EmptyBlock>
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
                      <span>{row.branch}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {row.status}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-slate-300" aria-hidden />
                </article>
              ))
            ))}

          {tab === 'purchases' &&
            (loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : purchases.length === 0 ? (
              <EmptyBlock>No store purchases linked yet. Ask the cashier to search your plate at checkout.</EmptyBlock>
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
                          {row.payment_method || 'paid'} · {row.branch}
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

      <nav className="account-dock" aria-label="Account actions">
        <Link to="/book" className="account-dock-primary">
          Book
        </Link>
        <Link to="/queue" className="account-dock-ghost">
          Queue
        </Link>
        <Link to="/" className="account-dock-ghost">
          Home
        </Link>
      </nav>
    </section>
  )
}

function EmptyBlock({ children }) {
  return <div className="account-empty">{children}</div>
}

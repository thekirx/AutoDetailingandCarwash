import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { CalendarDays, LogOut, MapPin, Navigation, Receipt } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { nearestBranchSlug } from '@/lib/branchGeo'
import { getQueueCounts } from '@/queue/queueLogic'
import { formatMoney } from '@/queue/queueApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import LoyaltyCard from '@/components/LoyaltyCard'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import InstallGuide from '@/components/InstallGuide'

async function fetchPortal() {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/customer-portal', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Unable to load account.')
  return body
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function CustomerAccountPage() {
  const { profile, user, signOut, loading: authLoading } = useAuth()
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
    if (profile?.role === 'customer' || user?.user_metadata?.role === 'customer') load()
  }, [load, profile, user])

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
          setGeoNote(`Nearest: ${nearest.name || nearest.slug} (~${nearest.distanceKm.toFixed(1)} km)`)
        }
      },
      () => setGeoNote('Location unavailable — pick a branch manually.'),
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
      <div className="account-page flex min-h-svh items-center justify-center p-6">
        <Skeleton className="h-40 w-full max-w-md rounded-2xl" />
      </div>
    )
  }

  if (!user || (profile && profile.role !== 'customer' && user.user_metadata?.role !== 'customer')) {
    return <Navigate to="/account/login" replace />
  }

  return (
    <section className="account-page">
      <header className="account-hero">
        <div className="public-shell account-hero-inner">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="account-eyebrow">My Hakum</p>
              <h1 className="account-title">Hi{firstName ? `, ${firstName}` : ''}</h1>
              <p className="account-sub">Visits, loyalty, and live queue — on your phone.</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <NotificationBell />
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
          <div className="mt-4">
            <PushToggle />
          </div>
        </div>
      </header>

      <div className="public-shell account-body">
        {error ? <p className="form-error mb-4">{error}</p> : null}

        <InstallGuide variant="panel" audience="customer" />

        {loading ? (
          <Skeleton className="mb-4 h-40 w-full rounded-2xl" />
        ) : loyalty ? (
          <div className="mb-5">
            <LoyaltyCard
              completed={loyalty.completed}
              cardSlots={loyalty.cardSlots}
              milestones={loyalty.milestones}
              encouragement={loyalty.encouragement}
            />
          </div>
        ) : null}

        <Card className="account-panel mb-5 overflow-hidden border-0 shadow-sm">
          <CardHeader className="gap-3 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin size={18} className="text-primary" /> Live queue
            </CardTitle>
            <CardDescription>{geoNote || 'Choose a branch to see how busy the floor is.'}</CardDescription>
            <div className="flex flex-col gap-2">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="min-h-11 w-full">
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
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="min-h-11 w-full sm:flex-1"
                  onClick={() => {
                    if (!navigator.geolocation) return
                    navigator.geolocation.getCurrentPosition((pos) => {
                      const nearest = nearestBranchSlug(
                        { lat: pos.coords.latitude, lng: pos.coords.longitude },
                        branches,
                      )
                      if (nearest) {
                        setSelectedBranch(nearest.slug)
                        setGeoNote(`Nearest: ${nearest.name || nearest.slug} (~${nearest.distanceKm.toFixed(1)} km)`)
                      }
                    })
                  }}
                >
                  <Navigation data-icon="inline-start" /> Use nearest
                </Button>
                {selectedBranch ? (
                  <Link
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 text-sm font-medium sm:flex-1"
                    to={`/queue/${selectedBranch}`}
                  >
                    Open live queue
                  </Link>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Waiting', selectedCounts.waiting],
                  ['In progress', selectedCounts.in_progress],
                  ['Checking', selectedCounts.final_checking],
                  ['Total active', selectedCounts.total],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-muted/40 px-3 py-3 text-center">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="active" className="account-tabs">
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="active" className="min-h-11 rounded-lg text-xs sm:text-sm">
              Active
            </TabsTrigger>
            <TabsTrigger value="history" className="min-h-11 rounded-lg text-xs sm:text-sm">
              Visits
            </TabsTrigger>
            <TabsTrigger value="purchases" className="min-h-11 rounded-lg text-xs sm:text-sm">
              Purchases
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : bookings.length === 0 ? (
              <EmptyBlock>
                No active visits.{' '}
                <Link className="text-primary underline" to="/book">
                  Book a service
                </Link>
                .
              </EmptyBlock>
            ) : (
              bookings.map((row) => {
                const visit = row.visit || { steps: [], currentIndex: 0, label: row.status, isComplete: false }
                return (
                  <article key={row.id} className="account-visit-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-semibold tracking-wide">{row.vehicle_plate || '—'}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') ||
                            row.service_name ||
                            'Service visit'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.branch}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {row.queue_label ? (
                          <p className="text-2xl font-bold text-primary">{row.queue_label}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Queue pending</p>
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
                                  ? 'border-primary/40 bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground'
                            }`}
                          >
                            {step.label}
                          </li>
                        )
                      })}
                    </ol>
                    {row.final_price_minor != null ? (
                      <p className="mt-3 text-right text-xs text-muted-foreground">
                        Est. {formatMoney(row.final_price_minor)}
                      </p>
                    ) : null}
                  </article>
                )
              })
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : history.length === 0 ? (
              <EmptyBlock>No visit history yet — your next check-in will show here.</EmptyBlock>
            ) : (
              history.map((row) => (
                <article key={row.id} className="account-history-card">
                  <div className="flex items-start gap-3">
                    <span className="account-history-icon" aria-hidden>
                      <CalendarDays className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold">{row.vehicle_plate || 'Visit'}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || 'Service'}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatMoney(row.final_price_minor)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatWhen(row.created_at || row.scheduled_start)}</span>
                        <span aria-hidden>·</span>
                        <span>{row.branch}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {row.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </TabsContent>

          <TabsContent value="purchases" className="mt-4 space-y-3">
            {loading ? (
              <Skeleton className="h-28 w-full rounded-2xl" />
            ) : purchases.length === 0 ? (
              <EmptyBlock>No POS purchases linked yet. Ask the cashier to search your name or plate at checkout for loyalty.</EmptyBlock>
            ) : (
              purchases.map((row) => (
                <article key={row.id} className="account-history-card">
                  <div className="flex items-start gap-3">
                    <span className="account-history-icon" aria-hidden>
                      <Receipt className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">Store purchase</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {row.payment_method || 'paid'} · {row.branch}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(row.total_minor)}</p>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{formatWhen(row.occurred_at)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      <nav className="account-dock" aria-label="Account actions">
        <Link to="/book" className="account-dock-primary">
          Book a service
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
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

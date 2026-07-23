import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogOut, MapPin, Navigation } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import LoyaltyCard from '@/components/LoyaltyCard'
import NotificationBell from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'

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

export default function CustomerAccountPage() {
  const { profile, user, signOut, loading: authLoading } = useAuth()
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [queueCounts, setQueueCounts] = useState({})
  const [history, setHistory] = useState([])
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Skeleton className="h-40 w-full max-w-md" />
      </div>
    )
  }

  if (!user || (profile && profile.role !== 'customer' && user.user_metadata?.role !== 'customer')) {
    return <Navigate to="/account/login" replace />
  }

  return (
    <section className="account-page">
      <div className="public-shell" style={{ paddingTop: 32, paddingBottom: 64 }}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">My account</p>
            <h1 className="section-title" style={{ marginBottom: 8 }}>
              Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
            <p className="text-sm text-slate-600">Track visits, loyalty, and live queue — same Hakum site you booked from.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            <PushToggle />
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut data-icon="inline-start" /> Sign out
            </Button>
          </div>
        </div>

        {error ? <p className="form-error mt-4">{error}</p> : null}

        <div className="mt-8 flex flex-col gap-6">
        {loading ? (
          <Skeleton className="h-64 w-full rounded-[2rem]" />
        ) : loyalty ? (
          <LoyaltyCard
            completed={loyalty.completed}
            cardSlots={loyalty.cardSlots}
            milestones={loyalty.milestones}
            encouragement={loyalty.encouragement}
          />
        ) : null}

        <Card>
          <CardHeader className="gap-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MapPin size={18} /> Live queue
            </CardTitle>
            <CardDescription>
              {geoNote || 'Choose a branch to see how busy the floor is.'}
            </CardDescription>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full sm:max-w-xs"><SelectValue placeholder="Branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
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
                <Link className="inline-flex h-8 items-center text-sm text-primary underline" to={`/queue/${selectedBranch}`}>
                  Open live queue
                </Link>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Waiting', selectedCounts.waiting],
                  ['In progress', selectedCounts.in_progress],
                  ['Checking', selectedCounts.final_checking],
                  ['Total active', selectedCounts.total],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-muted/30 px-3 py-4 text-center">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="active">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="active">Active visits</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your bookings in progress</CardTitle>
                <CardDescription>Queue number and live status for your vehicle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? <Skeleton className="h-24 w-full" /> : bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No active visits. <Link className="text-primary underline" to="/book">Book a service</Link>.
                  </p>
                ) : (
                  bookings.map((row) => {
                    const visit = row.visit || { steps: [], currentIndex: 0, label: row.status, isComplete: false }
                    return (
                      <div key={row.id} className="rounded-xl border border-border bg-muted/20 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold tracking-wide">{row.vehicle_plate || '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || row.service_name || 'Service visit'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{row.branch}</p>
                          </div>
                          <div className="text-right">
                            {row.queue_label ? (
                              <p className="text-2xl font-bold text-primary">{row.queue_label}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Queue pending</p>
                            )}
                            <Badge variant="secondary" className="mt-1">{visit.label || row.status}</Badge>
                          </div>
                        </div>
                        <ol className="mt-4 grid gap-2 sm:grid-cols-4">
                          {visit.steps.map((step, idx) => {
                            const done = visit.isComplete || idx < visit.currentIndex
                            const current = !visit.isComplete && idx === visit.currentIndex
                            return (
                              <li
                                key={step.key}
                                className={`rounded-lg border px-2 py-2 text-center text-[11px] leading-tight ${
                                  done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800'
                                    : current ? 'border-primary/40 bg-primary/10 text-primary'
                                      : 'border-border text-muted-foreground'
                                }`}
                              >
                                {step.label}
                              </li>
                            )
                          })}
                        </ol>
                        {row.final_price_minor != null ? (
                          <p className="mt-3 text-right text-xs text-muted-foreground">Est. {formatMoney(row.final_price_minor)}</p>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Visit history</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {loading ? <Skeleton className="h-24 w-full" /> : history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No history yet — your next check-in will show here.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(row.created_at || row.scheduled_start).toLocaleString('en-PH')}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{row.vehicle_plate || '—'}</div>
                            <div className="text-xs text-muted-foreground">{[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ')}</div>
                          </TableCell>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                          <TableCell className="text-right">{formatMoney(row.final_price_minor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-3 pb-4">
          <Link to="/book" className="button button-blue">Book a service</Link>
          <Link to="/queue" className="button">Live queue</Link>
          <Link to="/" className="button">Home</Link>
        </div>
        </div>
      </div>
    </section>
  )
}

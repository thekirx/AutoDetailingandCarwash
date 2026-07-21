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
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b12]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] text-blue-300 uppercase">Hakum Auto Care</p>
            <h1 className="truncate text-lg font-semibold sm:text-xl">
              Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-slate-300">
            <LogOut data-icon="inline-start" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}

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

        <Card className="border-white/10 bg-[#111820]">
          <CardHeader className="gap-3">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MapPin size={18} /> Live queue
            </CardTitle>
            <CardDescription className="text-slate-400">
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
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-center">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-[11px] tracking-wide text-slate-400 uppercase">{label}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {branches.map((b) => {
                const c = queueCounts[b.slug] || getQueueCounts([])
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => setSelectedBranch(b.slug)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedBranch === b.slug ? 'border-blue-400 bg-blue-500/20 text-blue-100' : 'border-white/10 text-slate-400'}`}
                  >
                    {b.name.replace('Hakum Auto Care ', '')} · {c.total}
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="active">
          <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger value="active">Active visits</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-4">
            <Card className="border-white/10 bg-[#111820]">
              <CardHeader>
                <CardTitle className="text-base">Your bookings in progress</CardTitle>
                <CardDescription>Queue number and live status for your vehicle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? <Skeleton className="h-24 w-full" /> : bookings.length === 0 ? (
                  <p className="text-sm text-slate-400">No active visits. Walk in or book from the public site.</p>
                ) : (
                  bookings.map((row) => {
                    const visit = row.visit || { steps: [], currentIndex: 0, label: row.status, isComplete: false }
                    return (
                      <div key={row.id} className="rounded-xl border border-white/10 bg-[#0d1218] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold tracking-wide text-white">{row.vehicle_plate || '—'}</p>
                            <p className="text-xs text-slate-400">
                              {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || row.service_name || 'Service visit'}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{row.branch}</p>
                          </div>
                          <div className="text-right">
                            {row.queue_label ? (
                              <p className="text-2xl font-bold text-blue-300">{row.queue_label}</p>
                            ) : (
                              <p className="text-sm text-slate-500">Queue pending</p>
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
                                  done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                    : current ? 'border-blue-400/50 bg-blue-500/15 text-blue-100'
                                      : 'border-white/5 text-slate-500'
                                }`}
                              >
                                {step.label}
                              </li>
                            )
                          })}
                        </ol>
                        {row.final_price_minor != null ? (
                          <p className="mt-3 text-right text-xs text-slate-400">Est. {formatMoney(row.final_price_minor)}</p>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <Card className="border-white/10 bg-[#111820]">
              <CardHeader>
                <CardTitle className="text-base">Visit history</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {loading ? <Skeleton className="h-24 w-full" /> : history.length === 0 ? (
                  <p className="text-sm text-slate-400">No history yet — your next check-in will show here.</p>
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
                          <TableCell className="whitespace-nowrap text-xs text-slate-400">
                            {new Date(row.created_at || row.scheduled_start).toLocaleString('en-PH')}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{row.vehicle_plate || '—'}</div>
                            <div className="text-xs text-slate-500">{[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ')}</div>
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

        <div className="flex flex-wrap gap-3 pb-8">
          <Link to="/book" className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground sm:w-auto">
            Book a service
          </Link>
          <Link to="/" className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-medium text-slate-200 sm:w-auto">
            Back to site
          </Link>
        </div>
      </main>
    </div>
  )
}

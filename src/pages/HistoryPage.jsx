import { useCallback, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CalendarRange,
  CarFront,
  ChevronRight,
  History,
  Loader2,
  Phone,
  Search,
  Shield,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessHistory, canSeeAllBranches } from '@/auth/permissions'
import { getAccessTokenFresh } from '@/lib/authToken'
import {
  filterHistoryTimeline,
  formatPhpMinor,
  normalizeHistoryPlate,
  normalizeHistoryPhone,
} from '@/lib/customerHistory'
import { DETAILING_BOARD_STATUSES, detailingBoardStatusLabel } from '@/lib/detailingBoardStatuses'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { cn } from '@/lib/utils'

const KIND_FILTERS = [
  { id: 'booking', label: 'Bookings' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'sale', label: 'POS sales' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...DETAILING_BOARD_STATUSES.map((s) => ({ value: s.id, label: s.label })),
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'scheduled', label: 'Maint · scheduled' },
  { value: 'notified', label: 'Maint · notified' },
  { value: 'completed', label: 'Completed / paid' },
]

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return String(iso)
  }
}

function kindTone(kind) {
  if (kind === 'maintenance') return 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100'
  if (kind === 'sale') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
  return 'border-primary/35 bg-primary/10 text-primary'
}

/**
 * Ops History — plate / mobile ledger. Mobile-first search, filterable timeline.
 * Audience: SA, ASA, Sales, TL, Marketing, Branch Admin (branch-scoped).
 */
export default function HistoryPage() {
  const { profile } = useAuth()
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [searched, setSearched] = useState(false)
  const [kinds, setKinds] = useState(['booking', 'maintenance', 'sale'])
  const [status, setStatus] = useState('all')
  const [serviceKind, setServiceKind] = useState('all')
  const [branch, setBranch] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState(null)

  const allBranches = canSeeAllBranches(profile) || profile?.role === 'marketing' || profile?.role === 'assistant_super_admin'
  const platePreview = normalizeHistoryPlate(q) || normalizeHistoryPhone(q) || '—'

  const timeline = useMemo(() => {
    if (!result?.timeline) return []
    return filterHistoryTimeline(result.timeline, {
      kinds,
      status,
      branch,
      serviceKind,
      from: from || null,
      to: to || null,
    })
  }, [result, kinds, status, branch, serviceKind, from, to])

  const branchOptions = useMemo(() => {
    const set = new Set(result?.identity?.branches || [])
    return ['all', ...[...set].sort()]
  }, [result])

  const runSearch = useCallback(async (queryRaw) => {
    const query = String(queryRaw || '').trim()
    if (query.length < 3) {
      toast.error('Enter at least 3 characters of a plate or mobile number.')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const token = await getAccessTokenFresh()
      const res = await fetch('/api/customer-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ q: query }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Search failed')
        setResult(null)
        return
      }
      setResult(data)
      setBranch('all')
      if (!data.counts?.events) {
        toast.message('No visits found for that plate or number.')
      }
    } catch (err) {
      toast.error(String(err.message || err))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const search = useCallback(
    async (e) => {
      e?.preventDefault?.()
      await runSearch(q)
    },
    [q, runSearch],
  )

  function toggleKind(id) {
    setKinds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((k) => k !== id)
        return next.length ? next : prev
      }
      return [...prev, id]
    })
  }

  const identityName =
    result?.customer?.full_name ||
    result?.identity?.names?.[0] ||
    'Customer'

  if (!canAccessHistory(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }

  return (
    <OpsPageShell
      className="hakum-history history-ledger"
      eyebrow="Operations"
      title="History"
      icon={History}
      description={
        `Look up a plate or mobile number — full visit ledger with services, packages, bookings, POS, and paint maintenance.${
          !allBranches ? ' Showing your branch only.' : ''
        }`
      }
    >
      {/* Signature: plate-bay search */}
      <form
        onSubmit={search}
        className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.07] via-background to-background p-4 shadow-sm sm:p-5"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 20%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 45%)',
          }}
          aria-hidden
        />
        <div className="relative grid gap-3">
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="history-q" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Plate or mobile
            </Label>
            <span
              className="font-mono text-sm tracking-[0.18em] text-primary tabular-nums"
              aria-live="polite"
            >
              {platePreview}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="history-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ABC 1234 or 09XXXXXXXXX"
                className="min-h-12 border-border/80 bg-background/90 pl-10 text-base tracking-wide sm:text-[15px]"
                autoComplete="off"
                inputMode="search"
                enterKeyHint="search"
              />
            </div>
            <Button type="submit" disabled={loading} className="min-h-12 shrink-0 px-6 sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Searching…
                </>
              ) : (
                'Search history'
              )}
            </Button>
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CarFront className="size-3.5" aria-hidden /> Plate
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3.5" aria-hidden /> Mobile
            </span>
            <span className="inline-flex items-center gap-1">
              <Shield className="size-3.5" aria-hidden /> Branch-scoped for Admin / TL
            </span>
          </p>
        </div>
      </form>

      {result ? (
        <>
          <div className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-[1.2fr_1fr]">
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground uppercase">Identity</p>
              <p className="mt-1 truncate text-xl font-semibold tracking-tight">{identityName}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-muted-foreground">
                {(result.identity?.phones || []).slice(0, 2).map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1">
                    <Phone className="size-3.5" aria-hidden />
                    {p}
                  </span>
                ))}
                {(result.identity?.plates || []).slice(0, 3).map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2 py-1 font-mono tracking-wider text-foreground"
                  >
                    <CarFront className="size-3.5 text-primary" aria-hidden />
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center sm:text-left">
              {[
                ['Bookings', result.counts?.bookings ?? 0],
                ['Maint.', result.counts?.maintenance ?? 0],
                ['Sales', result.counts?.sales ?? 0],
              ].map(([label, n]) => (
                <div key={label} className="rounded-xl border border-border/80 bg-background/70 px-2 py-3">
                  <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{n}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border p-3 sm:p-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Event types">
              {KIND_FILTERS.map((k) => {
                const on = kinds.includes(k.id)
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => toggleKind(k.id)}
                    className={cn(
                      'min-h-10 cursor-pointer rounded-lg border px-3 text-sm font-medium transition',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {k.label}
                  </button>
                )
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hist-status" className="text-xs">Status</Label>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  items={STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
                >
                  <SelectTrigger id="hist-status" className="min-h-11 w-full cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hist-svc" className="text-xs">Service kind</Label>
                <Select
                  value={serviceKind}
                  onValueChange={setServiceKind}
                  items={[
                    { value: 'all', label: 'All kinds' },
                    { value: 'detailing', label: 'Detailing' },
                    { value: 'package', label: 'Packages / PPF' },
                    { value: 'wash', label: 'Wash / service' },
                  ]}
                >
                  <SelectTrigger id="hist-svc" className="min-h-11 w-full cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All kinds</SelectItem>
                    <SelectItem value="detailing">Detailing</SelectItem>
                    <SelectItem value="package">Packages / PPF</SelectItem>
                    <SelectItem value="wash">Wash / service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {allBranches ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hist-branch" className="text-xs">Branch</Label>
                  <Select
                    value={branch}
                    onValueChange={setBranch}
                    items={branchOptions.map((b) => ({
                      value: b,
                      label: b === 'all' ? 'All branches' : b,
                    }))}
                  >
                    <SelectTrigger id="hist-branch" className="min-h-11 w-full cursor-pointer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b === 'all' ? 'All branches' : b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs">Date range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    className="min-h-11"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    aria-label="From date"
                  />
                  <Input
                    type="date"
                    className="min-h-11"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    aria-label="To date"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground tabular-nums">{timeline.length}</span> of{' '}
              <span className="tabular-nums">{result.counts?.events ?? 0}</span> events
            </p>
          </div>

          {timeline.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <CalendarRange className="mx-auto size-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">No events match these filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Clear filters or search another plate / number.</p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 min-h-11"
                onClick={() => {
                  setKinds(['booking', 'maintenance', 'sale'])
                  setStatus('all')
                  setServiceKind('all')
                  setBranch('all')
                  setFrom('')
                  setTo('')
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <ol className="relative space-y-0 border-l border-border/80 pl-0 sm:ml-2">
              {timeline.map((ev) => {
                const amount = formatPhpMinor(ev.amountMinor)
                const statusLabel =
                  detailingBoardStatusLabel(ev.status) ||
                  String(ev.status || '').replace(/_/g, ' ')
                const isComplete = ev.status === 'completed' || ev.kind === 'sale'
                return (
                  <li key={ev.id} className="relative pb-5 pl-6 last:pb-0 sm:pl-8">
                    <span
                      className={cn(
                        'absolute top-1.5 left-0 size-2.5 -translate-x-[5px] rounded-full ring-4 ring-background',
                        ev.kind === 'maintenance'
                          ? 'bg-amber-500'
                          : ev.kind === 'sale'
                            ? 'bg-emerald-500'
                            : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <button
                      type="button"
                      className="group w-full cursor-pointer rounded-xl border border-border/90 bg-card/80 p-3.5 text-left transition hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                      onClick={() => setSelected(ev)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                                kindTone(ev.kind),
                              )}
                            >
                              {ev.kind === 'maintenance' ? 'Maintenance' : ev.kind === 'sale' ? 'POS' : 'Booking'}
                            </span>
                            {statusLabel ? (
                              <span className="text-xs capitalize text-muted-foreground">{statusLabel}</span>
                            ) : null}
                          </div>
                          <h2 className="mt-1.5 text-base font-semibold tracking-tight group-hover:text-primary">
                            {ev.title}
                          </h2>
                          {ev.subtitle ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">{ev.subtitle}</p>
                          ) : null}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-primary">
                          Details
                          <ChevronRight className="size-3.5" aria-hidden />
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground tabular-nums sm:grid-cols-2">
                        {ev.statusAt ? <p>Status · {formatWhen(ev.statusAt)}</p> : null}
                        {ev.startedAt ? <p>Start · {formatWhen(ev.startedAt)}</p> : null}
                        {isComplete && ev.endedAt ? (
                          <p className="font-medium text-foreground">End · {formatWhen(ev.endedAt)}</p>
                        ) : null}
                        {ev.nextDueAt ? (
                          <p className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-200">
                            <Wrench className="size-3.5" aria-hidden />
                            Next due {ev.nextDueAt}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {ev.branch ? <span>Branch · {ev.branch}</span> : null}
                        {ev.plate ? <span className="font-mono tracking-wide">{ev.plate}</span> : null}
                        {amount ? <span className="font-medium text-foreground">{amount}</span> : null}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ol>
          )}

          <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{selected?.title || 'Event details'}</DialogTitle>
              </DialogHeader>
              {selected ? (
                <div className="grid gap-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className={cn('rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase', kindTone(selected.kind))}>
                      {selected.kind}
                    </span>
                    {selected.status ? (
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs capitalize">
                        {detailingBoardStatusLabel(selected.status) || String(selected.status).replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['Customer', selected.customerName || selected.subtitle],
                      ['Plate', selected.plate],
                      ['Phone', selected.phone],
                      ['Branch', selected.branch],
                      ['Vehicle', [selected.vehicleMake, selected.vehicleModel].filter(Boolean).join(' ')],
                      ['Amount', formatPhpMinor(selected.amountMinor)],
                      ['Status time', selected.statusAt ? formatWhen(selected.statusAt) : null],
                      ['Start', selected.startedAt ? formatWhen(selected.startedAt) : null],
                      [
                        'End',
                        selected.status === 'completed' || selected.kind === 'sale'
                          ? selected.endedAt
                            ? formatWhen(selected.endedAt)
                            : null
                          : null,
                      ],
                      ['Created', selected.createdAt ? formatWhen(selected.createdAt) : null],
                      ['Coated', selected.coatedAt],
                      ['Last maintenance', selected.lastMaintenanceAt],
                      ['Next due', selected.nextDueAt],
                      ['Last notified', selected.lastNotifiedAt ? formatWhen(selected.lastNotifiedAt) : null],
                      ['Booking ID', selected.bookingId],
                      ['Sale ID', selected.saleId],
                    ]
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                          <dt className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{label}</dt>
                          <dd className="mt-0.5 break-all font-medium">{value}</dd>
                        </div>
                      ))}
                  </dl>
                  {selected.notes ? (
                    <p className="rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground">{selected.notes}</p>
                  ) : null}
                </div>
              ) : null}
              <DialogFooter className="flex-col gap-2 sm:flex-row">
                {selected?.plate || selected?.phone ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 w-full cursor-pointer sm:w-auto"
                    onClick={() => {
                      const nextQ = selected.plate || selected.phone
                      setSelected(null)
                      setQ(nextQ)
                      runSearch(nextQ)
                    }}
                  >
                    Full history for this {selected?.plate ? 'plate' : 'number'}
                  </Button>
                ) : null}
                <Button type="button" className="min-h-11 w-full cursor-pointer sm:w-auto" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : searched && !loading ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-14 text-center">
          <Search className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">Nothing in the ledger yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another plate or the customer’s mobile number.</p>
        </div>
      ) : !loading ? (
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-12 text-center sm:px-8">
          <p className="text-sm text-muted-foreground">
            Search a plate like <span className="font-mono text-foreground">ABC1234</span> or a mobile like{' '}
            <span className="font-mono text-foreground">09171234567</span> to open the visit ledger.
          </p>
        </div>
      ) : null}
    </OpsPageShell>
  )
}

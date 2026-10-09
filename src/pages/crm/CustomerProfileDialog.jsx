/** CRM › customer profile modal - full visit + purchase history and marketing signals for one customer. */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, Mail, MessageSquare, Pencil, Phone, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { canAccessQueuePage, canEditCrm } from '@/auth/permissions'
import CustomerNotesPanel from '@/components/CustomerNotesPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { collectPaged } from '@/lib/crmInsights'
import { isSmsReachable, summarizeCustomerHistory, ticketNotesFromBookings } from '@/lib/crmSmartGroups'
import { vehicleIconGlyph } from '@/lib/ownerRevisionsPhase7'
import { normalizePricingSize, PRICING_SIZES } from '@/lib/servicePricing'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { STATUS_LABELS } from '@/queue/queueLogic'

const BOOKING_SELECT =
  'id, status, branch, scheduled_start, completed_at, created_at, vehicle_plate, vehicle_make, vehicle_model, queue_number, final_price_minor, price_minor, visit_group_id, cancellation_reason, notes, team_lead_id, services(name)'
const EMPTY = { bookings: [], sales: [], vehicles: [], loyalty: [], membership: null }

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-')
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-')
const ago = (days) => (days == null ? 'No visits yet' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`)
const STATUS_TONE = { completed: 'secondary', cancelled: 'outline', no_show: 'destructive' }

/** staff_display_names: CRM readers without staff_profiles access still see who wrote a ticket note. */
async function withTeamLeadNames(rows) {
  const ids = [...new Set(rows.filter((b) => b.team_lead_id && b.notes?.trim()).map((b) => b.team_lead_id))]
  if (!ids.length) return rows
  const { data } = await supabase.rpc('staff_display_names', { p_ids: ids })
  const names = new Map((data || []).map((p) => [p.id, p.full_name]))
  return rows.map((b) => (b.team_lead_id ? { ...b, team_lead_name: names.get(b.team_lead_id) || null } : b))
}

async function loadHistory(customerId) {
  const bookingsP = collectPaged(async (from, to) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(BOOKING_SELECT)
      .eq('customer_id', customerId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return data || []
  }).then(withTeamLeadNames)
  const [bookings, sales, vehicles, loyalty, membership] = await Promise.allSettled([
    bookingsP,
    supabase
      .from('sales')
      .select('id, branch, status, payment_method, total_minor, discount_minor, occurred_at, sale_line_items(name, quantity, line_total_minor)')
      .eq('customer_id', customerId)
      .order('occurred_at', { ascending: false })
      .limit(300),
    supabase
      .from('vehicles')
      .select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, icon, total_visits, last_visit_at')
      .eq('customer_id', customerId)
      .eq('is_archived', false),
    supabase.from('loyalty_ledger').select('id, delta, reason, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(100),
    supabase
      .from('customer_memberships')
      .select('id, starts_at, ends_at, membership_tiers(name)')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  const pick = (r, label) => {
    const error = r.status === 'rejected' ? r.reason : r.value?.error
    if (error) toast.error(`${label}: ${error.message || error}`)
    return error ? null : r.value?.data ?? r.value
  }
  return {
    bookings: pick(bookings, 'Visits') || [],
    sales: pick(sales, 'Purchases') || [],
    vehicles: pick(vehicles, 'Vehicles') || [],
    loyalty: pick(loyalty, 'Loyalty') || [],
    membership: pick(membership, 'Membership'),
  }
}

function Kpi({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/**
 * @param {{ customer: object|null, onOpenChange: (open: boolean) => void, profile: object, branchName: (slug: string) => string,
 *   reloadKey?: number, onMessage?: () => void, onEdit?: () => void, onAddVehicle?: () => void, children?: any }} props
 */
export default function CustomerProfileDialog({ customer, onOpenChange, profile, branchName, reloadKey = 0, onMessage, onEdit, onAddVehicle, children }) {
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(false)
  const customerId = customer?.id

  useEffect(() => {
    if (!customerId) return undefined
    let alive = true
    setLoading(true)
    loadHistory(customerId)
      .then((next) => alive && setData(next))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [customerId, reloadKey])

  const summary = useMemo(() => summarizeCustomerHistory(data.bookings), [data.bookings])
  const receiptsMinor = useMemo(
    () => data.sales.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (Number(s.total_minor) || 0), 0),
    [data.sales],
  )
  const ticketNotes = useMemo(() => ticketNotesFromBookings(data.bookings), [data.bookings])
  const showTicket = canAccessQueuePage(profile)

  if (!customer) return null
  const smsOk = isSmsReachable(customer)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="crm-profile flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="gap-3 border-b border-border px-5 pt-5 pb-4 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold">{customer.full_name || 'Unnamed customer'}</DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" aria-hidden />{customer.phone || 'No phone'}</span>
                <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="size-3.5" aria-hidden /><span className="truncate">{customer.email || 'No email'}</span></span>
                <span>Customer since {fmtDate(customer.created_at)}</span>
              </DialogDescription>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant={smsOk ? 'secondary' : 'outline'}>{smsOk ? 'SMS reachable' : 'No SMS'}</Badge>
                <Badge variant={customer.notify_push !== false ? 'secondary' : 'outline'}>{customer.notify_push !== false ? 'Push on' : 'Push off'}</Badge>
                {data.membership ? <Badge>{data.membership.membership_tiers?.name || 'Member'}</Badge> : null}
                {customer.is_disabled ? <Badge variant="destructive"><BellOff aria-hidden /> Muted account</Badge> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {onMessage ? (
                <Button type="button" size="sm" className="min-h-11 xl:min-h-9" onClick={onMessage}>
                  <MessageSquare data-icon="inline-start" aria-hidden /> Message
                </Button>
              ) : null}
              {onEdit ? (
                <Button type="button" size="sm" variant="outline" className="min-h-11 xl:min-h-9" onClick={onEdit}>
                  <Pencil data-icon="inline-start" aria-hidden /> Edit profile
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4" aria-busy={loading || undefined}>
          <section aria-label="Customer value" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Kpi label="Visits" value={summary.visits} hint={[summary.cancelled && `${summary.cancelled} cancelled`, summary.noShows && `${summary.noShows} no-show`].filter(Boolean).join(' · ') || 'Completed trips'} />
            <Kpi label="Lifetime value" value={formatMoney(summary.spendMinor)} hint={receiptsMinor ? `${formatMoney(receiptsMinor)} in POS receipts` : 'Completed services'} />
            <Kpi label="Avg per visit" value={formatMoney(summary.avgTicketMinor)} />
            <Kpi label="Last visit" value={ago(summary.daysSinceLast)} hint={summary.lastVisit ? fmtDate(new Date(summary.lastVisit).toISOString()) : undefined} />
            <Kpi label="Visit cadence" value={summary.cadenceDays == null ? '-' : `Every ${summary.cadenceDays || 1} day${summary.cadenceDays > 1 ? 's' : ''}`} hint={summary.firstVisit ? `First visit ${fmtDate(new Date(summary.firstVisit).toISOString())}` : undefined} />
            <Kpi label="Loyalty" value={`${customer.loyalty_points ?? 0} pts`} hint={`${customer.loyalty_stamps ?? 0} stamps`} />
          </section>

          <section aria-label="Preferences" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <p><span className="text-muted-foreground">Usual branch:</span> <strong className="font-medium">{summary.topBranch ? branchName(summary.topBranch) : '-'}</strong></p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">Top services:</span>
              {summary.topServices.length
                ? summary.topServices.map((s) => <Badge key={s.name} variant="outline">{s.name} × {s.count}</Badge>)
                : <span>-</span>}
            </div>
          </section>

          {loading && !data.bookings.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading history…</p>
          ) : (
            <Tabs defaultValue="visits">
              <TabsList className="mb-3 w-full justify-start overflow-x-auto sm:w-fit">
                <TabsTrigger value="visits">Visits ({data.bookings.length})</TabsTrigger>
                <TabsTrigger value="purchases">Purchases ({data.sales.length})</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles ({data.vehicles.length})</TabsTrigger>
                <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="visits">
                {data.bookings.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        {showTicket ? <TableHead className="text-right"><span className="sr-only">Ticket</span></TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.bookings.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="whitespace-nowrap">{fmtDateTime(b.completed_at || b.scheduled_start || b.created_at)}</TableCell>
                          <TableCell className="font-medium">{b.services?.name || '-'}</TableCell>
                          <TableCell>{branchName(b.branch)}</TableCell>
                          <TableCell>
                            {b.vehicle_plate || '-'}
                            {b.vehicle_make || b.vehicle_model ? <span className="block text-xs text-muted-foreground">{[b.vehicle_make, b.vehicle_model].filter(Boolean).join(' ')}</span> : null}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_TONE[b.status] || 'outline'}>{STATUS_LABELS[b.status] || b.status}</Badge>
                            {b.cancellation_reason ? <span className="block max-w-48 truncate text-xs text-muted-foreground" title={b.cancellation_reason}>{b.cancellation_reason}</span> : null}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {b.status === 'completed'
                              ? formatMoney(b.final_price_minor ?? b.price_minor)
                              : <span className="text-muted-foreground line-through" title="Not charged">{formatMoney(b.final_price_minor ?? b.price_minor)}</span>}
                          </TableCell>
                          {showTicket ? (
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="ghost">
                                <Link to={`/operations/queue/${b.id}`}>Ticket</Link>
                              </Button>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No visits yet.</p>
                )}
              </TabsContent>

              <TabsContent value="purchases" className="flex flex-col gap-2">
                {data.sales.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{fmtDateTime(s.occurred_at)} · {branchName(s.branch)}</p>
                      <p className="text-muted-foreground">
                        {(s.sale_line_items || []).map((l) => `${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''}`).join(', ') || 'No line items'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.status !== 'paid' ? <Badge variant="outline">{s.status}</Badge> : null}
                      <span className="text-xs text-muted-foreground capitalize">{s.payment_method || ''}</span>
                      <span className="font-semibold tabular-nums">{formatMoney(s.total_minor)}</span>
                    </div>
                  </div>
                ))}
                {!data.sales.length ? <p className="text-sm text-muted-foreground">No POS receipts on file.</p> : null}
              </TabsContent>

              <TabsContent value="vehicles" className="flex flex-col gap-2">
                {onAddVehicle ? (
                  <div className="flex justify-end">
                    <Button type="button" size="sm" variant="outline" className="min-h-11 xl:min-h-9" onClick={onAddVehicle}>
                      <Plus data-icon="inline-start" aria-hidden /> Add vehicle
                    </Button>
                  </div>
                ) : null}
                {data.vehicles.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
                    <span className="mt-0.5 text-lg" aria-hidden>{vehicleIconGlyph(v.icon)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{v.plate_number}</p>
                      <p className="text-muted-foreground">
                        {[v.vehicle_make, v.vehicle_model, v.vehicle_year, PRICING_SIZES.find((s) => s.slug === normalizePricingSize(v.vehicle_type))?.label, v.color].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {v.total_visits ?? 0} visits
                      {v.last_visit_at ? <span className="block">Last {fmtDate(v.last_visit_at)}</span> : null}
                    </p>
                  </div>
                ))}
                {!data.vehicles.length ? <p className="text-sm text-muted-foreground">No vehicles on file.</p> : null}
              </TabsContent>

              <TabsContent value="loyalty" className="flex flex-col gap-2">
                {data.loyalty.map((row) => (
                  <div key={row.id} className="flex justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                    <div>
                      <p>{row.reason}</p>
                      <p className="text-xs text-muted-foreground">{fmtDateTime(row.created_at)}</p>
                    </div>
                    <span className="font-medium tabular-nums">{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
                  </div>
                ))}
                {!data.loyalty.length ? <p className="text-sm text-muted-foreground">No loyalty activity.</p> : null}
              </TabsContent>

              <TabsContent value="notes" className="flex flex-col gap-6">
                <section aria-labelledby="crm-ticket-notes" className="flex flex-col gap-2">
                  <div>
                    <p id="crm-ticket-notes" className="text-sm font-medium">Ticket notes</p>
                    <p className="text-xs text-muted-foreground">From the Notes field on the Team Lead New ticket form and on bookings.</p>
                  </div>
                  {ticketNotes.map((n) => (
                    <article key={n.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{n.fromTeamLead ? `Team Lead${n.author ? ` · ${n.author}` : ''}` : 'Booking note'}</span>
                        <span>{fmtDateTime(n.at)}</span>
                        <span>{branchName(n.branch)}</span>
                        {n.queueNumber != null ? <span className="tabular-nums">#{n.queueNumber}</span> : null}
                        {n.plate ? <span>{n.plate}</span> : null}
                      </p>
                      <p className="mt-1.5 whitespace-pre-wrap">{n.text}</p>
                      {n.services.length ? <p className="mt-1 text-xs text-muted-foreground">{n.services.join(', ')}</p> : null}
                    </article>
                  ))}
                  {!ticketNotes.length ? <p className="text-sm text-muted-foreground">No ticket notes yet.</p> : null}
                </section>
                <CustomerNotesPanel customerId={customer.id} plate={data.vehicles[0]?.plate_number || ''} canWrite={canEditCrm(profile)} />
              </TabsContent>
            </Tabs>
          )}
        </div>
        {children}
      </DialogContent>
    </Dialog>
  )
}

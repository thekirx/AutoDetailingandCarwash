import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, MessageCircle, Radio } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { toast } from 'sonner'
import { visitProgressFor, visitStepInfo } from '@/lib/customerVisitSteps'
import { Badge, Skeleton } from '@/components/customer/CustomerUi'
import { HAKUM_MESSENGER_URL } from '@/components/public/bredesign/TalkToUsButton'
import { branchLabel, fetchPortal, portalAction } from '@/lib/customerPortalClient'
import { canCustomerRequestReschedule, RESCHEDULE_ACK, RESCHEDULE_OPEN_STATUSES } from '@/lib/bookingReschedule'
import { CUSTOMER_VISIT_PATH } from '@/lib/customerAccountNav'
import { customerQueuePath } from '@/lib/liveQueuePath'
import { usePageMeta } from '@/lib/pageMeta'
import { useBackOr } from '@/lib/useBackOr'
import { formatMoney } from '@/queue/queueApi'

/* What each step means for the customer, by step key. Unknown keys show the label alone. */
const STEP_NOTES = {
  pending: 'We have your booking',
  confirmed: 'Your booking is confirmed',
  waiting: 'In line for the bay',
  intake: 'Checked in at the bay',
  in_progress: 'The team is working on it',
  final_checking: 'Team Lead is checking the work',
  for_releasing: 'Getting it ready for pickup',
  for_payment: 'Ready to pay and drive off',
  completed: 'All done',
}

function formatDay(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * /account/visit/:id — one visit's progress as a timeline. Every value comes from
 * /api/customer-portal (bookings for active visits, history for finished ones).
 */
export default function CustomerVisitPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [ack, setAck] = useState('')
  const [busy, setBusy] = useState(false)
  const [visitVoucher, setVisitVoucher] = useState('')

  async function applyVoucherToVisit(e) {
    e.preventDefault()
    if (!visit || busy) return
    const code = visitVoucher.trim().toUpperCase()
    if (!code) return
    setBusy(true)
    try {
      await portalAction('apply-booking-voucher', { booking_id: visit.id, code })
      toast.success('Voucher applied to your visit!')
      setVisitVoucher('')
      setData(await fetchPortal())
    } catch (err) {
      toast.error(err.message || 'Could not apply voucher')
    } finally {
      setBusy(false)
    }
  }
  const back = useBackOr('/account')
  usePageMeta({ title: 'Visit', description: 'Follow your car through each step.', path: CUSTOMER_VISIT_PATH })

  useEffect(() => {
    let cancelled = false
    fetchPortal()
      .then((next) => !cancelled && setData(next))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [])

  const all = [...(data?.bookings || []), ...(data?.history || [])]
  const visit = id ? all.find((row) => String(row.id) === String(id)) : data?.bookings?.[0]
  const branches = data?.branches || []
  const finished = Boolean(visit && !(data?.bookings || []).some((row) => row.id === visit.id))
  const progress = visit ? visitProgressFor(visit) : null
  const info = progress ? visitStepInfo(finished ? { ...progress, isComplete: true } : progress) : null
  const car = visit ? [visit.vehicle_make, visit.vehicle_model].filter(Boolean).join(' ') : ''
  const canReschedule = Boolean(visit && canCustomerRequestReschedule(visit))
  const waitingOnCall = Boolean(
    visit?.reschedule_requested_at && RESCHEDULE_OPEN_STATUSES.includes(String(visit.status || '')),
  )

  async function askReschedule() {
    if (!visit || busy) return
    setBusy(true)
    setError('')
    try {
      const body = await portalAction('request-reschedule', { booking_id: visit.id })
      setAck(body.message || RESCHEDULE_ACK)
      setData(await fetchPortal())
    } catch (err) {
      setError(err.message || 'Could not send the reschedule request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CustomerAppFrame
      className="capp-visit"
      title={visit?.vehicle_plate || 'Visit'}
      subtitle={visit ? [visit.service_name, car].filter(Boolean).join(' · ') : ''}
      navTitle={visit?.vehicle_plate || 'Visit'}
      onBack={back}
    >
      {error ? (
        <div className="capp-empty" role="alert">
          <strong>{error}</strong>
        </div>
      ) : null}
      {!data && !error ? <Skeleton n={3} /> : null}
      {data && !visit ? (
        <div className="capp-empty">
          <strong>No visit to show</strong>
          It may have finished a while ago. Past visits are on Home.
          <Link className="capp-btn capp-btn-fill" to="/account">
            Back to Home
          </Link>
        </div>
      ) : null}

      {visit && info ? (
        <>
          <div className="capp-visit-status">
            <Badge status={finished ? 'completed' : visit.status} label={finished ? 'Completed' : progress.label || visit.status} />
          </div>

          <section className="capp-section" aria-label="Progress">
            <div className="capp-sect">
              <h2>Progress</h2>
            </div>
            <ol className="capp-timeline">
              {info.steps.map((step, i) => {
                const state = info.done || i < info.index ? 'is-done' : i === info.index ? 'is-current' : 'is-todo'
                return (
                  <li key={step.key || i} className={state} aria-current={state === 'is-current' ? 'step' : undefined}>
                    <span className="capp-timeline-dot" aria-hidden>
                      {state === 'is-done' ? <Check size={14} strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <strong>{step.label || step.key}</strong>
                      <em>{state === 'is-todo' ? 'Coming up' : STEP_NOTES[step.key] || ''}</em>
                    </span>
                  </li>
                )
              })}
            </ol>
          </section>

          {visit.update_photos?.length ? (
            <section className="capp-section" aria-label="Progress photos">
              <div className="capp-sect">
                <h2>Photos</h2>
              </div>
              <div className="capp-photos">
                {visit.update_photos.map((photo) => (
                  <a key={photo.path || photo.url} href={photo.url} target="_blank" rel="noreferrer">
                    <img src={photo.url} alt="" loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          <section className="capp-section" aria-label="Details">
            <div className="capp-sect">
              <h2>Details</h2>
            </div>
            <dl className="capp-sum">
              <div>
                <dt>Branch</dt>
                <dd>{branchLabel(branches, visit.branch) || visit.branch || '—'}</dd>
              </div>
              <div>
                <dt>Service</dt>
                <dd>{visit.service_name || '—'}</dd>
              </div>
              <div>
                <dt>Car</dt>
                <dd>{[visit.vehicle_plate, car].filter(Boolean).join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt>{finished ? 'Visited' : 'Booked for'}</dt>
                <dd>{formatDay(visit.scheduled_start || visit.created_at) || '—'}</dd>
              </div>
              {visit.promo_discount_minor ? (
                <div>
                  <dt>Voucher discount</dt>
                  <dd className="text-emerald-600 dark:text-emerald-400 font-semibold">-{formatMoney(visit.promo_discount_minor)}</dd>
                </div>
              ) : null}
              {visit.final_price_minor != null ? (
                <div>
                  <dt>{finished ? 'Paid' : 'Total due'}</dt>
                  <dd className="font-bold">{formatMoney(visit.final_price_minor)}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          {!finished && !visit.promo_voucher_id ? (
            <section className="capp-section" aria-label="Add voucher">
              <div className="capp-sect">
                <h2>Have a voucher code?</h2>
              </div>
              <form onSubmit={applyVoucherToVisit} className="capp-card flex gap-2">
                <input
                  type="text"
                  value={visitVoucher}
                  onChange={(e) => setVisitVoucher(e.target.value.toUpperCase())}
                  placeholder="Voucher code (e.g. SUMMER10)"
                  className="min-h-11 flex-1 font-mono uppercase tracking-wider px-3.5 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={16}
                  autoCapitalize="characters"
                />
                <button
                  type="submit"
                  className="capp-btn capp-btn-accent min-h-11 font-semibold"
                  disabled={!visitVoucher.trim() || busy}
                >
                  Apply
                </button>
              </form>
            </section>
          ) : null}

          {canReschedule || waitingOnCall || ack ? (
            <section className="capp-section" aria-label="Reschedule">
              {canReschedule ? (
                <button type="button" className="capp-btn capp-btn-fill" disabled={busy} onClick={askReschedule}>
                  {busy ? 'Sending…' : 'Schedule for reschedule'}
                </button>
              ) : null}
              {waitingOnCall || ack ? (
                <p className="capp-meta" role="status">
                  {ack || RESCHEDULE_ACK}
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="capp-actions">
            {!finished ? (
              <Link className="capp-btn capp-btn-fill" to={customerQueuePath(visit.branch)}>
                <Radio size={16} strokeWidth={1.75} aria-hidden />
                View live queue
              </Link>
            ) : null}
            <a className="capp-btn capp-btn-ghost" href={HAKUM_MESSENGER_URL} target="_blank" rel="noreferrer">
              <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
              Talk to us
            </a>
          </div>
        </>
      ) : null}
    </CustomerAppFrame>
  )
}

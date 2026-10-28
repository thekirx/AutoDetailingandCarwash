import { Check, Play, Undo2 } from 'lucide-react'
import { formatDaylightDuration } from '../../queue/daylightPresentation'
import { formatQueueNumberForKind } from '../../lib/serviceKinds'
import { isOverSla } from '../../lib/ownerRevisionsPhase7'

function elapsedMinutes(ticket) {
  const start = ticket.status === 'waiting'
    ? ticket.waiting_at || ticket.created_at
    : ticket.status === 'final_checking'
      ? ticket.final_checking_at || ticket.actual_end
      : ticket.in_progress_at || ticket.actual_start || ticket.created_at
  const end = ['completed', 'cancelled'].includes(ticket.status) ? ticket.actual_end : null
  if (!start) return null
  const minutes = Math.round(((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) / 60000)
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null
}

/** Pure card markup; the parent supplies the existing queue action functions. */
export default function DaylightQueueCard({ ticket, yourMove, next, canStart, canSendToPay, canRedo, onOpen, onSendToPay, onRedo, saving }) {
  const vehicle = [ticket.vehicle_make, ticket.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'
  const services = (ticket.service_names?.length ? ticket.service_names : [ticket.service_name].filter(Boolean)).join(' + ')
  const size = String(ticket.vehicle_type || '').replace(/_/g, ' ')
  const crew = String(ticket.assigned_staff_name || '').split(',').map(name => name.trim()).filter(Boolean)
  const minutes = elapsedMinutes(ticket)
  const time = formatDaylightDuration(minutes)
  const late = time !== '—' && isOverSla(minutes, ticket.service_sla_minutes)
  return (
    <article className={`daylight-car ${yourMove ? 'daylight-car-your-move' : ''}`}>
      <button type="button" className="daylight-car-open" onClick={onOpen} aria-label={`Open ticket ${ticket.vehicle_plate || 'No plate'} · ${vehicle}`}>
        <span className="daylight-car-top">
          {ticket.queue_number != null && ticket.queue_number !== '' ? (
            <span className="tabular-nums">{formatQueueNumberForKind(ticket.queue_number, ticket.service_pay_category)}</span>
          ) : null}
          <span className="daylight-plate">{ticket.vehicle_plate || 'NO PLATE'}</span>
          <strong>{vehicle}</strong>
          {ticket.customer_name ? <span>{ticket.customer_name}</span> : null}
          {ticket.customer_id ? <span>Repeat customer</span> : null}
          <span className={`daylight-time ${late ? 'daylight-time-late' : ''}`}>
            {late ? <span className="sr-only">Over service time: </span> : null}{time}
          </span>
        </span>
        <span className="daylight-car-meta">
          {services || 'No service'}{size ? ` · ${size}` : ''}
          {next && ticket.status === 'waiting' ? <span className="daylight-next">Next</span> : null}
          {ticket.birthdayToday && ['in_progress', 'final_checking', 'for_payment'].includes(ticket.status) ? (
            <span className="daylight-next">Happy birthday — ask for their code</span>
          ) : null}
        </span>
        <span className="daylight-car-meta">{ticket.notes?.trim() ? ticket.notes : 'No notes'}</span>
        {crew.length ? (
          <span className="daylight-crew">
            <span className="daylight-avatars" aria-hidden>
              {crew.map(name => <span key={name}>{name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()}</span>)}
            </span>
            <span>{crew.join(', ')}{yourMove ? ' · ready for your final check' : ''}</span>
          </span>
        ) : null}
      </button>
      {canStart || canSendToPay || canRedo ? (
        <div className="daylight-car-actions">
          {canStart ? <button type="button" className="daylight-button" onClick={onOpen}><Play size={16} aria-hidden />Start · pick crew</button> : null}
          {canSendToPay ? <button type="button" className="daylight-button daylight-button-ok" disabled={saving} onClick={onSendToPay}><Check size={16} aria-hidden />{saving === 'payment' ? 'Sending…' : 'Send to pay'}</button> : null}
          {canRedo ? <button type="button" className="daylight-button daylight-button-outline" disabled={saving} onClick={onRedo}><Undo2 size={16} aria-hidden />{saving === 'redo' ? 'Saving…' : 'Redo'}</button> : null}
        </div>
      ) : null}
    </article>
  )
}

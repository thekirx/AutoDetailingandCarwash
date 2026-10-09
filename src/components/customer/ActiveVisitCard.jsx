import { Link } from 'react-router-dom'
import { ChevronRight, Radio } from 'lucide-react'
import { customerQueuePath } from '@/lib/liveQueuePath'
import { customerVisitPath } from '@/lib/customerAccountNav'
import { visitProgressFor, visitStepInfo } from '@/lib/customerVisitSteps'
import { Badge } from './CustomerUi'
import VisitProgress from './VisitProgress'

/**
 * Home "Active visit" card. `visit` (one active booking from /api/customer-portal) drives every field.
 * `variant="live"` is the phone's lifted live card; the default is the desktop hero ticket.
 */
export default function ActiveVisitCard({ visit, branchName, className = '', variant }) {
  const car = [visit.vehicle_make, visit.vehicle_model].filter(Boolean).join(' ')
  const progress = visitProgressFor(visit)
  const statusLabel = progress.label || visit.status

  if (variant === 'live') {
    const info = visitStepInfo(progress)
    return (
      <article className={`capp-live-card capp-span ${info.done ? 'is-done ' : ''}${className}`.trim()} aria-label="Active visit">
        <div className="capp-live-top">
          <p className="capp-eyebrow">{[visit.queue_label, branchName].filter(Boolean).join(' · ') || 'Your car'}</p>
          <Badge status={visit.status} label={statusLabel} />
        </div>
        <h2 className="capp-live-plate">{visit.vehicle_plate || visit.service_name || 'Your car'}</h2>
        <p className="capp-live-sub">{[visit.service_name, car].filter(Boolean).join(' · ')}</p>
        {info.total ? (
          <>
            <div className="capp-live-now">
              <strong>{info.done ? 'All done' : info.current}</strong>
              <span>
                Step {info.index + 1} of {info.total}
              </span>
            </div>
            <div
              className="capp-live-rail"
              style={{ '--n': info.total }}
              role="progressbar"
              aria-label="Visit progress"
              aria-valuemin={0}
              aria-valuemax={Math.max(info.total - 1, 1)}
              aria-valuenow={info.index}
              aria-valuetext={info.current}
            >
              {info.steps.map((step, i) => (
                <i key={step.key || i} className={info.done || i < info.index ? 'is-done' : i === info.index ? 'is-current' : ''} />
              ))}
            </div>
            <div className="capp-live-labels">
              <span>{info.done ? 'Ready for you' : `Now: ${info.current}`}</span>
              <span>{info.next ? `Next: ${info.next}` : ''}</span>
            </div>
          </>
        ) : null}
        <div className="capp-live-actions">
          <Link className="capp-btn capp-btn-light" to={customerVisitPath(visit.id)}>
            See progress
            <ChevronRight size={16} strokeWidth={2} aria-hidden />
          </Link>
          <Link className="capp-live-round" to={customerQueuePath(visit.branch)} aria-label="View live queue">
            <Radio size={18} strokeWidth={1.9} aria-hidden />
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article className={`capp-card capp-span ${className}`.trim()} aria-label="Active visit">
      <div className="capp-card-row">
        <div className="min-w-0">
          <p className="capp-eyebrow">Active visit</p>
          <h2 className="capp-title">{visit.service_name || 'Service visit'}</h2>
          <p className="capp-meta">
            {[branchName, visit.vehicle_plate, car].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="grid justify-items-end gap-1.5">
          <Badge status={visit.status} label={statusLabel} />
          {visit.queue_label ? (
            <p className="capp-q">
              {visit.queue_label}
              <span>Ticket</span>
            </p>
          ) : null}
        </div>
      </div>
      <VisitProgress visit={progress} />
      {visit.update_photos?.length ? (
        <div className="capp-photos" aria-label="Progress photos">
          {visit.update_photos.map((photo) => (
            <a key={photo.path || photo.url} href={photo.url} target="_blank" rel="noreferrer">
              <img src={photo.url} alt="" loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
      <Link className="capp-btn capp-btn-ghost capp-btn-block" to={customerQueuePath(visit.branch)}>
        <Radio size={16} strokeWidth={1.75} aria-hidden />
        View live queue
      </Link>
    </article>
  )
}

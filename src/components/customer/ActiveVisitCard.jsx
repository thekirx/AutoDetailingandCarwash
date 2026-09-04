import { Link } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { customerQueuePath } from '@/lib/liveQueuePath'
import { Badge } from './CustomerUi'
import VisitProgress from './VisitProgress'

const FALLBACK_STEPS = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'final_checking', label: 'Final Checking' },
  { key: 'for_payment', label: 'For Payment' },
]

/** Home "Active visit" card. `visit` (one active booking from /api/customer-portal) drives every field. */
export default function ActiveVisitCard({ visit, branchName }) {
  const car = [visit.vehicle_make, visit.vehicle_model].filter(Boolean).join(' ')
  const statusLabel = visit.visit?.label || visit.status
  // Always render the bar when we have a booking — pending/confirmed land on Queued.
  const progress = visit.visit?.steps?.length
    ? visit.visit
    : { steps: FALLBACK_STEPS, currentIndex: 0, isComplete: false, label: statusLabel }

  return (
    <article className="capp-card capp-span" aria-label="Active visit">
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

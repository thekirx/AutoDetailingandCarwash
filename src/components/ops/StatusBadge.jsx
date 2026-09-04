import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/** Status key → brand token soft fill. */
const STATUS_BADGE_MAP = {
  queued: { label: 'Queued', className: 'border-transparent bg-[var(--status-queued-soft)] text-[var(--status-queued)]' },
  waiting: { label: 'Waiting', className: 'border-transparent bg-[var(--status-queued-soft)] text-[var(--status-queued)]' },
  washing: { label: 'Washing', className: 'border-transparent bg-[var(--status-washing-soft)] text-[var(--status-washing)]' },
  wash: { label: 'Wash', className: 'border-transparent bg-[var(--status-washing-soft)] text-[var(--status-washing)]' },
  detailing: { label: 'Detailing', className: 'border-transparent bg-[var(--status-detailing-soft)] text-[var(--status-detailing)]' },
  detail: { label: 'Detail', className: 'border-transparent bg-[var(--status-detailing-soft)] text-[var(--status-detailing)]' },
  ready: { label: 'Ready', className: 'border-transparent bg-[var(--status-ready-soft)] text-[var(--status-ready)]' },
  completed: { label: 'Completed', className: 'border-transparent bg-[var(--status-ready-soft)] text-[var(--status-ready)]' },
  paid: { label: 'Paid', className: 'border-transparent bg-[var(--status-paid-soft)] text-[var(--status-paid)]' },
  void: { label: 'Void', className: 'border-transparent bg-[var(--status-void-soft)] text-[var(--status-void)]' },
  cancelled: { label: 'Cancelled', className: 'border-transparent bg-[var(--status-void-soft)] text-[var(--status-void)]' },
  late: { label: 'Late', className: 'border-transparent bg-[var(--status-late-soft)] text-[var(--status-late)]' },
  absent: { label: 'Absent', className: 'border-transparent bg-[var(--status-absent-soft)] text-[var(--status-absent)]' },
  notified: { label: 'Notified', className: 'border-transparent bg-[var(--status-paid-soft)] text-[var(--status-paid)]' },
  scheduled: { label: 'Scheduled', className: 'border-transparent bg-[var(--status-washing-soft)] text-[var(--status-washing)]' },
  overdue: { label: 'Overdue', className: 'border-transparent bg-[var(--status-late-soft)] text-[var(--status-late)]' },
}

export default function StatusBadge({ status, label, className }) {
  const key = String(status || '')
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  const mapped = STATUS_BADGE_MAP[key] || STATUS_BADGE_MAP[key.replace(/_/g, '')] || null
  const text = label || mapped?.label || status || '—'
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
        mapped?.className || 'border-border bg-muted text-muted-foreground',
        className,
      )}
    >
      {text}
    </Badge>
  )
}

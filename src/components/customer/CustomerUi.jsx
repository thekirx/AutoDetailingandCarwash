import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

/** Small building blocks shared by the customer app screens. Dark theme classes live in styles-customer-app.css. */

export function SectionHead({ title, note, to, linkLabel = 'View all', onAction }) {
  return (
    <div className="capp-sect">
      <h2>
        {title}
        {note ? <small>{note}</small> : null}
      </h2>
      {to ? (
        <Link className="capp-link" to={to}>
          {linkLabel}
        </Link>
      ) : onAction ? (
        <button type="button" className="capp-link" onClick={onAction}>
          {linkLabel}
        </button>
      ) : null}
    </div>
  )
}

export function Tile({ icon: Icon, title, sub, to, onClick }) {
  const body = (
    <>
      <span className="capp-tile-icon" aria-hidden>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <strong>{title}</strong>
        {sub ? <em>{sub}</em> : null}
      </span>
    </>
  )
  if (to) {
    return (
      <Link className="capp-tile" to={to}>
        {body}
      </Link>
    )
  }
  return (
    <button type="button" className="capp-tile" onClick={onClick}>
      {body}
    </button>
  )
}

export function Pills({ items, value, onChange, label }) {
  return (
    <div className="capp-pills" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          className={`capp-pill-btn${value === item.id ? ' is-active' : ''}`}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count != null ? ` (${item.count})` : ''}
        </button>
      ))}
    </div>
  )
}

const TONES = {
  waiting: 'warn',
  in_progress: 'ok',
  final_checking: 'ok',
  for_payment: 'info',
  completed: 'ok',
  confirmed: 'info',
  pending: 'warn',
}

export function Badge({ status, label, tone }) {
  const t = tone || TONES[String(status || '').toLowerCase()] || ''
  return <span className={`capp-badge${t ? ` capp-badge--${t}` : ''}`}>{label}</span>
}

export function Row({ icon: Icon, thumb, title, sub, end, chevron, to, onClick, as: Tag, className = '' }) {
  const isStatic = !to && !onClick
  const cls = `capp-row${isStatic ? ' is-static' : ''}${className ? ` ${className}` : ''}`
  const body = (
    <>
      {thumb ? (
        <img className="capp-thumb" src={thumb} alt="" />
      ) : Icon ? (
        <span className="capp-row-icon" aria-hidden>
          <Icon size={18} strokeWidth={1.75} />
        </span>
      ) : null}
      <span className="capp-row-body">
        <strong>{title}</strong>
        {sub ? <em>{sub}</em> : null}
      </span>
      {end ? <span className="capp-row-end">{end}</span> : null}
      {chevron ? <ChevronRight className="capp-row-chevron" size={18} strokeWidth={1.75} aria-hidden /> : null}
    </>
  )
  if (to) {
    return (
      <Link className={cls} to={to} onClick={onClick}>
        {body}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    )
  }
  const Static = Tag || 'div'
  return <Static className={cls}>{body}</Static>
}

export function Stat({ value, label }) {
  return (
    <div className="capp-stat">
      <p className="capp-stat-value">{value}</p>
      <p className="capp-stat-label">{label}</p>
    </div>
  )
}

export function QueueStats({ counts }) {
  return (
    <div className="capp-stats">
      <Stat value={counts.waiting} label="Waiting" />
      <Stat value={counts.in_progress} label="In wash" />
      <Stat value={counts.final_checking} label="Checking" />
    </div>
  )
}

export function Skeleton({ n = 1 }) {
  return Array.from({ length: n }, (_, i) => <div key={i} className="capp-skel" aria-hidden />)
}

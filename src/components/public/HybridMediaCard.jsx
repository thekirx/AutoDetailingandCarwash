import { ArrowUpRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'

function formatCardDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}

export default function HybridMediaCard({ card, className = '' }) {
  if (!card) return null
  const isInternal = card.href?.startsWith('/')
  const dateLabel = formatCardDate(card.date)
  const cta = (
    <>
      <span>{card.ctaLabel}</span>
      <ArrowUpRight aria-hidden="true" size={17} />
    </>
  )

  return (
    <article className={`hybrid-media-card ${className}`.trim()} data-motion="card">
      <div className="hybrid-media-visual">
        {card.mediaUrl ? (
          <img src={card.mediaUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="hybrid-media-fallback" aria-hidden="true"><span>Hakum</span></div>
        )}
        <span className="hybrid-media-platform">{card.platform || 'Hakum'}</span>
      </div>
      <div className="hybrid-media-body">
        <div className="hybrid-media-meta">
          <span>{card.kind === 'event' ? 'Event' : 'Latest post'}</span>
          {dateLabel ? <time dateTime={card.date}><CalendarDays aria-hidden="true" size={13} />{dateLabel}</time> : null}
        </div>
        <h3>{card.title}</h3>
        {card.excerpt ? <p>{card.excerpt}</p> : null}
        {card.href ? (
          isInternal ? (
            <Link className="hybrid-media-link" to={card.href}>{cta}</Link>
          ) : (
            <a className="hybrid-media-link" href={card.href} target="_blank" rel="noreferrer">{cta}</a>
          )
        ) : null}
      </div>
    </article>
  )
}

import { Gift } from 'lucide-react'

/** Bounded Hakum logo stamps; labels preserve earned and reward states without relying on color. */
export default function StampTrack({ slots = 10, completed = 0, gifts = [], compact = false }) {
  const total = Math.min(24, Math.max(1, Number(slots) || 10))
  const earned = Math.min(Number(completed) || 0, total)
  const giftAt = new Set((gifts || []).map((n) => Number(n)))

  return (
    <ol className={`capp-stamps${compact ? ' is-compact' : ''}`} aria-label={`${earned} of ${total} stamps`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const on = n <= earned
        const gift = giftAt.has(n)
        return (
          <li
            key={n}
            className={`capp-stamp${on ? ' is-on' : ''}${gift && !on ? ' is-gift' : ''}`}
            aria-label={on ? `Stamp ${n} earned` : gift ? `Stamp ${n} reward` : `Stamp ${n}`}
          >
            <span className="capp-stamp-mark" aria-hidden="true" />
            <span className="capp-stamp-number" aria-hidden="true">{n}</span>
            {gift ? <Gift className="capp-stamp-gift" size={compact ? 11 : 13} strokeWidth={2} aria-hidden="true" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

import { Check, Gift } from 'lucide-react'

/** Physical stamp card — filled circles read as inked stamps, empty as the next slots. */
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
            {on ? <Check size={compact ? 12 : 16} strokeWidth={2.6} aria-hidden /> : gift ? <Gift size={compact ? 11 : 14} strokeWidth={2} aria-hidden /> : null}
          </li>
        )
      })}
    </ol>
  )
}

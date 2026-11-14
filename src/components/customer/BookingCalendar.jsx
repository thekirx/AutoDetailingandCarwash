import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDaysISO, earliestBookableDay } from '@/lib/bookingLead'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function monthOf(iso) {
  const [y, m] = String(iso).split('-').map(Number)
  return { y, m: m - 1 }
}

function isoOf(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Month calendar for the booking schedule step. Days before the first open day
 * (today and tomorrow stay closed) and more than `rangeDays` out are disabled.
 */
export default function BookingCalendar({ value, onChange, rangeDays = 60 }) {
  const minDay = earliestBookableDay()
  const maxDay = addDaysISO(minDay, rangeDays)
  const [view, setView] = useState(() => monthOf(value || minDay))
  const minMonth = monthOf(minDay)
  const maxMonth = monthOf(maxDay)
  const atMin = view.y === minMonth.y && view.m === minMonth.m
  const atMax = view.y === maxMonth.y && view.m === maxMonth.m

  const cells = useMemo(() => {
    const lead = new Date(view.y, view.m, 1).getDay()
    const count = new Date(view.y, view.m + 1, 0).getDate()
    return [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => i + 1)]
  }, [view])

  function shift(delta) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const title = new Date(view.y, view.m, 1).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  return (
    <div className="capp-cal">
      <div className="capp-cal-head">
        <strong>{title}</strong>
        <span>
          <button type="button" onClick={() => shift(-1)} disabled={atMin} aria-label="Previous month">
            <ChevronLeft size={18} strokeWidth={2} aria-hidden />
          </button>
          <button type="button" onClick={() => shift(1)} disabled={atMax} aria-label="Next month">
            <ChevronRight size={18} strokeWidth={2} aria-hidden />
          </button>
        </span>
      </div>
      <div className="capp-cal-grid" role="radiogroup" aria-label="Date">
        {WEEKDAYS.map((d) => (
          <b key={d} aria-hidden>
            {d}
          </b>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`gap-${i}`} aria-hidden />
          const iso = isoOf(view.y, view.m, d)
          const disabled = iso < minDay || iso > maxDay
          const on = iso === value
          return (
            <button
              key={iso}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={new Date(view.y, view.m, d).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
              className={on ? 'is-on' : ''}
              disabled={disabled}
              onClick={() => onChange(iso)}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

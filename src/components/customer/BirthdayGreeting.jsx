import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift } from 'lucide-react'
import Sheet from '@/components/customer/Sheet'
import { CUSTOMER_LOYALTY_PATH } from '@/lib/customerAccountNav'
import {
  BIRTHDAY_GIFT_LABEL,
  BIRTHDAY_GIFT_TITLE,
  birthdayCardState,
  birthdayGreetedKey,
  formatPerkDate,
} from '@/lib/birthdayPerk'

/** Approved 2026-10-17: design-mocks/birthday-profile-referral-2026-10-17 board 01. */

const CONFETTI = [
  ['8%', 'sky', '0s'],
  ['20%', 'paper', '.8s'],
  ['33%', 'gold', '.3s'],
  ['47%', 'sky', '1.4s'],
  ['61%', 'pink', '.5s'],
  ['74%', 'paper', '1.1s'],
  ['88%', 'gold', '.2s'],
]

function Confetti({ few = false }) {
  const bits = few ? CONFETTI.filter((_, i) => i % 2 === 0) : CONFETTI
  return (
    <span className="capp-bday-confetti" aria-hidden>
      {bits.map(([left, tone, delay]) => (
        <i key={left} className={`is-${tone}`} style={{ left, animationDelay: delay }} />
      ))}
    </span>
  )
}

function readGreeted(key) {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeGreeted(key) {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    /* private mode: the sheet may show again, which is harmless */
  }
}

/** Opens once on the first app open of the birthday; remembered per perk year. */
export function BirthdayGreetingSheet({ customerId, firstName, dateOfBirth, perk, queueHref }) {
  const state = birthdayCardState(dateOfBirth, perk)
  const key = birthdayGreetedKey(customerId, perk?.perk_year)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (state.mode === 'day' && !readGreeted(key)) setOpen(true)
  }, [state.mode, key])

  function close() {
    writeGreeted(key)
    setOpen(false)
  }

  if (state.mode !== 'day') return null
  return (
    <Sheet open={open} onClose={close} label="Happy birthday" className="capp-bday-sheet">
      <Confetti />
      <div className="capp-bday-hero">
        <img className="capp-bday-mark" src="/branding/hakum-mark-ow.png" alt="" width="64" height="30" decoding="async" />
        <h2 className="capp-bday-name">
          <em>Happy birthday,</em>
          {firstName ? `${firstName}!` : 'to you!'}
        </h2>
        <p className="capp-meta">From all of us at Hakum. Your car&apos;s treat is on the house.</p>
      </div>
      <div className="capp-bday-ticket">
        <p className="capp-bday-ticket-k">Your birthday gift</p>
        <p className="capp-bday-ticket-v">One {BIRTHDAY_GIFT_LABEL}</p>
        <p className="capp-meta">
          Any Hakum branch · show this at the counter
          {perk?.expires_at ? (
            <>
              {' '}
              · valid until <b>{formatPerkDate(perk.expires_at)}</b>
            </>
          ) : null}
        </p>
      </div>
      <div className="capp-bday-actions">
        <Link className="capp-btn capp-btn-fill capp-btn-block" to={queueHref} onClick={close}>
          View live queue
        </Link>
        <button type="button" className="capp-btn capp-btn-ghost capp-btn-block" onClick={close}>
          Later
        </button>
      </div>
    </Sheet>
  )
}

/** Home: hero card on the birthday, slim countdown row on days 2–30, nothing otherwise. */
export function BirthdayHomeCard({ dateOfBirth, perk }) {
  const state = birthdayCardState(dateOfBirth, perk)
  if (state.mode === 'none') return null
  const until = formatPerkDate(perk?.expires_at)

  if (state.mode === 'day') {
    return (
      <section className="capp-bday-card capp-span" aria-label="Birthday gift">
        <Confetti few />
        <p className="capp-bday-card-ey">Today only feels this good</p>
        <h2 className="capp-bday-card-t">It&apos;s your day.</h2>
        <p className="capp-bday-card-p">
          Your {BIRTHDAY_GIFT_LABEL} is ready. Show the pass at any branch{until ? ` until ${until}` : ''}.
        </p>
        <Link className="capp-btn capp-btn-light capp-btn-block" to={CUSTOMER_LOYALTY_PATH}>
          Show my pass
        </Link>
      </section>
    )
  }

  return (
    <Link className="capp-bday-row capp-span" to={CUSTOMER_LOYALTY_PATH}>
      <span className="capp-row-icon" aria-hidden>
        <Gift size={18} strokeWidth={1.75} />
      </span>
      <span className="capp-bday-row-copy">
        <strong>Birthday carwash waiting</strong>
        <small>Free at any branch · show the pass</small>
      </span>
      <span className={`capp-bday-pill${state.urgent ? ' is-urgent' : ''}`}>
        {state.daysLeft} {state.daysLeft === 1 ? 'day' : 'days'} left
      </span>
    </Link>
  )
}

/** Rewards: the pass sits above the stamp card while the perk is live. */
export function BirthdayPass({ name, plate, dateOfBirth, perk }) {
  const state = birthdayCardState(dateOfBirth, perk)
  if (state.mode === 'none') return null
  const until = formatPerkDate(perk?.expires_at)
  return (
    <section className="capp-bday-pass" aria-label="Birthday pass">
      <div className="capp-bday-pass-head">
        <img src="/branding/hakum-mark-blue.png" alt="" width="46" height="22" decoding="async" />
        <span>Birthday</span>
      </div>
      <h2 className="capp-bday-pass-t">{BIRTHDAY_GIFT_TITLE}</h2>
      <p className="capp-bday-pass-who">{[name, plate].filter(Boolean).join(' · ') || 'Hakum member'}</p>
      <p className="capp-bday-pass-foot">
        Show this at the counter of any Hakum branch.{until ? ` Valid until ${until}.` : ''}
      </p>
    </section>
  )
}

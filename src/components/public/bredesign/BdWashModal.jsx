import { useEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { WASH_SERVICES } from './content'

/* Premium Wash & Detailing, opened from the fourth card in "What we do".
 *
 * These are walk-in services: nothing here can be booked, so no card offers
 * to. Each one's only action is the live queue — the useful question for a
 * wash is which branch is busy right now, not which date is free. Mobile
 * Detailing is listed but not running yet, and says so instead of linking.
 */
export default function BdWashModal({ open, onClose, returnFocusRef }) {
  const closeRef = useRef(null)
  const sheetRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const returnTo = returnFocusRef?.current
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      // Keep Tab inside the dialog while it is open.
      if (event.key !== 'Tab' || !sheetRef.current) return
      const focusable = sheetRef.current.querySelectorAll('a[href], button:not([disabled])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      returnTo?.focus?.()
    }
  }, [open, onClose, returnFocusRef])

  if (!open) return null

  return (
    <div
      className="bd-wash-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bd-wash-title"
      data-wash-modal
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bd-wash-sheet" ref={sheetRef}>
        <button type="button" className="bd-wash-close" ref={closeRef} onClick={onClose} aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>

        <p className="bd-eyebrow">Premium wash &amp; detailing</p>
        <h2 id="bd-wash-title">
          Keep it clean
          <br />
          <em>between the big jobs.</em>
        </h2>
        <p className="bd-wash-lede">
          Walk-in services — no booking needed. Check how busy each branch is right now, then drive in.
        </p>
        <span className="bd-wash-live">
          <i aria-hidden="true" />
          Live queue at every branch
        </span>

        <ul className="bd-wash-grid">
          {WASH_SERVICES.map((service) => (
            <li className="bd-wash-card" key={service.id}>
              {service.image ? (
                <img src={service.image} alt={service.alt} loading="lazy" decoding="async" />
              ) : (
                <span className="bd-wash-soon" aria-hidden="true">
                  Coming soon
                </span>
              )}
              <div className="bd-wash-body">
                <h3>{service.title}</h3>
                <p>{service.copy}</p>
                <span className="bd-wash-benefit">{service.benefit}</span>
                {service.available ? (
                  <Link className="bd-btn bd-btn-primary" to="/queue" onClick={onClose}>
                    View live queue <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="bd-btn bd-btn-quiet is-disabled" aria-disabled="true">
                    Coming soon
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

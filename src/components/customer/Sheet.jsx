import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useCustomerAppTheme } from '@/lib/customerAppTheme'

/**
 * Bottom sheet for the customer app: slides up over the screen, closes on the
 * scrim, Escape, the close button or a downward drag on the grabber/header.
 * `full` makes it a tall task sheet (the booking steps); without it the sheet
 * hugs its content (car actions, sign out). On desktop it sits centred.
 */
export default function Sheet({ open, onClose, title, label, full = false, children, footer, className = '' }) {
  const [theme] = useCustomerAppTheme()
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef(null)
  const panel = useRef(null)
  const returnFocus = useRef(null)

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement
      setMounted(true)
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(id)
    }
    setShown(false)
    const id = window.setTimeout(() => setMounted(false), 420)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const html = document.documentElement
    html.classList.add('capp-sheet-open')
    const focusId = window.setTimeout(() => panel.current?.focus({ preventScroll: true }), 60)
    return () => {
      document.removeEventListener('keydown', onKey)
      html.classList.remove('capp-sheet-open')
      window.clearTimeout(focusId)
      returnFocus.current?.focus?.({ preventScroll: true })
    }
  }, [open, onClose])

  if (!mounted || typeof document === 'undefined') return null

  function down(e) {
    if (e.target.closest('button, a, input, select, textarea')) return
    start.current = e.clientY
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  function move(e) {
    if (start.current == null) return
    setDrag(Math.max(0, e.clientY - start.current))
  }
  function up() {
    if (start.current == null) return
    start.current = null
    if (drag > 110) onClose?.()
    setDrag(0)
  }

  return createPortal(
    <div className={`capp-sheet-layer${shown ? ' is-open' : ''}`} data-app-theme={theme}>
      <div className="capp-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        className={`capp-sheet${full ? ' is-full' : ''}${drag ? ' is-dragging' : ''} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={label || (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      >
        <div className="capp-sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden />
        {title != null ? (
          <div className="capp-sheet-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <div className="capp-sheet-title">{title}</div>
            <button type="button" className="capp-sheet-x" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="capp-sheet-body">{children}</div>
        {footer ? <div className="capp-sheet-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/** iOS-style action list inside a sheet: a titled group of actions plus a separate Cancel. */
export function SheetActions({ heading, sub, actions = [], onCancel }) {
  return (
    <div className="capp-acts">
      <div className="capp-acts-grp">
        {heading ? (
          <div className="capp-acts-t">
            <strong>{heading}</strong>
            {sub ? <span>{sub}</span> : null}
          </div>
        ) : null}
        {actions.map((a) => (
          <button key={a.label} type="button" className={a.danger ? 'is-danger' : ''} onClick={a.onClick} disabled={a.disabled}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="capp-acts-grp">
        <button type="button" className="is-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

import { beforeAfterShowcase } from '../../../data/publicHomeContent'

/**
 * Draggable before/after comparison.
 *
 * The transformation is the product in this trade, and a slider is the only
 * control that makes a visitor *do* the comparison rather than look at two
 * thumbnails and take our word for it.
 *
 * Position is kept as a percentage and applied with clip-path so both images
 * stay in normal flow — no absolute sizing to keep in sync, and the pair
 * cannot drift apart on resize.
 */
function ComparisonSlider({ item }) {
  const frameRef = useRef(null)
  const [position, setPosition] = useState(50)
  const draggingRef = useRef(false)

  const setFromClientX = useCallback((clientX) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    if (!rect.width) return
    const next = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, next)))
  }, [])

  useEffect(() => {
    const onMove = (event) => {
      if (!draggingRef.current) return
      /* Stops the page from scrolling under the finger mid-drag on touch. */
      if (event.cancelable) event.preventDefault()
      const point = event.touches ? event.touches[0] : event
      setFromClientX(point.clientX)
    }
    const onEnd = () => { draggingRef.current = false }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [setFromClientX])

  const startDrag = (event) => {
    draggingRef.current = true
    const point = event.touches ? event.touches[0] : event
    setFromClientX(point.clientX)
  }

  const onKeyDown = (event) => {
    const step = event.shiftKey ? 10 : 2
    if (event.key === 'ArrowLeft') { setPosition((p) => Math.max(0, p - step)); event.preventDefault() }
    if (event.key === 'ArrowRight') { setPosition((p) => Math.min(100, p + step)); event.preventDefault() }
    if (event.key === 'Home') { setPosition(0); event.preventDefault() }
    if (event.key === 'End') { setPosition(100); event.preventDefault() }
  }

  return (
    <figure className="ba-item" data-motion-item>
      <div
        className="ba-frame"
        ref={frameRef}
        onPointerDown={startDrag}
        onTouchStart={startDrag}
        style={{ '--ba-pos': `${position}%` }}
      >
        <img className="ba-layer ba-after" src={item.after} alt={item.afterAlt} loading="lazy" decoding="async" />
        <img className="ba-layer ba-before" src={item.before} alt={item.beforeAlt} loading="lazy" decoding="async" />

        <span className="ba-tag ba-tag-before" aria-hidden="true">Before</span>
        <span className="ba-tag ba-tag-after" aria-hidden="true">After</span>

        <div
          className="ba-handle"
          role="slider"
          tabIndex={0}
          aria-label={`Reveal the finished result — ${item.title}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`${Math.round(position)}% before`}
          onKeyDown={onKeyDown}
        >
          <span className="ba-handle-grip"><MoveHorizontal size={16} aria-hidden="true" /></span>
        </div>
      </div>
      <figcaption>
        <strong>{item.title}</strong>
        <span>{item.service}</span>
        {item.branch ? <span className="ba-branch">{item.branch}</span> : null}
      </figcaption>
    </figure>
  )
}

export default function BeforeAfterSection() {
  /* Seeded from data so the section simply does not exist until real pairs
     are added — a comparison built from stand-in photos would be worse than
     showing nothing at all. */
  if (!beforeAfterShowcase.items.length) return null

  return (
    <section id="before-after" className="ba-section" data-motion-section="before-after">
      <div className="public-shell ba-heading">
        <div data-motion="heading">
          <p className="eyebrow eyebrow-light">{beforeAfterShowcase.eyebrow}</p>
          <h2 className="section-title light">{beforeAfterShowcase.title}</h2>
        </div>
        <p>{beforeAfterShowcase.copy}</p>
      </div>
      <div className="public-shell ba-grid" data-motion="cards">
        {beforeAfterShowcase.items.map((item) => (
          <ComparisonSlider key={item.title} item={item} />
        ))}
      </div>
    </section>
  )
}

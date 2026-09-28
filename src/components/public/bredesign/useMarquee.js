import { useEffect, useRef } from 'react'

/* Two identical logo runs move left at one steady speed and wrap seamlessly.
   Dragging lets visitors inspect a mark; page scrolling never changes the speed. */
const SPEED = 64 // pixels per second; every supplier passes through the viewport

export default function useMarquee() {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let speed = reduced.matches ? 0 : SPEED
    const onPreference = () => {
      speed = reduced.matches ? 0 : SPEED
    }
    reduced.addEventListener('change', onPreference)

    let offset = 0
    let half = track.scrollWidth / 2
    let dragging = false
    let hovering = false
    let pointerId = null
    let lastX = 0
    let frame = 0
    let previous = performance.now()

    const measure = () => {
      half = track.scrollWidth / 2 || 1
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(track)

    const tick = (now) => {
      const dt = Math.min((now - previous) / 1000, 0.05) // a backgrounded tab
      previous = now // must not jump the strip on return

      if (!dragging && !hovering) {
        offset -= speed * dt
      }

      // Wrap into [-half, 0) whichever way it is travelling. The double modulo
      // is what makes it work in both directions: a plain % keeps the sign of
      // the operand, so dragging right would walk the offset off to +infinity.
      if (half > 0) offset = (((offset % half) + half) % half) - half
      track.style.transform = `translate3d(${offset}px, 0, 0)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const onDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return
      dragging = true
      pointerId = event.pointerId
      lastX = event.clientX
      viewport.setPointerCapture?.(pointerId)
      viewport.classList.add('is-grabbing')
    }

    const onMove = (event) => {
      if (!dragging || event.pointerId !== pointerId) return
      const dx = event.clientX - lastX
      offset += dx
      lastX = event.clientX
    }

    const onUp = (event) => {
      if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return
      dragging = false
      viewport.releasePointerCapture?.(pointerId)
      pointerId = null
      viewport.classList.remove('is-grabbing')
    }

    const onMouseEnter = () => {
      hovering = true
    }

    const onMouseLeave = () => {
      hovering = false
    }

    viewport.addEventListener('pointerdown', onDown)
    viewport.addEventListener('pointermove', onMove)
    viewport.addEventListener('pointerup', onUp)
    viewport.addEventListener('pointercancel', onUp)
    viewport.addEventListener('pointerleave', onUp)
    viewport.addEventListener('mouseenter', onMouseEnter)
    viewport.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reduced.removeEventListener('change', onPreference)
      viewport.removeEventListener('pointerdown', onDown)
      viewport.removeEventListener('pointermove', onMove)
      viewport.removeEventListener('pointerup', onUp)
      viewport.removeEventListener('pointercancel', onUp)
      viewport.removeEventListener('pointerleave', onUp)
      viewport.removeEventListener('mouseenter', onMouseEnter)
      viewport.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return { viewportRef, trackRef }
}

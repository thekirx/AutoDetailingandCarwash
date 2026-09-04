import { useEffect, useRef } from 'react'

/**
 * A marquee you can grab.
 *
 * A CSS animation can only drift. This runs the position itself so the strip
 * can do the three things a physical object would: hold still while pressed,
 * follow the finger exactly while dragged, and carry the speed of a flick
 * before easing back to its resting drift.
 *
 * The track holds the same run twice, so wrapping is a modulo of half its
 * width — at any offset the second copy is exactly where the first would have
 * been, and the seam never shows.
 *
 * Position lives in a ref rather than state: this updates every frame, and
 * re-rendering React sixty times a second to move one transform would be the
 * most expensive way to do the cheapest thing.
 */

const BASE_VELOCITY = 34 // px/sec of resting drift
const MAX_VELOCITY = 2600 // a hard flick should not become a blur
const DECAY_TAU = 0.85 // seconds to settle back toward the drift
const DIRECTION = 1 // 1 moves the logos left-to-right; -1 reverses it
const SCROLL_BOOST = 2.4 // page-scroll pixels translated into a short velocity impulse

export default function useMarquee() {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let base = reduced.matches ? 0 : BASE_VELOCITY * DIRECTION
    const onPreference = () => {
      base = reduced.matches ? 0 : BASE_VELOCITY * DIRECTION
    }
    reduced.addEventListener('change', onPreference)

    let offset = 0
    let velocity = base
    let half = track.scrollWidth / 2
    let dragging = false
    let hovering = false
    let pointerId = null
    let lastX = 0
    let lastAt = 0
    let lastScrollY = window.scrollY
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
        offset += velocity * dt
        // Exponential approach rather than a linear ramp, so a flick bleeds off
        // quickly at first and then settles, the way a spun object does.
        velocity += (base - velocity) * (1 - Math.exp(-dt / DECAY_TAU))
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
      lastAt = performance.now()
      velocity = 0
      viewport.setPointerCapture?.(pointerId)
      viewport.classList.add('is-grabbing')
    }

    const onMove = (event) => {
      if (!dragging || event.pointerId !== pointerId) return
      const now = performance.now()
      const dx = event.clientX - lastX
      const dt = (now - lastAt) / 1000
      offset += dx
      // Sampled per move rather than averaged over the whole drag, so the
      // release speed reflects the last flick and not a slow start.
      if (dt > 0) velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, dx / dt))
      lastX = event.clientX
      lastAt = now
    }

    const onUp = (event) => {
      if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return
      dragging = false
      // A press that never moved should not fling on release.
      if (performance.now() - lastAt > 120) velocity = base
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

    const onScroll = () => {
      const nextScrollY = window.scrollY
      const delta = nextScrollY - lastScrollY
      lastScrollY = nextScrollY
      if (dragging || hovering || reduced.matches || delta === 0) return

      velocity = Math.max(
        -MAX_VELOCITY,
        Math.min(MAX_VELOCITY, velocity + delta * SCROLL_BOOST),
      )
    }

    viewport.addEventListener('pointerdown', onDown)
    viewport.addEventListener('pointermove', onMove)
    viewport.addEventListener('pointerup', onUp)
    viewport.addEventListener('pointercancel', onUp)
    viewport.addEventListener('pointerleave', onUp)
    viewport.addEventListener('mouseenter', onMouseEnter)
    viewport.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('scroll', onScroll, { passive: true })

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
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return { viewportRef, trackRef }
}

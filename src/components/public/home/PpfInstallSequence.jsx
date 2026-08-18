import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getPpfFrameIndex } from '../../../lib/ppfScrollStory'

gsap.registerPlugin(ScrollTrigger)

const DESKTOP_FRAMES = 90
const MOBILE_FRAMES = 72
const DESKTOP_DIR = '/media/ppf-install/desktop'
const MOBILE_DIR = '/media/ppf-install/mobile'
const MOBILE_QUERY = '(max-width: 767px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

const framePath = (dir, index) => `${dir}/frame-${String(index).padStart(4, '0')}.webp`

/**
 * Scroll-driven PPF installation canvas.
 *
 * Performance strategy:
 * 1. Frames are decoded ONCE into ImageBitmaps (GPU-backed, off the main
 *    thread via createImageBitmap) so drawImage() never triggers a
 *    synchronous decode mid-scroll.
 * 2. Drawing is throttled to requestAnimationFrame and skipped entirely when
 *    the frame index has not changed, so a scrub firing 60+ times a second
 *    does not queue 60 redundant blits.
 * 3. The canvas backing store is capped so we never blit more pixels than the
 *    display actually needs (DPR capped, and hard-capped on mobile).
 * 4. Frames load in priority order (visible-first, then outward) so early
 *    scrolling has real frames instead of stale fallbacks.
 *
 * Loads ONE frame set per device, never both. With prefers-reduced-motion no
 * ScrollTrigger is created and a single static frame is drawn.
 */
export default function PpfInstallSequence({ onProgress, poster, posterAlt }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    const isMobile = window.matchMedia(MOBILE_QUERY).matches
    const reduced = window.matchMedia(REDUCED_QUERY).matches
    const dir = isMobile ? MOBILE_DIR : DESKTOP_DIR
    const frameCount = isMobile ? MOBILE_FRAMES : DESKTOP_FRAMES
    const initialFrame = reduced ? frameCount - 1 : 0

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true })
    const bitmaps = new Array(frameCount).fill(null)

    let disposed = false
    let trigger = null
    let rafId = 0
    let targetFrame = initialFrame
    let paintedFrame = -1

    // --- sizing -------------------------------------------------------------
    // Cap the backing store: past ~1.5x on mobile the extra pixels cost more
    // than they show.
    const maxDpr = isMobile ? 1.5 : 2
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      const rect = wrap.getBoundingClientRect()
      const w = Math.round(rect.width * dpr)
      const h = Math.round(rect.height * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
        paintedFrame = -1 // backing store cleared, force a repaint
      }
    }

    // --- drawing ------------------------------------------------------------
    const nearest = (index) => {
      if (bitmaps[index]) return bitmaps[index]
      for (let step = 1; step < frameCount; step += 1) {
        if (bitmaps[index - step]) return bitmaps[index - step]
        if (bitmaps[index + step]) return bitmaps[index + step]
      }
      return null
    }

    const paint = (index) => {
      const bmp = nearest(index)
      if (!bmp) return false
      const cw = canvas.width
      const ch = canvas.height
      const scale = Math.max(cw / bmp.width, ch / bmp.height)
      const w = bmp.width * scale
      const h = bmp.height * scale
      ctx.drawImage(bmp, (cw - w) / 2, (ch - h) / 2, w, h)
      return true
    }

    // Single rAF loop. Only repaints when the target frame actually moved,
    // which keeps scroll handling cheap no matter how often it fires.
    const tick = () => {
      rafId = 0
      if (disposed) return
      const next = targetFrame
      if (next !== paintedFrame && paint(next)) paintedFrame = next
    }
    const requestPaint = () => {
      if (!rafId && !disposed) rafId = requestAnimationFrame(tick)
    }

    // --- loading ------------------------------------------------------------
    // createImageBitmap decodes off the main thread and hands back a
    // GPU-uploadable bitmap, so scroll-time drawImage is a cheap blit.
    const load = async (index) => {
      if (bitmaps[index] || disposed) return
      try {
        const res = await fetch(framePath(dir, index + 1))
        if (!res.ok || disposed) return
        const blob = await res.blob()
        if (disposed) return
        const bmp = await createImageBitmap(blob)
        if (disposed) { bmp.close?.(); return }
        bitmaps[index] = bmp
        // If this fills the frame we're currently showing (or a nearer one), repaint.
        if (Math.abs(index - targetFrame) <= 1) requestPaint()
      } catch {
        /* a missing frame just falls back to the nearest loaded one */
      }
    }

    const run = async () => {
      sizeCanvas()

      await load(initialFrame)
      if (disposed) return
      paint(initialFrame)
      paintedFrame = initialFrame
      setReady(true)

      if (reduced) return

      // Coarse pass first so any scroll position has something close,
      // then fill the gaps. Concurrency is bounded to avoid saturating
      // the connection and starving the main thread.
      const coarseStep = Math.max(2, Math.round(frameCount / 12))
      const order = []
      for (let i = 0; i < frameCount; i += coarseStep) order.push(i)
      for (let i = 0; i < frameCount; i += 1) if (!order.includes(i)) order.push(i)

      const concurrency = isMobile ? 3 : 6
      let cursor = 0
      const worker = async () => {
        while (cursor < order.length && !disposed) {
          const i = order[cursor]
          cursor += 1
          await load(i)
        }
      }
      await Promise.all(Array.from({ length: concurrency }, worker))
    }

    run()

    // --- scroll -------------------------------------------------------------
    if (!reduced) {
      trigger = ScrollTrigger.create({
        trigger: wrap.closest('[data-ppf-stage]') || wrap,
        start: 'top top',
        end: isMobile ? '+=200%' : '+=350%',
        // A little smoothing reads as "weighty" rather than laggy; too much
        // feels disconnected from the finger/wheel.
        scrub: isMobile ? 0.25 : 0.5,
        pin: wrap.closest('[data-ppf-pin]') || wrap,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
        onUpdate: (self) => {
          targetFrame = getPpfFrameIndex(self.progress, frameCount)
          requestPaint()
          if (onProgress) onProgress(self.progress)
        },
      })
    }

    // --- resize -------------------------------------------------------------
    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        sizeCanvas()
        requestPaint()
      }, 120)
    }
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      disposed = true
      clearTimeout(resizeTimer)
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      if (trigger) trigger.kill()
      bitmaps.forEach((b) => b && b.close && b.close())
    }
  }, [onProgress])

  return (
    <div className="ppf-sequence" ref={wrapRef}>
      <canvas className="ppf-sequence-canvas" ref={canvasRef} aria-hidden="true" />
      {!ready && poster ? (
        <img className="ppf-sequence-poster" src={poster} alt={posterAlt} decoding="async" />
      ) : null}
      <span className="sr-only">
        Paint protection film being installed onto a vehicle panel, from the film being positioned
        through to a fully protected, finished surface.
      </span>
    </div>
  )
}

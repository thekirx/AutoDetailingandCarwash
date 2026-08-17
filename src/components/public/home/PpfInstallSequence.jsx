import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const FRAME_COUNT = 110
const DESKTOP_DIR = '/media/ppf-install/desktop'
const MOBILE_DIR = '/media/ppf-install/mobile'
const MOBILE_QUERY = '(max-width: 767px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

const framePath = (dir, index) => `${dir}/frame-${String(index).padStart(4, '0')}.webp`

/**
 * Scroll-driven PPF installation canvas.
 *
 * Loads ONE frame set per device (never both), draws to a canvas, and lets a
 * scrubbed ScrollTrigger timeline drive the frame index so scroll position
 * directly controls installation progress in both directions.
 *
 * With prefers-reduced-motion the canvas renders a single static frame and no
 * ScrollTrigger is created — the surrounding content stays fully visible.
 */
export default function PpfInstallSequence({ onProgress, poster, posterAlt }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const imagesRef = useRef([])
  const stateRef = useRef({ frame: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined

    const mobileMQ = window.matchMedia(MOBILE_QUERY)
    const reducedMQ = window.matchMedia(REDUCED_QUERY)
    const isMobile = mobileMQ.matches
    const reduced = reducedMQ.matches
    const dir = isMobile ? MOBILE_DIR : DESKTOP_DIR

    const ctx = canvas.getContext('2d', { alpha: false })
    let disposed = false
    let trigger = null
    const images = new Array(FRAME_COUNT).fill(null)
    imagesRef.current = images

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = wrap.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    // Nearest already-loaded frame, so a gap never paints blank.
    const resolveFrame = (index) => {
      if (images[index]) return images[index]
      for (let step = 1; step < FRAME_COUNT; step += 1) {
        if (images[index - step]) return images[index - step]
        if (images[index + step]) return images[index + step]
      }
      return null
    }

    const draw = (index) => {
      const img = resolveFrame(Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(index))))
      if (!img) return
      const cw = canvas.width
      const ch = canvas.height
      const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      ctx.fillStyle = '#08090b'
      ctx.fillRect(0, 0, cw, ch)
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
    }

    const load = (index) => new Promise((resolve) => {
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => { images[index] = img; resolve(img) }
      img.onerror = () => resolve(null)
      img.src = framePath(dir, index + 1)
    })

    const start = async () => {
      sizeCanvas()

      // First frame immediately so the section never shows an empty canvas.
      await load(0)
      if (disposed) return
      draw(0)
      setReady(true)

      if (reduced) return

      // Critical frames first (evenly spaced), then fill in the rest.
      const critical = [0, 27, 54, 81, FRAME_COUNT - 1]
      await Promise.all(critical.map(load))
      if (disposed) return
      draw(stateRef.current.frame)

      const remaining = []
      for (let i = 0; i < FRAME_COUNT; i += 1) {
        if (!critical.includes(i)) remaining.push(i)
      }
      for (let i = 0; i < remaining.length; i += 8) {
        if (disposed) return
        await Promise.all(remaining.slice(i, i + 8).map(load))
        draw(stateRef.current.frame)
      }
    }

    start()

    if (!reduced) {
      trigger = ScrollTrigger.create({
        trigger: wrap.closest('[data-ppf-stage]') || wrap,
        start: 'top top',
        end: isMobile ? '+=180%' : '+=320%',
        scrub: isMobile ? 0.4 : 0.8,
        pin: wrap.closest('[data-ppf-pin]') || wrap,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const frame = self.progress * (FRAME_COUNT - 1)
          stateRef.current.frame = frame
          draw(frame)
          if (onProgress) onProgress(self.progress)
        },
      })
    }

    const onResize = () => {
      sizeCanvas()
      draw(stateRef.current.frame)
    }
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      if (trigger) trigger.kill()
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

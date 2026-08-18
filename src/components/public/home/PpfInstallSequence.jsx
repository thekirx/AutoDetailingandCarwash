import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { getPpfFrameIndex } from '../../../lib/ppfScrollStory'

gsap.registerPlugin(ScrollTrigger)

const DESKTOP_FRAMES = 120
const MOBILE_FRAMES = 120
const DESKTOP_DIR = '/media/ppf-install/desktop'
const MOBILE_DIR = '/media/ppf-install/mobile'
const MOBILE_QUERY = '(max-width: 767px)'
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

const framePath = (dir, index) => `${dir}/frame-${String(index).padStart(4, '0')}.webp`

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
    const frameCount = isMobile ? MOBILE_FRAMES : DESKTOP_FRAMES
    const initialFrame = reduced ? frameCount - 1 : 0

    const ctx = canvas.getContext('2d', { alpha: false })
    let disposed = false
    let trigger = null
    const images = new Array(frameCount).fill(null)
    imagesRef.current = images

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = wrap.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    const resolveFrame = (index) => {
      if (images[index]) return images[index]
      for (let step = 1; step < frameCount; step += 1) {
        if (images[index - step]) return images[index - step]
        if (images[index + step]) return images[index + step]
      }
      return null
    }

    const draw = (index) => {
      const img = resolveFrame(Math.max(0, Math.min(frameCount - 1, Math.round(index))))
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
      await load(initialFrame)
      if (disposed) return
      stateRef.current.frame = initialFrame
      draw(initialFrame)
      setReady(true)

      if (reduced) return

      const step = isMobile ? Math.floor(frameCount / 4) : Math.floor(frameCount / 5)
      const critical = [0]
      for (let i = step; i < frameCount; i += step) critical.push(i)
      if (!critical.includes(frameCount - 1)) critical.push(frameCount - 1)

      await Promise.all(critical.map(load))
      if (disposed) return
      draw(stateRef.current.frame)

      const batchSize = isMobile ? 4 : 8
      const remaining = []
      for (let i = 0; i < frameCount; i += 1) {
        if (!critical.includes(i)) remaining.push(i)
      }
      for (let i = 0; i < remaining.length; i += batchSize) {
        if (disposed) return
        await Promise.all(remaining.slice(i, i + batchSize).map(load))
        draw(stateRef.current.frame)
      }
    }

    start()

    if (!reduced) {
      trigger = ScrollTrigger.create({
        trigger: wrap.closest('[data-ppf-stage]') || wrap,
        start: 'top top',
        end: isMobile ? '+=200%' : '+=350%',
        scrub: isMobile ? 0.3 : 0.6,
        pin: wrap.closest('[data-ppf-pin]') || wrap,
        pinSpacing: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const frame = getPpfFrameIndex(self.progress, frameCount)
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

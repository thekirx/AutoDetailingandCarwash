import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  currentHeroOrientation,
  currentHeroTier,
  h264TierFor,
  portraitTierFor,
} from '../../../lib/heroTier'
import { isHeroLogoMoment } from '../../../lib/homeHero'
import { fetchHomeStats, STAT_BASE, STATIC_STATS, withBase } from '../../../lib/homeStats'

import heroPoster from '../../../assets/hero/bredesign-hero-poster.webp'
import portrait1080Av1 from '../../../assets/hero/bredesign-hero-portrait-1080.av1.mp4'
import portrait1080H264 from '../../../assets/hero/bredesign-hero-portrait-1080.h264.mp4'
import portrait720Av1 from '../../../assets/hero/bredesign-hero-portrait-720.av1.mp4'
import portraitPoster from '../../../assets/hero/bredesign-hero-portrait-poster.webp'
import hero1080Av1 from '../../../assets/hero/bredesign-hero-1080.av1.mp4'
import hero1080H264 from '../../../assets/hero/bredesign-hero-1080.h264.mp4'
import hero1440Av1 from '../../../assets/hero/bredesign-hero-1440.av1.mp4'
import hero2160Av1 from '../../../assets/hero/bredesign-hero-2160.av1.mp4'
import hero720Av1 from '../../../assets/hero/bredesign-hero-720.av1.mp4'
import hero720H264 from '../../../assets/hero/bredesign-hero-720.h264.mp4'

/* Two of these count, two do not.
   - Years and team size are claims about the business; no table holds them.
   - Clients and vehicles are a base figure for the decade before this system
     existed, plus everything the database has recorded since. */
function buildStats(live) {
  return [
    { value: STATIC_STATS.years, suffix: '+', label: 'Years combined experience' },
    {
      value: withBase(STAT_BASE.clients, live.returningClients),
      suffix: '+',
      label: 'Satisfied clients',
    },
    {
      value: withBase(STAT_BASE.services, live.servicesDone),
      suffix: '+',
      label: 'Vehicles cared for',
    },
    { value: STATIC_STATS.team, suffix: '', label: 'Team members' },
  ]
}

/* Two encodes of each cut. AV1 carries the same picture as H.264 in a little
   over half the bytes, so it is offered first and browsers without it fall
   through to the H.264 file. The codecs string is what lets them skip it —
   without it Safari would claim the AV1 file and fail to decode. */
const AV1_TYPE = 'video/mp4; codecs="av01.0.08M.08"'

const AV1_BY_TIER = {
  720: hero720Av1,
  1080: hero1080Av1,
  1440: hero1440Av1,
  2160: hero2160Av1,
}

const H264_BY_TIER = {
  720: hero720H264,
  1080: hero1080H264,
}

/* The portrait cut is a different edit, not a crop: 13.07s against the wide
   cut's 16.40s, and it carries no opening mark. Its mark windows are the
   'mobile' entry that already describes this exact clip. */
const PORTRAIT_AV1_BY_TIER = {
  720: portrait720Av1,
  1080: portrait1080Av1,
}

function CountUp({ value, suffix }) {
  const [display, setDisplay] = useState(value)
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    // Counting from zero is decoration. If the reader has asked for less
    // motion, or the browser cannot tell us when the number is on screen, the
    // final figure is what shows — never a wrong number.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      return undefined
    }

    let frame = 0
    let started = false
    const observer = new IntersectionObserver(
      (entries) => {
        if (started || !entries.some((entry) => entry.isIntersecting)) return
        started = true
        observer.disconnect()
        const start = performance.now()
        const run = (now) => {
          const t = Math.min(1, (now - start) / 1400)
          const eased = 1 - (1 - t) ** 3
          setDisplay(Math.round(value * eased))
          if (t < 1) frame = requestAnimationFrame(run)
        }
        setDisplay(0)
        frame = requestAnimationFrame(run)
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value])

  return (
    <span ref={ref} className="bd-stat-value">
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function BdHero() {
  const [videoFailed, setVideoFailed] = useState(false)
  const [live, setLive] = useState({ servicesDone: null, returningClients: null })
  /* Sized to the pixels this screen can actually draw, then held. Re-picking on
     resize would swap the file mid-play for a window drag, so the tier is
     chosen once — a dragged window is not worth restarting the clip. */
  const [tier] = useState(currentHeroTier)
  const [orientation] = useState(currentHeroOrientation)
  const isPortrait = orientation === 'portrait'
  const markVariant = isPortrait ? 'mobile' : 'bredesign'
  const poster = isPortrait ? portraitPoster : heroPoster
  const av1Src = isPortrait ? PORTRAIT_AV1_BY_TIER[portraitTierFor(tier)] : AV1_BY_TIER[tier]
  const h264Src = isPortrait ? portrait1080H264 : H264_BY_TIER[h264TierFor(tier)]
  /* The clip opens and closes on the Hakum mark. The overlay copy clears while
     the mark is on screen so the two never share the frame, and comes back a
     beat after it goes — the same treatment the shipping hero uses. */
  const [logoMoment, setLogoMoment] = useState(true)
  /* The mark logic only makes sense while the clip is running. A video that is
     paused sits at 0, which is inside the opening mark window, so keying the
     copy on the mark alone hides the headline permanently the moment autoplay
     is refused — which Safari does by default on many machines. */
  const [playing, setPlaying] = useState(false)
  /* Tapping the hero brings the copy back even mid-mark. It is cleared when the
     next mark window opens, so the mark still gets the frame to itself. */
  const [revealed, setRevealed] = useState(false)
  const videoRef = useRef(null)
  const wasMark = useRef(true)

  useEffect(() => {
    let active = true
    fetchHomeStats().then((next) => {
      if (active) setLive(next)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const node = videoRef.current
    if (!node) return undefined

    // Recomputed from the current time on every tick, so a loop restart needs
    // no special case — the new time simply reads as inside the opening window.
    const sync = () => {
      const mark = isHeroLogoMoment(markVariant, node.currentTime)
      // A fresh mark window takes the frame back from a manual reveal.
      if (mark && !wasMark.current) setRevealed(false)
      wasMark.current = mark
      setLogoMoment(mark)
    }
    const onPlay = () => setPlaying(true)
    const onStop = () => setPlaying(false)

    node.addEventListener('timeupdate', sync)
    node.addEventListener('seeked', sync)
    node.addEventListener('playing', onPlay)
    node.addEventListener('pause', onStop)
    node.addEventListener('ended', onStop)
    sync()

    // Autoplay can be refused — Safari's per-site setting, Low Power Mode, a
    // reduced-motion preference. Asking explicitly and ignoring the rejection
    // means the copy falls back to visible rather than the page looking empty.
    const attempt = node.play()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => setPlaying(false))

    return () => {
      node.removeEventListener('timeupdate', sync)
      node.removeEventListener('seeked', sync)
      node.removeEventListener('playing', onPlay)
      node.removeEventListener('pause', onStop)
      node.removeEventListener('ended', onStop)
    }
  }, [videoFailed, markVariant])

  /* Hidden only while the clip is actually running and on the mark, and only
     when the reader has not asked for it back. Anything else shows the copy. */
  const copyHidden = !videoFailed && playing && logoMoment && !revealed

  const revealCopy = () => {
    setRevealed(true)
    const node = videoRef.current
    if (node && node.paused) {
      const attempt = node.play()
      if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {})
    }
  }

  return (
    <section
      className="bd-hero"
      id="top"
      /* Tap or click anywhere on the hero brings the copy back. Not a button:
         the whole backdrop is the target, and the copy underneath keeps its own
         focusable links, so nothing here is reachable only by pointer. */
      onPointerDown={revealCopy}
    >
      {videoFailed ? (
        <img className="bd-hero-media" src={poster} alt="" />
      ) : (
        <video
          ref={videoRef}
          className="bd-hero-media"
          autoPlay
          muted
          loop
          playsInline
          poster={poster}
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        >
          <source src={av1Src} type={AV1_TYPE} />
          <source src={h264Src} type="video/mp4" />
        </video>
      )}

      <div
        className={`bd-shell bd-hero-in${copyHidden ? ' is-logo-moment' : ''}`}
        aria-hidden={copyHidden || undefined}
      >
        <h1>
          Give your car
          <br />
          the <em>pampering</em>
          <br />
          it deserves.
        </h1>
        <p className="bd-hero-lede">
          Detailing, protection, and care by a team that treats every panel like it is going back on a
          showroom floor.
        </p>
        <div className="bd-cta-row bd-hero-cta">
          <Link className="bd-btn bd-btn-primary" to="/services">
            See what we do
          </Link>
          <a className="bd-btn bd-btn-quiet" href="#origin">
            Our story
          </a>
        </div>
      </div>

      <div className="bd-stats">
        <div className="bd-shell bd-stats-in">
          {buildStats(live).map((stat) => (
            <div className="bd-stat" key={stat.label}>
              <CountUp value={stat.value} suffix={stat.suffix} />
              <span className="bd-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

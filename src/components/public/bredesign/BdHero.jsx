import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  currentHeroOrientation,
  currentHeroTier,
  h264TierFor,
  portraitTierFor,
} from '../../../lib/heroTier'
import { fetchHomeStats, STAT_BASE, STATIC_STATS, withBase } from '../../../lib/homeStats'
import { isHeroLogoMoment } from '../../../lib/homeHero'

import heroPoster from '../../../assets/hero/hakum-desktop-poster.webp'
import portrait1080Av1 from '../../../assets/hero/bredesign-hero-portrait-1080.av1.mp4'
import portrait1080H264 from '../../../assets/hero/bredesign-hero-portrait-1080.h264.mp4'
import portrait720Av1 from '../../../assets/hero/bredesign-hero-portrait-720.av1.mp4'
import portraitPoster from '../../../assets/hero/bredesign-hero-portrait-poster.webp'
import hero1080Av1 from '../../../assets/hero/hakum-desktop-1080.av1.mp4'
import hero1080H264 from '../../../assets/hero/hakum-desktop-1080.h264.mp4'
import hero1440Av1 from '../../../assets/hero/hakum-desktop-1440.av1.mp4'
import hero2160Av1 from '../../../assets/hero/hakum-desktop-2160.av1.mp4'
import hero720Av1 from '../../../assets/hero/hakum-desktop-720.av1.mp4'
import hero720H264 from '../../../assets/hero/hakum-desktop-720.h264.mp4'

/* Two of these count, two do not.
   - Years and team size are claims about the business; no table holds them.
   - Clients and vehicles are a base figure for the decade before this system
     existed, plus everything the database has recorded since. */
function buildStats(live) {
  return [
    {
      value: withBase(STAT_BASE.services, live.servicesDone),
      suffix: '+',
      label: 'Vehicles cared for',
    },
    { value: STATIC_STATS.team, suffix: '', label: 'Team members' },
    { value: STATIC_STATS.years, suffix: '+', label: 'Years experience combined' },
    {
      value: withBase(STAT_BASE.clients, live.returningClients),
      suffix: '+',
      label: 'Satisfied clients',
    },
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

/* The four figures, on their own band. They used to sit at the foot of the
   hero; the hero is now the video and its copy alone, and the figures follow
   the Hakum story instead, where they back up what the story says. */
export function BdStats({ className = '', title = null }) {
  const [live, setLive] = useState({ servicesDone: null, returningClients: null })

  useEffect(() => {
    let active = true
    fetchHomeStats().then((next) => {
      if (active) setLive(next)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <section
      className={`bd-stats bd-stats-band ${className}`.trim()}
      aria-label={title ? undefined : 'Hakum in numbers'}
      aria-labelledby={title ? 'bd-stats-title' : undefined}
    >
      <div className="bd-shell bd-stats-in">
        {buildStats(live).map((stat, index) => (
          <div className="bd-stat" key={stat.label}>
            {/* The label sits over the first figure rather than on a row of
                its own, so it costs no extra height. */}
            {title && index === 0 ? (
              <p className="bd-eyebrow bd-stats-title" id="bd-stats-title">
                {title}
              </p>
            ) : null}
            <CountUp value={stat.value} suffix={stat.suffix} />
            <span className="bd-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function BdHero() {
  const [videoFailed, setVideoFailed] = useState(false)
  /* Sized to the pixels this screen can actually draw, then held. Re-picking on
     resize would swap the file mid-play for a window drag, so the tier is
     chosen once — a dragged window is not worth restarting the clip. */
  const [tier] = useState(currentHeroTier)
  /* Orientation is different: turning a phone or tablet, or a page that
     loaded wide and was then narrowed, must swap to the other cut, or the
     phone keeps playing the desktop clip. */
  const [orientation, setOrientation] = useState(currentHeroOrientation)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const query = window.matchMedia('(orientation: portrait)')
    const update = () => setOrientation(currentHeroOrientation())
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const isPortrait = orientation === 'portrait'
  const poster = isPortrait ? portraitPoster : heroPoster
  const av1Src = isPortrait ? PORTRAIT_AV1_BY_TIER[portraitTierFor(tier)] : AV1_BY_TIER[tier]
  const h264Src = isPortrait ? portrait1080H264 : H264_BY_TIER[h264TierFor(tier)]
  /* Give the mark its opening and closing frames. Buttons stay available;
     blocked playback reveals the copy over the static poster. */
  const [playing, setPlaying] = useState(false)
  const [logoMoment, setLogoMoment] = useState(!isPortrait)
  const [videoBlocked, setVideoBlocked] = useState(false)
  const videoRef = useRef(null)
  const hideCopy = logoMoment && !videoBlocked && !videoFailed

  useEffect(() => {
    const node = videoRef.current
    if (!node) return undefined

    const syncLogoMoment = () => setLogoMoment(isHeroLogoMoment(
      isPortrait ? 'mobile' : 'hakum-desktop', node.currentTime, 0.75,
    ))
    const onPlay = () => {
      setPlaying(true)
      setVideoBlocked(false)
      syncLogoMoment()
    }
    const onStop = () => {
      setPlaying(false)
      setVideoBlocked(true)
    }

    syncLogoMoment()

    node.addEventListener('playing', onPlay)
    node.addEventListener('pause', onStop)
    node.addEventListener('ended', onStop)
    node.addEventListener('timeupdate', syncLogoMoment)
    node.addEventListener('seeked', syncLogoMoment)
    node.addEventListener('loadedmetadata', syncLogoMoment)

    // Autoplay can be refused — Safari's per-site setting, Low Power Mode, a
    // reduced-motion preference. Asking explicitly and ignoring the rejection
    // means the copy falls back to visible rather than the page looking empty.
    const attempt = node.play()
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {
      setPlaying(false)
      setVideoBlocked(true)
    })

    return () => {
      node.removeEventListener('playing', onPlay)
      node.removeEventListener('pause', onStop)
      node.removeEventListener('ended', onStop)
      node.removeEventListener('timeupdate', syncLogoMoment)
      node.removeEventListener('seeked', syncLogoMoment)
      node.removeEventListener('loadedmetadata', syncLogoMoment)
    }
  }, [videoFailed, orientation, isPortrait])

  return (
    <section className={`bd-hero${hideCopy ? ' is-logo-moment' : ''}`} id="top">
      {!videoFailed ? (
        <video
          /* A changed <source> is ignored by a playing video; a new key
             mounts a fresh element that loads the other cut. */
          key={orientation}
          ref={videoRef}
          className="bd-hero-media bd-hero-video"
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          poster={poster}
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setVideoFailed(true)}
        >
          <source src={av1Src} type={AV1_TYPE} />
          <source src={h264Src} type="video/mp4" />
        </video>
      ) : null}
      <img
        className={`bd-hero-media bd-hero-poster${playing && !videoFailed ? ' is-hidden' : ''}`}
        src={poster}
        alt=""
        aria-hidden="true"
      />

      <div className="bd-shell bd-hero-in">
        <h1 aria-hidden={hideCopy || undefined}>
          Clean cars
          <br />
          <em>matter</em>
        </h1>
        <div className="bd-cta-row bd-hero-cta">
          <Link className="bd-btn bd-btn-primary" to="/services">
            See what we do
          </Link>
          <a className="bd-btn bd-btn-quiet" href="#origin">
            Our story
          </a>
        </div>
        <p className="bd-hero-lede" aria-hidden={hideCopy || undefined}>
          From ceramic coating to paint protection film, our team approaches every vehicle the same
          way: like it matters. That means showroom-level attention to every panel, every time — not
          just for the cars that look brand new, but for every vehicle that comes through our doors.
        </p>
      </div>
    </section>
  )
}

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import heroPoster from '../../../assets/hakum-hero.webp'
import { PrimaryButton, SecondaryButton } from '../../ui'

gsap.registerPlugin(ScrollTrigger)

// HIGGSFIELD PLACEHOLDERS: replace these paths after the approved generation pass.
const HERO_CLIP_ONE = '/media/hero/PLACEHOLDER-hakum-precision-01.mp4'
const HERO_CLIP_TWO = '/media/hero/PLACEHOLDER-hakum-protection-02.mp4'
const HERO_MEDIA_READY = false

const headline = 'Pamper it. Protect it.'
const headlineWords = headline.split(' ')

export default function HomeHeroSection() {
  const sectionRef = useRef(null)
  const mediaRef = useRef(null)
  const mediaTrackRef = useRef(null)
  const contentRef = useRef(null)
  const tintRef = useRef(null)
  const glossRef = useRef(null)
  const firstVideoRef = useRef(null)
  const secondVideoRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    const media = mediaRef.current
    const mediaTrack = mediaTrackRef.current
    const content = contentRef.current
    const tint = tintRef.current
    const gloss = glossRef.current
    const videos = [firstVideoRef.current, secondVideoRef.current].filter(Boolean)

    if (!section || !media || !mediaTrack || !content || !tint || !gloss || videos.length !== 2) {
      return undefined
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let activeIndex = 0
    let transitionTween

    const showFallback = () => {
      section.classList.add('is-media-fallback')
      videos.forEach((video) => video.pause())
    }

    const transitionTo = (nextIndex) => {
      if (reducedMotion || !HERO_MEDIA_READY || nextIndex === activeIndex) return

      const currentVideo = videos[activeIndex]
      const nextVideo = videos[nextIndex]
      nextVideo.currentTime = 0

      nextVideo.play().then(() => {
        transitionTween?.kill()
        transitionTween = gsap.timeline({
          defaults: { duration: 0.45, ease: 'power2.inOut' },
          onComplete: () => {
            currentVideo.pause()
            currentVideo.classList.remove('is-active')
            nextVideo.classList.add('is-active')
            activeIndex = nextIndex
          },
        })
          .to(currentVideo, { autoAlpha: 0 }, 0)
          .fromTo(nextVideo, { autoAlpha: 0 }, { autoAlpha: 1 }, 0)
      }).catch(showFallback)
    }

    const handleEnded = [() => transitionTo(1), () => transitionTo(0)]
    const handleError = () => showFallback()

    videos.forEach((video, index) => {
      video.addEventListener('ended', handleEnded[index])
      video.addEventListener('error', handleError)
    })

    const onPointerMove = (event) => {
      const rect = section.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * 30
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * 30
      gsap.to(mediaTrack, { x, y, duration: 1.1, ease: 'power2.out', overwrite: 'auto' })
    }

    const onPointerLeave = () => {
      gsap.to(mediaTrack, { x: 0, y: 0, duration: 1.1, ease: 'power2.out', overwrite: 'auto' })
    }

    const context = gsap.context(() => {
      const words = gsap.utils.toArray('.hero-cinematic-word')
      const subhead = section.querySelector('.hero-cinematic-subhead')
      const actions = gsap.utils.toArray('.hero-cinematic-actions .ui-button')

      if (reducedMotion) {
        section.classList.add('is-reduced-motion', 'is-media-fallback')
        gsap.set(media, { opacity: 1 })
        gsap.fromTo(
          [words, subhead, actions],
          { opacity: 0 },
          { opacity: 1, duration: 0.35, stagger: 0.04, ease: 'power1.out' },
        )
        return
      }

      gsap.set([media, words, subhead, actions], { willChange: 'transform, opacity' })

      const entrance = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete: () => {
          gsap.set([media, words, subhead, actions], { clearProps: 'willChange' })
        },
      })

      entrance
        .fromTo(media, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' })
        .fromTo(
          words,
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.72, stagger: 0.06, ease: 'power3.out' },
          0.22,
        )
        .fromTo(
          subhead,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: 'power2.out' },
          '>+=0.2',
        )
        .fromTo(
          actions,
          { y: 12, scale: 0.96, opacity: 0 },
          { y: 0, scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
          '-=0.28',
        )
        .fromTo(
          gloss,
          { xPercent: -135, opacity: 0 },
          { xPercent: 135, opacity: 0.26, duration: 1.15, ease: 'power2.inOut' },
          '-=0.25',
        )
        .set(gloss, { opacity: 0, clearProps: 'willChange' })

      gsap.to(tint, {
        xPercent: 6,
        opacity: 0.88,
        duration: 10,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      })

      gsap.to(media, {
        yPercent: 15,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      gsap.to(content, {
        yPercent: 4,
        opacity: 0.42,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom 32%',
          scrub: true,
        },
      })

      section.addEventListener('pointermove', onPointerMove)
      section.addEventListener('pointerleave', onPointerLeave)

      if (HERO_MEDIA_READY) {
        videos[0].play().catch(showFallback)
      } else {
        section.classList.add('is-media-fallback')
      }
    }, section)

    return () => {
      section.removeEventListener('pointermove', onPointerMove)
      section.removeEventListener('pointerleave', onPointerLeave)
      videos.forEach((video, index) => {
        video.removeEventListener('ended', handleEnded[index])
        video.removeEventListener('error', handleError)
        video.pause()
      })
      transitionTween?.kill()
      context.revert()
    }
  }, [])

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="hero-stage hero-cinematic"
      aria-label="Hakum Auto Care introduction"
    >
      <div ref={mediaRef} className="hero-cinematic-media" aria-hidden="true">
        <div className="hero-cinematic-poster" style={{ backgroundImage: `url(${heroPoster})` }} />
        <div ref={mediaTrackRef} className="hero-cinematic-track">
          <video
            ref={firstVideoRef}
            className="hero-cinematic-video is-active"
            src={HERO_MEDIA_READY ? HERO_CLIP_ONE : undefined}
            poster={heroPoster}
            autoPlay
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            role="presentation"
          />
          <video
            ref={secondVideoRef}
            className="hero-cinematic-video"
            src={HERO_MEDIA_READY ? HERO_CLIP_TWO : undefined}
            poster={heroPoster}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            role="presentation"
          />
        </div>
      </div>

      <div className="hero-cinematic-overlay" aria-hidden="true" />
      <div ref={tintRef} className="hero-cinematic-tint" aria-hidden="true" />
      <div ref={glossRef} className="hero-cinematic-gloss" aria-hidden="true" />

      <div ref={contentRef} className="hero-cinematic-content public-shell">
        <div className="hero-cinematic-copy">
          <h1 className="hero-cinematic-title">
            {headlineWords.map((word) => (
              <span className="hero-cinematic-word" key={word}>{word}</span>
            ))}
          </h1>
          <p className="hero-cinematic-subhead">
            Precision detailing, ceramic coating, and paint protection for drivers who care how their finish lasts.
          </p>
          <div className="hero-cinematic-actions">
            <PrimaryButton to="/book" aria-label="Book a service with Hakum Auto Care">
              Book a service
            </PrimaryButton>
            <SecondaryButton to="/services" aria-label="Explore Hakum Auto Care services">
              Explore services
            </SecondaryButton>
          </div>
        </div>
      </div>
    </section>
  )
}

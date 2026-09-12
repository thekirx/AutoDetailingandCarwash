import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { storyStages } from './scrollStoryData'

gsap.registerPlugin(ScrollTrigger)

export function usePinnedCarStory() {
  const storyRef = useRef(null)

  useLayoutEffect(() => {
    const root = storyRef.current
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobileViewport = window.matchMedia('(max-width: 800px)').matches
    if (!root || reduceMotion || mobileViewport) return undefined

    const context = gsap.context(() => {
      const pinStage = root.querySelector('[data-pin-stage]')
      const scrollTrack = root.querySelector('.story-scroll-track') || root
      const carSelector = '[data-pin-stage] [data-car-state]'

      gsap.set(`${carSelector}:not([data-car-state="dirty"])`, { opacity: 0 })
      gsap.set('[data-story-stage]:not([data-story-stage="arrival"])', { opacity: 0, y: 28 })
      gsap.set('[data-progress-stage]:not([data-progress-stage="arrival"])', { opacity: 0.35 })
      gsap.set('.story-water-sweep, .story-foam, .story-ppf-panel, .story-gloss-sweep, .story-droplets, .story-detail-insets', { opacity: 0 })

      const timeline = gsap.timeline({ defaults: { ease: 'none' } })

      storyStages.forEach((stage, index) => {
        if (index === 0) return
        const previous = storyStages[index - 1]
        const label = `stage-${index}`
        const duration = stage.weight

        timeline
          .to(`${carSelector}[data-car-state="${previous.state}"]`, { opacity: 0, duration }, label)
          .to(`${carSelector}[data-car-state="${stage.state}"]`, { opacity: 1, duration }, label)
          .to(`[data-story-stage="${previous.id}"]`, { opacity: 0, y: -22, duration: duration * 0.55 }, label)
          .to(`[data-story-stage="${stage.id}"]`, { opacity: 1, y: 0, duration }, label)
          .to(`[data-progress-stage="${previous.id}"]`, { opacity: 0.35, duration: duration * 0.35 }, label)
          .to(`[data-progress-stage="${stage.id}"]`, { opacity: 1, duration: duration * 0.35 }, label)

        if (stage.id === 'carwash') {
          timeline
            .fromTo('.story-water-sweep', { xPercent: -130, opacity: 0 }, { xPercent: 130, opacity: 1, duration: duration * 0.6 }, label)
            .fromTo('.story-foam', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: 0.72, duration: duration * 0.42 }, label)
            .to('.story-foam', { opacity: 0, duration: duration * 0.3 }, `${label}+=${duration * 0.5}`)
        }

        if (stage.id === 'detailing') {
          timeline
            .to('.story-swirl', { opacity: 0, duration }, label)
            .to('[data-pin-stage] [data-car-stack]', { scale: 1.045, duration }, label)
            .to('.story-detail-insets', { opacity: 1, y: 0, duration: duration * 0.65 }, `${label}+=${duration * 0.2}`)
        }

        if (stage.id === 'ppf') {
          timeline
            .fromTo('.story-ppf-panel', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, transformOrigin: 'left center', duration: duration * 0.22, stagger: duration * 0.08 }, label)
            .to('[data-pin-stage] [data-car-stack]', { scale: 1, duration }, label)
        }

        if (stage.id === 'ceramic') {
          timeline
            .fromTo('.story-gloss-sweep', { xPercent: -140, opacity: 0 }, { xPercent: 140, opacity: 0.85, duration: duration * 0.72 }, label)
            .fromTo('.story-droplets', { opacity: 0, yPercent: -10 }, { opacity: 1, yPercent: 24, duration }, label)
            .fromTo('.story-gloss-meter i', { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration }, label)
        }
      })

      ScrollTrigger.create({
        trigger: scrollTrack,
        start: 'top top',
        end: 'bottom bottom',
        animation: timeline,
        pin: pinStage,
        scrub: true,
        invalidateOnRefresh: true,
      })

      const images = [...root.querySelectorAll('[data-pin-stage] img')]
      Promise.all(images.map((image) => image.decode?.().catch(() => undefined))).then(() => ScrollTrigger.refresh?.())
    }, root)

    return () => context.revert()
  }, [])

  return { storyRef }
}

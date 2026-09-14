import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Wrap-around rails: the reviews, the service proof clips and the homepage
 * gallery. Nothing moves on its own — past the last slide, the arrows and a
 * swipe carry straight on to the first.
 *
 * The slides are rendered once for real and again as copies on both sides.
 * When scrolling settles more than half a set away from the real slides, the
 * position jumps by exactly one set: the same picture, so the jump cannot be
 * seen, and there is always more rail in both directions. Copies stay
 * clickable, because a swipe can leave one on screen, but they are hidden from
 * assistive tech and taken out of the tab order so each slide is met once.
 *
 * Slides sized as a share of the rail change width whenever the rail does. A
 * ResizeObserver re-measures and puts the slide that was leading back at the
 * start. Until it has, settling is skipped: the browser scrolls the rail itself
 * during a resize, and wrapping with the old set width is what lands the rail
 * several slides away from where the reader left it.
 *
 * The arrows and progress bar that go with a rail live in LoopRail.jsx. */

const SETTLE_MS = 140

export function loopSlides(items, copies) {
  if (items.length < 2 || !copies) {
    return items.map((item, index) => ({ item, index, copy: false, key: `o${index}` }))
  }
  const slides = []
  for (let c = 0; c < copies; c += 1) {
    items.forEach((item, index) => slides.push({ item, index, copy: true, key: `b${c}-${index}` }))
  }
  items.forEach((item, index) => slides.push({ item, index, copy: false, key: `o${index}` }))
  for (let c = 0; c < copies; c += 1) {
    items.forEach((item, index) => slides.push({ item, index, copy: true, key: `a${c}-${index}` }))
  }
  return slides
}

function jumpTo(track, left) {
  track.style.scrollSnapType = 'none'
  track.scrollLeft = left
  void track.offsetWidth
  track.style.scrollSnapType = ''
}

export function useLoopRail(count) {
  const trackRef = useRef(null)
  const barRef = useRef(null)
  const [copies, setCopies] = useState(1)
  const loop = useRef({ setWidth: 0, width: 0, lead: 0 })
  const looping = count > 1

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track || !looping || track.children.length < count * (copies * 2 + 1)) return 0
    return (track.children[copies * count].offsetLeft - track.children[0].offsetLeft) / copies
  }, [copies, count, looping])

  const syncBar = useCallback(() => {
    const track = trackRef.current
    const bar = barRef.current
    const { setWidth } = loop.current
    if (!track || !bar) return
    if (!looping || !setWidth) {
      bar.style.width = '100%'
      bar.style.transform = 'none'
      return
    }
    const share = Math.min(1, track.clientWidth / setWidth)
    const position = (((track.scrollLeft - copies * setWidth) % setWidth) + setWidth) % setWidth
    bar.style.width = `${share * 100}%`
    bar.style.transform = `translateX(${(position / setWidth / share) * 100}%)`
  }, [copies, looping])

  const normalise = useCallback(() => {
    const track = trackRef.current
    const { setWidth } = loop.current
    if (!track || !setWidth) return
    const middle = copies * setWidth
    const x = track.scrollLeft
    if (x < middle - setWidth / 2) jumpTo(track, x + setWidth)
    else if (x >= middle + setWidth / 2) jumpTo(track, x - setWidth)
  }, [copies])

  const leadingIndex = useCallback(() => {
    const track = trackRef.current
    if (!track) return 0
    const left = track.getBoundingClientRect().left
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < track.children.length; i += 1) {
      const distance = Math.abs(track.children[i].getBoundingClientRect().left - left)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    return looping ? best % count : best
  }, [count, looping])

  const placeOnLead = useCallback(() => {
    const track = trackRef.current
    const lead = track?.children[copies * count + loop.current.lead]
    if (!lead) return
    jumpTo(track, lead.offsetLeft - track.children[0].offsetLeft)
    syncBar()
  }, [copies, count, syncBar])

  /* Start on the real slides, growing the copies first if one set is narrower
     than the rail — otherwise there would be no rail left to wrap into. */
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track || !looping) return
    const setWidth = measure()
    if (!setWidth) return
    const needed = Math.max(1, Math.ceil(track.clientWidth / setWidth))
    if (needed > copies) {
      setCopies(needed)
      return
    }
    loop.current.setWidth = setWidth
    loop.current.width = track.clientWidth
    placeOnLead()
  }, [copies, looping, measure, placeOnLead])

  useEffect(() => {
    const track = trackRef.current
    if (!track || !looping) return undefined
    let timer
    const settle = () => {
      if (track.clientWidth !== loop.current.width) return
      normalise()
      loop.current.lead = leadingIndex()
      syncBar()
    }
    const onScroll = () => {
      syncBar()
      clearTimeout(timer)
      timer = setTimeout(settle, SETTLE_MS)
    }
    const observer = new ResizeObserver(() => {
      const width = track.clientWidth
      if (!width || width === loop.current.width) return
      const setWidth = measure()
      if (!setWidth) return
      loop.current.width = width
      loop.current.setWidth = setWidth
      if (Math.ceil(width / setWidth) > copies) {
        setCopies(Math.ceil(width / setWidth))
        return
      }
      placeOnLead()
    })
    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener('scrollend', settle)
    observer.observe(track)
    return () => {
      clearTimeout(timer)
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('scrollend', settle)
      observer.disconnect()
    }
  }, [copies, leadingIndex, looping, measure, normalise, placeOnLead, syncBar])

  const step = useCallback(
    (direction) => {
      const track = trackRef.current
      if (!track || !track.children.length) return
      if (track.clientWidth === loop.current.width) normalise()
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0
      const slide = track.children[0].getBoundingClientRect().width + gap
      const perStep = Math.max(1, Math.floor(track.clientWidth / slide) - 1)
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      track.scrollBy({ left: direction * slide * perStep, behavior: reduceMotion ? 'auto' : 'smooth' })
    },
    [normalise],
  )

  return {
    trackRef,
    barRef,
    copies: looping ? copies : 0,
    prev: () => step(-1),
    next: () => step(1),
  }
}

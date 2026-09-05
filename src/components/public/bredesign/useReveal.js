import { useEffect } from 'react'

/**
 * Reveals `.bd-reveal` elements once as they come into view.
 *
 * One observer for the whole page rather than one per section: the homepage has
 * ten sections and several reveal a grid of children, so per-component
 * observers would mean dozens watching the same scroll.
 *
 * Sections that depend on fetched data mount after this hook first runs, so the
 * DOM is watched too. Without that, a section whose data arrives late is never
 * observed and stays at opacity 0 forever — which is exactly what happened to
 * the branches section when only the event status was in the dependency list.
 *
 * Elements are unobserved after firing: these are entrances, not something to
 * replay every time the reader scrolls back up. Under prefers-reduced-motion
 * the stylesheet already shows everything, so nothing is observed at all.
 */
export default function useReveal() {
  useEffect(() => {
    const root = document.querySelector('.bredesign')
    if (!root) return undefined

    const showAll = () => {
      root.querySelectorAll('.bd-reveal:not(.is-in)').forEach((node) => node.classList.add('is-in'))
    }

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      showAll()
      return undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        })
      },
      { rootMargin: '0px 0px -12% 0px' },
    )

    const observeNew = () => {
      root.querySelectorAll('.bd-reveal:not(.is-in)').forEach((node) => io.observe(node))
    }
    observeNew()

    const mo = new MutationObserver(observeNew)
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [])
}

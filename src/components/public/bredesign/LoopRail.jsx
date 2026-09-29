import { ArrowLeft, ArrowRight } from 'lucide-react'

/* The controls for a wrap-around rail. The rail itself — the copies, the wrap
   and the resize handling — is useLoopRail.js. */

export function LoopArrows({ rail, label }) {
  return (
    <div className="bd-loop-arrows">
      <button type="button" className="bd-loop-arrow" onClick={rail.prev} aria-label={`Previous ${label}`}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <button type="button" className="bd-loop-arrow" onClick={rail.next} aria-label={`Next ${label}`}>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

export function LoopBar({ rail }) {
  return (
    <div className="bd-loop-bar" aria-hidden="true">
      <i ref={rail.barRef} />
    </div>
  )
}

/* Large arrows on the rail's own edges, for a mouse that has no swipe to reach
   for. The header arrows scroll out of view once the reader is down among the
   cards; these stay beside them. They repeat the header arrows, so they are
   kept out of the tab order and hidden from assistive tech. */
export function LoopStage({ rail, children }) {
  return (
    <div className="bd-loop-stage">
      {children}
      <button type="button" className="bd-loop-side is-prev" onClick={rail.prev} tabIndex={-1} aria-hidden="true">
        <ArrowLeft size={22} aria-hidden="true" />
      </button>
      <button type="button" className="bd-loop-side is-next" onClick={rail.next} tabIndex={-1} aria-hidden="true">
        <ArrowRight size={22} aria-hidden="true" />
      </button>
    </div>
  )
}

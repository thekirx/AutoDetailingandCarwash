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

import { useCallback, useState } from 'react'
import { Play } from 'lucide-react'

import BdVideoModal from './BdVideoModal'
import { LoopArrows, LoopBar } from './LoopRail'
import { loopSlides, useLoopRail } from './useLoopRail'

/* Real installation clips for one service, as a wrap-around rail of posters.
   The page used to stack every clip as a full player — over 2,000px of scroll
   on PPF alone. A tile opens the shared player instead, so only the clip the
   reader chose ever loads. */
export default function ServiceProofSection({ serviceId, serviceName, proof }) {
  const clips = proof?.clips || []
  const rail = useLoopRail(clips.length)
  const [activeClip, setActiveClip] = useState(null)
  const close = useCallback(() => setActiveClip(null), [])

  if (!clips.length) return null

  return (
    <section className="bd-service-proof" data-service-proof={serviceId}>
      <div className="bd-shell">
        {/* The title runs the full width of the shell; the standfirst and the
            arrows share the row under it. */}
        <div className="bd-proof-head">
          <header>
            <p className="bd-eyebrow">{proof.eyebrow}</p>
            <h2>{proof.title}</h2>
          </header>
          <p className="bd-proof-lede">{proof.copy}</p>
          <LoopArrows rail={rail} label="video" />
        </div>

        <div className="bd-proof-rail" ref={rail.trackRef}>
          {loopSlides(clips, rail.copies).map(({ item: clip, copy, key }) => {
            const [title, ...detail] = clip.caption.split(' · ')
            return (
              <button
                type="button"
                key={key}
                className="bd-proof-tile"
                onClick={() => setActiveClip({ ...clip, serviceName })}
                aria-label={copy ? undefined : `Play ${clip.caption}`}
                aria-hidden={copy || undefined}
                tabIndex={copy ? -1 : undefined}
                data-proof-clip={copy ? undefined : clip.id}
              >
                <img src={clip.poster} alt="" loading="lazy" decoding="async" />
                <span className="bd-proof-shade" aria-hidden="true" />
                <span className="bd-proof-kind" aria-hidden="true">
                  Video
                </span>
                <span className="bd-proof-play" aria-hidden="true">
                  <Play size={16} fill="currentColor" />
                </span>
                <span className="bd-proof-cap" aria-hidden="true">
                  <strong>{title}</strong>
                  {detail.length ? <span>{detail.join(' · ')}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
        <LoopBar rail={rail} />
      </div>
      <BdVideoModal clip={activeClip} onClose={close} />
    </section>
  )
}

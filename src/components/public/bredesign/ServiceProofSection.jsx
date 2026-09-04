import { useCallback, useRef } from 'react'

export default function ServiceProofSection({ serviceId, proof }) {
  const sectionRef = useRef(null)
  const clips = proof?.clips || []

  const pauseOtherClips = useCallback((event) => {
    sectionRef.current?.querySelectorAll('video').forEach((video) => {
      if (video !== event.currentTarget) video.pause()
    })
  }, [])

  if (!clips.length) return null

  return (
    <section ref={sectionRef} className="bd-service-proof" data-service-proof={serviceId}>
      <div className="bd-shell bd-service-proof-layout">
        <header>
          <p className="bd-eyebrow">{proof.eyebrow}</p>
          <h2>{proof.title}</h2>
          <p>{proof.copy}</p>
        </header>
        <div className="bd-service-proof-gallery">
          {clips.map((clip) => (
            <figure key={clip.id}>
              <video
                controls
                playsInline
                preload="metadata"
                poster={clip.poster}
                aria-label={clip.label}
                onPlay={pauseOtherClips}
              >
                <source src={clip.sources.av1} type='video/mp4; codecs="av01.0.08M.08"' />
                <source src={clip.sources.h264} type="video/mp4" />
              </video>
              <figcaption>{clip.caption}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

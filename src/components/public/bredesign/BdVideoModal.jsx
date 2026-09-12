import { useEffect } from 'react'
import { X } from 'lucide-react'

const AV1_TYPE = 'video/mp4; codecs="av01.0.08M.08"'

/* The player the homepage gallery opened, shared now by every rail of clips.
   A clip carries its own poster, label, caption and sources; the two
   service-proof clips bundled with the app have an H.264 file only, so the AV1
   source is optional. */
export default function BdVideoModal({ clip, onClose }) {
  useEffect(() => {
    if (!clip) return undefined

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [clip, onClose])

  if (!clip) return null

  return (
    <div
      className="bd-gallery-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${clip.serviceName} video`}
      data-gallery-player
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="bd-gallery-player">
        <button
          type="button"
          className="bd-gallery-close"
          data-gallery-close
          aria-label="Close video"
          onClick={onClose}
          autoFocus
        >
          <X size={22} aria-hidden="true" />
        </button>
        <video controls autoPlay playsInline preload="metadata" poster={clip.poster} aria-label={clip.label}>
          {clip.sources.av1 ? <source src={clip.sources.av1} type={AV1_TYPE} /> : null}
          <source src={clip.sources.h264} type="video/mp4" />
        </video>
        <div className="bd-gallery-player-copy">
          <span>{clip.serviceName}</span>
          <strong>{clip.caption}</strong>
        </div>
      </div>
    </div>
  )
}

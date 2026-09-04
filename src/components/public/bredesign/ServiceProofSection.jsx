export default function ServiceProofSection({ serviceId, proof }) {
  if (!proof?.video) return null

  return (
    <section className="bd-service-proof" data-service-proof={serviceId}>
      <div className="bd-shell bd-service-proof-layout">
        <header>
          <p className="bd-eyebrow">{proof.eyebrow}</p>
          <h2>{proof.title}</h2>
          <p>{proof.copy}</p>
        </header>
        <figure>
          <video
            controls
            playsInline
            preload="metadata"
            poster={proof.poster}
            aria-label={proof.label}
          >
            <source src={proof.video} type="video/mp4" />
          </video>
          <figcaption>Real work by Hakum Auto Care.</figcaption>
        </figure>
      </div>
    </section>
  )
}

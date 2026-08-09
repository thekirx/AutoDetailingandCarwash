import ContentEmptyState from '../ContentEmptyState'
import HybridMediaCard from '../HybridMediaCard'

export default function LatestPostSection({ state }) {
  const item = state?.item || null
  return (
    <section id="latest-post" className="home-content-section home-latest-post" data-motion-section="latest-post">
      <div className="public-shell home-content-heading">
        <div>
          <p className="eyebrow eyebrow-light">From the Hakum team</p>
          <h2 className="section-title light" data-motion="heading">Latest post.</h2>
        </div>
        <p>Fresh work, stories, and updates from our Facebook and Instagram community.</p>
      </div>
      <div className="public-shell home-content-feature">
        {item ? <HybridMediaCard card={item} /> : (
          <ContentEmptyState
            eyebrow="Latest post"
            title={state?.status === 'error' ? 'Updates are temporarily unavailable.' : 'New stories are coming soon.'}
            body="Follow Hakum Auto Care on Facebook and Instagram for the latest work."
          />
        )}
      </div>
    </section>
  )
}

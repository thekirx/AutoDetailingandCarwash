import { Link } from 'react-router-dom'
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
        <p>Care tips, fresh work, and stories from the people behind every Hakum finish.</p>
      </div>
      <div className="public-shell home-content-feature">
        {item ? <HybridMediaCard card={item} /> : (
          <ContentEmptyState
            eyebrow="Latest post"
            title={state?.status === 'error' ? 'Updates are temporarily unavailable.' : 'New stories are coming soon.'}
            body="Visit the Hakum Blog for more care notes and bay stories."
          />
        )}
        <Link className="home-content-all-link" to="/blog">View all posts <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  )
}

import { Link } from 'react-router-dom'
import ContentEmptyState from '../ContentEmptyState'
import HybridMediaCard from '../HybridMediaCard'

export default function EventsPreviewSection({ state }) {
  const item = state?.item || null
  return (
    <section id="events" className="home-content-section home-events-preview" data-motion-section="events">
      <div className="public-shell home-content-heading">
        <div>
          <p className="eyebrow eyebrow-light">Community</p>
          <h2 className="section-title light" data-motion="heading">Events &amp; meets.</h2>
        </div>
        <p>Promotions, branch events, and car meets from Hakum Auto Care.</p>
      </div>
      <div className="public-shell home-content-feature">
        {item ? <HybridMediaCard card={item} /> : (
          <ContentEmptyState
            eyebrow="Events & meets"
            title={state?.status === 'error' ? 'Events are temporarily unavailable.' : 'No published events yet.'}
            body="Check back soon."
          />
        )}
        <Link className="home-content-all-link" to="/events">View all events <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  )
}

import { Link } from 'react-router-dom'
import HybridMediaCard from '../HybridMediaCard'

export default function EventsPreviewSection({ state }) {
  const item = state?.item || null

  /* A homepage section reading "nothing here yet" is worse than no section:
     it tells a first-time visitor the business is quiet. When there is no
     published event the block is dropped and /events keeps the nav entry. */
  if (!item) return null

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
        <HybridMediaCard card={item} />
        <Link className="home-content-all-link" to="/events">View all events <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  )
}

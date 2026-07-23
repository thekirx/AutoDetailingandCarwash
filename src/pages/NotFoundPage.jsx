import { Link } from 'react-router-dom'
import { usePageMeta } from '@/lib/pageMeta'

export default function NotFoundPage() {
  usePageMeta({
    title: 'Page not found',
    description: 'That Hakum Auto Care page does not exist. Head home or book a service.',
    path: '/404',
  })

  return (
    <section className="legal-page not-found-page">
      <div className="public-shell legal-inner">
        <p className="eyebrow">404</p>
        <h1 className="section-title">
          This lane
          <br />
          <i>is empty.</i>
        </h1>
        <p className="legal-updated">The page you asked for is not on our site map.</p>
        <div className="not-found-actions">
          <Link className="button button-blue" to="/">
            Back home
          </Link>
          <Link className="dark-link" to="/book">
            Book a service
          </Link>
          <Link className="dark-link" to="/queue">
            Live queue
          </Link>
          <Link className="dark-link" to="/contact">
            Contact
          </Link>
        </div>
      </div>
    </section>
  )
}

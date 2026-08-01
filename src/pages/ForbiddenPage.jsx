import { Link } from 'react-router-dom'
import { usePageMeta } from '@/lib/pageMeta'

export default function ForbiddenPage() {
  usePageMeta({
    title: 'Access denied',
    description: 'You do not have access to that Hakum Auto Care page.',
    path: '/403',
  })

  return (
    <section className="legal-page not-found-page">
      <div className="public-shell legal-inner">
        <p className="eyebrow">403</p>
        <h1 className="section-title">
          This bay
          <br />
          <i>is restricted.</i>
        </h1>
        <p className="legal-updated">
          Your account cannot open this page. Sign in with the right role, or continue as a guest.
        </p>
        <div className="not-found-actions">
          <Link className="button button-blue" to="/">
            Back home
          </Link>
          <Link className="dark-link" to="/signin">
            Customer sign in
          </Link>
          <Link className="dark-link" to="/operations/login">
            Team portal
          </Link>
          <Link className="dark-link" to="/contact">
            Contact
          </Link>
        </div>
      </div>
    </section>
  )
}

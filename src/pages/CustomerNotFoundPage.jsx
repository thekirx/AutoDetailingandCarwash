import { Link } from 'react-router-dom'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { usePageMeta } from '@/lib/pageMeta'

/** In-app 404 inside /account/* so customers stay in the Hakum app frame and dock. */
export default function CustomerNotFoundPage() {
  usePageMeta({
    title: 'Page not found · Hakum App',
    description: 'That screen does not exist inside the Hakum customer app.',
    path: '/account/not-found',
    noindex: true,
  })

  return (
    <CustomerAppFrame title="Page not found" navTitle="Not found" backTo="/account" backLabel="Home">
      <div className="capp-card">
        <p className="capp-eyebrow">Unknown screen</p>
        <h2 className="mt-1 text-lg font-bold">That screen is not in the app</h2>
        <p className="capp-note mt-2">
          Head back to Home, check the live queue, or book a service below.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/account" className="capp-btn is-primary">
            Back to Home
          </Link>
          <Link to="/account/queue" className="capp-btn is-ghost">
            Live queue
          </Link>
          <Link to="/account/book" className="capp-btn is-ghost">
            Book a service
          </Link>
        </div>
      </div>
    </CustomerAppFrame>
  )
}

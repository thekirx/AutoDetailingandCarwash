import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function ServiceBottomCta({ serviceId, serviceName, bookState }) {
  return (
    <section className="bd-service-bottom-cta" data-service-bottom-cta={serviceId}>
      <div className="bd-shell">
        <p className="bd-eyebrow">Ready when you are</p>
        <h2>Give your vehicle<br /><em>the right treatment.</em></h2>
        <p>Choose your branch and preferred schedule. We’ll confirm the details before the work begins.</p>
        <Link className="bd-btn bd-btn-primary" to="/book" state={bookState}>
          Book {serviceName} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

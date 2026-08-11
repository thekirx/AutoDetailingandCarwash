import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerAccountDock from '@/components/CustomerAccountDock'

/**
 * Phone-first customer chrome. Same stage on web (ticket window on the bay).
 */
export default function CustomerAppFrame({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
  queueHref = '/queue',
  hero,
  children,
}) {
  const showTop = Boolean(title || backTo || onBack || actions)

  return (
    <div className="capp">
      <div className="capp-stage">
        {hero || null}
        {showTop ? (
          <header className="capp-top">
            {onBack ? (
              <button type="button" className="capp-back" onClick={onBack}>
                <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
                Back
              </button>
            ) : backTo ? (
              <Link className="capp-back" to={backTo}>
                <ArrowLeft size={18} strokeWidth={1.75} aria-hidden />
                Home
              </Link>
            ) : null}
            <div className="capp-top-copy">
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="capp-top-actions">{actions}</div> : null}
          </header>
        ) : null}
        <div className="capp-scroll">{children}</div>
        <CustomerAccountDock queueHref={queueHref} />
      </div>
    </div>
  )
}

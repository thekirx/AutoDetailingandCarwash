import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerAccountDock from '@/components/CustomerAccountDock'

/**
 * Customer account chrome.
 * Mobile / PWA: phone app stage + bottom dock.
 * Desktop web: content sits under the landing-page header (PublicLayout).
 */
export default function CustomerAppFrame({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
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
        <CustomerAccountDock />
      </div>
    </div>
  )
}

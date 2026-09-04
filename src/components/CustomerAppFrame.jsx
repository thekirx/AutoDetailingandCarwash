import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import CustomerAccountDock from '@/components/CustomerAccountDock'

/**
 * Customer account chrome.
 * Mobile / PWA: dark phone stage + bottom dock.
 * Desktop web: content sits under the landing-page header (PublicLayout); dock becomes a tab row.
 * `cols` opts the scroll area into a 2-column grid on wide screens (children add `capp-span` to go full width).
 */
export default function CustomerAppFrame({
  title,
  subtitle,
  backTo,
  onBack,
  actions,
  hero,
  cols = false,
  children,
}) {
  const showTop = Boolean(title || backTo || onBack || actions)
  const hasBack = Boolean(onBack || backTo)

  return (
    <div className="capp">
      <div className="capp-stage">
        {hero || null}
        {showTop ? (
          <header className="capp-top">
            {onBack ? (
              <button type="button" className="capp-back" onClick={onBack} aria-label="Back">
                <ChevronLeft size={22} strokeWidth={2} aria-hidden />
              </button>
            ) : backTo ? (
              <Link className="capp-back" to={backTo} aria-label="Back">
                <ChevronLeft size={22} strokeWidth={2} aria-hidden />
              </Link>
            ) : null}
            <div className={`capp-top-copy${hasBack ? '' : ' is-plain'}`}>
              {title ? <h1>{title}</h1> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {actions ? <div className="capp-top-actions">{actions}</div> : null}
          </header>
        ) : null}
        <div className={`capp-scroll${cols ? ' is-cols' : ''}`}>{children}</div>
        <CustomerAccountDock />
      </div>
    </div>
  )
}

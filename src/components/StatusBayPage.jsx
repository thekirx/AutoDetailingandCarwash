import { Link } from 'react-router-dom'

/** Decorative closed garage bay — signature for 403/404 status pages. */
function ClosedBayVisual({ label }) {
  return (
    <div className="status-bay-visual" aria-hidden="true">
      <div className="status-bay-door">
        <span className="status-bay-door-track" />
        <div className="status-bay-door-face">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="status-bay-slat" style={{ '--i': i }} />
          ))}
          <span className="status-bay-handle" />
        </div>
        <span className="status-bay-plate">{label}</span>
      </div>
      <div className="status-bay-floor" />
    </div>
  )
}

/**
 * Shared Soft UI status composition for customer 403 / 404.
 * One job: explain the dead end and route people back into Hakum.
 */
export default function StatusBayPage({ code, titleLine1, titleLine2, message, primary, secondary = [] }) {
  return (
    <section className="status-bay" data-code={code}>
      <div className="public-shell status-bay-inner">
        <div className="status-bay-copy">
          <p className="status-bay-code">
            <span className="status-bay-code-dot" aria-hidden />
            {code}
          </p>
          <h1 className="status-bay-title">
            {titleLine1}
            <br />
            <i>{titleLine2}</i>
          </h1>
          <p className="status-bay-message">{message}</p>
          <div className="status-bay-actions">
            <Link className="button button-blue" to={primary.to}>
              {primary.label}
            </Link>
            <nav className="status-bay-links" aria-label="Helpful links">
              {secondary.map((link) => (
                <Link key={link.to} className="status-bay-link" to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <ClosedBayVisual label={code === '403' ? 'Restricted' : 'Empty lane'} />
      </div>
    </section>
  )
}

import { Link } from 'react-router-dom'
import { Car, ClipboardList, Gauge, MapPin, Sparkles, Users } from 'lucide-react'

/** Split auth shell — Hakum cinematic blue + light form (Kado-style layout, Hakum brand). */
export default function HakumAuthShell({
  kicker = 'Hakum Auto Care — Customer account',
  title,
  subtitle,
  bullets = [],
  children,
  footerLinks,
}) {
  return (
    <div className="hakum-auth">
      <aside className="hakum-auth-brand">
        <Link className="hakum-auth-wordmark" to="/" aria-label="Hakum Auto Care home">
          <b>H</b>
          <span>
            HAKUM<small>AUTO CARE</small>
          </span>
        </Link>
        <div className="hakum-auth-brand-body">
          <h1>{title}</h1>
          <p>{subtitle}</p>
          {bullets.length > 0 && (
            <ul className="hakum-auth-bullets">
              {bullets.map(({ icon: Icon, text }) => (
                <li key={text}>
                  <span>
                    <Icon size={16} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="hakum-auth-brand-foot">{kicker}</p>
      </aside>
      <section className="hakum-auth-panel">
        <div className="hakum-auth-panel-inner">{children}</div>
        {footerLinks ? <div className="hakum-auth-panel-foot">{footerLinks}</div> : null}
      </section>
    </div>
  )
}

export const CUSTOMER_AUTH_BULLETS = [
  { icon: Sparkles, text: 'Track visits, plates, and service history' },
  { icon: Car, text: 'See active bookings and live queue load' },
  { icon: MapPin, text: 'Find your nearest Hakum branch' },
]

export const TEAM_AUTH_BULLETS = [
  { icon: Gauge, text: 'Run the live queue and crew assignments' },
  { icon: ClipboardList, text: 'Ticket, check, and hand off for payment' },
  { icon: Users, text: 'Staff, Team Lead, Admin, and Super Admin' },
]

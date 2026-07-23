import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import PublicPageMeta from '@/components/PublicPageMeta'
import NotificationBell from '@/components/NotificationBell'
import { useAuth } from '@/auth/AuthProvider'
import { usePublicBranches } from '@/lib/branches'

const navItems = [
  ['Main', '/'],
  ['Services', '/services'],
  ['Packages', '/packages'],
  ['Branch', '/branches'],
  ['Events', '/events'],
  ['Live Queue', '/queue'],
  ['Contact', '/contact'],
]

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { branches } = usePublicBranches({ mode: 'visible' })
  const { user, profile, loading } = useAuth()
  const isCustomer =
    !loading && Boolean(user) && (profile?.role === 'customer' || user?.user_metadata?.role === 'customer')

  useEffect(() => setOpen(false), [pathname])

  const footerCities = branches.map((b) => b.name.replace(/^Hakum Auto Care\s*/i, '') || b.name).join(' · ') || 'Philippines'

  return (
    <div className="public-site">
      <PublicPageMeta />
      <header className={`public-header ${open ? 'menu-open' : ''}`}>
        <div className="public-shell header-inner">
          <Link className="wordmark" to="/" aria-label="Hakum Auto Care home">
            <b>H</b>
            <span>
              HAKUM<small>AUTO CARE</small>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
            {isCustomer ? <NavLink to="/account">My account</NavLink> : null}
          </nav>
          <div className="header-actions">
            {isCustomer ? (
              <>
                <NotificationBell light />
                <Link className="header-auth header-signin" to="/account">
                  Account
                </Link>
              </>
            ) : (
              <>
                <Link className="header-auth header-signin" to="/signin">
                  Sign in
                </Link>
                <Link className="header-auth header-signup" to="/signup">
                  Sign up
                </Link>
              </>
            )}
            <Link className="header-book" to="/book">
              Book now <ArrowUpRight size={16} />
            </Link>
          </div>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">
            {navItems.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {label}
              </NavLink>
            ))}
            {isCustomer ? (
              <NavLink to="/account">My account</NavLink>
            ) : (
              <>
                <Link to="/signin">Sign in</Link>
                <Link to="/signup">Sign up</Link>
              </>
            )}
            <Link className="mobile-book" to="/book">
              Book now <ArrowUpRight size={17} />
            </Link>
          </nav>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="public-footer">
        <div className="public-shell footer-pitch">
          <div>
            <p className="footer-kicker">Your car deserves the Hakum treatment</p>
            <h2>
              Pamper it.
              <br />
              <i>Protect it.</i>
            </h2>
          </div>
          <Link to="/book">
            Book a service <ArrowRight />
          </Link>
        </div>

        <div className="public-shell footer-details">
          <div className="footer-brand">
            <Link className="wordmark footer-logo" to="/">
              <b>H</b>
              <span>
                HAKUM<small>AUTO CARE</small>
              </span>
            </Link>
            <p>Precision car care, premium protection, and genuine pride in every detail.</p>
            <div className="footer-social">
              <a href="https://www.facebook.com/share/1GHerg8pxV/" aria-label="Hakum on Facebook">
                <Facebook />
              </a>
              <a href="https://www.instagram.com/_hakumautocare" aria-label="Hakum on Instagram">
                <Instagram />
              </a>
            </div>
          </div>

          <div className="footer-branches">
            <h3>Our branches</h3>
            {branches.length ? branches.map((b, i) => (
              <Link key={b.slug} to={b.coming_soon ? '/branches' : `/queue/${b.slug}`}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{b.name.replace(/^Hakum Auto Care\s*/i, '') || b.name}</strong>
                <small>{b.coming_soon ? 'Coming soon' : (b.address || b.slug)}</small>
                <ArrowUpRight />
              </Link>
            )) : (
              <Link to="/branches">
                <span>01</span>
                <strong>Find a branch</strong>
                <small>Locations across the Philippines</small>
                <ArrowUpRight />
              </Link>
            )}
          </div>

          <div className="footer-contact">
            <h3>Talk to Hakum</h3>
            <a href="tel:+639156296096">
              <Phone />
              0915 629 6096
            </a>
            <a href="mailto:sales@hakumautocare.com">
              <Mail />
              sales@hakumautocare.com
            </a>
            <a href="mailto:admin@hakumautocare.com">
              <Mail />
              admin@hakumautocare.com
            </a>
            <Link to="/contact">
              <Mail />
              Contact form
            </Link>
            <Link to="/complaints">Submit a complaint</Link>
            <span>
              <MapPin />
              {footerCities}
            </span>
          </div>
        </div>

        <div className="public-shell footer-navigation">
          <nav aria-label="Footer navigation">
            {navItems.map(([label, to]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ))}
            <Link to="/book">Book a Service</Link>
            <Link to="/signin">Sign in</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
          <div>
            <span>© {new Date().getFullYear()} Hakum Auto Care</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

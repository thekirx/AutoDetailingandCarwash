import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import PublicPageMeta from '@/components/PublicPageMeta'
import NotificationBell from '@/components/NotificationBell'
import { CookiePreferencesButton } from '@/components/CookieConsent'
import { useAuth } from '@/auth/AuthProvider'
import { branchCityName, usePublicBranches } from '@/lib/branches'
import { CustomerInstallPopup } from '@/components/InstallGuide'
import TikTokIcon from '@/components/public/TikTokIcon'
import { PUBLIC_NAV_ITEMS } from '@/data/publicNavigation'
import { buildHomeBranchCards } from '@/lib/homeBranches'

// Routes actually rebuilt in BreDESIGN. A page only joins this list once its
// own sections exist, because the scope repaints headings and body text for a
// dark ground — applied to a page still built for paper, it renders white
// headings on a paper section and they vanish. The remaining marketing routes
// keep the shipping look until Phase 4 rebuilds them.
const BREDESIGN_ROUTES = ['/home', '/services', '/branches', '/partnerships', '/events', '/blog', '/contact', '/complaints', '/terms', '/privacy', '/cookies']

function PublicSiteHeader({ open, setOpen, isCustomer, className = '' }) {
  return (
    <header className={`public-header ${className} ${open ? 'menu-open' : ''}`.trim()}>
      <div className="public-shell header-inner">
        <Link className="wordmark" to="/home" aria-label="Hakum Auto Care home">
          <img
            className="wordmark-image"
            src="/branding/hakum-lw-ow.png"
            alt=""
            width="124"
            height="70"
          />
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {PUBLIC_NAV_ITEMS.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === '/home'}>
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
          {PUBLIC_NAV_ITEMS.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === '/home'}>
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
  )
}

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const { branches } = usePublicBranches({ mode: 'visible' })
  const visibleBranches = branches.length ? branches : buildHomeBranchCards([]).map((branch) => ({
    ...branch,
    coming_soon: branch.isComingSoon,
  }))
  const { user, profile, loading } = useAuth()
  // Trust DB profile only — metadata.role is client-writable
  const isCustomer = !loading && Boolean(user) && profile?.role === 'customer'
  // /account: phone app chrome on mobile; landing header + wide layout on desktop.
  const accountRoute = pathname.startsWith('/account')
  // BreDESIGN covers the marketing site only. /book, /queue and the auth pages
  // stay on the shipping styles, so the class that scopes the new stylesheet is
  // applied by route rather than to the whole public layout.
  const bredesignRoute = BREDESIGN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  useEffect(() => setOpen(false), [pathname])

  const footerCities = visibleBranches.map(branchCityName).join(' · ') || 'Philippines'

  if (accountRoute) {
    return (
      <div className="public-site app-shell account-route">
        <PublicPageMeta />
        <PublicSiteHeader
          className="account-web-header"
          open={open}
          setOpen={setOpen}
          isCustomer={isCustomer}
        />
        <main className="app-shell-main">
          <Outlet />
        </main>
        <CustomerInstallPopup enabled={isCustomer} />
      </div>
    )
  }

  const homeRoute = pathname === '/home' || pathname === '/'

  return (
    <div
      className={`public-site${bredesignRoute ? ' bredesign' : ''}${
        bredesignRoute && homeRoute ? ' bd-home' : ''
      }`}
    >
      <PublicPageMeta />
      <PublicSiteHeader open={open} setOpen={setOpen} isCustomer={isCustomer} />

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
            <Link className="wordmark footer-logo" to="/" aria-label="Hakum Auto Care home">
              <img
                className="wordmark-image"
                src="/branding/hakum-lw-ow.png"
                alt=""
                width="170"
                height="96"
              />
            </Link>
            <p>Precision car care, premium protection, and genuine pride in every detail.</p>
            <div className="footer-social">
              <a href="https://www.facebook.com/share/1GHerg8pxV/" aria-label="Hakum on Facebook">
                <Facebook />
              </a>
              <a href="https://www.instagram.com/_hakumautocare" aria-label="Hakum on Instagram">
                <Instagram />
              </a>
              <a href="https://www.tiktok.com/@hakum_autocare" aria-label="Hakum on TikTok" target="_blank" rel="noreferrer noopener">
                <TikTokIcon />
              </a>
            </div>
          </div>

          <div className="footer-branches">
            <h3>Our branches</h3>
            {visibleBranches.length ? visibleBranches.map((b, i) => (
              <Link key={b.slug} to={b.coming_soon ? '/branches' : `/queue/${b.slug}`}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{branchCityName(b)}</strong>
                <small>{b.coming_soon ? 'Coming soon' : (b.address || 'Open daily')}</small>
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
          <nav aria-label="Legal and privacy">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/cookies">Cookies</Link>
            <CookiePreferencesButton />
          </nav>
          <div>
            <span>© {new Date().getFullYear()} Hakum Auto Care</span>
          </div>
        </div>

      </footer>
      <CustomerInstallPopup enabled={isCustomer} />
    </div>
  )
}

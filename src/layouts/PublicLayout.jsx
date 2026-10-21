import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import PublicPageMeta from '@/components/PublicPageMeta'
import NotificationBell from '@/components/NotificationBell'
import UserSettingsModal from '@/components/UserSettingsModal'
import { useAuth } from '@/auth/AuthProvider'
import { usePublicBranches } from '@/lib/branches'
import { CustomerInstallPopup } from '@/components/InstallGuide'
import SiteFooter from '@/components/public/SiteFooter'
import { PUBLIC_NAV_ITEMS } from '@/data/publicNavigation'
import { buildHomeBranchCards } from '@/lib/homeBranches'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// Routes actually rebuilt in BreDESIGN. A page only joins this list once its
// own sections exist, because the scope repaints headings and body text for a
// dark ground — applied to a page still built for paper, it renders white
// headings on a paper section and they vanish. The remaining marketing routes
// keep the shipping look until Phase 4 rebuilds them.
const BREDESIGN_ROUTES = ['/home', '/services', '/tint-finder', '/branches', '/partnerships', '/refer', '/events', '/blog', '/contact', '/complaints', '/terms', '/privacy', '/cookies']

function PublicSiteHeader({ open, setOpen, isCustomer, className = '' }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function leaveAccount() {
    setOpen(false)
    setAccountOpen(false)
    await signOut()
    navigate('/signin', { replace: true })
  }

  function openSettings() {
    setOpen(false)
    setAccountOpen(false)
    setSettingsOpen(true)
  }

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
              <button
                type="button"
                className="header-auth header-signin"
                aria-label="Account menu"
                aria-haspopup="dialog"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen(true)}
              >
                Account
              </button>
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
        </div>
        <button
          type="button"
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
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
            <>
              <NavLink to="/account">My account</NavLink>
              <button type="button" className="mobile-nav-action" onClick={openSettings}>
                Settings
              </button>
              <button type="button" className="mobile-nav-action" onClick={leaveAccount}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin">Sign in</Link>
              <Link to="/signup">Sign up</Link>
            </>
          )}
        </nav>
      )}
      {isCustomer ? (
        <>
          <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
            <DialogContent className="header-account-dialog sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{profile?.full_name || 'Account'}</DialogTitle>
                <DialogDescription>Open your portal, change settings, or sign out.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full justify-start"
                  onClick={() => {
                    setAccountOpen(false)
                    navigate('/account')
                  }}
                >
                  My account
                </Button>
                <Button type="button" variant="outline" className="min-h-11 w-full justify-start" onClick={openSettings}>
                  Settings
                </Button>
                <Button type="button" variant="destructive" className="min-h-11 w-full justify-start" onClick={leaveAccount}>
                  Sign out
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <UserSettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            profile={profile}
            audience="customer"
          />
        </>
      ) : null}
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

      <SiteFooter branches={visibleBranches} />
      <CustomerInstallPopup enabled={isCustomer} />
    </div>
  )
}

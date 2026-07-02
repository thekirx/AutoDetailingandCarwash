import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  ['Main', '/'],
  ['Services', '/services'],
  ['Packages', '/packages'],
  ['Branch', '/branches'],
  ['Live Queue', '/queue'],
]

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])

  return <div className="public-site">
    <header className={`public-header ${open ? 'menu-open' : ''}`}>
      <div className="public-shell header-inner">
        <Link className="wordmark" to="/" aria-label="Hakum Auto Care home"><b>H</b><span>HAKUM<small>AUTO CARE</small></span></Link>
        <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map(([label,to]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav>
        <Link className="header-book" to="/book">Book now <ArrowUpRight size={16}/></Link>
        <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="mobile-navigation">{open ? <X/> : <Menu/>}</button>
      </div>
      {open && <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation">{navItems.map(([label,to]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}<Link className="mobile-book" to="/book">Book now <ArrowUpRight size={17}/></Link></nav>}
    </header>

    <main><Outlet/></main>

    <footer className="public-footer">
      <div className="public-shell footer-pitch">
        <div><p className="footer-kicker">Your car deserves the Hakum treatment</p><h2>Pamper it.<br/><i>Protect it.</i></h2></div>
        <Link to="/book">Book a service <ArrowRight/></Link>
      </div>

      <div className="public-shell footer-details">
        <div className="footer-brand"><Link className="wordmark footer-logo" to="/"><b>H</b><span>HAKUM<small>AUTO CARE</small></span></Link><p>Precision car care, premium protection, and genuine pride in every detail.</p><div className="footer-social"><a href="https://www.facebook.com/share/1GHerg8pxV/" aria-label="Hakum on Facebook"><Facebook/></a><a href="https://www.instagram.com/_hakumautocare" aria-label="Hakum on Instagram"><Instagram/></a></div></div>

        <div className="footer-branches"><h3>Our branches</h3><Link to="/branches"><span>01</span><strong>Bacoor</strong><small>RFC Mall, Cavite</small><ArrowUpRight/></Link><Link to="/branches"><span>02</span><strong>Batangas</strong><small>Batangas City</small><ArrowUpRight/></Link></div>

        <div className="footer-contact"><h3>Talk to Hakum</h3><a href="tel:+639156296096"><Phone/>0915 629 6096</a><a href="mailto:sales@hakumautocare.com"><Mail/>sales@hakumautocare.com</a><a href="mailto:admin@hakumautocare.com"><Mail/>admin@hakumautocare.com</a><span><MapPin/>Bacoor · Batangas</span></div>
      </div>

      <div className="public-shell footer-navigation"><nav aria-label="Footer navigation">{navItems.map(([label,to]) => <Link key={to} to={to}>{label}</Link>)}<Link to="/book">Book a Service</Link></nav><div><span>© {new Date().getFullYear()} Hakum Auto Care</span><Link to="/admin">Admin access</Link></div></div>
    </footer>
  </div>
}

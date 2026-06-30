import { useState } from 'react'
import { CarFront, Clock3, Facebook, Instagram, Mail, MapPin, Menu, Phone, X } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'Services', to: '/#services' },
  { label: '360 Visualizer', to: '/#visualizer' },
  { label: 'Live Queue', to: '/#live-queue' },
  { label: 'Loyalty', to: '/#loyalty' },
]

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#080c11] text-slate-100">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#080c11]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Hakum Auto Care home">
            <span className="grid size-10 place-items-center rounded-xl bg-lime-400 text-[#080c11]"><CarFront size={22} /></span>
            <span><span className="block text-sm font-bold tracking-[0.18em]">HAKUM</span><span className="block text-[9px] tracking-[0.28em] text-slate-500">AUTO CARE</span></span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => <NavLink key={item.label} to={item.to} className={({ isActive }) => `text-xs font-medium tracking-wide transition hover:text-lime-300 ${isActive && item.to === '/' ? 'text-lime-400' : 'text-slate-400'}`}>{item.label}</NavLink>)}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link to="/login" className="px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-white">Staff Login</Link>
            <Link to="/booking" className="rounded-xl bg-lime-400 px-5 py-2.5 text-xs font-bold text-[#080c11] transition hover:bg-lime-300">BOOK NOW</Link>
          </div>
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-300 lg:hidden" aria-label="Toggle navigation" aria-expanded={menuOpen}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>

        {menuOpen && (
          <nav className="border-t border-white/8 bg-[#0b1016] px-5 py-5 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {navItems.map((item) => <Link key={item.label} to={item.to} onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 hover:text-lime-300">{item.label}</Link>)}
              <Link to="/booking" onClick={() => setMenuOpen(false)} className="mt-3 rounded-xl bg-lime-400 px-5 py-3 text-center text-sm font-bold text-[#080c11]">BOOK NOW</Link>
            </div>
          </nav>
        )}
      </header>

      <main><Outlet /></main>

      <footer className="border-t border-white/8 bg-[#070a0e]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.2fr_.8fr_1fr]">
          <div>
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-lime-400 text-[#080c11]"><CarFront size={23} /></span><div><p className="font-bold tracking-[0.18em]">HAKUM</p><p className="text-[9px] tracking-[0.28em] text-slate-500">AUTO CARE</p></div></div>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500">Premium auto detailing and car care, built around precision, protection, and the pride of driving something immaculate.</p>
            <div className="mt-6 flex gap-3"><a href="#facebook" aria-label="Facebook" className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-500 transition hover:border-lime-400/40 hover:text-lime-300"><Facebook size={17} /></a><a href="#instagram" aria-label="Instagram" className="grid size-10 place-items-center rounded-xl border border-white/10 text-slate-500 transition hover:border-lime-400/40 hover:text-lime-300"><Instagram size={17} /></a></div>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-300 uppercase">Explore</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-500"><Link to="/#services" className="hover:text-lime-300">Services</Link><Link to="/#visualizer" className="hover:text-lime-300">360 Visualizer</Link><Link to="/booking" className="hover:text-lime-300">Book a Service</Link><Link to="/#live-queue" className="hover:text-lime-300">Live Queue</Link><Link to="/login" className="hover:text-lime-300">Staff Portal</Link></div>
          </div>

          <div>
            <h2 className="text-xs font-semibold tracking-[0.18em] text-slate-300 uppercase">Our branches</h2>
            <div className="mt-5 space-y-5">
              <div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-sm font-medium text-slate-200">Bacoor Branch</p><p className="mt-1 text-sm text-slate-500">RFC Mall, Bacoor</p></div></div>
              <div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-lime-400" /><div><p className="text-sm font-medium text-slate-200">Hakum Batangas</p><p className="mt-1 text-sm text-slate-500">Batangas</p></div></div>
              <div className="flex gap-3 text-xs text-slate-500"><Clock3 size={16} className="shrink-0" /><span>Open daily · Queue availability varies</span></div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/6"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8"><p>© {new Date().getFullYear()} Hakum Auto Care. All rights reserved.</p><div className="flex gap-5"><a href="mailto:hello@hakumautocare.com" className="flex items-center gap-1.5 hover:text-slate-400"><Mail size={13} />Email us</a><a href="tel:+630000000000" className="flex items-center gap-1.5 hover:text-slate-400"><Phone size={13} />Contact</a></div></div></div>
      </footer>
    </div>
  )
}

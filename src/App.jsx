import { lazy, Suspense, useCallback, useState } from 'react'
import { ArrowDown, ArrowRight, Menu, X } from 'lucide-react'
import BookingModal from './components/BookingModal'
import LoyaltyCard from './components/LoyaltyCard'
import PricingTabs from './components/PricingTabs'
import { services } from './data/services'

const PPFVisualizer = lazy(() => import('./components/PPFVisualizer'))

export default function App() {
  const [booking, setBooking] = useState({ open: false, service: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const openBooking = (service = '') => setBooking({ open: true, service })
  const closeBooking = useCallback(() => setBooking((current) => ({ ...current, open: false })), [])

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-white">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-ink/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-3" aria-label="Hakum Auto Care home"><span className="grid h-9 w-9 -skew-x-12 place-items-center bg-acid font-display text-lg text-ink">H</span><span className="font-display text-sm uppercase leading-tight tracking-wide">Hakum<br /><span className="font-sans text-[9px] tracking-[.3em] text-mist">Auto Care</span></span></a>
          <div className="hidden items-center gap-6 text-xs font-bold uppercase tracking-[.15em] md:flex"><a href="#services" className="nav-link">Services</a><a href="#visualizer" className="nav-link">360 PPF</a><a href="#loyalty" className="nav-link">Rewards</a><a href="#pricing" className="nav-link">Pricing</a><a href="#locations" className="nav-link">Branches</a><button onClick={() => openBooking()} className="bg-acid px-5 py-3 text-ink transition hover:bg-white">Book now</button></div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
        </nav>
        {menuOpen && <div className="grid gap-4 border-t border-line bg-panel px-5 py-6 text-sm font-bold uppercase tracking-widest md:hidden"><a onClick={() => setMenuOpen(false)} href="#services">Services</a><a onClick={() => setMenuOpen(false)} href="#visualizer">360 PPF</a><a onClick={() => setMenuOpen(false)} href="#loyalty">Rewards</a><a onClick={() => setMenuOpen(false)} href="#pricing">Pricing</a><button onClick={() => { setMenuOpen(false); openBooking() }} className="bg-acid p-3 text-ink">Book now</button></div>}
      </header>

      <section id="top" className="relative flex min-h-[760px] items-end border-b border-line px-5 pb-20 pt-32 sm:px-8 lg:items-center lg:pb-0">
        <div className="hero-grid absolute inset-0 opacity-30" />
        <div className="absolute -right-32 top-28 h-[420px] w-[650px] rotate-[-8deg] rounded-[50%] border-[70px] border-white/[.035] shadow-[0_0_140px_rgba(233,255,63,.07)]" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Metro Manila’s premium auto care</p>
            <h1 className="max-w-4xl font-display text-6xl uppercase leading-[.86] tracking-[-.05em] sm:text-8xl lg:text-[7rem]">Your car.<br /><span className="text-acid">At its peak.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-mist sm:text-lg">Precision detailing. Serious protection. A finish that makes every drive feel like the first one.</p>
            <div className="mt-9 flex flex-wrap gap-4"><button onClick={() => openBooking()} className="group flex items-center gap-4 bg-acid px-7 py-4 text-sm font-extrabold uppercase tracking-wider text-ink">Book your service <ArrowRight size={18} className="transition group-hover:translate-x-1" /></button><a href="#services" className="flex items-center gap-4 border border-line px-7 py-4 text-sm font-bold uppercase tracking-wider hover:border-white">Explore services <ArrowDown size={17} /></a></div>
          </div>
          <div className="hidden border-l border-line pl-10 lg:block"><p className="font-display text-5xl text-acid">08</p><p className="mt-1 text-xs font-bold uppercase tracking-[.25em] text-mist">Signature services</p><p className="mt-7 max-w-xs border-t border-line pt-6 text-sm leading-6 text-slate-400">From your weekly wash to full-body protection, every service is handled with obsessive attention.</p></div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="eyebrow">What we do</p><h2 className="section-title">Built for the obsessed.</h2></div><p className="max-w-md text-sm leading-6 text-mist">Expert care for every surface, every detail, and every drive. Select a service to reserve your slot.</p></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4">
          {services.map(({ name, description, icon: Icon }, index) => <button key={name} onClick={() => openBooking(name)} className="service-card group min-h-72 border border-line p-7 text-left transition hover:z-10 hover:border-acid hover:bg-panel"><span className="mb-12 block text-xs font-bold tracking-widest text-mist">0{index + 1}</span><Icon size={34} strokeWidth={1.5} className="mb-5 text-acid transition group-hover:scale-110" /><h3 className="font-display text-xl uppercase">{name}</h3><p className="mt-3 text-sm leading-6 text-mist">{description}</p><span className="mt-5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-acid opacity-0 transition group-hover:opacity-100">Book service <ArrowRight size={14} /></span></button>)}
        </div>
      </section>

      <Suspense fallback={<div className="grid h-[720px] place-items-center border-y border-line bg-[#0b1012] text-xs font-bold uppercase tracking-[.25em] text-mist">Loading 360 studio…</div>}><PPFVisualizer onBook={openBooking} /></Suspense>
      <section id="loyalty" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end"><div><p className="eyebrow">Loyalty, rewarded</p><h2 className="section-title">Care that pays you back.</h2></div><p className="max-w-lg text-sm leading-6 text-mist">Keep your car looking its best and unlock complimentary Hakum services along the way.</p></div>
        <LoyaltyCard visitCount={8} />
      </section>
      <div className="border-y border-line bg-[#0c1113]"><PricingTabs onBook={openBooking} /></div>
      <section id="locations" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="flex flex-col items-start justify-between gap-8 rounded-3xl border border-line bg-panel p-8 sm:p-12 lg:flex-row lg:items-center"><div><p className="eyebrow">Ready when you are</p><h2 className="font-display text-4xl uppercase sm:text-5xl">Give your car the care it deserves.</h2><p className="mt-4 text-mist">Quezon City · Makati · Alabang</p></div><button onClick={() => openBooking()} className="shrink-0 bg-acid px-8 py-4 text-sm font-extrabold uppercase tracking-wider text-ink">Book an appointment</button></div></section>
      <footer className="border-t border-line px-5 py-8 text-center text-xs uppercase tracking-widest text-mist">© 2026 Hakum Auto Care. Driven by detail.</footer>
      <BookingModal open={booking.open} initialService={booking.service} onClose={closeBooking} />
    </main>
  )
}

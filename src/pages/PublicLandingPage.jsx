import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CarFront, ChevronRight, MapPin, Radio, ShieldCheck, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import LoyaltyCard from '../components/LoyaltyCard'

const stats = [
  { value: 15000, suffix: '+', label: 'Vehicles Rejuvenated' },
  { value: 3000, suffix: '+', label: 'Satisfied Clients' },
  { value: 10, suffix: '', label: 'Years Combined Experience' },
  { value: 26, suffix: '', label: 'Team Members' },
]

const branches = [
  { slug: 'bacoor', name: 'Bacoor Branch', location: 'RFC Mall, Bacoor', note: 'View current RFC Mall queue' },
  { slug: 'batangas', name: 'Hakum Batangas', location: 'Batangas', note: 'View current Batangas queue' },
]

function AnimatedNumber({ value, suffix }) {
  const [display, setDisplay] = useState(0)
  const elementRef = useRef(null)

  useEffect(() => {
    const node = elementRef.current
    let frame
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      const startedAt = performance.now()
      const animate = (time) => {
        const progress = Math.min((time - startedAt) / 1400, 1)
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplay(Math.round(value * eased))
        if (progress < 1) frame = requestAnimationFrame(animate)
      }
      frame = requestAnimationFrame(animate)
      observer.disconnect()
    }, { threshold: 0.4 })
    observer.observe(node)
    return () => { observer.disconnect(); cancelAnimationFrame(frame) }
  }, [value])

  return <span ref={elementRef}>{display.toLocaleString()}{suffix}</span>
}

export default function PublicLandingPage() {
  return (
    <>
      <section className="relative isolate min-h-[760px] overflow-hidden border-b border-white/8">
        <div className="absolute inset-0 -z-20 bg-[#080c11]" />
        <div className="absolute inset-0 -z-10 opacity-70 [background-image:radial-gradient(circle_at_78%_34%,rgba(163,230,53,.13),transparent_25%),linear-gradient(115deg,transparent_55%,rgba(255,255,255,.025)_55%,rgba(255,255,255,.025)_56%,transparent_56%)]" />
        <div className="absolute top-1/2 right-[-10%] -z-10 h-[430px] w-[680px] -translate-y-1/2 rotate-[-8deg] rounded-[45%] border border-lime-400/10 bg-white/[0.018] shadow-[0_0_120px_rgba(163,230,53,.06)]" />
        <CarFront className="absolute top-1/2 right-[14%] -z-10 hidden size-72 -translate-y-1/2 text-white/[0.035] xl:block" strokeWidth={0.7} />

        <div className="mx-auto flex min-h-[760px] max-w-7xl items-center px-5 py-20 sm:px-8">
          <div className="max-w-4xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.06] px-4 py-2 text-[10px] font-semibold tracking-[0.18em] text-lime-300 uppercase"><Sparkles size={14} />Premium automotive care</div>
            <h1 className="max-w-4xl text-5xl leading-[.95] font-black tracking-[-0.055em] text-white uppercase sm:text-7xl lg:text-[92px]">
              Give your car <span className="text-lime-400">experience</span> the pampering it deserves
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">Expert detailing. Meticulous protection. A finish that makes every drive feel brand new.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/booking" className="group flex items-center justify-center gap-3 rounded-xl bg-lime-400 px-7 py-4 text-sm font-bold text-[#080c11] transition hover:bg-lime-300">START NOW <ArrowRight size={18} className="transition group-hover:translate-x-1" /></Link>
              <a href="#live-queue" className="flex items-center justify-center gap-3 rounded-xl border border-white/12 bg-white/[0.025] px-7 py-4 text-sm font-semibold text-slate-200 transition hover:border-white/25 hover:bg-white/5"><Radio size={17} className="text-lime-400" />CHECK LIVE QUEUE</a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-xs text-slate-500"><span className="flex items-center gap-2"><ShieldCheck size={16} className="text-lime-400" />Professional-grade care</span><span className="flex items-center gap-2"><Sparkles size={16} className="text-lime-400" />Two trusted branches</span></div>
          </div>
        </div>
      </section>

      <section aria-label="Hakum Auto Care milestones" className="border-b border-white/8 bg-[#0b1016]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={stat.label} className={`px-3 py-9 sm:px-7 sm:py-11 ${index % 2 ? 'border-l border-white/8' : ''} ${index > 1 ? 'border-t border-white/8 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l' : ''}`}>
              <p className="text-3xl font-bold tracking-tight text-white sm:text-4xl"><AnimatedNumber value={stat.value} suffix={stat.suffix} /></p>
              <p className="mt-2 text-[10px] leading-4 tracking-[0.13em] text-slate-500 uppercase sm:text-xs">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="loyalty" className="border-b border-white/8 bg-[#0b1016] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_.7fr] lg:items-end">
            <div><div className="text-xs font-semibold tracking-[0.18em] text-lime-400 uppercase">Loyalty, rewarded</div><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Care that pays you back.</h2></div>
            <p className="max-w-lg leading-7 text-slate-400">Keep your car looking its best and unlock complimentary Hakum services along the way.</p>
          </div>
          <LoyaltyCard visitCount={8} />
        </div>
      </section>

      <section id="live-queue" className="bg-[#080c11] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-lime-400 uppercase"><Radio size={15} />Live branch status</div><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Know the queue before you drive.</h2><p className="mt-4 leading-7 text-slate-400">Choose your nearest Hakum branch to see its current service queue and plan your visit.</p></div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {branches.map((branch) => (
              <Link key={branch.slug} to={`/queue/${branch.slug}`} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#10161e] p-7 transition hover:-translate-y-1 hover:border-lime-400/35 hover:shadow-[0_20px_60px_rgba(0,0,0,.25)] sm:p-8">
                <div className="absolute top-0 right-0 size-32 rounded-bl-full bg-lime-400/[0.035] transition group-hover:bg-lime-400/[0.07]" />
                <div className="flex items-start justify-between gap-5"><span className="grid size-12 place-items-center rounded-2xl bg-lime-400/10 text-lime-300"><MapPin size={22} /></span><span className="flex items-center gap-2 rounded-full border border-lime-400/20 bg-lime-400/[0.06] px-3 py-1.5 text-[10px] font-semibold tracking-wide text-lime-300 uppercase"><span className="size-1.5 animate-pulse rounded-full bg-lime-400" />Live</span></div>
                <h3 className="mt-8 text-2xl font-semibold">{branch.name}</h3><p className="mt-2 text-sm text-slate-500">{branch.location}</p>
                <div className="mt-8 flex items-center justify-between border-t border-white/8 pt-5"><span className="text-xs text-slate-400">{branch.note}</span><ChevronRight className="text-lime-400 transition group-hover:translate-x-1" size={19} /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

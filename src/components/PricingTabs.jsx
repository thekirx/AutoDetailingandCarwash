import { useState } from 'react'
import { Check, Shield } from 'lucide-react'
import { pricing } from '../data/services'

export default function PricingTabs({ onBook }) {
  const [active, setActive] = useState('Ceramic Coating')
  return (
    <section id="pricing" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
      <div className="mb-10 text-center">
        <p className="eyebrow">Protection packages</p>
        <h2 className="section-title">Choose your armor.</h2>
        <p className="mx-auto mt-4 max-w-xl text-mist">Premium protection, transparent pricing. Final rates may vary based on vehicle size and paint condition.</p>
      </div>
      <div className="mx-auto mb-10 flex w-fit rounded-full border border-line bg-panel p-1.5" role="tablist" aria-label="Pricing categories">
        {Object.keys(pricing).map((tab) => <button key={tab} role="tab" aria-selected={active === tab} onClick={() => setActive(tab)} className={`rounded-full px-5 py-3 text-xs font-extrabold uppercase tracking-wider transition sm:px-8 ${active === tab ? 'bg-acid text-ink' : 'text-mist hover:text-white'}`}>{tab}</button>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {pricing[active].map((plan) => (
          <article key={plan.name} className={`relative flex flex-col overflow-hidden rounded-2xl border p-7 ${plan.featured ? 'border-acid bg-[#151c1c] shadow-glow lg:-translate-y-3' : 'border-line bg-panel'}`}>
            {plan.featured && <div className="absolute right-0 top-0 bg-acid px-4 py-2 text-[10px] font-black uppercase tracking-wider text-ink">30% off · Best deal</div>}
            <Shield className={plan.featured ? 'text-acid' : 'text-mist'} size={28} />
            <h3 className="mt-5 font-display text-2xl uppercase">{plan.name}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-mist">{plan.note}</p>
            <div className="mb-7 mt-6 flex items-end gap-3"><span className="font-display text-3xl">{plan.price}</span>{plan.oldPrice && <span className="pb-1 text-sm text-mist line-through">{plan.oldPrice}</span>}</div>
            <ul className="mb-8 grid gap-3 border-t border-line pt-6">{plan.features.map((feature) => <li className="flex gap-3 text-sm text-slate-300" key={feature}><Check size={17} className="shrink-0 text-acid" />{feature}</li>)}</ul>
            <button onClick={() => onBook(active)} className={`mt-auto px-6 py-3 text-xs font-extrabold uppercase tracking-wider transition ${plan.featured ? 'bg-acid text-ink hover:bg-white' : 'border border-line hover:border-acid hover:text-acid'}`}>Choose {plan.name}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

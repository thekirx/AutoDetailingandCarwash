import { Gift, Sparkles } from 'lucide-react'

const TOTAL_SLOTS = 15
const MILESTONES = [10, 15]

function getEncouragement(currentVisits) {
  if (currentVisits >= TOTAL_SLOTS) return 'Your next freebie is ready!'

  const nextMilestone = currentVisits < MILESTONES[0] ? MILESTONES[0] : MILESTONES[1]
  const remaining = nextMilestone - currentVisits

  return `You are ${remaining} ${remaining === 1 ? 'wash' : 'washes'} away from your next freebie!`
}

export default function LoyaltyCard({ currentVisits = 0 }) {
  const completed = Math.min(Math.max(Math.floor(currentVisits), 0), TOTAL_SLOTS)
  const progress = Math.round((completed / TOTAL_SLOTS) * 100)

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1316] p-6 shadow-2xl sm:p-10">
      <div className="loyalty-orbit loyalty-orbit-one" />
      <div className="loyalty-orbit loyalty-orbit-two" />
      <div className="relative">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.28em] text-lime-400"><Sparkles size={14} /> Hakum rewards</div>
            <h3 className="max-w-xl text-3xl font-black uppercase leading-tight sm:text-4xl">{getEncouragement(completed)}</h3>
            <p className="mt-3 text-sm text-slate-400">Every visit brings your ride—and your next reward—closer.</p>
          </div>
          <div className="flex shrink-0 items-baseline gap-2 sm:block sm:text-right"><span className="text-4xl font-black text-lime-400">{completed}</span><span className="text-xs font-bold uppercase tracking-widest text-slate-500"> / {TOTAL_SLOTS} visits</span></div>
        </div>

        <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-white/5" aria-label={`${progress}% loyalty progress`} role="progressbar" aria-valuemin="0" aria-valuemax="15" aria-valuenow={completed}>
          <div className="h-full rounded-full bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,.65)] transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>

        <ol className="grid grid-cols-5 gap-3 sm:gap-5" aria-label="15-visit loyalty stamp card">
          {Array.from({ length: TOTAL_SLOTS }, (_, index) => {
            const number = index + 1
            const stamped = number <= completed
            const milestone = MILESTONES.includes(number)
            const reward = number === 10 ? 'Free wash milestone' : number === 15 ? 'Premium detail milestone' : null
            return (
              <li key={number} className="grid justify-items-center gap-2">
                <div aria-label={stamped ? `Visit ${number} completed${reward ? `, ${reward}` : ''}` : `Visit ${number}${reward ? `, ${reward}` : ''}`} className={`stamp-slot relative grid aspect-square w-full max-w-[82px] place-items-center rounded-full border ${stamped ? 'stamp-slot-complete' : 'border-white/10 bg-black/20'} ${milestone ? `stamp-milestone stamp-milestone-${number}` : ''}`}>
                  {stamped ? <span className="stamp-logo grid h-[68%] w-[68%] -rotate-6 place-items-center rounded-full border-2 border-[#080c11] bg-lime-400 text-xl font-black text-[#080c11] shadow-lg sm:text-2xl">H</span> : milestone ? <Gift size={20} className="text-lime-400/75" /> : <span className="text-xs font-bold text-white/20">{String(number).padStart(2, '0')}</span>}
                  {stamped && <span className="absolute inset-1 rounded-full border border-lime-400/30" />}
                </div>
                <span className={`text-[8px] font-extrabold uppercase tracking-[.15em] sm:text-[9px] ${milestone ? 'text-lime-400' : 'text-slate-500/60'}`}>{reward || `Visit ${number}`}</span>
              </li>
            )
          })}
        </ol>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
          <span>10 visits · Free wash</span><span className="text-lime-400">15 visits · Premium detail</span>
        </div>
      </div>
    </section>
  )
}

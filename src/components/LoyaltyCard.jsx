import { Gift, Sparkles } from 'lucide-react'

export default function LoyaltyCard({
  completed = 0,
  cardSlots = 15,
  milestones = [],
  encouragement,
  variant = 'dark',
}) {
  const slots = Math.max(Number(cardSlots) || 15, 1)
  const stampedCount = Math.min(Math.max(Math.floor(Number(completed) || 0), 0), slots)
  const progress = Math.round((stampedCount / slots) * 100)
  const milestonePoints = new Set(milestones.map((m) => Number(m.threshold_points)))
  const message = encouragement || 'Every visit brings your ride closer to the next reward.'
  const hakum = variant === 'hakum'

  return (
    <section
      className={
        hakum
          ? 'loyalty-card-hakum relative overflow-hidden rounded-[1.5rem] border border-[#052699]/15 bg-white p-5 shadow-[0_12px_40px_rgba(5,20,65,0.08)] sm:p-7'
          : 'relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1316] p-6 shadow-2xl sm:p-10'
      }
    >
      {!hakum && (
        <>
          <div className="loyalty-orbit loyalty-orbit-one" />
          <div className="loyalty-orbit loyalty-orbit-two" />
        </>
      )}
      <div className="relative">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-start">
          <div>
            <div
              className={`mb-3 flex items-center gap-2 text-[10px] font-extrabold tracking-[0.22em] uppercase ${
                hakum ? 'text-[#052699]' : 'text-lime-400'
              }`}
            >
              <Sparkles size={14} /> Hakum rewards
            </div>
            <h3
              className={
                hakum
                  ? 'max-w-xl text-xl font-black tracking-tight text-[#020a31] sm:text-2xl'
                  : 'max-w-xl text-3xl font-black uppercase leading-tight sm:text-4xl'
              }
            >
              {message}
            </h3>
            <p className={`mt-2 text-sm ${hakum ? 'text-slate-500' : 'text-slate-400'}`}>
              Stamps from each service visit fill your card.
            </p>
          </div>
          <div className={`flex shrink-0 items-baseline gap-1 ${hakum ? '' : 'sm:block sm:text-right'}`}>
            <span className={`text-4xl font-black tabular-nums ${hakum ? 'text-[#052699]' : 'text-lime-400'}`}>
              {stampedCount}
            </span>
            <span className={`text-xs font-bold tracking-widest uppercase ${hakum ? 'text-slate-400' : 'text-slate-500'}`}>
              / {slots}
            </span>
          </div>
        </div>

        <div
          className={`mb-6 h-1.5 overflow-hidden rounded-full ${hakum ? 'bg-[#052699]/10' : 'bg-white/5'}`}
          aria-label={`${progress}% loyalty progress`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={slots}
          aria-valuenow={stampedCount}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              hakum ? 'bg-[#052699]' : 'bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,.65)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="grid grid-cols-5 gap-2.5 sm:gap-4" aria-label={`${slots}-point loyalty stamp card`}>
          {Array.from({ length: slots }, (_, index) => {
            const number = index + 1
            const stamped = number <= stampedCount
            const milestone = milestones.find((m) => Number(m.threshold_points) === number)
            const isMilestoneSlot = milestonePoints.has(number)
            const reward = milestone?.reward_label || null
            return (
              <li key={number} className="grid justify-items-center gap-1.5">
                <div
                  aria-label={
                    stamped
                      ? `Point ${number} completed${reward ? `, ${reward}` : ''}`
                      : `Point ${number}${reward ? `, ${reward}` : ''}`
                  }
                  className={`stamp-slot relative grid aspect-square w-full max-w-[72px] place-items-center rounded-full border ${
                    stamped
                      ? hakum
                        ? 'border-[#052699] bg-[#052699]'
                        : 'stamp-slot-complete'
                      : hakum
                        ? 'border-[#052699]/15 bg-[#f4f6fb]'
                        : 'border-white/10 bg-black/20'
                  } ${isMilestoneSlot && !hakum ? `stamp-milestone stamp-milestone-${number}` : ''}`}
                >
                  {stamped ? (
                    <span
                      className={`grid h-[68%] w-[68%] -rotate-6 place-items-center rounded-full border-2 text-lg font-black shadow-md sm:text-xl ${
                        hakum
                          ? 'border-white/30 bg-white text-[#052699]'
                          : 'border-[#080c11] bg-lime-400 text-[#080c11]'
                      }`}
                    >
                      H
                    </span>
                  ) : isMilestoneSlot ? (
                    <Gift size={18} className={hakum ? 'text-[#052699]/70' : 'text-lime-400/75'} />
                  ) : (
                    <span className={`text-[10px] font-bold ${hakum ? 'text-[#052699]/35' : 'text-white/20'}`}>
                      {String(number).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <span
                  className={`text-center text-[8px] font-extrabold tracking-[0.12em] uppercase sm:text-[9px] ${
                    isMilestoneSlot
                      ? hakum
                        ? 'text-[#052699]'
                        : 'text-lime-400'
                      : hakum
                        ? 'text-slate-400'
                        : 'text-slate-500/60'
                  }`}
                >
                  {reward || `Pt ${number}`}
                </span>
              </li>
            )
          })}
        </ol>

        {milestones.length > 0 && (
          <div
            className={`mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-[10px] font-bold tracking-[0.16em] uppercase ${
              hakum ? 'border-[#052699]/10 text-slate-400' : 'border-white/10 text-slate-500'
            }`}
          >
            {milestones.map((m) => (
              <span
                key={m.id || m.threshold_points}
                className={
                  stampedCount >= Number(m.threshold_points)
                    ? hakum
                      ? 'text-[#052699]'
                      : 'text-lime-400'
                    : ''
                }
              >
                {m.threshold_points} pts · {m.reward_label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

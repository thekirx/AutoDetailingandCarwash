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
          ? 'loyalty-card-hakum relative overflow-hidden rounded-[1.25rem] border border-primary/10 bg-white p-5 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_12px_32px_rgba(5,20,65,0.055)] sm:p-6'
          : 'relative overflow-hidden rounded-[2rem] border border-white/10 bg-[var(--color-surface-cinematic)] p-6 shadow-2xl sm:p-10'
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
                hakum ? 'text-primary' : 'text-lime-400'
              }`}
            >
              <Sparkles size={14} /> Hakum rewards
            </div>
            <h3
              className={
                hakum
                  ? 'max-w-xl text-xl font-black tracking-tight text-foreground sm:text-2xl'
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
            <span className={`text-4xl font-black tabular-nums ${hakum ? 'text-primary' : 'text-lime-400'}`}>
              {stampedCount}
            </span>
            <span className={`text-xs font-bold tracking-widest uppercase ${hakum ? 'text-slate-400' : 'text-slate-500'}`}>
              / {slots}
            </span>
          </div>
        </div>

        <div
          className={`mb-6 h-1.5 overflow-hidden rounded-full ${hakum ? 'bg-primary/10' : 'bg-white/5'}`}
          aria-label={`${progress}% loyalty progress`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={slots}
          aria-valuenow={stampedCount}
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              hakum ? 'bg-primary' : 'bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,.65)]'
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
                        ? 'border-primary bg-primary'
                        : 'stamp-slot-complete'
                      : hakum
                        ? 'border-primary/15 bg-primary/[0.06]'
                        : 'border-white/10 bg-black/20'
                  } ${isMilestoneSlot && !hakum ? `stamp-milestone stamp-milestone-${number}` : ''}`}
                >
                  {stamped ? (
                    <span
                      className={`grid h-[68%] w-[68%] -rotate-6 place-items-center rounded-full border-2 text-lg font-black shadow-md sm:text-xl ${
                        hakum
                          ? 'border-white/30 bg-white text-primary'
                          : 'border-[var(--color-surface-cinematic)] bg-lime-400 text-[var(--color-surface-cinematic)]'
                      }`}
                    >
                      H
                    </span>
                  ) : isMilestoneSlot ? (
                    <Gift size={18} className={hakum ? 'text-primary/70' : 'text-lime-400/75'} />
                  ) : (
                    <span className={`text-[10px] font-bold ${hakum ? 'text-primary/35' : 'text-white/20'}`}>
                      {String(number).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <span
                  className={`text-center text-[8px] font-extrabold tracking-[0.12em] uppercase sm:text-[9px] ${
                    isMilestoneSlot
                      ? hakum
                        ? 'text-primary'
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
              hakum ? 'border-primary/10 text-slate-400' : 'border-white/10 text-slate-500'
            }`}
          >
            {milestones.map((m) => (
              <span
                key={m.id || m.threshold_points}
                className={
                  stampedCount >= Number(m.threshold_points)
                    ? hakum
                      ? 'text-primary'
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

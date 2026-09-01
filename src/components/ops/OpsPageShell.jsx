import { cn } from '@/lib/utils'

/**
 * Shared ops page chrome — matches Attendance / POS (max-w-7xl, eyebrow, safe-area padding).
 */
export default function OpsPageShell({
  className,
  eyebrow,
  title,
  description,
  icon: Icon,
  meta,
  actions,
  children,
}) {
  return (
    <section
      className={cn(
        'mx-auto flex w-full max-w-7xl flex-col gap-6 pb-[max(2rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {Icon ? <Icon className="size-6 shrink-0 text-primary" aria-hidden /> : null}
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {(meta || actions) ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {meta ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {meta}
              </div>
            ) : null}
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        ) : null}
      </header>
      {children}
    </section>
  )
}

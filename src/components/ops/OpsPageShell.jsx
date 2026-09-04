import { cn } from '@/lib/utils'
import { Link } from 'react-router-dom'

/**
 * Shared ops page chrome — max-w-7xl, eyebrow, breadcrumbs, safe-area padding.
 */
export default function OpsPageShell({
  className,
  eyebrow,
  title,
  description,
  icon: Icon,
  breadcrumbs,
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
        <div className="max-w-2xl min-w-0">
          {breadcrumbs?.length ? (
            <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {breadcrumbs.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1.5">
                  {i > 0 ? <span aria-hidden>/</span> : null}
                  {crumb.to ? (
                    <Link to={crumb.to} className="hover:text-foreground">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
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
        {meta || actions ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end sticky bottom-0 z-10 bg-background/95 py-1 backdrop-blur supports-backdrop-filter:bg-background/80 lg:static lg:bg-transparent lg:py-0 lg:backdrop-blur-none">
            {meta ? (
              <div className="flex items-center gap-2 rounded-[var(--shape-card)] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
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

export { OpsPageShell as PageHeader }

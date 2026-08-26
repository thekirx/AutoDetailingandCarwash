/** Shared Finance tab chrome — matches Dashboard panels / metric strip. */
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

export function FinanceMetricStrip({ children, label = 'Totals' }) {
  return (
    <div className="finance-metric-strip" role="group" aria-label={label}>
      {children}
    </div>
  )
}

export function FinanceMetricCell({ label, value, hint, tone = 'ink' }) {
  return (
    <div className="finance-metric-cell" data-tone={tone}>
      <p className="finance-metric-label">{label}</p>
      <p className="finance-metric-value tabular-nums">{value}</p>
      {hint ? <p className="finance-metric-hint">{hint}</p> : null}
    </div>
  )
}

export function FinancePanel({ title, description, actions = null, children, bodyClassName = '' }) {
  return (
    <section className="finance-panel">
      {(title || description || actions) ? (
        <header className="finance-panel-head">
          <div className="min-w-0">
            {title ? <h2 className="finance-panel-title">{title}</h2> : null}
            {description ? <p className="finance-panel-desc">{description}</p> : null}
          </div>
          {actions ? <div className="finance-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={`finance-panel-body ${bodyClassName}`.trim()}>{children}</div>
    </section>
  )
}

export function FinanceEmpty({ title, body, action = null }) {
  return (
    <div className="finance-empty">
      <p className="finance-empty-title">{title}</p>
      {body ? <p className="finance-empty-body">{body}</p> : null}
      {action ? (
        <Button type="button" variant="outline" size="sm" className="mt-3 min-h-10 cursor-pointer" onClick={action.onClick}>
          {action.label}
          <ArrowRight data-icon="inline-end" />
        </Button>
      ) : null}
    </div>
  )
}

export function FinanceTabSkeleton({ metrics = 4, lines = 6 }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="finance-metric-strip">
        {Array.from({ length: metrics }, (_, i) => (
          <div key={i} className="finance-metric-cell">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2 h-7 w-24" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <section className="finance-panel">
        <div className="finance-panel-body flex flex-col gap-2">
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </section>
    </div>
  )
}

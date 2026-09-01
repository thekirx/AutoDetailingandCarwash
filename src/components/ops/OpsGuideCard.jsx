import { useState } from 'react'
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const DEFAULT_STEP_ICONS = {}

/**
 * Collapsible non-tech workflow guide — same pattern as POS / Payroll guides.
 */
export default function OpsGuideCard({
  title = 'How this works',
  description = 'Tap a step if you are new to this screen.',
  steps = [],
  stepIcons = DEFAULT_STEP_ICONS,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (!steps.length) return null

  return (
    <Card className="border-primary/15 bg-muted/15">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1 max-w-prose">{description}</CardDescription>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 min-w-11 shrink-0"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
          <span className="sr-only">{open ? 'Hide guide' : 'Show guide'}</span>
        </Button>
      </CardHeader>
      {open ? (
        <CardContent className="pt-0">
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => {
              const Icon = stepIcons[step.id]
              return (
                <li
                  key={step.id}
                  className="flex gap-3 rounded-xl border border-border/60 bg-background/80 p-3"
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-medium">
                      {Icon ? <Icon className="size-4 text-primary" aria-hidden /> : null}
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      ) : null}
    </Card>
  )
}

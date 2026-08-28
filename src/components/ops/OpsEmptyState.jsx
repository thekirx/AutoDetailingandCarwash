import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Composed empty state for ops lists — optional CTA as Button or link child. */
export default function OpsEmptyState({ title, description, action, actionLabel, onAction, icon: Icon }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start gap-3">
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="mt-1 max-w-prose">{description}</CardDescription> : null}
        </div>
      </CardHeader>
      {(action || onAction) && actionLabel ? (
        <CardContent className="pt-0">
          {action || (
            <Button type="button" variant="secondary" className="min-h-11" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </CardContent>
      ) : null}
    </Card>
  )
}

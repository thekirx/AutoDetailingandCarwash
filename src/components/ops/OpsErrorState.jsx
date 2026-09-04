import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OpsErrorState({ title = 'Something went wrong', description, onRetry, retryLabel = 'Retry' }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden />
        </span>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="mt-1 max-w-prose">{description}</CardDescription> : null}
        </div>
      </CardHeader>
      {onRetry ? (
        <CardContent className="pt-0">
          <Button type="button" variant="secondary" className="min-h-11" onClick={onRetry}>
            {retryLabel}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  )
}

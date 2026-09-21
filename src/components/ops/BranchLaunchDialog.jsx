import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, MonitorPlay } from 'lucide-react'
import { toast } from 'sonner'
import { absolutePublicUrl, branchLaunchGuide } from '@/lib/liveQueuePath'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

async function copyText(value) {
  await navigator.clipboard.writeText(value)
}

export default function BranchLaunchDialog({ branch, onClose }) {
  const open = Boolean(branch?.slug)
  const guide = open ? branchLaunchGuide(branch) : null
  const [copied, setCopied] = useState('')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    setCopied('')
  }, [branch?.slug])

  async function copyPath(path, id) {
    try {
      await copyText(absolutePublicUrl(path, origin))
      setCopied(id)
      toast.success('Link copied')
    } catch (err) {
      toast.error(err.message || 'Could not copy')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" showCloseButton>
        {guide ? (
          <>
            <DialogHeader>
              <DialogTitle>{guide.title}</DialogTitle>
              <DialogDescription>{guide.lead}</DialogDescription>
            </DialogHeader>

            <ol className="grid gap-2">
              {guide.steps.map((step, index) => (
                <li key={step.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
                  <p className="flex items-start gap-2 font-medium">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] tabular-nums">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      {step.title}
                      <span className="ml-2 text-[11px] font-medium text-muted-foreground">
                        {step.ready ? 'Ready' : 'You still do this'}
                      </span>
                    </span>
                  </p>
                  <p className="mt-1 pl-8 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  {step.copyPath || step.href ? (
                    <div className="mt-2 flex flex-wrap gap-2 pl-8">
                      {step.copyPath ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11"
                          onClick={() => copyPath(step.copyPath, step.id)}
                        >
                          {copied === step.id ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                          {copied === step.id ? 'Copied' : 'Copy link'}
                        </Button>
                      ) : null}
                      {step.href ? (
                        <Button asChild variant="outline" size="sm" className="min-h-11">
                          <Link to={step.href} target="_blank" rel="noreferrer">
                            {step.linkLabel || 'Open'}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => onClose?.()}>
                I will set this up later
              </Button>
              <Button asChild className="min-h-11">
                <Link to={guide.tvPath} target="_blank" rel="noreferrer">
                  <MonitorPlay className="size-4" aria-hidden />
                  Open shop TV
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

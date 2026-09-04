import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

function useIsMdUp() {
  const [md, setMd] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true))
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => setMd(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return md
}

/** Dialog on md+, bottom Sheet below. */
export default function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  sheetSide = 'bottom',
}) {
  const isDesktop = useIsMdUp()

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn('rounded-[var(--shape-sheet)] sm:max-w-lg', className)}>
          {(title || description) && (
            <DialogHeader>
              {title ? <DialogTitle>{title}</DialogTitle> : null}
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
          )}
          {children}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheetSide} className={cn('rounded-t-[var(--shape-sheet)]', className)}>
        {(title || description) && (
          <SheetHeader>
            {title ? <SheetTitle>{title}</SheetTitle> : null}
            {description ? <SheetDescription>{description}</SheetDescription> : null}
          </SheetHeader>
        )}
        <div className="mt-4 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

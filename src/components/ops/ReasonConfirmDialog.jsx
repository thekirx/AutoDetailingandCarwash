import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Shared accessible confirmation and reason-prompt modal replacing native
 * browser `window.confirm()` and `window.prompt()` across operations surfaces.
 */
export default function ReasonConfirmDialog({
  open,
  onOpenChange,
  title,
  description = '',
  mode = 'prompt',
  inputLabel = 'Reason',
  placeholder = '',
  defaultValue = '',
  required = false,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  busy = false,
  onConfirm,
}) {
  const [value, setValue] = useState(defaultValue)
  const [lastOpenKey, setLastOpenKey] = useState('')
  const openKey = open ? `${title}|${defaultValue}` : ''

  if (open && openKey !== lastOpenKey) {
    setLastOpenKey(openKey)
    setValue(defaultValue || '')
  } else if (!open && lastOpenKey) {
    setLastOpenKey('')
  }

  const trimmed = String(value || '').trim()
  const blocked = mode === 'prompt' && required && !trimmed

  function handleSubmit(e) {
    e.preventDefault()
    if (blocked || busy) return
    onConfirm?.(mode === 'prompt' ? trimmed : true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          {mode === 'prompt' ? (
            <div className="space-y-1.5">
              <Label htmlFor="reason-confirm-input">{inputLabel}</Label>
              <Input
                id="reason-confirm-input"
                autoFocus
                value={value}
                placeholder={placeholder}
                disabled={busy}
                className="min-h-11"
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 cursor-pointer"
              disabled={busy}
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
              className={cn('min-h-11 cursor-pointer font-semibold')}
              disabled={busy || blocked}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

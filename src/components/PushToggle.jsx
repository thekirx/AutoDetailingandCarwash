import { useCallback, useEffect, useState } from 'react'
import { Bell, BellRing, ShieldCheck, Smartphone } from 'lucide-react'
import { disablePush, enablePush, getPushStatus, pushSupported, pushUnsupportedReason } from '@/lib/push'
import { getAccessTokenFresh } from '@/lib/authToken'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

/**
 * Branded Hakum push alerts control + modal.
 * @param {'customer'|'ops'} [audience]
 * @param {boolean} [autoPrompt] — open once when idle (customer account)
 */
export default function PushToggle({
  className = '',
  audience = 'customer',
  autoPrompt = false,
  compact = false,
  variant = 'default',
  surface = 'auto',
  layout = 'chips',
}) {
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const reason = pushUnsupportedReason()
  const ops = audience === 'ops' || variant === 'ops'
  const lightChips = surface === 'light' || ops

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setStatus('unsupported')
      return
    }
    setStatus(await getPushStatus())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!autoPrompt || status !== 'idle') return
    if (typeof localStorage !== 'undefined' && localStorage.getItem('hakum-push-prompt-v1')) return
    try {
      localStorage.setItem('hakum-prompt-busy', '1')
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setOpen(true), 1600)
    return () => {
      window.clearTimeout(t)
      try {
        localStorage.removeItem('hakum-prompt-busy')
      } catch {
        /* ignore */
      }
    }
  }, [autoPrompt, status])

  async function sessionToken() {
    const token = await getAccessTokenFresh()
    if (!token) throw new Error('Sign in again to manage alerts.')
    return token
  }

  async function turnOn() {
    setBusy(true)
    try {
      const token = await sessionToken()
      await enablePush(token)
      toast.success('Alerts on — you will get visit updates')
      await refresh()
      setOpen(false)
      try {
        localStorage.setItem('hakum-push-prompt-v1', '1')
      } catch {
        /* ignore */
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      const token = await sessionToken()
      await disablePush(token)
      toast.success('Alerts off')
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    try {
      const token = await sessionToken()
      const res = await fetch('/api/send-push', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selfTest: true,
          url: ops ? '/operations' : '/account',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Test push failed')
      if (!body.subscriptions) throw new Error('Enable alerts on this device first.')
      if (body.sent > 0) toast.success('Test alert sent')
      else toast.message('Saved — open from Home Screen (iOS) or use Chrome for delivery')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  function dismissPrompt() {
    setOpen(false)
    try {
      localStorage.setItem('hakum-push-prompt-v1', '1')
    } catch {
      /* ignore */
    }
  }

  if (status === 'unsupported') {
    if (compact) return null
    const tip =
      reason === 'ios-install'
        ? 'iPhone/iPad: Share, Add to Home Screen, then open Hakum and enable alerts.'
        : 'Install Hakum (Chrome/Edge or Home Screen) to unlock push alerts.'
    if (layout === 'panel') {
      return (
        <div className={`capp-pref ${className}`}>
          <div>
            <strong>Push on this device</strong>
            <em>{tip}</em>
          </div>
          <button type="button" className="capp-btn capp-btn-ghost" onClick={() => setOpen(true)}>
            How
          </button>
          <PushModal open={open} onOpenChange={(v) => (v ? setOpen(true) : dismissPrompt())} busy={busy} status={status} reason={reason} onEnable={turnOn} onDismiss={dismissPrompt} />
        </div>
      )
    }
    return (
      <>
        <button type="button" className={`push-chip push-chip-muted ${className}`} onClick={() => setOpen(true)}>
          <Smartphone className="size-4 shrink-0" aria-hidden />
          <span className="text-left leading-snug">{tip}</span>
        </button>
        <PushModal open={open} onOpenChange={(v) => (v ? setOpen(true) : dismissPrompt())} busy={busy} status={status} reason={reason} onEnable={turnOn} onDismiss={dismissPrompt} />
      </>
    )
  }

  const on = status === 'subscribed'
  const label = status === 'denied' ? 'Blocked in the browser' : on ? 'Push alerts on' : 'Push alerts off'
  const hint =
    status === 'denied'
      ? 'Allow notifications for this site, then try again.'
      : on
        ? 'Visit and floor updates on this device.'
        : 'Tap enable, then allow the browser prompt.'

  if (layout === 'panel') {
    return (
      <div className={className}>
        <div className="capp-pref">
          <div>
            <strong>{label}</strong>
            <em>{hint}</em>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy || status === 'loading' || status === 'denied'}
            className={`capp-switch${on ? ' is-on' : ''}`}
            onClick={() => (on ? turnOff() : setOpen(true))}
          >
            <span />
          </button>
        </div>
        {on && !compact ? (
          <button type="button" className="capp-btn capp-btn-ghost" disabled={busy} onClick={sendTest}>
            {busy ? 'Sending…' : 'Send test push'}
          </button>
        ) : null}
        <PushModal open={open} onOpenChange={(v) => (v ? setOpen(true) : dismissPrompt())} busy={busy} status={status} reason={reason} onEnable={turnOn} onDismiss={dismissPrompt} />
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`push-chip ${on ? 'push-chip-on' : 'push-chip-off'} ${lightChips ? 'push-chip-ops' : ''}`}
          disabled={busy || status === 'loading' || status === 'denied'}
          onClick={() => (on ? turnOff() : setOpen(true))}
        >
          {on ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
          <span>{status === 'denied' ? 'Blocked' : on ? 'Alerts on' : 'Enable alerts'}</span>
        </button>
        {on && !compact ? (
          <button type="button" className={`push-chip push-chip-ghost ${lightChips ? 'push-chip-ops' : ''}`} disabled={busy} onClick={sendTest}>
            Test alert
          </button>
        ) : null}
      </div>

      <PushModal open={open} onOpenChange={(v) => (v ? setOpen(true) : dismissPrompt())} busy={busy} status={status} reason={reason} onEnable={turnOn} onDismiss={dismissPrompt} />
    </div>
  )
}

function PushModal({ open, onOpenChange, busy, status, reason, onEnable, onDismiss }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="push-modal max-w-md gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="push-modal-head">
          <span className="push-modal-badge" aria-hidden>
            <BellRing className="size-6" />
          </span>
          <DialogHeader className="gap-2 text-left">
            <p className="text-[10px] font-extrabold tracking-[0.22em] text-white/60 uppercase">Hakum alerts</p>
            <DialogTitle className="text-2xl font-bold text-white">Never miss your car</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-white/75">
              Queue updates, payment ready, and finish notices — delivered on this device.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="push-modal-body space-y-3">
          <div className="push-modal-point">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            <span>Live visit status from the floor</span>
          </div>
          <div className="push-modal-point">
            <Bell className="size-4 text-primary" aria-hidden />
            <span>Ready for payment and service complete</span>
          </div>
          <div className="push-modal-point">
            <Smartphone className="size-4 text-primary" aria-hidden />
            <span>Best from the installed Hakum home-screen app</span>
          </div>
          {reason === 'ios-install' ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              On iPhone/iPad: Safari → Share → Add to Home Screen, open the icon, then Enable.
            </p>
          ) : null}
        </div>
        <DialogFooter className="push-modal-footer flex-col gap-2 sm:flex-col">
          <Button type="button" className="min-h-12 w-full text-base" disabled={busy || status === 'denied' || status === 'unsupported'} onClick={onEnable}>
            {busy ? 'Enabling…' : status === 'unsupported' ? 'Install app first' : 'Enable alerts'}
          </Button>
          <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={onDismiss}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

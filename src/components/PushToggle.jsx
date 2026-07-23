import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disablePush, enablePush, getPushStatus, pushSupported, pushUnsupportedReason } from '@/lib/push'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function PushToggle({ className = '', compact = false, variant = 'default' }) {
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)
  const reason = pushUnsupportedReason()

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

  async function sessionToken() {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Sign in to enable alerts.')
    return token
  }

  async function toggle() {
    setBusy(true)
    try {
      const token = await sessionToken()
      if (status === 'subscribed') {
        await disablePush(token)
        toast.success('Push alerts off')
      } else {
        await enablePush(token)
        toast.success('Push alerts on — keep this app installed for mobile')
      }
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          selfTest: true,
          url: variant === 'ops' ? '/operations' : '/account',
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Test push failed')
      if (!body.subscriptions) throw new Error('No subscription on this device — tap Enable alerts first.')
      if (body.sent > 0) toast.success('Test alert sent — check your notifications')
      else toast.message('Subscription saved, but the push service returned no delivery (try Chrome/Edge or installed PWA)')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'unsupported') {
    if (compact) return null
    const tip =
      reason === 'ios-install'
        ? 'iPhone/iPad: Share → Add to Home Screen, open Hakum from the icon, then enable alerts.'
        : 'Install Hakum to your Home Screen (Android/iOS) or use Chrome/Edge on desktop for push alerts.'
    return <p className={`text-xs text-muted-foreground ${className}`}>{tip}</p>
  }

  const on = status === 'subscribed'
  const ghostOps = variant === 'ops'
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={ghostOps ? (on ? 'secondary' : 'ghost') : on ? 'secondary' : 'outline'}
        size={compact ? 'icon' : 'sm'}
        className={ghostOps ? 'min-h-11 text-slate-100 hover:bg-white/10 hover:text-white' : ''}
        disabled={busy || status === 'loading' || status === 'denied'}
        onClick={toggle}
        aria-label={on ? 'Disable notifications' : 'Enable notifications'}
        title={status === 'denied' ? 'Blocked in browser settings' : on ? 'Disable alerts' : 'Enable alerts'}
      >
        {on ? <BellOff className={compact ? undefined : 'mr-1 size-4'} /> : <Bell className={compact ? undefined : 'mr-1 size-4'} />}
        {!compact && (status === 'denied' ? 'Blocked' : on ? 'Alerts on' : 'Enable alerts')}
      </Button>
      {on && !compact ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={sendTest} className={ghostOps ? 'min-h-11 border-white/20 text-slate-100 hover:bg-white/10' : ''}>
          Test alert
        </Button>
      ) : null}
    </div>
  )
}

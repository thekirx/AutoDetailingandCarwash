import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disablePush, enablePush, getPushStatus, pushSupported } from '@/lib/push'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function PushToggle({ className = '', compact = false }) {
  const [status, setStatus] = useState('loading')
  const [busy, setBusy] = useState(false)

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

  async function toggle() {
    setBusy(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in to enable alerts.')
      if (status === 'subscribed') {
        await disablePush(token)
        toast.success('Push alerts off')
      } else {
        await enablePush(token)
        toast.success('Push alerts on')
      }
      await refresh()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'unsupported') {
    return compact ? null : (
      <p className="text-xs text-muted-foreground">
        Install this app to your Home Screen (iOS/Android) for push alerts.
      </p>
    )
  }

  const on = status === 'subscribed'
  return (
    <Button
      type="button"
      variant={on ? 'secondary' : 'outline'}
      size={compact ? 'icon' : 'sm'}
      className={className}
      disabled={busy || status === 'loading' || status === 'denied'}
      onClick={toggle}
      aria-label={on ? 'Disable notifications' : 'Enable notifications'}
      title={status === 'denied' ? 'Blocked in browser settings' : on ? 'Disable alerts' : 'Enable alerts'}
    >
      {on ? <BellOff className={compact ? undefined : 'mr-1 size-4'} /> : <Bell className={compact ? undefined : 'mr-1 size-4'} />}
      {!compact && (status === 'denied' ? 'Blocked' : on ? 'Alerts on' : 'Enable alerts')}
    </Button>
  )
}

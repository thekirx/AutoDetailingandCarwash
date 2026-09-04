import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createCoalescedReload } from '@/lib/coalesceReload'
import { subscribeUserNotificationRealtime } from '@/lib/userNotificationsRealtime'

export function useUserNotifications() {
  const [rows, setRows] = useState([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        setRows([])
        setUnread(0)
        return
      }
      const { data } = await supabase
        .from('user_notifications')
        .select('id, title, body, url, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(20)
      const next = data || []
      setRows(next)
      setUnread(next.filter((r) => !r.read_at).length)
    } catch {
      /* ponytail: never crash the account shell for inbox */
    }
  }, [])

  const loadRef = useRef(load)
  loadRef.current = load
  const scheduleReload = useMemo(() => createCoalescedReload(() => loadRef.current(), 400), [])

  useEffect(() => {
    let alive = true
    let unsubscribe = () => {}
    load()
    void supabase.auth.getUser().then(({ data }) => {
      if (!alive || !data.user) return
      unsubscribe = subscribeUserNotificationRealtime(data.user.id, scheduleReload, supabase)
    })
    return () => {
      alive = false
      scheduleReload.cancel()
      unsubscribe()
    }
  }, [load, scheduleReload])

  const markRead = useCallback(
    async (row) => {
      if (!row?.id || row.read_at) return
      await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', row.id)
      load()
    },
    [load],
  )

  const markAllRead = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return
    await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userData.user.id)
      .is('read_at', null)
    load()
  }, [load])

  return { rows, unread, load, markRead, markAllRead }
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function NotificationBell({
  className = '',
  light = false,
  variant = 'default',
  homeUrl = '/account',
  homeLabel = 'Open my account',
}) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const { rows, unread, markRead, markAllRead } = useUserNotifications()
  const capp = variant === 'capp' || light

  useEffect(() => {
    function onDoc(e) {
      if (root.current && !root.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function openRow(row) {
    await markRead(row)
    setOpen(false)
  }

  const btn = capp
    ? 'capp-icon-btn'
    : light
      ? 'relative rounded-full p-2 text-white/90 hover:bg-white/10'
      : 'relative rounded-full p-2 text-foreground hover:bg-muted'

  return (
    <div className={`relative ${className}`} ref={root}>
      <button type="button" className={btn} aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className={capp ? 'capp-inbox-badge' : 'absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground'}>
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className={capp ? 'capp-inbox' : 'absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl'}>
          <div className={capp ? 'capp-inbox-head' : 'border-b border-border px-3 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase'}>
            <span>Alerts</span>
            {unread > 0 ? (
              <button type="button" className={capp ? 'capp-inbox-clear' : 'text-[11px] font-semibold text-primary'} onClick={markAllRead}>
                Mark read
              </button>
            ) : null}
          </div>
          <div className={capp ? 'capp-inbox-list' : 'max-h-80 overflow-y-auto'}>
            {!rows.length ? <p className={capp ? 'capp-inbox-empty' : 'px-3 py-4 text-sm text-muted-foreground'}>No alerts yet.</p> : null}
            {rows.map((row) => (
              <Link
                key={row.id}
                to={row.url || homeUrl}
                onClick={() => openRow(row)}
                className={capp ? `capp-inbox-row${row.read_at ? '' : ' is-new'}` : 'block border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/50'}
              >
                <strong>{row.title}</strong>
                <em>{row.body}</em>
                <span>{formatWhen(row.created_at)}</span>
              </Link>
            ))}
          </div>
          <Link to={homeUrl} onClick={() => setOpen(false)} className={capp ? 'capp-inbox-foot' : 'block px-3 py-2.5 text-center text-sm font-medium text-primary'}>
            {homeLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}

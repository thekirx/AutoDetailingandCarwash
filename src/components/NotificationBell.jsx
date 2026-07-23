import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function NotificationBell({ className = '', light = false }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [unread, setUnread] = useState(0)
  const root = useRef(null)

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session?.user) {
      setRows([])
      setUnread(0)
      return
    }
    const { data } = await supabase
      .from('user_notifications')
      .select('id, title, body, url, read_at, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    setRows(data || [])
    setUnread((data || []).filter((r) => !r.read_at).length)
  }, [])

  useEffect(() => {
    load()
    const channel = supabase
      .channel('user-notifications-bell')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications' }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    function onDoc(e) {
      if (root.current && !root.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function openRow(row) {
    if (!row.read_at) {
      await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', row.id)
      load()
    }
    setOpen(false)
  }

  const btn = light
    ? 'relative rounded-full p-2 text-white/90 hover:bg-white/10'
    : 'relative rounded-full p-2 text-foreground hover:bg-muted'

  return (
    <div className={`relative ${className}`} ref={root}>
      <button type="button" className={btn} aria-label="Notifications" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#052699] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="border-b border-border px-3 py-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Notifications
          </div>
          <div className="max-h-80 overflow-y-auto">
            {!rows.length && <p className="px-3 py-4 text-sm text-muted-foreground">No alerts yet.</p>}
            {rows.map((row) => (
              <Link
                key={row.id}
                to={row.url || '/account'}
                onClick={() => openRow(row)}
                className="block border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/50"
              >
                <span className={`block text-sm ${row.read_at ? 'font-normal' : 'font-semibold'}`}>{row.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{row.body}</span>
              </Link>
            ))}
          </div>
          <Link to="/account" onClick={() => setOpen(false)} className="block px-3 py-2.5 text-center text-sm font-medium text-primary">
            Open my account
          </Link>
        </div>
      )}
    </div>
  )
}

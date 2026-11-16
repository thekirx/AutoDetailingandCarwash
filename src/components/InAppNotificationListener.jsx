import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import {
  buildForegroundToastData,
  playGentleNotificationChime,
  rememberNotificationId,
} from '@/lib/inAppNotifications'
import { syncAppBadge } from '@/lib/pwaUpdates'
import { supabase } from '@/lib/supabase'
import { subscribeUserNotificationRealtime } from '@/lib/userNotificationsRealtime'

/**
 * Global foreground in-app notification + OS badge synchronizer for signed-in
 * customers and staff across web, Windows PWA, Android PWA, and iOS Home Screen PWA.
 */
export default function InAppNotificationListener() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const seenIdsRef = useRef(new Set())
  const roleRef = useRef(profile?.role || '')
  roleRef.current = profile?.role || ''

  const surfaceNotification = useCallback(
    (row) => {
      if (!rememberNotificationId(seenIdsRef.current, row?.id)) return
      const item = buildForegroundToastData(row, roleRef.current)
      if (!item) return
      playGentleNotificationChime()
      toast.message(item.title, {
        id: item.id ? `hakum-notif-${item.id}` : undefined,
        description: item.body || undefined,
        duration: 6000,
        action: item.href
          ? {
              label: 'Open',
              onClick: () => navigate(item.href),
            }
          : undefined,
      })
    },
    [navigate],
  )

  const syncUnreadAndCatchUp = useCallback(async (seedOnly = false) => {
    if (!user?.id) {
      await syncAppBadge(0)
      return
    }
    try {
      const { data } = await supabase
        .from('user_notifications')
        .select('id, title, body, url, kind, read_at, created_at')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(12)
      const rows = data || []
      await syncAppBadge(rows.length)
      if (seedOnly) {
        for (const r of rows) rememberNotificationId(seenIdsRef.current, r.id)
        return
      }
      // Show only very fresh unseen unread rows created in the last 3 minutes when returning online/foreground
      const cutoff = Date.now() - 3 * 60 * 1000
      for (const r of [...rows].reverse()) {
        const createdMs = r?.created_at ? Date.parse(r.created_at) : 0
        if (createdMs && createdMs >= cutoff) {
          surfaceNotification(r)
        } else {
          rememberNotificationId(seenIdsRef.current, r.id)
        }
      }
    } catch {
      /* ignore transient offline */
    }
  }, [user?.id, surfaceNotification])

  useEffect(() => {
    if (!user?.id) {
      seenIdsRef.current.clear()
      void syncAppBadge(0)
      return undefined
    }

    void syncUnreadAndCatchUp(true)

    const unsub = subscribeUserNotificationRealtime(
      user.id,
      (payload) => {
        if (payload?.eventType === 'INSERT' && payload?.new) {
          surfaceNotification(payload.new)
        }
        void syncUnreadAndCatchUp(true)
      },
      supabase,
    )

    const onWake = () => {
      if (document.visibilityState === 'visible') {
        void syncUnreadAndCatchUp(false)
      }
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)

    return () => {
      unsub()
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [user?.id, surfaceNotification, syncUnreadAndCatchUp])

  return null
}

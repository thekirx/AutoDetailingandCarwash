import { useCallback, useEffect, useMemo, useState } from 'react'
import { createCoalescedReload } from './coalesceReload'
import { PUBLIC_QUEUE_POLL_MS, queueCountsFromRow } from './liveQueuePath'
import { supabase } from './supabase'

/** Poll count view only. No WAL subscription, no booking rows. */
export function usePublicQueueCounts() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState(null)

  const reload = useCallback(async () => {
    const { data, error: nextError } = await supabase
      .from('public_queue_counts')
      .select('branch, waiting_count, in_progress_count, final_checking_count, total_active_count')
    if (nextError) {
      setError(nextError.message)
      setLoading(false)
      return
    }
    setRows(data || [])
    setError('')
    setUpdatedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const scheduleReload = createCoalescedReload(() => reload(), 400)
    const timer = window.setInterval(() => scheduleReload(), PUBLIC_QUEUE_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleReload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      scheduleReload.cancel()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  const countsBySlug = useMemo(() => {
    const map = {}
    for (const row of rows) map[row.branch] = queueCountsFromRow(row)
    return map
  }, [rows])

  return { countsBySlug, rows, loading, error, updatedAt, reload }
}

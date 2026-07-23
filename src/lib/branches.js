import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const BRANCH_SELECT = 'slug, name, address, code, latitude, longitude, coming_soon, is_active'

/**
 * Public branch lists.
 * @param {{ mode?: 'bookable' | 'visible' }} opts
 * - bookable: open for queue/booking (active, not coming soon)
 * - visible: active OR coming soon (marketing / branches page)
 */
export async function fetchPublicBranches({ mode = 'bookable' } = {}) {
  let q = supabase
    .from('branches')
    .select(BRANCH_SELECT)
    .eq('is_archived', false)
    .order('name')

  if (mode === 'bookable') {
    q = q.eq('is_active', true).eq('coming_soon', false)
  } else {
    q = q.or('is_active.eq.true,coming_soon.eq.true')
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data || []
}

export function usePublicBranches({ mode = 'bookable' } = {}) {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchPublicBranches({ mode })
      .then((rows) => {
        if (active) setBranches(rows)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [mode])

  return { branches, loading, error }
}

export function branchLabel(count) {
  if (count === 1) return 'One branch'
  return `${count} branches`
}

export function branchStatusLabel(row) {
  if (row?.is_archived) return 'Archived'
  if (row?.coming_soon) return 'Coming soon'
  if (row?.is_active) return 'Active'
  return 'Inactive'
}

/** Display name map from slug → name for ops tables that only store slug. */
export function branchNameMap(rows = []) {
  const map = Object.create(null)
  for (const row of rows) map[row.slug] = row.name
  return map
}

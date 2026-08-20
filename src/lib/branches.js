import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const BRANCH_SELECT = 'slug, name, address, code, latitude, longitude, coming_soon, is_active'

/* Added by the branch_operating_hours migration. Selected separately so the
   site keeps working on an environment where that migration has not been
   applied yet — PostgREST rejects the whole select for one unknown column,
   which would otherwise take out every branch list on the public site. */
const BRANCH_HOURS_SELECT = 'opens_at, closes_at, closed_weekdays'

function branchQuery(select, mode) {
  let q = supabase
    .from('branches')
    .select(select)
    .eq('is_archived', false)
    .order('name')

  if (mode === 'bookable') {
    q = q.eq('is_active', true).eq('coming_soon', false)
  } else {
    q = q.or('is_active.eq.true,coming_soon.eq.true')
  }
  return q
}

/**
 * Public branch lists.
 * @param {{ mode?: 'bookable' | 'visible' }} opts
 * - bookable: open for queue/booking (active, not coming soon)
 * - visible: active OR coming soon (marketing / branches page)
 */
export async function fetchPublicBranches({ mode = 'bookable' } = {}) {
  const withHours = await branchQuery(`${BRANCH_SELECT}, ${BRANCH_HOURS_SELECT}`, mode)
  if (!withHours.error) return withHours.data || []

  const { data, error } = await branchQuery(BRANCH_SELECT, mode)
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

/**
 * Short display name for a branch — the city, without the brand prefix or a
 * trailing "Branch". Keeps mixed records ("Hakum Auto Care Bacoor",
 * "Dasmarinas Branch") reading consistently in lists and the hero location line.
 */
export function branchCityName(row) {
  const name = row?.name || ''
  const short = name.replace(/^Hakum Auto Care\s*/i, '').replace(/\s*Branch$/i, '').trim()
  return short || name
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

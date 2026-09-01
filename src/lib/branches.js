import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

const BRANCH_SELECT = 'slug, name, address, code, latitude, longitude, coming_soon, is_active, is_public'

/* Opening hours live in their own table (one row per weekday per branch), so
   they are fetched separately and attached as `hours`. Fetched best-effort:
   on an environment without that table the branch lists still render, just
   without any open/closed claim. */
async function attachHours(rows) {
  if (!rows.length) return rows
  const { data, error } = await supabase
    .from('branch_operating_hours')
    .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
    .in('branch_slug', rows.map((row) => row.slug))
  if (error) return rows.map((row) => ({ ...row, hours: [] }))

  const bySlug = new Map()
  for (const entry of data || []) {
    if (!bySlug.has(entry.branch_slug)) bySlug.set(entry.branch_slug, [])
    bySlug.get(entry.branch_slug).push(entry)
  }
  return rows.map((row) => ({ ...row, hours: bySlug.get(row.slug) || [] }))
}

function branchQuery(select, mode) {
  let q = supabase
    .from('branches')
    .select(select)
    .eq('is_archived', false)
    // Back-office locations such as HQ are active and unarchived, so nothing
    // else here excludes them. They are not places a customer brings a car.
    .eq('is_public', true)
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
  const { data, error } = await branchQuery(BRANCH_SELECT, mode)
  if (error) throw new Error(error.message)
  return attachHours(data || [])
}

/** Map branch_slug → week rows for public /branches cards. */
export async function fetchPublicBranchHours(slugs = []) {
  const list = [...new Set((slugs || []).map((s) => String(s || '').trim()).filter(Boolean))]
  if (!list.length) return {}
  const { data, error } = await supabase
    .from('branch_operating_hours')
    .select('branch_slug, day_of_week, opens_at, closes_at, is_closed')
    .in('branch_slug', list)
    .order('day_of_week')
  if (error) throw new Error(error.message)
  const hoursBySlug = Object.create(null)
  for (const row of data || []) {
    const key = row.branch_slug
    if (!hoursBySlug[key]) hoursBySlug[key] = []
    hoursBySlug[key].push(row)
  }
  return hoursBySlug
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

export { requireBranchSlug, branchSlugsForOwnPay } from './branchScope.js'


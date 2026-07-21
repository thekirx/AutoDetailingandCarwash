import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

/** Active branches for public + anon flows (booking, queue, landing). */
export async function fetchPublicBranches() {
  const { data, error } = await supabase
    .from('branches')
    .select('slug, name, address, code')
    .eq('is_active', true)
    .eq('is_archived', false)
    .order('name')
  if (error) throw new Error(error.message)
  return data || []
}

export function usePublicBranches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchPublicBranches()
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
  }, [])

  return { branches, loading, error }
}

export function branchLabel(count) {
  if (count === 1) return 'One branch'
  return `${count} branches`
}

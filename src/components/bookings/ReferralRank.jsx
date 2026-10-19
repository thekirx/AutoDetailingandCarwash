import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { rankReferrals } from '@/lib/referralSource'

function pct(share) {
  return `${Math.round((share || 0) * 100)}%`
}

function Bars({ rows, labelKey }) {
  const top = rows[0]?.count || 1
  return (
    <ol className="space-y-2">
      {rows.map((row) => (
        <li key={row.id || row.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-foreground">{row[labelKey]}</span>
            <span className="shrink-0 tabular-nums text-foreground">
              {row.count} · {pct(row.share)}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(row.count / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Ranked referral sources for the SA / ASA floor, using the board's timeline and branch. */
export default function ReferralRank({ start, end, branch = 'all' }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const from = start instanceof Date ? start.toISOString() : start
    const to = end instanceof Date ? end.toISOString() : end
    if (!from || !to) return undefined
    let query = supabase
      .from('bookings')
      .select('referral_source, referred_by_name, created_at, branch')
      .eq('is_archived', false)
      .gte('created_at', from)
      .lte('created_at', to)
      .limit(1000)
    if (branch && branch !== 'all') query = query.eq('branch', branch)
    query.then(({ data, error: queryError }) => {
      if (cancelled) return
      if (queryError) {
        setError(queryError.message)
        setRows([])
        return
      }
      setError('')
      setRows(data || [])
    })
    return () => {
      cancelled = true
    }
  }, [start, end, branch])

  const ranked = rankReferrals(rows)

  return (
    <section className="mt-6" aria-label="Highest referrals">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Highest referrals</h2>
        <p className="text-sm text-muted-foreground">
          {ranked.answered} of {ranked.total} bookings named a source
        </p>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>
      ) : null}
      {!error && ranked.answered === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No referral answers in this timeline.</p>
      ) : null}
      {ranked.answered > 0 ? (
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">By source</h3>
            <Bars rows={ranked.sources} labelKey="label" />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">Talked to an employee</h3>
            {ranked.staff.length ? (
              <Bars rows={ranked.staff} labelKey="name" />
            ) : (
              <p className="text-sm text-muted-foreground">No staff names in this timeline.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessReviews, getBranchScopeList, canSeeAllBranches } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function ReviewsPage() {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState([])
  const [branches, setBranches] = useState([])
  const [branchFilter, setBranchFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const seeAll = canSeeAllBranches(profile)

  useEffect(() => {
    listBranches().then(setBranches).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('service_reviews')
      .select(
        'id, overall_rating, app_rating, service_rating, detailing_rating, comment, branch, customer_name, created_at, customers(full_name)',
      )
      .order('created_at', { ascending: false })
      .limit(200)
    if (branchFilter && branchFilter !== 'all') {
      q = q.eq('branch', branchFilter)
    } else if (!seeAll) {
      const scope = getBranchScopeList(profile)
      if (Array.isArray(scope) && scope.length) q = q.in('branch', scope)
    }
    const { data, error } = await q
    if (error) toast.error(error.message)
    setReviews(data || [])
    setLoading(false)
  }, [branchFilter, profile, seeAll])

  useEffect(() => {
    load()
  }, [load])

  const avg = useMemo(() => {
    if (!reviews.length) return 0
    return reviews.reduce((s, r) => s + Number(r.overall_rating || 0), 0) / reviews.length
  }, [reviews])

  if (!canAccessReviews(profile)) return <Navigate to="/operations/access-denied" replace />

  const branchOptions = seeAll
    ? [{ slug: 'all', name: 'All branches' }, ...branches]
    : (getBranchScopeList(profile) || []).map((slug) => ({
        slug,
        name: branches.find((b) => b.slug === slug)?.name || slug,
      }))

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-primary uppercase">Operations</p>
        <h1 className="text-3xl font-semibold tracking-tight">Service Reviews</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Customer ratings after completed visits. Average {avg ? avg.toFixed(1) : '—'} / 5 across {reviews.length}{' '}
          review(s).
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {(seeAll || branchOptions.length > 1) && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="min-h-11 w-48">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {seeAll && <SelectItem value="all">All branches</SelectItem>}
              {branchOptions
                .filter((b) => b.slug !== 'all')
                .map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Reviews" value={reviews.length} />
        <StatCard label="Average rating" value={avg ? avg.toFixed(1) : '—'} />
        <StatCard label="5-star" value={reviews.filter((r) => Number(r.overall_rating) === 5).length} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{r.customer_name || r.customers?.full_name || 'Customer'}</CardTitle>
                  <Badge variant="outline" className="capitalize">
                    {r.branch || '—'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      className={`size-4 ${i < (r.overall_rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                  <span className="ml-2 text-sm font-semibold tabular-nums">{r.overall_rating}/5</span>
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
        <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

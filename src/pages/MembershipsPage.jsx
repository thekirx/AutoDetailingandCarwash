import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { isAdmin } from '@/auth/permissions'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

export default function MembershipsPage() {
  const { profile } = useAuth()
  const [tiers, setTiers] = useState([])

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('membership_tiers').select('*').order('starting_price_minor')
    if (error) toast.error(error.message)
    setTiers(data || [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!isAdmin(profile)) return <Navigate to="/operations/access-denied" replace />

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Membership</p>
        <h1 className="text-3xl font-semibold tracking-tight">Premium plans</h1>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {tiers.map((tier) => (
          <Card key={tier.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle>{tier.name}</CardTitle>
              {tier.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-3xl font-semibold">{formatMoney(tier.starting_price_minor)}</p>
              <p className="text-sm text-muted-foreground">Loyalty multiplier ×{tier.loyalty_multiplier} · {tier.discount_percent}% off</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {(tier.benefits || []).map((b) => <li key={b}>{b}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">Includes: {(tier.included_services || []).join(', ') || '—'}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

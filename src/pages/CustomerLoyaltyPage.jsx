import { useEffect, useState } from 'react'
import { Cake, Check, Gift, Percent, Star } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import { Row, SectionHead, Skeleton, Stat } from '@/components/customer/CustomerUi'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_LOYALTY_PATH } from '@/lib/customerAccountNav'
import { usePageMeta } from '@/lib/pageMeta'

/** /account/loyalty — stamps, next reward, membership, points. All values from /api/customer-portal. */
export default function CustomerLoyaltyPage() {
  usePageMeta({ title: 'Loyalty program', description: 'Wash more. Get rewarded.', path: CUSTOMER_LOYALTY_PATH })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPortal().then(setData).catch((err) => setError(err.message))
  }, [])

  const loyalty = data?.loyalty
  const birthday = data?.birthday
  const slots = Number(loyalty?.cardSlots) || 10
  const completed = Math.min(Number(loyalty?.completed) || 0, slots)
  const giftAt = new Set((loyalty?.milestones || []).map((m) => Number(m.threshold_points)))

  return (
    <CustomerAppFrame title="Loyalty program" subtitle="Wash more. Get rewarded." backTo="/account" cols>
      {error ? (
        <div className="capp-empty capp-span" role="alert">
          <strong>{error}</strong>
        </div>
      ) : null}

      {!data && !error ? (
        <div className="capp-span">
          <Skeleton n={2} />
        </div>
      ) : null}

      {loyalty && loyalty.stampsEnabled !== false ? (
        <section className="capp-card" aria-label="Your stamps">
          <div className="capp-card-row">
            <h2 className="capp-title">Your stamps</h2>
            <p className="capp-count">
              <b>{completed}</b> / {slots}
            </p>
          </div>
          <ol className="capp-stamps" aria-label={`${completed} of ${slots} stamps`}>
            {Array.from({ length: slots }, (_, i) => {
              const n = i + 1
              const on = n <= completed
              const gift = giftAt.has(n)
              return (
                <li key={n} className={`capp-stamp${on ? ' is-on' : ''}${gift && !on ? ' is-gift' : ''}`} aria-label={on ? `Stamp ${n} earned` : `Stamp ${n}`}>
                  {on ? <Check size={14} strokeWidth={2.5} aria-hidden /> : gift ? <Gift size={13} strokeWidth={2} aria-hidden /> : n}
                </li>
              )
            })}
          </ol>
          {loyalty.nextMilestone ? (
            <Row
              icon={Gift}
              title={`Next reward: ${loyalty.nextMilestone.reward_label}`}
              sub={`at ${loyalty.nextMilestone.threshold_points} stamps`}
            />
          ) : (
            <p className="capp-meta">{loyalty.encouragement}</p>
          )}
        </section>
      ) : data ? (
        <div className="capp-empty">
          <strong>Stamps are paused right now</strong>
          Completed visits still count toward your history.
        </div>
      ) : null}

      {loyalty?.pointsEnabled || loyalty?.membership ? (
        <div className="capp-stats" style={{ gridTemplateColumns: loyalty.pointsEnabled && loyalty.membership ? undefined : '1fr' }}>
          {loyalty.pointsEnabled ? <Stat value={loyalty.loyaltyPoints ?? 0} label="Spend points" /> : null}
          {loyalty.membership ? <Stat value={loyalty.membership.tier_name} label="Membership" /> : null}
        </div>
      ) : null}

      {loyalty ? (
        <section className="capp-section" aria-label="Member benefits">
          <SectionHead title="Member benefits" />
          <div className="capp-group">
            {loyalty.membership?.discount_percent != null ? (
              <Row icon={Percent} title={`${loyalty.membership.discount_percent}% member discount`} sub={loyalty.membership.ends_at ? `Until ${loyalty.membership.ends_at}` : 'Active'} />
            ) : null}
            {(loyalty.milestones || []).map((m) => {
              const earned = completed >= Number(m.threshold_points)
              return (
                <Row
                  key={m.id || m.threshold_points}
                  icon={earned ? Check : Star}
                  title={m.reward_label}
                  sub={earned ? 'Earned' : `At ${m.threshold_points} stamps`}
                />
              )
            })}
            <Row
              icon={Cake}
              title="Birthday carwash"
              sub={
                birthday?.perk
                  ? 'Your free service is ready. Show this at any branch.'
                  : birthday?.date_of_birth
                    ? 'One free service on your birthday month.'
                    : 'Add your birthday in Settings to unlock.'
              }
              to={birthday?.date_of_birth ? undefined : '/account/more?tab=account'}
              chevron={!birthday?.date_of_birth}
            />
          </div>
        </section>
      ) : null}
    </CustomerAppFrame>
  )
}

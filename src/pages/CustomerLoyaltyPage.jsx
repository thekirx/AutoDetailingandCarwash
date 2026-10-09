import { useEffect, useState } from 'react'
import { Cake, Check, Gift, Percent, Star } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import StampTrack from '@/components/customer/StampTrack'
import { Row, SectionHead, Skeleton, Stat } from '@/components/customer/CustomerUi'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_LOYALTY_PATH } from '@/lib/customerAccountNav'
import { usePageMeta } from '@/lib/pageMeta'

/** /account/loyalty — stamps, next reward, membership, points. All values from /api/customer-portal. */
export default function CustomerLoyaltyPage() {
  usePageMeta({ title: 'Rewards', description: 'A stamp for every paid visit.', path: CUSTOMER_LOYALTY_PATH })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPortal().then(setData).catch((err) => setError(err.message))
  }, [])

  const loyalty = data?.loyalty
  const birthday = data?.birthday
  const slots = Number(loyalty?.cardSlots) || 10
  const completed = Math.min(Number(loyalty?.completed) || 0, slots)
  const next = loyalty?.nextMilestone
  const nextAt = Number(next?.threshold_points) || slots
  const nextPct = Math.min(100, Math.round((completed / Math.max(nextAt, 1)) * 100))
  const name = data?.profile?.full_name || ''

  return (
    <CustomerAppFrame title="Rewards" subtitle="A stamp for every paid visit." cols>
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
        <>
          <section className="capp-card capp-pass" aria-label="Your stamps">
            <div className="capp-pass-head">
              <img src="/branding/hakum-mark-ow.png" alt="" width="44" height="44" decoding="async" />
              <span>Member</span>
            </div>
            <h2 className="capp-title sr-only">Your stamps</h2>
            <p className="capp-count capp-pass-count">
              <b>{completed}</b> of {slots} stamps
            </p>
            <p className="capp-pass-line">
              {next
                ? `${Math.max(0, nextAt - completed)} more ${nextAt - completed === 1 ? 'visit' : 'visits'} to ${next.reward_label}`
                : loyalty.encouragement || 'Every reward earned. Show this at the counter.'}
            </p>
            <StampTrack
              slots={slots}
              completed={completed}
              gifts={(loyalty.milestones || []).map((m) => m.threshold_points)}
            />
            <div className="capp-pass-foot">
              <span>
                <b>{name || 'Hakum member'}</b>
                {loyalty.membership?.tier_name || 'Loyalty card'}
              </span>
              {loyalty.pointsEnabled ? (
                <span className="is-end">
                  <b>{loyalty.loyaltyPoints ?? 0}</b>
                  spend points
                </span>
              ) : null}
            </div>
          </section>
          {next ? (
            <div className="capp-next">
              <span className="capp-ring" style={{ '--p': nextPct }} aria-hidden>
                <b>
                  {completed}/{nextAt}
                </b>
              </span>
              <Row icon={Gift} title={`Next reward: ${next.reward_label}`} sub={`at ${next.threshold_points} stamps`} />
            </div>
          ) : (
            <p className="capp-meta">{loyalty.encouragement}</p>
          )}
        </>
      ) : data ? (
        <div className="capp-empty">
          <strong>Stamps are paused right now</strong>
          Completed visits still count toward your history.
        </div>
      ) : null}

      {/* Points ride on the pass when stamps are on; on their own otherwise. */}
      {(loyalty?.pointsEnabled && loyalty?.stampsEnabled === false) || loyalty?.membership ? (
        <div className="capp-stats" style={{ gridTemplateColumns: loyalty.pointsEnabled && loyalty.stampsEnabled === false && loyalty.membership ? undefined : '1fr' }}>
          {loyalty.pointsEnabled && loyalty.stampsEnabled === false ? <Stat value={loyalty.loyaltyPoints ?? 0} label="Spend points" /> : null}
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

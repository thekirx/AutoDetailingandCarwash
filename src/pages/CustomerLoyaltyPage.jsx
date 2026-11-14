import PointsShop from '@/components/customer/PointsShop'
import { useEffect, useState } from 'react'
import { Car, Check, Gift } from 'lucide-react'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import StampTrack from '@/components/customer/StampTrack'
import { BirthdayPass } from '@/components/customer/BirthdayGreeting'
import Sheet from '@/components/customer/Sheet'
import ReferralCard from '@/components/customer/ReferralCard'
import { memberTier } from '@/lib/rewardsCatalog'
import { Row, SectionHead, Skeleton, Stat } from '@/components/customer/CustomerUi'
import { fetchPortal } from '@/lib/customerPortalClient'
import { CUSTOMER_LOYALTY_PATH } from '@/lib/customerAccountNav'
import { usePageMeta } from '@/lib/pageMeta'

/** /account/loyalty — tier, stamps (tap a gift for its reward), how stamps work, points shop. All values from /api/customer-portal. */
export default function CustomerLoyaltyPage() {
  usePageMeta({ title: 'Rewards', description: 'A stamp for every paid visit.', path: CUSTOMER_LOYALTY_PATH })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [giftAt, setGiftAt] = useState(null)

  useEffect(() => {
    fetchPortal().then(setData).catch((err) => setError(err.message))
  }, [])

  // /refer "Get my link" lands on #refer once the card has rendered.
  useEffect(() => {
    if (!data?.referral || window.location.hash !== '#refer') return
    document.getElementById('refer')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [data])

  const loyalty = data?.loyalty
  const birthday = data?.birthday
  const slots = Number(loyalty?.cardSlots) || 10
  const completed = Math.min(Number(loyalty?.completed) || 0, slots)
  const next = loyalty?.nextMilestone
  const nextAt = Number(next?.threshold_points) || slots
  const milestones = loyalty?.milestones || []
  const giftMilestone = milestones.find((m) => Number(m.threshold_points) === giftAt) || null
  const name = data?.profile?.full_name || ''
  const visits = Number(loyalty?.visitCount) || 0
  const tier = memberTier(visits)
  const rewardStamps = milestones.map((m) => Number(m.threshold_points)).filter(Boolean)
  const rewardNames = [...new Set(milestones.map((m) => m.reward_label).filter(Boolean))]

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

      {birthday?.perk ? (
        <BirthdayPass
          name={name}
          plate={data?.vehicles?.[0]?.plate_number}
          dateOfBirth={birthday.date_of_birth}
          perk={birthday.perk}
        />
      ) : null}

      {loyalty && loyalty.stampsEnabled !== false ? (
        <>
          <section className="capp-card capp-pass" aria-label="Your stamps">
            <div className="capp-pass-head">
              <img src="/branding/hakum-mark-ow.png" alt="" width="44" height="44" decoding="async" />
              <span className="capp-pass-tier">{loyalty.membership?.tier_name || tier.name}</span>
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
            <StampTrack slots={slots} completed={completed} gifts={rewardStamps} onGift={setGiftAt} />
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
          <section className="capp-section" aria-label="How stamps work">
            <SectionHead title="How stamps work" />
            <div className="capp-group">
              <Row icon={Check} title="1 paid visit = 1 stamp" sub="Stamped at the counter when you pay" />
              <Row icon={Car} title="Any car on your account" sub="All your cars fill the same card" />
              {rewardStamps.length ? (
                <Row
                  icon={Gift}
                  title={`${rewardNames.join(' / ') || 'A reward'} at ${rewardStamps.join(' and ')}`}
                  sub="Tap a gift on the card to see it"
                />
              ) : null}
            </div>
          </section>
          <Sheet open={Boolean(giftMilestone)} onClose={() => setGiftAt(null)} title={giftMilestone ? `Stamp ${giftMilestone.threshold_points}` : ''}>
            {giftMilestone ? (
              <div className="capp-gift-sheet">
                <span className="capp-row-icon capp-gift-sheet-icon" aria-hidden>
                  <Gift size={30} strokeWidth={1.75} />
                </span>
                <h3 className="capp-title">{giftMilestone.reward_label}</h3>
                <p className="capp-meta">
                  {completed >= Number(giftMilestone.threshold_points)
                    ? 'Earned. Ask the branch to use it on your next visit.'
                    : `Unlocks at ${giftMilestone.threshold_points} stamps. You have ${completed}, so ${Number(giftMilestone.threshold_points) - completed} more paid ${Number(giftMilestone.threshold_points) - completed === 1 ? 'visit' : 'visits'}.`}
                </p>
                <button type="button" className="capp-btn capp-btn-fill capp-btn-block" onClick={() => setGiftAt(null)}>
                  Got it
                </button>
              </div>
            ) : null}
          </Sheet>
        </>
      ) : data ? (
        <div className="capp-empty">
          <strong>Stamps are paused right now</strong>
          Completed visits still count toward your history.
        </div>
      ) : null}

      {data ? <PointsShop data={data} onRefresh={setData} /> : null}

      {/* Points ride on the pass when stamps are on; on their own otherwise. */}
      {(loyalty?.pointsEnabled && loyalty?.stampsEnabled === false) || loyalty?.membership ? (
        <div className="capp-stats" style={{ gridTemplateColumns: loyalty.pointsEnabled && loyalty.stampsEnabled === false && loyalty.membership ? undefined : '1fr' }}>
          {loyalty.pointsEnabled && loyalty.stampsEnabled === false ? <Stat value={loyalty.loyaltyPoints ?? 0} label="Spend points" /> : null}
          {loyalty.membership ? <Stat value={loyalty.membership.tier_name} label="Membership" /> : null}
        </div>
      ) : null}

      {data?.referral ? <ReferralCard referral={data.referral} /> : null}

    </CustomerAppFrame>
  )
}

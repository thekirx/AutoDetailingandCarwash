import { Suspense, lazy, useMemo } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Crown, Gift, ShoppingBag, Sparkles, TicketPercent } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessMemberships,
  canAccessRewardsHub,
  canManageMerchShop,
  canManageServices,
  canViewVouchers,
  isSuperAdmin,
} from '@/auth/permissions'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import ReferralProgramCard from '@/components/ops/ReferralProgramCard'
import ReferralSettingsCard from '@/components/ops/ReferralSettingsCard'
import { resolveOpsTab } from '@/lib/opsShell'
import { Tabs, TabsContent } from '@/components/ui/tabs'

const MembershipsPage = lazy(() => import('@/pages/MembershipsPage'))
const VouchersPage = lazy(() => import('@/pages/VouchersPage'))
const MerchShopPage = lazy(() => import('@/pages/MerchShopPage'))

const REWARDS_SHELL_TABS = Object.freeze([
  { id: 'memberships', label: 'Memberships & Loyalty', icon: Crown },
  { id: 'vouchers', label: 'Vouchers', icon: TicketPercent },
  { id: 'points-shop', label: 'Sellables for Points', icon: ShoppingBag },
  { id: 'referrals', label: 'Referrals & Bonuses', icon: Sparkles },
])

const REWARDS_GUIDE_STEPS = Object.freeze([
  {
    id: 'memberships',
    title: 'Memberships & Loyalty',
    body: 'Control stamp card vs spend points, loyalty tiers, thresholds, and service multipliers.',
  },
  {
    id: 'vouchers',
    title: 'Vouchers',
    body: 'Mint promo codes with percent/fixed/free discounts, service rules, and usage caps.',
  },
  {
    id: 'points-shop',
    title: 'Sellables for Points',
    body: 'Choose merch items customers can claim in the app and hand over redemptions at branches.',
  },
  {
    id: 'referrals',
    title: 'Referrals & Bonuses',
    body: 'Set friend-referral points, detailing discount %, yearly caps, and validity.',
  },
])

export default function RewardsPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const canMemberships = canAccessMemberships(profile)
  const canVouchers = canViewVouchers(profile)
  const canMerch = canManageMerchShop(profile)
  const canReferrals = isSuperAdmin(profile) || canManageServices(profile)

  const visibleTabs = useMemo(
    () =>
      REWARDS_SHELL_TABS.filter((t) => {
        if (t.id === 'memberships') return canMemberships
        if (t.id === 'vouchers') return canVouchers
        if (t.id === 'points-shop') return canMerch
        if (t.id === 'referrals') return canReferrals
        return false
      }),
    [canMemberships, canVouchers, canMerch, canReferrals],
  )

  if (!canAccessRewardsHub(profile) || !visibleTabs.length) {
    return <Navigate to="/operations/access-denied" replace />
  }

  const defaultTab = visibleTabs[0].id
  const tab = resolveOpsTab(searchParams.get('tab'), visibleTabs.map((t) => t.id), defaultTab)

  function setShellTab(next) {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (next === defaultTab) n.delete('tab')
      else n.set('tab', next)
      if (next !== 'memberships') n.delete('mtab')
      return n
    }, { replace: true })
  }

  const guideIcons = {
    memberships: Crown,
    vouchers: TicketPercent,
    'points-shop': ShoppingBag,
    referrals: Sparkles,
  }

  return (
    <OpsPageShell
      className="hakum-rewards"
      eyebrow="Loyalty"
      title="Rewards & Loyalty"
      icon={Gift}
      description="Memberships, stamp rules, promo vouchers, points-shop sellables, and friend referrals in one place."
    >
      <OpsGuideCard
        title="How rewards work"
        description="Manage every loyalty, promo, and points-redemption setting here. POS and the customer app follow these rules live."
        steps={REWARDS_GUIDE_STEPS.filter((s) => visibleTabs.some((t) => t.id === s.id))}
        stepIcons={guideIcons}
      />

      <Tabs value={tab} onValueChange={setShellTab}>
        <OpsTabList tabs={visibleTabs} aria-label="Rewards sections" />

        {canMemberships ? (
          <TabsContent value="memberships" className="mt-6">
            <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading memberships…</p>}>
              <MembershipsPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}

        {canVouchers ? (
          <TabsContent value="vouchers" className="mt-6">
            <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading vouchers…</p>}>
              <VouchersPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}

        {canMerch ? (
          <TabsContent value="points-shop" className="mt-6">
            <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading sellables for points…</p>}>
              <MerchShopPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}

        {canReferrals ? (
          <TabsContent value="referrals" className="mt-6 flex flex-col gap-6">
            <ReferralProgramCard />
            <ReferralSettingsCard canEdit />
          </TabsContent>
        ) : null}
      </Tabs>
    </OpsPageShell>
  )
}

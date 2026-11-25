import { Link, Navigate } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessPos, canAccessSettings, canWritePosSettings } from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import PosSettingsPanel from '@/pages/pos/PosSettingsPanel'

/** Settings → POS: payment methods, expense kinds, shift-close field editor. */
export default function PosSettingsPage() {
  const { profile } = useAuth()
  if (!canAccessPos(profile) && !canWritePosSettings(profile) && !canAccessSettings(profile)) {
    return <Navigate to="/operations/access-denied" replace />
  }
  const hasSettings = canAccessSettings(profile)
  const backTo = hasSettings ? '/operations/settings' : '/operations/pos'
  const backLabel = hasSettings ? '← Company settings' : '← Back to POS'
  return (
    <OpsPageShell
      className="hakum-pos-settings"
      eyebrow="Settings"
      title="POS settings"
      icon={ShoppingCart}
      breadcrumbs={[{ label: hasSettings ? 'Settings' : 'POS', to: backTo }, { label: 'POS settings' }]}
      description="Payment methods, POS expense kinds, and end-of-shift field labels. Checkout reads these lists live."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      }
    >
      <PosSettingsPanel embedded={false} hideHeader />
    </OpsPageShell>
  )
}

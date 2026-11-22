import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import PosSettingsPanel from '@/pages/pos/PosSettingsPanel'

/** Settings → POS: payment methods, expense kinds, shift-close field editor. */
export default function PosSettingsPage() {
  return (
    <OpsPageShell
      className="hakum-pos-settings"
      eyebrow="Settings"
      title="POS settings"
      icon={ShoppingCart}
      breadcrumbs={[{ label: 'Settings', to: '/operations/settings' }, { label: 'POS settings' }]}
      description="Payment methods, POS expense kinds, and end-of-shift field labels. Checkout reads these lists live."
      actions={
        <Button type="button" variant="outline" className="min-h-11" asChild>
          <Link to="/operations/settings">← Company settings</Link>
        </Button>
      }
    >
      <PosSettingsPanel embedded={false} hideHeader />
    </OpsPageShell>
  )
}

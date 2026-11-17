import OpsPageShell from '@/components/ops/OpsPageShell'
import VehicleTransferPanel from '@/pages/crm/VehicleTransferPanel'

export default function VehicleTransferPage() {
  return (
    <OpsPageShell
      eyebrow="Customers"
      title="Transfer a car"
      description="When someone sells their car, move the plate to the buyer. Past visits stay on the seller."
    >
      <VehicleTransferPanel />
    </OpsPageShell>
  )
}

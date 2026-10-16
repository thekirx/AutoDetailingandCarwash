import { useState } from 'react'
import { toast } from 'sonner'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getAccessTokenFresh } from '@/lib/authToken'

async function transferApi(body) {
  const token = await getAccessTokenFresh()
  const res = await fetch('/api/vehicle-transfer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not transfer this car.')
  return data
}

export default function VehicleTransferPage() {
  const [plate, setPlate] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [picked, setPicked] = useState(null)
  const [owner, setOwner] = useState(null)
  const [busy, setBusy] = useState(false)

  const findCar = async (event) => {
    event.preventDefault()
    setBusy(true)
    setPicked(null)
    try {
      const data = await transferApi({ action: 'lookup', plate })
      setVehicles(data.vehicles || [])
      if (!data.vehicles?.length) toast.message('No car with that plate.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const findOwner = async (event) => {
    event.preventDefault()
    setBusy(true)
    setOwner(null)
    try {
      const data = await transferApi({ action: 'lookup', phone })
      if (!data.customer) {
        toast.error(data.reason || 'The new owner needs a Hakum account before this car can move.')
        return
      }
      setOwner(data.customer)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const move = async () => {
    if (!picked || !owner) return
    setBusy(true)
    try {
      await transferApi({ vehicle_id: picked.id, to_customer_id: owner.id })
      toast.success(`${picked.plate_number} now belongs to ${owner.full_name}.`)
      setPicked(null)
      setOwner(null)
      setVehicles([])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <OpsPageShell
      eyebrow="Customers"
      title="Transfer a car"
      description="When someone sells their car, move the plate to the buyer. The buyer must already have a Hakum account. Past visits stay on the seller."
    >
      <form onSubmit={findCar} className="grid max-w-lg gap-3">
        <Label htmlFor="transfer-plate">Plate</Label>
        <div className="flex gap-2">
          <Input id="transfer-plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="ABC 1234" />
          <Button type="submit" disabled={busy || !plate.trim()}>Find car</Button>
        </div>
      </form>
      <ul className="grid max-w-lg gap-2">
        {vehicles.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className={`w-full rounded-xl border px-3 py-3 text-left ${picked?.id === row.id ? 'border-primary' : 'border-border'}`}
              onClick={() => setPicked(row)}
            >
              <span className="font-semibold">{row.plate_number}</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}
                {' · '}
                {row.customers?.full_name || 'No owner on file'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={findOwner} className="grid max-w-lg gap-3">
        <Label htmlFor="transfer-phone">New owner&apos;s phone</Label>
        <div className="flex gap-2">
          <Input id="transfer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09…" />
          <Button type="submit" variant="secondary" disabled={busy || !phone.trim()}>Find account</Button>
        </div>
        {owner ? <p className="text-sm">Account: {owner.full_name} · {owner.phone}</p> : null}
      </form>
      <Button type="button" disabled={busy || !picked || !owner} onClick={move}>
        Transfer this car
      </Button>
    </OpsPageShell>
  )
}

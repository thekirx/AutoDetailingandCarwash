import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, CarFront, Check, Search, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ConfirmDialog from '@/components/ops/ConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function VehicleTransferPanel({ initialVehicle = null, onTransferred }) {
  const [vehicleQuery, setVehicleQuery] = useState('')
  const [ownerQuery, setOwnerQuery] = useState('')
  const [vehicles, setVehicles] = useState([])
  const [customers, setCustomers] = useState([])
  const [picked, setPicked] = useState(initialVehicle)
  const [buyer, setBuyer] = useState(null)
  const [loadingList, setLoadingList] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (initialVehicle?.id) setPicked(initialVehicle)
  }, [initialVehicle])

  const runSearch = useCallback(async (q = '') => {
    setLoadingList(true)
    try {
      const data = await transferApi({ action: 'search', q })
      setVehicles(data.vehicles || [])
      setCustomers(data.customers || [])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    runSearch('')
  }, [runSearch])

  async function handleVehicleSearch(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const trimmed = vehicleQuery.trim()
      const data = await transferApi({ action: 'search', q: trimmed })
      let nextVehicles = data.vehicles || []
      if (!nextVehicles.length && trimmed) {
        const exact = await transferApi({ action: 'lookup', plate: trimmed })
        nextVehicles = exact.vehicles || []
      }
      setVehicles(nextVehicles)
      if (!nextVehicles.length) toast.message('No matching active vehicle found.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleOwnerSearch(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const trimmed = ownerQuery.trim()
      const data = await transferApi({ action: 'search', q: trimmed })
      let nextCustomers = data.customers || []
      if (!nextCustomers.length && trimmed) {
        const exact = await transferApi({ action: 'lookup', phone: trimmed })
        if (exact.customer) nextCustomers = [exact.customer]
        else if (exact.reason) toast.error(exact.reason)
      }
      setCustomers(nextCustomers)
      if (!nextCustomers.length) toast.message('No matching customer account found.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function moveOwnership() {
    if (!picked?.id || !buyer?.id) return
    setBusy(true)
    try {
      await transferApi({ vehicle_id: picked.id, to_customer_id: buyer.id })
      toast.success(`${picked.plate_number} now belongs to ${buyer.full_name}.`)
      setConfirmOpen(false)
      setPicked(null)
      setBuyer(null)
      await runSearch('')
      onTransferred?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const visibleVehicles = vehicles.filter((v) => {
    const needle = vehicleQuery.trim().toLowerCase()
    if (!needle) return true
    return [v.plate_number, v.vehicle_make, v.vehicle_model, v.customers?.full_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })

  const visibleBuyers = customers.filter((c) => {
    if (picked?.customer_id && c.id === picked.customer_id) return false
    const needle = ownerQuery.trim().toLowerCase()
    if (!needle) return true
    return [c.full_name, c.phone, c.email]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle)
  })

  return (
    <div className="crm-transfer-grid">
      <div className="crm-transfer-cols">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CarFront className="size-4" aria-hidden />
              1. Pick vehicle to transfer
            </CardTitle>
            <CardDescription>Search by plate number, brand, model, or current owner.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={handleVehicleSearch} className="flex gap-2">
              <Label htmlFor="transfer-plate" className="sr-only">Plate or vehicle</Label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="transfer-plate"
                  className="min-h-11 pl-9"
                  value={vehicleQuery}
                  onChange={(e) => setVehicleQuery(e.target.value)}
                  placeholder="Plate (ABC 1234), model, or seller…"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={busy}>
                Find
              </Button>
            </form>

            <div className="crm-transfer-list" aria-busy={loadingList}>
              {visibleVehicles.map((row) => {
                const isSelected = picked?.id === row.id
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`crm-pick-row ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => {
                      setPicked(row)
                      if (buyer?.id === row.customer_id) setBuyer(null)
                    }}
                  >
                    <div className="min-w-0">
                      <span className="crm-plate-chip">{row.plate_number}</span>
                      <p className="mt-1 font-medium text-foreground">
                        {[row.vehicle_make, row.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Current owner: {row.customers?.full_name || 'Unlinked'}
                      </p>
                    </div>
                    {isSelected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                )
              })}
              {!visibleVehicles.length && !loadingList ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No matching vehicles found.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="size-4" aria-hidden />
              2. Pick buyer customer account
            </CardTitle>
            <CardDescription>The buyer must have an active customer account. Need to add them first? Use + New customer above.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form onSubmit={handleOwnerSearch} className="flex gap-2">
              <Label htmlFor="transfer-phone" className="sr-only">Buyer name or phone</Label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="transfer-phone"
                  className="min-h-11 pl-9"
                  value={ownerQuery}
                  onChange={(e) => setOwnerQuery(e.target.value)}
                  placeholder="Buyer name, 09…, or email…"
                />
              </div>
              <Button type="submit" variant="outline" className="min-h-11 shrink-0" disabled={busy}>
                Find
              </Button>
            </form>

            <div className="crm-transfer-list" aria-busy={loadingList}>
              {visibleBuyers.map((row) => {
                const isSelected = buyer?.id === row.id
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={`crm-pick-row ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setBuyer(row)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{row.full_name || 'Customer'}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {row.phone || 'No phone'}
                        {row.email && !row.email.endsWith('@customers.hakumautocare.com') ? ` · ${row.email}` : ''}
                      </p>
                    </div>
                    {isSelected ? <Check className="size-4 shrink-0 text-primary" aria-hidden /> : null}
                  </button>
                )
              })}
              {!visibleBuyers.length && !loadingList ? (
                <p className="py-4 text-center text-sm text-muted-foreground">No matching buyer accounts found.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="crm-transfer-confirm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span>{picked ? `${picked.plate_number} (${picked.customers?.full_name || 'Seller'})` : 'Select a vehicle'}</span>
              <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              <span>{buyer ? `${buyer.full_name} (${buyer.phone || 'No phone'})` : 'Select new owner'}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Open maintenance reminders move with the car; past service receipts and visits remain under the original seller.
            </p>
          </div>
          <Button type="button" className="min-h-11 shrink-0 px-5" disabled={busy || !picked || !buyer} onClick={() => setConfirmOpen(true)}>
            {busy ? 'Transferring…' : 'Transfer car'}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={picked && buyer ? `Transfer ${picked.plate_number} to ${buyer.full_name}?` : 'Transfer vehicle ownership?'}
        description="Open maintenance schedules will move with the vehicle while past visit history remains with the seller."
        confirmLabel="Confirm transfer"
        pending={busy}
        onConfirm={moveOwnership}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { formatSizePriceRange, PRICING_SIZES, resolveServicePriceMinor } from '@/lib/servicePricing'
import { seedBookingFromVehicle } from '@/lib/uiDeadControls'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function formatPeso(minor) {
  return `₱${(Number(minor || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

/**
 * Mobile / account booking sheet — same /api/public-book backend as /book.
 */
export default function CustomerBookingModal({
  open,
  onOpenChange,
  profile,
  branches = [],
  vehicles = [],
  initialVehicle = null,
  onBooked,
}) {
  const [services, setServices] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    vehicle_plate: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_type: 'medium',
    scheduled_start: '',
    service_id: '',
    branch: '',
  })

  useEffect(() => {
    if (!open) return
    supabase
      .from('services')
      .select('id, name, price_minor, service_size_prices(size_slug, price_minor)')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data, error: svcError }) => {
        if (svcError) {
          setError(svcError.message)
          toast.error(svcError.message)
          setServices([])
          return
        }
        setServices(
          (data || []).map((row) => ({
            ...row,
            size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
          })),
        )
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    const name = String(profile?.full_name || '').trim()
    const parts = name.split(/\s+/).filter(Boolean)
    const pick = initialVehicle || vehicles[0] || null
    setForm((f) =>
      seedBookingFromVehicle(
        {
          ...f,
          customer_first_name: parts[0] || f.customer_first_name,
          customer_last_name: parts.slice(1).join(' ') || f.customer_last_name,
          customer_phone: profile?.phone || f.customer_phone,
          branch: f.branch || branches[0]?.slug || '',
        },
        pick,
      ),
    )
  }, [open, profile, branches, vehicles, initialVehicle])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function applyVehicle(id) {
    const v = vehicles.find((row) => row.id === id)
    if (!v) return
    setForm((f) => ({
      ...f,
      vehicle_plate: v.plate_number || '',
      vehicle_make: v.vehicle_make || '',
      vehicle_model: v.vehicle_model || '',
      vehicle_type: v.vehicle_type || f.vehicle_type || 'medium',
    }))
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const token = await getAccessTokenFresh()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/public-book', {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Booking failed')
      toast.success('Booking requested — we will confirm by SMS')
      onOpenChange(false)
      onBooked?.()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const selected = services.find((s) => s.id === form.service_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="account-sheet-modal max-h-[92svh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <div className="account-modal-head">
          <DialogHeader className="gap-1 text-left">
            <p className="text-[10px] font-extrabold tracking-[0.22em] text-white/60 uppercase">Book a service</p>
            <DialogTitle className="text-xl text-white">Schedule your visit</DialogTitle>
            <DialogDescription className="text-white/75">
              Same booking as the site — linked to your Hakum account when signed in.
            </DialogDescription>
          </DialogHeader>
        </div>
        <form onSubmit={submit} className="space-y-3 p-4 sm:p-5">
          {vehicles.length > 0 ? (
            <div className="grid gap-1.5">
              <Label htmlFor="book-garage">Your garage</Label>
              <select
                id="book-garage"
                className="account-field"
                defaultValue=""
                onChange={(e) => applyVehicle(e.target.value)}
              >
                <option value="">Pick a saved car (optional)</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number} · {[v.vehicle_make, v.vehicle_model].filter(Boolean).join(' ') || 'Vehicle'}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="book-fn">First name</Label>
              <Input id="book-fn" required className="min-h-11" value={form.customer_first_name} onChange={(e) => set('customer_first_name', e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="book-ln">Last name</Label>
              <Input id="book-ln" required className="min-h-11" value={form.customer_last_name} onChange={(e) => set('customer_last_name', e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="book-phone">Mobile</Label>
            <Input id="book-phone" required className="min-h-11" inputMode="tel" value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="book-plate">Plate</Label>
            <Input id="book-plate" required className="min-h-11" value={form.vehicle_plate} onChange={(e) => set('vehicle_plate', e.target.value)} />
          </div>
          <VehicleMakeModelFields
            make={form.vehicle_make}
            model={form.vehicle_model}
            onMakeChange={(vehicle_make) => set('vehicle_make', vehicle_make)}
            onModelChange={(vehicle_model) => set('vehicle_model', vehicle_model)}
            variant="public"
            makeLabel="Brand"
            modelLabel="Model"
          />
          <div className="grid gap-1.5">
            <Label htmlFor="book-size">Car size</Label>
            <select
              id="book-size"
              required
              className="account-field"
              value={form.vehicle_type}
              onChange={(e) => set('vehicle_type', e.target.value)}
            >
              {PRICING_SIZES.map((sz) => (
                <option key={sz.slug} value={sz.slug}>
                  {sz.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="book-when">Preferred date & time</Label>
            <Input
              id="book-when"
              required
              type="datetime-local"
              className="min-h-11"
              value={form.scheduled_start}
              onChange={(e) => set('scheduled_start', e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="book-service">Service</Label>
            <select
              id="book-service"
              required
              className="account-field"
              value={form.service_id}
              onChange={(e) => set('service_id', e.target.value)}
            >
              <option value="">Select service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatSizePriceRange(s, formatPeso)}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                For {PRICING_SIZES.find((s) => s.slug === form.vehicle_type)?.label || form.vehicle_type}:{' '}
                {formatPeso(resolveServicePriceMinor(selected, form.vehicle_type))}
              </p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="book-branch">Branch</Label>
            <select
              id="book-branch"
              required
              className="account-field"
              value={form.branch}
              onChange={(e) => set('branch', e.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <DialogFooter className="gap-2 pt-2 sm:flex-col">
            <Button type="submit" className="account-btn account-btn-primary min-h-12 w-full" disabled={busy}>
              <CalendarPlus data-icon="inline-start" />
              {busy ? 'Submitting…' : 'Request booking'}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11 w-full" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

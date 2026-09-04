import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Car, MapPin, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { fetchPortal } from '@/lib/customerPortalClient'
import { formatSizePriceRange, PRICING_SIZES, resolveServicePriceMinor } from '@/lib/servicePricing'
import { seedBookingFromVehicle } from '@/lib/uiDeadControls'
import { plateValidationError, PLATE_FIELD_HINT } from '@/lib/customerAuth'
import { usePageMeta } from '@/lib/pageMeta'
import { CUSTOMER_BOOK_PATH } from '@/lib/customerAccountNav'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import { Pills, Row, Skeleton } from '@/components/customer/CustomerUi'

function formatPeso(minor) {
  return `₱${(Number(minor || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

function isoDay(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nextDays(n = 7) {
  const today = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })
}

const EMPTY_FORM = {
  customer_first_name: '',
  customer_last_name: '',
  customer_phone: '',
  vehicle_plate: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_type: 'medium',
  service_id: '',
  branch: '',
}

/** /account/book — same /api/public-book backend as the public /book page, laid out as an app screen. */
export default function CustomerBookPage() {
  usePageMeta({ title: 'Book a service', description: 'Choose a branch, service, and time.', path: CUSTOMER_BOOK_PATH })
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { profile: authProfile, user } = useAuth()
  const [portal, setPortal] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [day, setDay] = useState(isoDay(new Date()))
  const [time, setTime] = useState('10:00')
  const days = useMemo(() => nextDays(7), [])

  const branches = portal?.branches || []
  const vehicles = portal?.vehicles || []

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchPortal().catch(() => null),
      supabase
        .from('services')
        .select('id, name, description, price_minor, service_size_prices(size_slug, price_minor)')
        .eq('is_active', true)
        .order('display_order'),
    ]).then(([data, svc]) => {
      if (cancelled) return
      if (svc.error) setError(svc.error.message)
      setServices(
        (svc.data || []).map((row) => ({
          ...row,
          size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
        })),
      )
      setPortal(data)
      const name = String(data?.profile?.full_name || authProfile?.full_name || '').trim()
      const parts = name.split(/\s+/).filter(Boolean)
      const wantedVehicle = params.get('vehicle')
      const pick = (data?.vehicles || []).find((v) => v.id === wantedVehicle) || data?.vehicles?.[0] || null
      const wantedBranch = params.get('branch')
      setForm((f) =>
        seedBookingFromVehicle(
          {
            ...f,
            customer_first_name: parts[0] || '',
            customer_last_name: parts.slice(1).join(' ') || '',
            customer_phone: data?.profile?.phone || authProfile?.phone || user?.phone || '',
            branch:
              (wantedBranch && data?.branches?.some((b) => b.slug === wantedBranch) && wantedBranch) ||
              data?.branches?.[0]?.slug ||
              '',
          },
          pick,
        ),
      )
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [authProfile, user, params])

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function applyVehicle(v) {
    if (!v) return
    setForm((f) => ({
      ...f,
      vehicle_plate: v.plate_number || '',
      vehicle_make: v.vehicle_make || '',
      vehicle_model: v.vehicle_model || '',
      vehicle_type: v.vehicle_type || f.vehicle_type || 'medium',
    }))
  }

  const selected = services.find((s) => s.id === form.service_id)
  const sizeLabel = PRICING_SIZES.find((s) => s.slug === form.vehicle_type)?.label || form.vehicle_type
  const branchRow = branches.find((b) => b.slug === form.branch)

  async function submit(e) {
    e.preventDefault()
    const plateError = plateValidationError(form.vehicle_plate)
    if (plateError) {
      setError(plateError)
      return
    }
    if (!form.service_id) {
      setError('Pick a service first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const token = await getAccessTokenFresh()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/public-book', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...form, scheduled_start: `${day}T${time}` }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Booking failed')
      toast.success('Booking requested. We will confirm by SMS.')
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <CustomerAppFrame title="Book a service" subtitle="Choose a branch, service, and time." backTo="/account">
      <form className="capp-section" onSubmit={submit} noValidate={false}>
        <label className="capp-row is-static" style={{ cursor: 'default' }}>
          <span className="capp-row-icon" aria-hidden>
            <MapPin size={18} strokeWidth={1.75} />
          </span>
          <span className="capp-row-body">
            <strong>{branchRow ? branchRow.name.replace(/^Hakum Auto Care\s*/i, '') : 'Branch'}</strong>
            <em>{branchRow?.address || 'Choose where to bring your car'}</em>
            <select
              className="capp-select mt-2"
              required
              aria-label="Branch"
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
          </span>
        </label>

        <div className="capp-sect">
          <h2>Select a service</h2>
        </div>
        {loading ? (
          <Skeleton n={3} />
        ) : (
          <div className="capp-list" role="radiogroup" aria-label="Service">
            {services.map((s) => {
              const active = s.id === form.service_id
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`capp-service${active ? ' is-active' : ''}`}
                  onClick={() => set('service_id', s.id)}
                >
                  <span className="capp-row-icon" aria-hidden>
                    <Sparkles size={18} strokeWidth={1.75} />
                  </span>
                  <span className="capp-row-body">
                    <strong>{s.name}</strong>
                    {s.description ? <em>{s.description}</em> : null}
                  </span>
                  <span className="capp-price">
                    {active ? sizeLabel : 'From'}
                    <b>{active ? formatPeso(resolveServicePriceMinor(s, form.vehicle_type)) : formatSizePriceRange(s, formatPeso)}</b>
                  </span>
                </button>
              )
            })}
            {!services.length ? <div className="capp-empty">No services are open for booking right now.</div> : null}
          </div>
        )}

        <div className="capp-sect">
          <h2>Your car</h2>
        </div>
        {vehicles.length ? (
          <Pills
            label="Saved cars"
            items={vehicles.map((v) => ({ id: v.id, label: v.plate_number }))}
            value={vehicles.find((v) => v.plate_number === form.vehicle_plate)?.id || ''}
            onChange={(id) => applyVehicle(vehicles.find((v) => v.id === id))}
          />
        ) : null}
        <div className="capp-card">
          <label className="capp-field">
            <span>Plate / sticker</span>
            <input
              required
              autoComplete="off"
              autoCapitalize="characters"
              value={form.vehicle_plate}
              onChange={(e) => set('vehicle_plate', e.target.value.toUpperCase())}
              placeholder="ABC 1234 or CS 123456"
            />
            <p className="capp-field-hint">{PLATE_FIELD_HINT}</p>
          </label>
          <VehicleMakeModelFields
            make={form.vehicle_make}
            model={form.vehicle_model}
            onMakeChange={(vehicle_make) => set('vehicle_make', vehicle_make)}
            onModelChange={(vehicle_model) => set('vehicle_model', vehicle_model)}
            variant="public"
            makeLabel="Brand"
            modelLabel="Model"
          />
          <label className="capp-field">
            <span>Car size</span>
            <select required value={form.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)}>
              {PRICING_SIZES.map((sz) => (
                <option key={sz.slug} value={sz.slug}>
                  {sz.label}
                </option>
              ))}
            </select>
          </label>
          {selected ? (
            <p className="capp-meta">
              {selected.name} for {sizeLabel}: <b>{formatPeso(resolveServicePriceMinor(selected, form.vehicle_type))}</b>
            </p>
          ) : null}
        </div>

        <div className="capp-sect">
          <h2>Select date and time</h2>
        </div>
        <div className="capp-days" role="radiogroup" aria-label="Date">
          {days.map((d) => {
            const id = isoDay(d)
            const active = id === day
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`capp-day${active ? ' is-active' : ''}`}
                onClick={() => setDay(id)}
              >
                <small>{d.toLocaleDateString('en-PH', { weekday: 'short' })}</small>
                <b>{d.getDate()}</b>
                <small>{d.toLocaleDateString('en-PH', { month: 'short' })}</small>
              </button>
            )
          })}
        </div>
        <label className="capp-field">
          <span>Preferred time</span>
          <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} step={900} />
        </label>

        <div className="capp-sect">
          <h2>Contact</h2>
        </div>
        <div className="capp-card">
          <div className="capp-two">
            <label className="capp-field">
              <span>First name</span>
              <input required value={form.customer_first_name} onChange={(e) => set('customer_first_name', e.target.value)} />
            </label>
            <label className="capp-field">
              <span>Last name</span>
              <input required value={form.customer_last_name} onChange={(e) => set('customer_last_name', e.target.value)} />
            </label>
          </div>
          <label className="capp-field">
            <span>Mobile</span>
            <input required inputMode="tel" value={form.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} />
          </label>
        </div>

        {error ? (
          <p className="capp-field-error" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="capp-btn capp-btn-accent capp-btn-block" disabled={busy || loading}>
          {busy ? 'Submitting…' : 'Request booking'}
          <ArrowRight size={16} strokeWidth={2} aria-hidden />
        </button>
        {!vehicles.length && !loading ? (
          <Row icon={Car} title="Save this car to your garage" sub="Next time it is one tap." chevron to="/account/more?tab=garage" />
        ) : null}
      </form>
    </CustomerAppFrame>
  )
}

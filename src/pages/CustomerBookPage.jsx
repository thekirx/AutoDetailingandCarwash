import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { fetchPortal, portalAction } from '@/lib/customerPortalClient'
import { normalizePromoCode, promoDiscountedPriceMinor } from '@/lib/promoVoucher'
import { formatSizePriceRange, PRICING_SIZES, resolveServicePriceMinor, normalizePricingSize } from '@/lib/servicePricing'
import { filterFloorDetailingServices } from '@/lib/serviceKinds'
import { packagesForService, bookedDetailingServiceId } from '@/lib/detailingPackages'
import { pointsLabel } from '@/lib/loyaltyPoints'
import { seedBookingFromVehicle } from '@/lib/uiDeadControls'
import { plateValidationError, PLATE_FIELD_HINT } from '@/lib/customerAuth'
import { earliestBookableDay } from '@/lib/bookingLead'
import { branchDistanceKm } from '@/lib/branchGeo'
import { formatDistanceKm, loadCustomerBranch, loadCustomerPin, resolveCustomerBranchChoice } from '@/lib/customerLocation'
import { useCustomerBranch } from '@/lib/useCustomerBranch'
import ReferralSourceFields, { useReferralStaff } from '@/components/bookings/ReferralSourceFields'
import { friendCodeAccountError, referralRequiredError, referralSourceLabel } from '@/lib/referralSource'
import { usePageMeta } from '@/lib/pageMeta'
import { CUSTOMER_BOOK_PATH } from '@/lib/customerAccountNav'
import { CUSTOMER_QUEUE_PATH } from '@/lib/liveQueuePath'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import { Skeleton } from '@/components/customer/CustomerUi'
import BookingCalendar from '@/components/customer/BookingCalendar'
import Sheet from '@/components/customer/Sheet'
import ceramicPhoto from '@/assets/services/ceramic.webp'
import maintenancePhoto from '@/assets/services/detailing.webp'
import tintPhoto from '@/assets/services/ceramic-tint.webp'
import ppfPhoto from '@/assets/services/ppf-clearpro-install.webp'
import carwashPhoto from '@/assets/services/carwash.webp'

const SERVICE_PHOTOS = { 'ceramic-coating': ceramicPhoto, 'paint-maintenance': maintenancePhoto, 'nano-ceramic-tint': tintPhoto, 'ceramic-tint': tintPhoto, 'paint-protection-film': ppfPhoto, ppf: ppfPhoto }

function formatPeso(minor) {
  return `₱${(Number(minor || 0) / 100).toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

/* Hourly slots for the When step; "Another time" keeps the free time field. */
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

function slotLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
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
  package_id: '',
  branch: '',
  referral_source: '',
  referred_by_name: '',
  referred_by_staff_id: '',
}

/** /account/book — same /api/public-book backend as the public /book page, laid out as an app screen. */
export default function CustomerBookPage() {
  usePageMeta({ title: 'Book a service', description: 'Choose a branch, service, and time.', path: CUSTOMER_BOOK_PATH })
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { profile: authProfile, user } = useAuth()
  const [portal, setPortal] = useState(null)
  const [services, setServices] = useState([])
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const referralStaff = useReferralStaff()
  const [day, setDay] = useState(() => earliestBookableDay())
  const [time, setTime] = useState('10:00')
  const [voucherInput, setVoucherInput] = useState(() => String(params.get('voucher') || '').toUpperCase())
  const [appliedVoucher, setAppliedVoucher] = useState(null)
  const [voucherBusy, setVoucherBusy] = useState(false)
  const [voucherError, setVoucherError] = useState('')
  const [otherTime, setOtherTime] = useState(false)
  const [flowOpen, setFlowOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [sent, setSent] = useState(false)
  const [otherCar, setOtherCar] = useState(false)
  const openedFromLink = useRef(false)

  const { branches, nearestSlug, pin, selectBranch } = useCustomerBranch(portal?.branches || [], { wanted: params.get('branch') || '' })
  const vehicles = portal?.vehicles || []

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchPortal().catch(() => null),
      supabase
        .from('services')
        .select('id, name, description, slug, pay_category, price_minor, points_award, parent_service_id, service_size_prices(size_slug, price_minor)')
        .eq('is_active', true)
        .order('display_order'),
    ]).then(([data, svc]) => {
      if (cancelled) return
      if (svc.error) setError(svc.error.message)
      setPortal(data)
      const name = String(data?.profile?.full_name || authProfile?.full_name || '').trim()
      const parts = name.split(/\s+/).filter(Boolean)
      const wantedVehicle = params.get('vehicle')
      const wantedPlate = String(params.get('plate') || '').trim()
      const wantedService = String(params.get('service') || '').toLowerCase()
      const rows = (svc.data || []).map((row) => ({
        ...row,
        size_prices: Object.fromEntries((row.service_size_prices || []).map((p) => [p.size_slug, p.price_minor])),
      }))
      setCatalog(rows)
      const detailing = filterFloorDetailingServices(rows.filter((row) => !row.parent_service_id))
      setServices(detailing)
      const pickById = (data?.vehicles || []).find((v) => v.id === wantedVehicle)
      const pickByPlate = wantedPlate
        ? (data?.vehicles || []).find((v) => String(v.plate_number || '').toUpperCase() === wantedPlate.toUpperCase())
        : null
      const pick = pickById || pickByPlate || (!wantedPlate && !wantedVehicle ? data?.vehicles?.[0] : null) || null
      const wantedBranch = params.get('branch')
      const resolvedBranch = resolveCustomerBranchChoice({
        wanted: wantedBranch,
        savedSlug: loadCustomerBranch(),
        pin: loadCustomerPin(),
        branches: data?.branches || [],
      })
      const serviceId = wantedService ? detailing.find((s) => String(s.slug || '').toLowerCase() === wantedService)?.id || '' : ''
      setForm((f) =>
        seedBookingFromVehicle(
          {
            ...f,
            customer_first_name: parts[0] || '',
            customer_last_name: parts.slice(1).join(' ') || '',
            customer_phone: data?.profile?.phone || authProfile?.phone || user?.phone || '',
            branch: resolvedBranch.slug || f.branch || '',
            service_id: serviceId || f.service_id,
            vehicle_plate: wantedPlate || f.vehicle_plate,
          },
          pick,
        ),
      )
      setLoading(false)
      // A link that names a service (website buttons, "Book maintenance") opens the steps straight away.
      if (serviceId && !openedFromLink.current) {
        openedFromLink.current = true
        setFlowOpen(true)
      }
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
      vehicle_type: v.vehicle_type ? normalizePricingSize(v.vehicle_type) : f.vehicle_type || 'medium',
    }))
  }

  const selected = services.find((s) => s.id === form.service_id)
  const packages = packagesForService(catalog, form.service_id)
  const selectedPackage = packages.find((p) => p.id === form.package_id) || null
  const basePriceMinor = selectedPackage?.price_minor > 0
    ? selectedPackage.price_minor
    : selected
      ? resolveServicePriceMinor(selected, form.vehicle_type)
      : 0
  const quote = basePriceMinor > 0 ? formatPeso(basePriceMinor) : selectedPackage ? 'Ask for price' : ''
  const discountedPriceMinor = appliedVoucher
    ? promoDiscountedPriceMinor(basePriceMinor, appliedVoucher)
    : basePriceMinor
  const voucherDiscountMinor = Math.max(0, basePriceMinor - discountedPriceMinor)
  const availablePromos = portal?.vouchers?.active || []
  const sizeLabel = PRICING_SIZES.find((s) => s.slug === form.vehicle_type)?.label || form.vehicle_type
  const branchRow = branches.find((b) => b.slug === form.branch)
  const savedCar = vehicles.find((v) => v.plate_number === form.vehicle_plate) || null
  const showCarFields = otherCar || !vehicles.length || !savedCar

  /* Car first (size comes from My cars), a package only when the service has them, then the
     schedule, the branch + where they heard about us, and the summary with the price last. */
  const steps = ['car', ...(packages.length ? ['package'] : []), 'when', 'details', 'review']
  const stepId = steps[Math.min(step, steps.length - 1)]
  const stepReady =
    stepId === 'package'
      ? Boolean(form.package_id)
      : stepId === 'car'
        ? !plateValidationError(form.vehicle_plate)
        : stepId === 'when'
          ? Boolean(day && time)
          : stepId === 'details'
            ? Boolean(form.branch) && !referralRequiredError(form) && !friendCodeAccountError(form, authProfile?.role === 'customer' ? user?.id : null)
            : Boolean(form.customer_first_name && form.customer_phone)

  async function applyVoucherDirect(rawCode) {
    const code = normalizePromoCode(rawCode)
    if (!code) return
    setVoucherBusy(true)
    setVoucherError('')
    try {
      const targetServiceId = bookedDetailingServiceId(form.service_id, form.package_id, packages)
      const res = await portalAction('check-voucher', {
        code,
        service_id: targetServiceId,
        price_minor: basePriceMinor,
      })
      if (res?.ok && res.voucher) {
        setAppliedVoucher(res.voucher)
        setVoucherInput(res.voucher.code)
        toast.success(`Voucher ${res.voucher.code} applied!`)
      } else {
        throw new Error(res?.error || 'Voucher not found')
      }
    } catch (err) {
      setVoucherError(err.message || 'That voucher could not be applied.')
      toast.error(err.message || 'Voucher could not be applied')
    } finally {
      setVoucherBusy(false)
    }
  }

  function openFlow(serviceId) {
    setForm((f) => ({ ...f, service_id: serviceId, package_id: '' }))
    setStep(0)
    setSent(false)
    setError('')
    setFlowOpen(true)
  }

  function closeFlow() {
    setFlowOpen(false)
    if (sent) navigate('/account', { replace: true })
  }

  function next() {
    setError('')
    if (stepId === 'car') {
      const plateError = plateValidationError(form.vehicle_plate)
      if (plateError) return setError(plateError)
    }
    setStep((n) => Math.min(n + 1, steps.length - 1))
  }

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
    if (packages.length && !form.package_id) {
      setError('Pick a package for this service.')
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
        body: JSON.stringify({
        ...form,
        service_id: bookedDetailingServiceId(form.service_id, form.package_id, packages),
        scheduled_start: `${day}T${time}`,
        voucher_code: appliedVoucher ? appliedVoucher.code : undefined,
      }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Booking failed')
      toast.success('Booking requested. We will confirm by SMS.')
      setSent(true)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const stepTitles = { package: 'Pick a package', car: 'Which car?', when: 'Book your schedule', details: 'Branch and last details', review: 'Summary' }
  const branchName = branchRow ? branchRow.name.replace(/^Hakum Auto Care\s*/i, '') : ''
  const carLine = [form.vehicle_plate, [form.vehicle_make, form.vehicle_model].filter(Boolean).join(' '), sizeLabel].filter(Boolean).join(' · ')
  const whenLine = `${new Date(`${day}T00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · ${slotLabel(time)}`

  return (
    <CustomerAppFrame title="Book" subtitle="Protection services are booked ahead. Pick one to start." navTitle="Book">
      <div className="capp-sect">
        <h2>Select a detailing service</h2>
      </div>
      {loading ? (
        <Skeleton n={3} />
      ) : (
        <div className="capp-svc-list" role="list" aria-label="Service">
          {services.map((s, i) => (
            <button key={s.id} type="button" role="listitem" className="capp-svc" onClick={() => openFlow(s.id)}>
              {SERVICE_PHOTOS[s.slug] ? <img className="capp-svc-bg" src={SERVICE_PHOTOS[s.slug]} alt="" loading="lazy" /> : null}
              <span className="capp-no" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="capp-svc-in">
                <span className="min-w-0">
                  <strong>{s.name}</strong>
                  {s.points_award > 0 ? <em>Earn {pointsLabel(s.points_award)}</em> : null}
                </span>
                <span className="capp-svc-from">
                  From
                  <b>{formatSizePriceRange(s, formatPeso)}</b>
                </span>
              </span>
            </button>
          ))}
          {!services.length ? <div className="capp-empty">No detailing services are open for booking right now.</div> : null}
        </div>
      )}

      <p className="capp-meta capp-walkin-note">Washing or detailing? Walk in, no booking needed.</p>
      <div className="capp-svc-list">
        <Link className="capp-svc capp-svc--walkin" to={CUSTOMER_QUEUE_PATH}>
          <img className="capp-svc-bg" src={carwashPhoto} alt="" loading="lazy" />
          <span className="capp-svc-in">
            <span className="min-w-0">
              <strong>Car wash</strong>
              <em>Walk-in only</em>
            </span>
            <span className="capp-svc-from">
              Live queue
              <b>See the live queue →</b>
            </span>
          </span>
        </Link>
      </div>

      <Sheet
        open={flowOpen}
        onClose={closeFlow}
        full
        label="Book a service"
        title={<span className="capp-flow-count">{sent ? 'Done' : `Step ${step + 1} of ${steps.length}`}</span>}
        footer={
          sent ? (
            <button type="button" className="capp-btn capp-btn-fill capp-btn-block" onClick={closeFlow}>
              Back to Home
            </button>
          ) : (
            <div className="capp-flow-cta">
              {step > 0 ? (
                <button type="button" className="capp-flow-back" onClick={() => setStep((n) => n - 1)} aria-label="Back">
                  <ChevronLeft size={20} strokeWidth={2} aria-hidden />
                </button>
              ) : null}
              {stepId === 'review' ? (
                <button key="submit" type="submit" form="capp-book-form" className="capp-btn capp-btn-fill capp-btn-block" disabled={busy || loading || !stepReady}>
                  {busy ? 'Submitting…' : 'Request booking'}
                </button>
              ) : (
                <button key="next" type="button" className="capp-btn capp-btn-fill capp-btn-block" onClick={next} disabled={!stepReady}>
                  Continue
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                </button>
              )}
            </div>
          )
        }
      >
        <div className="capp-flow-bar" style={{ '--n': steps.length }} aria-hidden>
          {steps.map((id, i) => (
            <i key={id} className={sent || i <= step ? 'is-on' : ''} />
          ))}
        </div>
        {sent ? (
          <div className="capp-flow-done" role="status">
            <span className="capp-flow-check" aria-hidden>
              <Check size={40} strokeWidth={2.6} />
            </span>
            <h3>Thank you for submitting!</h3>
            <p>
              Your {selected?.name || 'booking'} request{form.vehicle_plate ? ` for ${form.vehicle_plate}` : ''} is now with the {branchName || 'branch'} team. They&apos;ll
              text you to confirm the final day.
            </p>
            <p className="capp-meta">{[whenLine, branchName, quote].filter(Boolean).join(' · ')}</p>
          </div>
        ) : (
          <form id="capp-book-form" className="capp-flow" onSubmit={submit} noValidate={false}>
            <span className="capp-no" aria-hidden>
              {String(step + 1).padStart(2, '0')}
            </span>
            <h3 className="capp-flow-h">{stepId === 'package' && selected ? selected.name : stepTitles[stepId]}</h3>

            {stepId === 'package' ? (
              <>
                <p className="capp-flow-sub">Pick a package. Final price depends on your car&apos;s size.</p>
                <div className="capp-opts" role="radiogroup" aria-label="Package">
                  {packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      type="button"
                      role="radio"
                      aria-checked={pkg.id === form.package_id}
                      className="capp-opt"
                      onClick={() => set('package_id', pkg.id)}
                    >
                      <span className="capp-opt-rd" aria-hidden />
                      <span className="capp-row-body">
                        <strong>{pkg.name}</strong>
                        {pkg.description ? <em>{pkg.description}</em> : null}
                        {pkg.points_award > 0 ? <em>Earn {pointsLabel(pkg.points_award)}</em> : null}
                      </span>
                      <span className="capp-opt-price">{pkg.price_minor > 0 ? formatPeso(pkg.price_minor) : 'Ask for price'}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {stepId === 'car' ? (
              <>
                <p className="capp-flow-sub">{vehicles.length ? 'From your garage.' : 'The plate exactly as it appears on the car.'}</p>
                {vehicles.length ? (
                  <div className="capp-opts" role="radiogroup" aria-label="Saved cars">
                    {vehicles.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="radio"
                        aria-checked={!otherCar && savedCar?.id === v.id}
                        className="capp-opt"
                        onClick={() => {
                          setOtherCar(false)
                          applyVehicle(v)
                        }}
                      >
                        <span className="capp-opt-rd" aria-hidden />
                        <span className="capp-row-body">
                          <strong className="capp-plate">{v.plate_number}</strong>
                          <em>
                            {[[v.vehicle_make, v.vehicle_model].filter(Boolean).join(' '), PRICING_SIZES.find((sz) => sz.slug === normalizePricingSize(v.vehicle_type))?.label]
                              .filter(Boolean)
                              .join(' · ') || 'Saved car'}
                          </em>
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={showCarFields}
                      className="capp-opt is-dashed"
                      onClick={() => {
                        setOtherCar(true)
                        setForm((f) => ({ ...f, vehicle_plate: '', vehicle_make: '', vehicle_model: '' }))
                      }}
                    >
                      <span className="capp-opt-rd is-plus" aria-hidden>
                        <Plus size={14} strokeWidth={2.4} />
                      </span>
                      <span className="capp-row-body">
                        <strong>Another car</strong>
                      </span>
                    </button>
                  </div>
                ) : null}
                {showCarFields ? (
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
                      onSizeSuggest={(size) => set('vehicle_type', size)}
                      variant="public"
                      makeLabel="Brand"
                      modelLabel="Model"
                    />
                  </div>
                ) : null}
                {showCarFields ? (
                  <label className="capp-field">
                    <span>Car size</span>
                    <select required value={form.vehicle_type} onChange={(e) => set('vehicle_type', e.target.value)}>
                      {PRICING_SIZES.map((sz) => (
                        <option key={sz.slug} value={sz.slug}>
                          {sz.label}
                        </option>
                      ))}
                    </select>
                    <p className="capp-field-hint">Fills in from the model. Save the car in My cars and next time it is one tap.</p>
                  </label>
                ) : (
                  <p className="capp-meta">Car size comes from My cars. Wrong size? Change it in the Cars tab.</p>
                )}
              </>
            ) : null}

            {stepId === 'when' ? (
              <>
                <p className="capp-flow-sub">
                  Today and tomorrow stay closed so the branch can check the bay. Your request is tentative until they call to confirm the final day.
                </p>
                <BookingCalendar value={day} onChange={setDay} />
                <div className="capp-sect">
                  <h2>Time</h2>
                </div>
                <div className="capp-slots" role="radiogroup" aria-label="Time">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={!otherTime && time === t}
                      className="capp-slot"
                      onClick={() => {
                        setOtherTime(false)
                        setTime(t)
                      }}
                    >
                      {slotLabel(t)}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={otherTime || !TIME_SLOTS.includes(time)}
                    className="capp-slot is-wide"
                    onClick={() => setOtherTime(true)}
                  >
                    Another time
                  </button>
                </div>
                {otherTime || !TIME_SLOTS.includes(time) ? (
                  <label className="capp-field">
                    <span>Preferred time</span>
                    <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} step={900} />
                  </label>
                ) : null}
              </>
            ) : null}

            {stepId === 'details' ? (
              <>
                <p className="capp-flow-sub">Where will you bring your car?</p>
                <div className="capp-opts" role="radiogroup" aria-label="Branch">
                  {branches.map((b) => {
                    const km = pin ? branchDistanceKm(pin, b) : null
                    return (
                      <button
                        key={b.slug}
                        type="button"
                        role="radio"
                        aria-checked={b.slug === form.branch}
                        className="capp-opt"
                        onClick={() => {
                          set('branch', b.slug)
                          selectBranch(b.slug)
                        }}
                      >
                        <span className="capp-opt-rd" aria-hidden />
                        <span className="capp-row-body">
                          <strong>{b.name.replace(/^Hakum Auto Care\s*/i, '')}</strong>
                          <em>
                            {[nearestSlug === b.slug ? 'Closest to you' : '', km != null ? formatDistanceKm(km) : '', b.address].filter(Boolean).join(' · ')}
                          </em>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="capp-flow-gap">
                  <ReferralSourceFields
                    variant="capp"
                    source={form.referral_source}
                    name={form.referred_by_name}
                    staffId={form.referred_by_staff_id}
                    staff={referralStaff}
                    accountError={friendCodeAccountError(form, authProfile?.role === 'customer' ? user?.id : null)}
                    onChange={(patch) => setForm((current) => ({ ...current, ...patch }))}
                  />
                </div>
              </>
            ) : null}

            {stepId === 'review' ? (
              <>
                <p className="capp-flow-sub">We&apos;ll text you once the branch confirms.</p>
                <dl className="capp-sum">
                  <div>
                    <dt>Service</dt>
                    <dd>{selected?.name || '—'}</dd>
                  </div>
                  {selectedPackage ? (
                    <div>
                      <dt>Package</dt>
                      <dd>{selectedPackage.name}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Car</dt>
                    <dd>{carLine || '—'}</dd>
                  </div>
                  <div>
                    <dt>Schedule</dt>
                    <dd>{whenLine}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{branchName || '—'}</dd>
                  </div>
                  {form.referral_source ? (
                    <div>
                      <dt>Heard about us</dt>
                      <dd>{[referralSourceLabel(form.referral_source), form.referred_by_name].filter(Boolean).join(' · ')}</dd>
                    </div>
                  ) : null}
                  <div className="capp-sum-total">
                    <dt>Price</dt>
                    <dd className={appliedVoucher ? 'line-through text-muted-foreground' : 'capp-sum-price'}>
                      {quote || '—'}
                    </dd>
                  </div>
                  {appliedVoucher ? (
                    <div>
                      <dt className="text-emerald-700 dark:text-emerald-400 font-semibold">
                        Voucher ({appliedVoucher.code})
                      </dt>
                      <dd className="text-emerald-700 dark:text-emerald-400 font-bold">
                        -{formatPeso(voucherDiscountMinor)} ({appliedVoucher.discount_kind === 'free' ? 'Free service' : (appliedVoucher.discount_kind === 'fixed' || appliedVoucher.discount_kind === 'amount') ? `${formatPeso(appliedVoucher.discount_amount_minor || 0)} off` : `${appliedVoucher.discount_percent}% off`})
                      </dd>
                    </div>
                  ) : null}
                  {appliedVoucher ? (
                    <div>
                      <dt className="font-bold">Total price</dt>
                      <dd className="capp-sum-price font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatPeso(discountedPriceMinor)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="capp-sect mt-3">
                  <h2>Promo voucher</h2>
                </div>
                <div className="capp-card space-y-3">
                  {appliedVoucher ? (
                    <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                          <span className="font-mono font-bold text-sm text-emerald-800 dark:text-emerald-300">
                            {appliedVoucher.code}
                          </span>
                          <span className="text-xs text-muted-foreground">· Applied</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {appliedVoucher.title} ({appliedVoucher.discount_kind === 'free' ? 'Free service' : (appliedVoucher.discount_kind === 'fixed' || appliedVoucher.discount_kind === 'amount') ? `${formatPeso(appliedVoucher.discount_amount_minor || 0)} off` : `${appliedVoucher.discount_percent}% off`})
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-destructive hover:underline px-2 py-1"
                        onClick={() => {
                          setAppliedVoucher(null)
                          setVoucherInput('')
                          setVoucherError('')
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={voucherInput}
                          onChange={(e) => {
                            setVoucherInput(e.target.value.toUpperCase())
                            setVoucherError('')
                          }}
                          placeholder="Voucher code (e.g. SUMMER10)"
                          className="capp-voucher-input"
                          autoCapitalize="characters"
                          autoComplete="off"
                          maxLength={16}
                        />
                        <button
                          type="button"
                          className="capp-btn capp-btn-accent min-h-11 font-semibold"
                          disabled={!voucherInput.trim() || voucherBusy}
                          onClick={() => applyVoucherDirect(voucherInput)}
                        >
                          {voucherBusy ? 'Checking…' : 'Apply'}
                        </button>
                      </div>
                      {voucherError ? (
                        <p className="text-xs font-medium text-destructive mt-1" role="alert">
                          {voucherError}
                        </p>
                      ) : null}
                      {availablePromos.length ? (
                        <div className="pt-1">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Available vouchers:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {availablePromos.slice(0, 3).map((v) => (
                              <button
                                key={v.id || v.code}
                                type="button"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-muted/60 text-xs font-medium hover:bg-muted transition-colors text-foreground"
                                onClick={() => {
                                  setVoucherInput(v.code)
                                  applyVoucherDirect(v.code)
                                }}
                              >
                                <strong className="font-mono">{v.code}</strong>
                                <span className="text-[11px] text-muted-foreground">
                                  ({v.discount_kind === 'free' ? 'Free' : (v.discount_kind === 'fixed' || v.discount_kind === 'amount') ? `${formatPeso(v.discount_amount_minor || 0)} off` : `${v.discount_percent}%`})
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
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
              </>
            ) : null}

            {error ? (
              <p className="capp-field-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        )}
      </Sheet>
    </CustomerAppFrame>
  )
}

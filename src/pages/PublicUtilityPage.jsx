import queueHeroPoster from '../assets/hero/bredesign-hero-poster.webp'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { CUSTOMER_QUEUE_PATH } from '../lib/liveQueuePath'
import { branchCityName, usePublicBranches } from '../lib/branches'
import { getAccessTokenFresh } from '../lib/authToken'
import { supabase } from '../lib/supabase'
import { filterFloorDetailingServices } from '../lib/serviceKinds'
import { applyPublicBookPrefill, matchServiceIdByPrefillName } from '../lib/uiDeadControls'
import VehicleMakeModelFields from '../components/VehicleMakeModelFields'
import FormLegalNotice from '../components/FormLegalNotice'
import { usePageMeta } from '../lib/pageMeta'
import { formatStartingPrice, useStartingPrices } from '../lib/serviceStartingPrices'
import './BookingWizard.css'
import { plateValidationError, PLATE_FIELD_HINT } from '../lib/customerAuth'

export function QueuePage() {
  const { user, profile, loading: authLoading } = useAuth()
  const { branches, loading, error } = usePublicBranches()
  usePageMeta({
    title: 'Live queue',
    description: 'Pick a Hakum Auto Care branch for the customer count board or shop TV floor board.',
    path: '/queue',
  })

  if (authLoading) return null
  if (user && profile?.role === 'customer') {
    return <Navigate to={CUSTOMER_QUEUE_PATH} replace />
  }

  return (
    <section className="lq-picker">
      {/* The hero still under the brand gradient, the same shape the interior
          marketing pages open on — so arriving from the site keeps one language. */}
      <img className="lq-picker-media" src={queueHeroPoster} alt="" />
      <div className="public-shell lq-picker-inner">
        <div className="lq-picker-copy">
          <img src="/branding/hakum-wm-ow.png" alt="Hakum" className="lq-picker-wm" width={180} height={44} />
          <p className="lq-kicker">
            <span className="lq-pulse">
              <span className="lq-pulse-dot" aria-hidden />
              Live service queue
            </span>
          </p>
          <h1 className="lq-picker-title">
            Plan your
            <br />
            <i>arrival.</i>
          </h1>
          <p className="lq-picker-lede">
            Customer view shows counts only. Shop TV is the in-store landscape board — no sign-in.
          </p>
        </div>

        <div className="lq-picker-lanes" aria-label="Branches">
          {error ? <p className="lq-picker-error">{error}</p> : null}
          {loading ? (
            <>
              <div className="lq-skeleton lq-skeleton-lane-card" />
              <div className="lq-skeleton lq-skeleton-lane-card" />
            </>
          ) : null}
          {branches.map((b, index) => (
            <article key={b.slug} className="lq-lane-card lq-lane-card-split" style={{ '--i': index }}>
              <span className="lq-lane-card-shell">
                <span className="lq-lane-card-core">
                  <img src="/branding/hakum-mark-ow.png" alt="" className="lq-lane-card-mark" width={40} height={40} />
                  <span className="lq-lane-card-copy">
                    <strong>{b.name}</strong>
                    <span>{b.address || b.slug}</span>
                  </span>
                </span>
                <span className="lq-lane-card-actions">
                  <Link to={`/queue/${b.slug}`} className="lq-lane-card-cta">
                    Customer
                  </Link>
                  <Link to={`/queue/${b.slug}/tv`} className="lq-lane-card-cta lq-lane-card-cta-tv">
                    Shop TV
                  </Link>
                </span>
              </span>
            </article>
          ))}
          {!loading && !branches.length ? (
            <p className="lq-picker-empty">No active branches yet.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

const WIZARD_STEPS = ['Service', 'Branch', 'Date & time', 'Your car', 'Your details', 'Review']

/* Hourly slots inside branch hours (daily 8 AM–8 PM); the branch confirms by SMS. */
const BOOKING_TIMES = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']

const SERVICE_BLURBS = {
  'paint-maintenance': 'Decontaminate, polish and protect the paint',
  'ceramic-coating': 'Long-lasting gloss and water beading',
  'nano-ceramic-tint': 'Heat-rejecting window film',
  'paint-protection-film': 'Clear film against chips and scratches',
}

function timeLabel(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function niceDate(key) {
  if (!key) return ''
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })
}


function WizardOption({ checked, onSelect, title, sub, right }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="bk-opt" onClick={onSelect}>
      <span className="bk-opt-dot" aria-hidden="true" />
      <span className="bk-opt-text">
        <strong>{title}</strong>
        {sub ? <span>{sub}</span> : null}
      </span>
      {right ? <span className="bk-opt-price">{right}</span> : null}
    </button>
  )
}

export function BookingPage() {
  const location = useLocation()
  const { branches, loading: branchesLoading, error: branchesError } = usePublicBranches()
  const [services, setServices] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [plateHint, setPlateHint] = useState('')
  const [packageNote, setPackageNote] = useState('')
  const [prefServiceName, setPrefServiceName] = useState('')
  const [step, setStep] = useState(0)
  // Lowest size price per service: the customer no longer picks a size, so options say "From".
  // Anonymous visitors can't read the size table, so this comes from the public RPC.
  const startingPrices = useStartingPrices()
  const fromLabel = (s) => {
    const minor = startingPrices[String(s?.slug || '')]
    return minor ? `From ${formatStartingPrice(minor)}` : null
  }
  const [form, setForm] = useState({
    customer_first_name: '',
    customer_last_name: '',
    customer_phone: '',
    vehicle_plate: '',
    vehicle_make: '',
    vehicle_model: '',
    // No size question: suggested from the Cars catalog when brand/model match, else medium.
    // The team confirms the real size at the bay.
    vehicle_type: 'medium',
    visit_date: '',
    visit_time: '',
    service_id: '',
    branch: '',
  })
  const stepHeadingRef = useRef(null)
  const wizardRef = useRef(null)

  useEffect(() => {
    const prefilled = applyPublicBookPrefill({}, location.state)
    if (prefilled._prefNotes) setPackageNote(prefilled._prefNotes)
    if (prefilled._prefServiceName) setPrefServiceName(prefilled._prefServiceName)
    if (prefilled.service_id) setForm((f) => ({ ...f, service_id: prefilled.service_id }))
  }, [location.state])

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name, slug, pay_category')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data, error: e }) => {
        if (e) {
          setError(e.message)
          return
        }
        const rows = filterFloorDetailingServices(data || [])
        setServices(rows)
        setForm((f) => {
          if (f.service_id && rows.some((s) => s.id === f.service_id)) return f
          const matched = matchServiceIdByPrefillName(rows, prefServiceName)
          return matched ? { ...f, service_id: matched } : { ...f, service_id: '' }
        })
      })
  }, [prefServiceName])

  useEffect(() => {
    if (!form.branch && branches[0]?.slug) {
      setForm((f) => ({ ...f, branch: branches[0].slug }))
    }
  }, [branches, form.branch])

  useEffect(() => {
    const plate = form.vehicle_plate.trim()
    if (plateValidationError(plate)) {
      setPlateHint('')
      return undefined
    }
    const t = window.setTimeout(() => {
      fetch(`/api/plate-lookup?plate=${encodeURIComponent(plate)}`)
        .then((r) => r.json())
        .then((body) => {
          if (!body?.found) {
            setPlateHint('New plate — enter your car’s brand and model.')
            return
          }
          setPlateHint('We know this plate — brand and model filled from past visits.')
          setForm((current) => ({
            ...current,
            vehicle_make: body.vehicle_make || current.vehicle_make,
            vehicle_model: body.vehicle_model || current.vehicle_model,
          }))
        })
        .catch(() => setPlateHint(''))
    }, 280)
    return () => window.clearTimeout(t)
  }, [form.vehicle_plate])

  // Move focus to the new step's heading so keyboard and screen-reader users land on it.
  const stepMounted = useRef(false)
  useEffect(() => {
    if (!stepMounted.current) {
      stepMounted.current = true
      return
    }
    if (status !== 'idle') return
    // On a phone, Next sits below the fold; bring the new step's top back into view.
    const box = wizardRef.current
    if (box && box.getBoundingClientRect().top < 0) box.scrollIntoView({ behavior: 'smooth', block: 'start' })
    stepHeadingRef.current?.focus({ preventScroll: true })
  }, [step, status])

  const update = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: key === 'vehicle_plate' ? event.target.value.toUpperCase() : event.target.value,
    }))

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const service = services.find((s) => s.id === form.service_id)
  const branch = branches.find((b) => b.slug === form.branch)
  const phoneDigits = form.customer_phone.replace(/\D/g, '')

  const stepReady = [
    Boolean(form.service_id),
    Boolean(form.branch),
    Boolean(form.visit_date && form.visit_time),
    !plateValidationError(form.vehicle_plate) && Boolean(form.vehicle_make.trim() && form.vehicle_model.trim()),
    Boolean(form.customer_first_name.trim() && form.customer_last_name.trim() && phoneDigits.length >= 10),
    true,
  ][step]
  const lastStep = step === WIZARD_STEPS.length - 1

  const goNext = () => {
    if (!stepReady) return
    setError('')
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!lastStep) {
      goNext()
      return
    }
    setStatus('loading')
    setError('')
    try {
      const plateError = plateValidationError(form.vehicle_plate)
      if (plateError) throw new Error(plateError)
      const headers = { 'Content-Type': 'application/json' }
      const token = await getAccessTokenFresh()
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/public-book', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customer_first_name: form.customer_first_name,
          customer_last_name: form.customer_last_name,
          customer_phone: form.customer_phone,
          vehicle_plate: form.vehicle_plate,
          vehicle_make: form.vehicle_make,
          vehicle_model: form.vehicle_model,
          vehicle_type: form.vehicle_type,
          // Branch-local (Manila) time, so the server's UTC clock can't shift it.
          scheduled_start: `${form.visit_date}T${form.visit_time}:00+08:00`,
          service_id: form.service_id,
          branch: form.branch,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Booking failed')
      setStatus('done')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <section className="booking-page">
        <div className="public-shell">
          <div className="bk-wizard bk-done">
            <span className="bk-done-tick" aria-hidden="true">✓</span>
            <h1 className="bk-title">You’re on the list</h1>
            <p className="bk-sub">We’ll confirm by SMS. Track status anytime from My account if you signed in.</p>
            <Link to="/" className="bk-btn bk-btn-next">Back home</Link>
          </div>
        </div>
      </section>
    )
  }

  const stepBody = () => {
    switch (step) {
      case 0:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>What does your car need?</h2>
            <p className="bk-sub">Pick one service. You can add more at the branch.</p>
            <div className="bk-opts" role="radiogroup" aria-label="Service">
              {services.map((s) => (
                <WizardOption
                  key={s.id}
                  checked={form.service_id === s.id}
                  onSelect={() => set('service_id', s.id)}
                  title={s.name}
                  sub={SERVICE_BLURBS[String(s.slug || '').toLowerCase()]}
                  right={fromLabel(s)}
                />
              ))}
              {!services.length && !error ? <p className="bk-sub">Loading services…</p> : null}
            </div>
          </>
        )
      case 1:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>Which branch?</h2>
            <p className="bk-sub">Choose where you’ll bring your car.</p>
            <div className="bk-opts" role="radiogroup" aria-label="Branch">
              {branches.map((b) => (
                <WizardOption
                  key={b.slug}
                  checked={form.branch === b.slug}
                  onSelect={() => set('branch', b.slug)}
                  title={branchCityName(b)}
                  sub={b.address}
                />
              ))}
              {branchesLoading ? <p className="bk-sub">Loading branches…</p> : null}
            </div>
          </>
        )
      case 2:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>When would you like to come?</h2>
            <p className="bk-sub">We’ll confirm the exact time by SMS.</p>
            <label className="bk-field">
              <span>Date</span>
              <input type="date" min={todayKey()} value={form.visit_date} onChange={update('visit_date')} />
            </label>
            <div className="bk-field">
              <span id="bk-time-label">Time</span>
              <div className="bk-chips" role="radiogroup" aria-labelledby="bk-time-label">
                {BOOKING_TIMES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={form.visit_time === t}
                    className="bk-chip"
                    onClick={() => set('visit_time', t)}
                  >
                    {timeLabel(t)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )
      case 3:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>Tell us about your car</h2>
            <p className="bk-sub">We use the plate to find your past visits.</p>
            <label className="bk-field">
              <span>Plate or sticker number</span>
              <input
                value={form.vehicle_plate}
                placeholder="ABC 1234"
                onChange={update('vehicle_plate')}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <small>{plateHint || PLATE_FIELD_HINT}</small>
            </label>
            <div className="bk-two">
              <VehicleMakeModelFields
                make={form.vehicle_make}
                model={form.vehicle_model}
                onMakeChange={(vehicle_make) => set('vehicle_make', vehicle_make)}
                onModelChange={(vehicle_model) => set('vehicle_model', vehicle_model)}
                onSizeSuggest={(vehicle_type) => set('vehicle_type', vehicle_type)}
                variant="public"
                makeLabel="Brand"
                modelLabel="Model"
              />
            </div>
            <p className="bk-info">
              <i aria-hidden="true">i</i>
              <span>
                <b>No need to pick a car size.</b> Our team checks it when you arrive and confirms the final price.
              </span>
            </p>
          </>
        )
      case 4:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>How do we reach you?</h2>
            <p className="bk-sub">We’ll text you the booking confirmation.</p>
            <div className="bk-two">
              <label className="bk-field">
                <span>First name</span>
                <input value={form.customer_first_name} placeholder="Juan" autoComplete="given-name" onChange={update('customer_first_name')} />
              </label>
              <label className="bk-field">
                <span>Last name</span>
                <input value={form.customer_last_name} placeholder="Dela Cruz" autoComplete="family-name" onChange={update('customer_last_name')} />
              </label>
            </div>
            <label className="bk-field">
              <span>Mobile number</span>
              <input
                value={form.customer_phone}
                placeholder="0917 123 4567"
                inputMode="tel"
                autoComplete="tel"
                onChange={update('customer_phone')}
              />
              <small>Starts with 09, 11 digits</small>
            </label>
          </>
        )
      default:
        return (
          <>
            <h2 className="bk-title" ref={stepHeadingRef} tabIndex={-1}>Check your booking</h2>
            <p className="bk-sub">Tap Change to fix anything.</p>
            <dl className="bk-review">
              {[
                ['Service', service ? [service.name, fromLabel(service)?.toLowerCase()].filter(Boolean).join(' · ') : '', 0],
                ['Branch', branch ? branchCityName(branch) : form.branch, 1],
                ['When', `${niceDate(form.visit_date)} · ${form.visit_time ? timeLabel(form.visit_time) : ''}`, 2],
                ['Car', [form.vehicle_plate, form.vehicle_make, form.vehicle_model].filter(Boolean).join(' '), 3],
                ['You', `${form.customer_first_name} ${form.customer_last_name} · ${form.customer_phone}`, 4],
              ].map(([label, value, target]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                  <button type="button" className="bk-change" onClick={() => setStep(target)}>
                    Change<span className="sr-only"> {label.toLowerCase()}</span>
                  </button>
                </div>
              ))}
            </dl>
            <FormLegalNotice id="book-legal" className="bk-agree" />
          </>
        )
    }
  }

  return (
    <section className="booking-page">
      {/* Navy hero over the working surface — the same shape /queue and the
          interior marketing pages use, so the seam from the site is gone. */}
      <header className="booking-hero">
        <img className="booking-hero-media" src={queueHeroPoster} alt="" />
        <div className="public-shell booking-hero-in">
          <p className="eyebrow">Book a service</p>
          <h1 className="booking-hero-title">Your car’s next<br /><i>chapter</i> starts here.</h1>
          <p className="booking-hero-lede">Tell us what you drive and when you’d like to visit. Works with or without an account — we’ll SMS you updates.</p>
        </div>
      </header>
      <div className="public-shell booking-grid">
        <aside className="booking-rail">
          <div className="booking-rail-card">
            <p className="eyebrow">Have an account?</p>
            <p>Sign in first and this visit appears under My account, with history kept against your plate.</p>
            <Link to="/signin" className="booking-rail-cta">Sign in</Link>
          </div>
          {packageNote ? (
            <div className="booking-rail-card">
              <p className="eyebrow">Selected</p>
              <p>{packageNote}</p>
            </div>
          ) : null}
        </aside>
        {/* One question per screen. Same fields and the same /api/public-book call as the
            old flat form; car size is no longer asked. */}
        <form ref={wizardRef} onSubmit={submit} className="bk-wizard" noValidate={!lastStep}>
          <ol className="bk-progress" aria-hidden="true">
            {WIZARD_STEPS.map((label, i) => (
              <li key={label} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} />
            ))}
          </ol>
          <p className="bk-count">
            <span>
              Step <b>{step + 1}</b> of {WIZARD_STEPS.length}
            </span>
            <span>{WIZARD_STEPS[step]}</span>
          </p>

          {stepBody()}

          {(error || branchesError) && <p className="form-error" role="alert">{error || branchesError}</p>}
          <div className="bk-nav">
            {step > 0 ? (
              <button type="button" className="bk-btn bk-btn-back" onClick={() => setStep((s) => s - 1)}>
                Back
              </button>
            ) : null}
            {/* Distinct keys: reusing one <button> would let the Next click that opens
                Review land on the freshly-typed submit button and submit at once. */}
            {lastStep ? (
              <button key="submit" type="submit" className="bk-btn bk-btn-next" disabled={status === 'loading'}>
                {status === 'loading' ? 'Submitting…' : 'Request booking'}
              </button>
            ) : (
              <button key="next" type="button" className="bk-btn bk-btn-next" disabled={!stepReady} onClick={goNext}>
                Next
              </button>
            )}
          </div>
        </form>
      </div>
    </section>
  )
}

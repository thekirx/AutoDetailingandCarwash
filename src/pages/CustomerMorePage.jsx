import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  Cake,
  CalendarDays,
  Camera,
  Car,
  ChevronRight,
  Gift,
  KeyRound,
  LifeBuoy,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Newspaper,
  Phone,
  Plus,
  UserRound,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCustomerAppTheme } from '@/lib/customerAppTheme'
import Sheet, { SheetActions } from '@/components/customer/Sheet'
import { toast } from 'sonner'
import { useAuth } from '@/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { loadUserSettings, saveSmsOptIn } from '@/lib/userSettings'
import { isSyntheticCustomerEmail } from '@/lib/customerOnboarding'
import { isValidCustomerPlate, plateValidationError, PLATE_FIELD_HINT, safeVehiclePhotoUrl } from '@/lib/customerAuth'
import { VEHICLE_ICON_PRESETS, normalizeVehicleIcon, vehicleIconGlyph } from '@/lib/ownerRevisionsPhase7'
import { normalizePricingSize, PRICING_SIZES } from '@/lib/servicePricing'
import { fetchPortal, initials, portalAction } from '@/lib/customerPortalClient'
import { CUSTOMER_BOOK_PATH, CUSTOMER_LOYALTY_PATH, CUSTOMER_MORE_PATH } from '@/lib/customerAccountNav'
import { notificationHref } from '@/lib/notificationUrl'
import { usePageMeta } from '@/lib/pageMeta'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell, { useUserNotifications } from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import { Row, SectionHead, Skeleton } from '@/components/customer/CustomerUi'

const TAB_TITLES = {
  account: ['My profile', 'Email, phone, birthday, and password.'],
  garage: ['My cars', 'Plates saved to your account.'],
  alerts: ['Notifications', 'Push, text messages, and your inbox.'],
}

const EMPTY_CAR = { plate_number: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'medium', color: '', photo_url: '', icon: '' }

function formatWhen(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** /account/more — settings hub. `?tab=account|garage|alerts` opens a section; `&vehicle=<id>` edits a car. */
export default function CustomerMorePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || ''
  const navigate = useNavigate()
  const { user, profile: authProfile, signOut } = useAuth()
  const [portal, setPortal] = useState(null)
  const [smsOptIn, setSmsOptIn] = useState(null)
  const [signingOut, setSigningOut] = useState(false)

  const meta = TAB_TITLES[tab]
  usePageMeta({ title: meta ? meta[0] : 'Settings', description: 'Manage your Hakum account.', path: CUSTOMER_MORE_PATH })

  const load = useCallback(() => fetchPortal().then(setPortal).catch((err) => toast.error(err.message)), [])

  useEffect(() => {
    load()
    loadUserSettings()
      .then((s) => setSmsOptIn(s.sms_opt_in !== false))
      .catch(() => setSmsOptIn(true))
  }, [load])

  const profile = portal?.profile || { full_name: authProfile?.full_name, phone: authProfile?.phone, email: user?.email }
  const vehicles = portal?.vehicles || []
  const fullName = profile.full_name || ''
  const email = isSyntheticCustomerEmail(profile.email) ? '' : profile.email || ''

  if (tab && meta) {
    return (
      <CustomerAppFrame
        title={meta[0]}
        subtitle={meta[1]}
        backTo={CUSTOMER_MORE_PATH}
        backLabel="Me"
        actions={
          tab === 'garage' ? (
            <button
              type="button"
              className="capp-icon-btn"
              aria-label="Add a car"
              onClick={() => setParams({ tab: 'garage', add: '1' }, { replace: true })}
            >
              <Plus size={20} strokeWidth={2} aria-hidden />
            </button>
          ) : null
        }
      >
        {tab === 'account' ? <AccountSection profile={profile} onUpdated={load} /> : null}
        {tab === 'garage' ? (
          <GarageSection
            vehicles={vehicles}
            loaded={Boolean(portal)}
            editId={params.get('vehicle') || ''}
            startAdding={params.get('add') === '1'}
            onEdit={(id) => setParams(id ? { tab: 'garage', vehicle: id } : { tab: 'garage' }, { replace: true })}
            onUpdated={load}
          />
        ) : null}
        {tab === 'alerts' ? <AlertsSection phone={profile.phone} smsOptIn={smsOptIn} setSmsOptIn={setSmsOptIn} /> : null}
      </CustomerAppFrame>
    )
  }

  return (
    <CustomerAppFrame
      title="Me"
      navTitle={fullName || 'Me'}
      actions={<NotificationBell variant="capp" homeUrl={`${CUSTOMER_MORE_PATH}?tab=alerts`} homeLabel="Notifications" />}
      cols
    >
      <Link className="capp-card capp-profile capp-span" to={`${CUSTOMER_MORE_PATH}?tab=account`}>
        <span className="capp-avatar" aria-hidden>
          {initials(fullName) || <UserRound size={20} strokeWidth={1.75} />}
        </span>
        <span className="capp-row-body">
          <strong className="capp-title" style={{ fontSize: '1.05rem', margin: 0 }}>
            {fullName || 'Your account'}
          </strong>
          <em className="capp-meta" style={{ display: 'block', fontStyle: 'normal' }}>
            {email || profile.phone || 'Add your details'}
          </em>
        </span>
      </Link>

      <section className="capp-section" aria-label="Garage">
        <SectionHead title="Garage" />
        <div className="capp-group">
          <Row icon={Car} title="My cars" end={vehicles.length ? `${vehicles.length}` : ''} chevron to={`${CUSTOMER_MORE_PATH}?tab=garage`} />
        </div>
      </section>

      <section className="capp-section" aria-label="Account">
        <SectionHead title="Account" />
        <div className="capp-group">
          <Row icon={UserRound} title="My profile" chevron to={`${CUSTOMER_MORE_PATH}?tab=account`} />
          <Row icon={Bell} title="Notifications" sub="Push alerts and your inbox" chevron to={`${CUSTOMER_MORE_PATH}?tab=alerts`} />
          <SmsRow smsOptIn={smsOptIn} setSmsOptIn={setSmsOptIn} />
          <AppearanceRow />
        </div>
      </section>

      <section className="capp-section" aria-label="More">
        <SectionHead title="More" />
        <div className="capp-group">
          <Row icon={Gift} title="Rewards" chevron to={CUSTOMER_LOYALTY_PATH} />
          <Row icon={CalendarDays} title="Events" chevron to="/account/events" />
          <Row icon={Newspaper} title="Blog" chevron to="/account/blog" />
          <Row icon={LifeBuoy} title="Help and support" chevron to="/contact" />
        </div>
      </section>

      <div className="capp-group capp-span">
        <Row icon={LogOut} className="capp-row-danger" title={<span className="capp-link--danger">Sign out</span>} onClick={() => setSigningOut(true)} />
      </div>

      <Sheet open={signingOut} onClose={() => setSigningOut(false)} label="Sign out">
        <SheetActions
          heading="Sign out of Hakum?"
          sub="You'll need your phone number and PIN to sign back in."
          onCancel={() => setSigningOut(false)}
          actions={[
            {
              label: 'Sign out',
              danger: true,
              onClick: async () => {
                setSigningOut(false)
                await signOut()
                navigate('/signin', { replace: true })
              },
            },
          ]}
        />
      </Sheet>
    </CustomerAppFrame>
  )
}

/** Text-message alerts, switched in the row itself (same user_metadata flag as the Notifications screen). */
function SmsRow({ smsOptIn, setSmsOptIn }) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    const next = !smsOptIn
    setBusy(true)
    try {
      await saveSmsOptIn(next)
      setSmsOptIn(next)
      toast.success(next ? 'SMS alerts on' : 'SMS alerts off')
    } catch (err) {
      toast.error(err.message || 'Could not save SMS preference')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="capp-row is-static">
      <span className="capp-row-icon" aria-hidden>
        <MessageSquare size={18} strokeWidth={1.75} />
      </span>
      <span className="capp-row-body">
        <strong>Text messages</strong>
        <em>Reminders and status updates</em>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(smsOptIn)}
        aria-label="SMS alerts"
        disabled={busy || smsOptIn == null}
        className={`capp-switch${smsOptIn ? ' is-on' : ''}`}
        onClick={toggle}
      >
        <span />
      </button>
    </div>
  )
}

/** Light or dark for the app on this device. Dark is the website's navy and the default. */
function AppearanceRow() {
  const [appTheme, setAppTheme] = useCustomerAppTheme()
  const { setTheme } = useTheme()
  function pick(next) {
    setAppTheme(next)
    // Keep the site-wide class in step so the sign-in screens and website match the choice.
    setTheme(next)
  }
  return (
    <div className="capp-row is-static">
      <span className="capp-row-icon" aria-hidden>
        <Moon size={18} strokeWidth={1.75} />
      </span>
      <span className="capp-row-body">
        <strong>Appearance</strong>
      </span>
      <span className="capp-mini-seg" role="radiogroup" aria-label="Appearance">
        {['light', 'dark'].map((t) => (
          <button key={t} type="button" role="radio" aria-checked={appTheme === t} onClick={() => pick(t)}>
            {t === 'light' ? 'Light' : 'Dark'}
          </button>
        ))}
      </span>
    </div>
  )
}

function AccountSection({ profile, onUpdated }) {
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const syntheticEmail = isSyntheticCustomerEmail(profile?.email)

  useEffect(() => {
    setEmail(syntheticEmail ? '' : profile?.email || '')
    setPhone(profile?.phone || '')
    setBirthday(profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '')
  }, [profile, syntheticEmail])

  async function run(fn, okMessage) {
    setBusy(true)
    try {
      await fn()
      if (okMessage) toast.success(okMessage)
      onUpdated?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form
        className="capp-card"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const next = email.trim()
            if (isSyntheticCustomerEmail(next)) throw new Error('Use your own email, not a shop login address.')
            const { error } = await supabase.auth.updateUser({ email: next })
            if (error) throw error
            await portalAction('sync-email', { email: next })
          }, 'Check your inbox to confirm the new email')
        }}
      >
        <SectionHead title="Email" />
        <p className="capp-meta">
          {syntheticEmail ? 'Add a real inbox. Shop login addresses cannot receive confirmations.' : 'We send a confirmation link when this changes.'}
        </p>
        <label className="capp-field">
          <span>Login email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
          <Mail size={16} strokeWidth={1.75} aria-hidden />
          Update email
        </button>
      </form>

      <form
        className="capp-card"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => portalAction('update-phone', { phone: phone.trim() }), 'Phone updated')
        }}
      >
        <SectionHead title="Phone" />
        <label className="capp-field">
          <span>Mobile number</span>
          <input inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
          <Phone size={16} strokeWidth={1.75} aria-hidden />
          Update phone
        </button>
      </form>

      <form
        className="capp-card"
        onSubmit={(e) => {
          e.preventDefault()
          run(() => portalAction('update-birthday', { date_of_birth: birthday.trim() }), birthday.trim() ? 'Birthday saved' : 'Birthday cleared')
        }}
      >
        <SectionHead title="Birthday" />
        <p className="capp-meta">Greeting plus one free service at any Hakum branch.</p>
        <label className="capp-field">
          <span>Date of birth</span>
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </label>
        <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
          <Cake size={16} strokeWidth={1.75} aria-hidden />
          Save birthday
        </button>
      </form>

      <form
        className="capp-card"
        onSubmit={(e) => {
          e.preventDefault()
          if (password.length < 8) return toast.error('Use at least 8 characters')
          if (password !== password2) return toast.error('Passwords do not match')
          run(async () => {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
            setPassword('')
            setPassword2('')
          }, 'Password updated')
        }}
      >
        <SectionHead title="Password" />
        <label className="capp-field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="capp-field">
          <span>Confirm password</span>
          <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </label>
        <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
          <KeyRound size={16} strokeWidth={1.75} aria-hidden />
          Change password
        </button>
      </form>
    </>
  )
}

function GarageSection({ vehicles, loaded, editId, onEdit, onUpdated, startAdding = false }) {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(startAdding)
  const [picked, setPicked] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const editing = vehicles.find((v) => v.id === editId) || null
  const showForm = adding || Boolean(editing)

  useEffect(() => {
    if (startAdding) setAdding(true)
  }, [startAdding])

  function closeSheet() {
    setPicked(null)
    setConfirming(false)
  }

  async function remove(v) {
    closeSheet()
    try {
      await portalAction('archive-vehicle', { vehicle_id: v.id })
      toast.success(`${v.plate_number} removed`)
      onUpdated?.()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (!loaded) return <Skeleton n={2} />

  return (
    <>
      {vehicles.length && !showForm ? (
        <div className="capp-group capp-garage">
          {vehicles.map((v) => (
            <button key={v.id} type="button" className="capp-row" onClick={() => setPicked(v)}>
              {v.photo_url ? (
                <img className="capp-thumb" src={v.photo_url} alt="" />
              ) : (
                <span className="capp-row-icon" aria-hidden>
                  {v.icon ? vehicleIconGlyph(v.icon) : <Car size={18} strokeWidth={1.75} />}
                </span>
              )}
              <span className="capp-row-body">
                <strong className="capp-plate">{v.plate_number}</strong>
                <em>{[v.vehicle_make, v.vehicle_model, v.color].filter(Boolean).join(' · ') || 'Saved vehicle'}</em>
              </span>
              <ChevronRight className="capp-row-chevron" size={18} strokeWidth={1.75} aria-hidden />
            </button>
          ))}
        </div>
      ) : !showForm ? (
        <div className="capp-empty">
          <strong>No cars on file yet</strong>
          Save a plate so booking and queue tracking are one tap.
        </div>
      ) : null}

      {showForm ? (
        <CarForm
          key={editing?.id || 'new'}
          vehicle={editing}
          onDone={() => {
            setAdding(false)
            onEdit('')
            onUpdated?.()
          }}
          onCancel={() => {
            setAdding(false)
            onEdit('')
          }}
        />
      ) : (
        <button type="button" className="capp-btn capp-btn-accent capp-btn-block" onClick={() => setAdding(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          Add a car
        </button>
      )}

      <Sheet open={Boolean(picked)} onClose={closeSheet} label={picked ? `${picked.plate_number} actions` : 'Car actions'}>
        {picked ? (
          confirming ? (
            <SheetActions
              heading={`Remove ${picked.plate_number}?`}
              sub="It leaves your garage. Past visits stay in your history."
              onCancel={closeSheet}
              actions={[{ label: 'Remove from garage', danger: true, onClick: () => remove(picked) }]}
            />
          ) : (
            <SheetActions
              heading={<span className="capp-plate">{picked.plate_number}</span>}
              sub={[picked.vehicle_make, picked.vehicle_model, picked.color].filter(Boolean).join(' · ')}
              onCancel={closeSheet}
              actions={[
                {
                  label: 'Book this car',
                  onClick: () => {
                    closeSheet()
                    navigate(`${CUSTOMER_BOOK_PATH}?vehicle=${picked.id}`)
                  },
                },
                {
                  label: 'Edit details',
                  onClick: () => {
                    closeSheet()
                    onEdit(picked.id)
                  },
                },
                { label: 'Remove', danger: true, onClick: () => setConfirming(true) },
              ]}
            />
          )
        ) : null}
      </Sheet>
    </>
  )
}

function CarForm({ vehicle, onDone, onCancel }) {
  const [car, setCar] = useState(
    vehicle
      ? {
          plate_number: vehicle.plate_number || '',
          vehicle_make: vehicle.vehicle_make || '',
          vehicle_model: vehicle.vehicle_model || '',
          vehicle_type: normalizePricingSize(vehicle.vehicle_type),
          color: vehicle.color || '',
          photo_url: vehicle.photo_url || '',
          icon: vehicle.icon || '',
        }
      : EMPTY_CAR,
  )
  const [busy, setBusy] = useState(false)
  const [plateError, setPlateError] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoRef = useRef(null)

  async function handlePhotoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file')
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB')
    setPhotoUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('vehicle-photos').upload(path, file, { upsert: false })
    setPhotoUploading(false)
    if (error) {
      // ponytail: storage bucket may not exist; fall back to manual URL
      toast.warning('Upload failed. Paste a URL instead.')
      return
    }
    const { data: urlData } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
    setCar((c) => ({ ...c, photo_url: urlData?.publicUrl || '' }))
    toast.success('Photo uploaded')
  }

  async function save(e) {
    e.preventDefault()
    if (!isValidCustomerPlate(car.plate_number)) return setPlateError(plateValidationError(car.plate_number))
    if (car.photo_url && !safeVehiclePhotoUrl(car.photo_url)) return toast.error('Photo URL must start with http:// or https://')
    setPlateError('')
    setBusy(true)
    try {
      await portalAction(vehicle ? 'update-vehicle' : 'add-vehicle', {
        ...car,
        icon: normalizeVehicleIcon(car.icon),
        vehicle_id: vehicle?.id || undefined,
      })
      toast.success(vehicle ? 'Car updated' : 'Car saved to your garage')
      onDone()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="capp-card" onSubmit={save}>
      <SectionHead title={vehicle ? 'Edit car' : 'Add a car'} />
      <p className="capp-meta">
        {vehicle ? 'Use this when a conduction sticker becomes an LTO plate, or the number was typed wrong.' : 'Add the plate exactly as it appears on the car.'}
      </p>
      <label className="capp-field">
        <span>Plate number</span>
        <input
          required
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={plateError ? 'true' : 'false'}
          value={car.plate_number}
          onChange={(e) => {
            setPlateError('')
            setCar((c) => ({ ...c, plate_number: e.target.value.toUpperCase() }))
          }}
        />
        <p className="capp-field-hint">{PLATE_FIELD_HINT}</p>
        {plateError ? (
          <p className="capp-field-error" role="alert">
            {plateError}
          </p>
        ) : null}
      </label>
      <VehicleMakeModelFields
        make={car.vehicle_make}
        model={car.vehicle_model}
        onMakeChange={(vehicle_make) => setCar((c) => ({ ...c, vehicle_make }))}
        onModelChange={(vehicle_model) => setCar((c) => ({ ...c, vehicle_model }))}
        onSizeSuggest={(vehicle_type) => setCar((c) => ({ ...c, vehicle_type }))}
        variant="public"
        makeLabel="Brand"
        modelLabel="Model"
      />
      <label className="capp-field">
        <span>Car size</span>
        <select
          required
          value={car.vehicle_type || 'medium'}
          onChange={(e) => setCar((c) => ({ ...c, vehicle_type: e.target.value }))}
        >
          {PRICING_SIZES.map((sz) => (
            <option key={sz.slug} value={sz.slug}>
              {sz.label}
            </option>
          ))}
        </select>
        <p className="capp-field-hint">Auto-fills from make and model. Change it if the car is lifted, wrapped, or otherwise priced differently.</p>
      </label>
      <label className="capp-field">
        <span>Color (optional)</span>
        <input value={car.color} onChange={(e) => setCar((c) => ({ ...c, color: e.target.value }))} />
      </label>
      <div className="capp-field">
        <span>Icon</span>
        <div className="capp-pills" role="radiogroup" aria-label="Icon">
          {VEHICLE_ICON_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={car.icon === p.key}
              className={`capp-pill-btn${car.icon === p.key ? ' is-active' : ''}`}
              onClick={() => setCar((c) => ({ ...c, icon: p.key }))}
            >
              {p.glyph} {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="capp-field">
        <span>Photo (optional)</span>
        <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={handlePhotoFile} />
        <div className="capp-two">
          <button type="button" className="capp-btn capp-btn-ghost" disabled={photoUploading} onClick={() => photoRef.current?.click()}>
            <Camera size={16} strokeWidth={1.75} aria-hidden />
            {photoUploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <input type="url" placeholder="or paste URL" value={car.photo_url} onChange={(e) => setCar((c) => ({ ...c, photo_url: e.target.value }))} />
        </div>
        {car.photo_url && safeVehiclePhotoUrl(car.photo_url) ? <img className="capp-cover" src={car.photo_url} alt="Vehicle preview" /> : null}
      </div>
      <div className="capp-actions">
        <button type="button" className="capp-btn capp-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
          {busy ? 'Saving…' : vehicle ? 'Save changes' : 'Save car'}
        </button>
      </div>
    </form>
  )
}

function AlertsSection({ phone, smsOptIn, setSmsOptIn }) {
  const { rows, markRead } = useUserNotifications()
  const [smsBusy, setSmsBusy] = useState(false)

  async function toggleSms(next) {
    setSmsBusy(true)
    try {
      await saveSmsOptIn(next)
      setSmsOptIn(next)
      toast.success(next ? 'SMS alerts on' : 'SMS alerts off')
    } catch (err) {
      toast.error(err.message || 'Could not save SMS preference')
    } finally {
      setSmsBusy(false)
    }
  }

  async function sendTestSms() {
    setSmsBusy(true)
    try {
      const token = await getAccessTokenFresh()
      if (!token) throw new Error('Sign in again.')
      const res = await fetch('/api/lifecycle-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kind: 'self_test' }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Test text failed')
      const status = body.result?.status
      if (status === 'duplicate') toast.message('Already sent a test text today')
      else if (status === 'opted_out') toast.error('SMS is off for this account')
      else if (status === 'disabled') toast.error('Shop SMS is turned off')
      else if (status === 'sent' || body.result?.ok) toast.success('Test text sent')
      else toast.error(body.result?.providerResponse || 'Could not send the test text')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSmsBusy(false)
    }
  }

  return (
    <>
      <section className="capp-card" aria-label="Push notifications">
        <SectionHead title="Push" />
        <PushToggle audience="customer" layout="panel" />
      </section>

      <section className="capp-card" aria-label="SMS notifications">
        <SectionHead title="Text messages" />
        <div className="capp-pref">
          <div>
            <strong>{smsOptIn ? 'SMS alerts on' : 'SMS alerts off'}</strong>
            <em>Status texts to {phone || 'your saved number'} when the shop has SMS on.</em>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(smsOptIn)}
            aria-label="SMS alerts"
            disabled={smsBusy || smsOptIn == null}
            className={`capp-switch${smsOptIn ? ' is-on' : ''}`}
            onClick={() => toggleSms(!smsOptIn)}
          >
            <span />
          </button>
        </div>
        <button type="button" className="capp-btn capp-btn-ghost" disabled={smsBusy || !smsOptIn} onClick={sendTestSms}>
          {smsBusy ? 'Sending…' : 'Send test text'}
        </button>
      </section>

      <section className="capp-section" aria-label="Recent alerts">
        <SectionHead title="Inbox" />
        {!rows.length ? (
          <div className="capp-empty">
            <strong>No alerts yet</strong>
            Enable push or SMS, then send a test.
          </div>
        ) : (
          <div className="capp-group">
            {rows.slice(0, 8).map((row) => (
              <Row
                key={row.id}
                className={row.read_at ? '' : 'capp-row-new'}
                title={row.title}
                sub={row.body}
                end={formatWhen(row.created_at)}
                to={notificationHref(row.url, '/account')}
                onClick={() => markRead(row)}
              />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

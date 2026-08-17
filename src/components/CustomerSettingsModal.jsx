import { useEffect, useRef, useState } from 'react'
import { Cake, Camera, KeyRound, Mail, Phone, Plus } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { loadUserSettings, saveSmsOptIn } from '@/lib/userSettings'
import { isSyntheticCustomerEmail } from '@/lib/customerOnboarding'
import CustomerAppFrame from '@/components/CustomerAppFrame'
import NotificationBell, { useUserNotifications } from '@/components/NotificationBell'
import PushToggle from '@/components/PushToggle'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import { Link } from 'react-router-dom'
import { isValidCustomerPlate, plateValidationError, PLATE_FIELD_HINT, safeVehiclePhotoUrl } from '@/lib/customerAuth'

async function portalAction(action, payload) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in again.')
  const res = await fetch('/api/customer-portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Request failed')
  return body
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function CustomerSettingsModal({
  open,
  onOpenChange,
  profile,
  onUpdated,
  initialTab = 'alerts',
  vehicles = [],
  initialVehicle = null,
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { rows, markRead } = useUserNotifications()
  const [tab, setTab] = useState(initialTab)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthday, setBirthday] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(true)
  const [smsBusy, setSmsBusy] = useState(false)
  const [car, setCar] = useState({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '', photo_url: '' })
  const [editingId, setEditingId] = useState('')
  const [plateError, setPlateError] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoRef = useRef(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setEmail(isSyntheticCustomerEmail(profile?.email) ? '' : profile?.email || '')
    setPhone(profile?.phone || '')
    setBirthday(profile?.date_of_birth ? String(profile.date_of_birth).slice(0, 10) : '')
    setPassword('')
    setPassword2('')
    setCar({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '', photo_url: '' })
    setEditingId('')
    setPlateError('')
    setPhotoPreview('')
    setPhotoUploading(false)
    setTab(initialTab || 'alerts')
    if (initialVehicle) {
      setCar({
        plate_number: initialVehicle.plate_number || '',
        vehicle_make: initialVehicle.vehicle_make || '',
        vehicle_model: initialVehicle.vehicle_model || '',
        color: initialVehicle.color || '',
        photo_url: initialVehicle.photo_url || '',
      })
      setEditingId(initialVehicle.id || '')
      setPhotoPreview(initialVehicle.photo_url || '')
    }
    loadUserSettings()
      .then((s) => setSmsOptIn(s.sms_opt_in !== false))
      .catch(() => setSmsOptIn(true))
  }, [open, profile, initialTab, initialVehicle])

  if (!open) return null

  const dark = mounted && (resolvedTheme === 'dark' || theme === 'dark')
  const syntheticEmail = isSyntheticCustomerEmail(profile?.email)

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

  async function saveEmail(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const next = email.trim()
      if (isSyntheticCustomerEmail(next)) throw new Error('Use your own email, not a shop login address.')
      const { error } = await supabase.auth.updateUser({ email: next })
      if (error) throw error
      await portalAction('sync-email', { email: next })
      toast.success('Check your inbox to confirm the new email')
      onUpdated?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePhone(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await portalAction('update-phone', { phone: phone.trim() })
      toast.success('Phone updated')
      onUpdated?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Use at least 8 characters')
      return
    }
    if (password !== password2) {
      toast.error('Passwords do not match')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success('Password updated')
      setPassword('')
      setPassword2('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handlePhotoFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setPhotoUploading(true)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('vehicle-photos').upload(path, file, { upsert: false })
    if (error) {
      // ponytail: storage bucket may not exist — fall back to manual URL
      toast.warning('Upload failed — paste a URL instead')
      setPhotoUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('vehicle-photos').getPublicUrl(path)
    const url = urlData?.publicUrl || ''
    setCar((c) => ({ ...c, photo_url: url }))
    setPhotoPreview(url)
    setPhotoUploading(false)
    toast.success('Photo uploaded')
  }

  async function saveCar(e) {
    e.preventDefault()
    if (!isValidCustomerPlate(car.plate_number)) {
      setPlateError(plateValidationError(car.plate_number))
      return
    }
    if (car.photo_url && !safeVehiclePhotoUrl(car.photo_url)) {
      toast.error('Photo URL must start with http:// or https://')
      return
    }
    setPlateError('')
    setBusy(true)
    try {
      await portalAction(editingId ? 'update-vehicle' : 'add-vehicle', {
        ...car,
        vehicle_id: editingId || undefined,
      })
      toast.success(editingId ? 'Plate updated' : 'Car saved to your garage')
      setCar({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '', photo_url: '' })
      setEditingId('')
      setPlateError('')
      setPhotoPreview('')
      onUpdated?.()
      onOpenChange(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const tabs = [
    ['alerts', 'Alerts'],
    ['account', 'Account'],
    ['car', 'Garage'],
  ]

  return (
    <CustomerAppFrame
      title="Settings"
      subtitle="Alerts, email, and your garage."
      onBack={() => onOpenChange(false)}
      actions={<NotificationBell variant="capp" homeUrl="/account" homeLabel="Home" />}
    >
      <div className="capp-chips" role="tablist" aria-label="Settings sections">
        {tabs.map(([id, label], index) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`capp-chip capp-chip-btn${tab === id ? ' is-active' : ''}`}
            style={{ '--i': index, minWidth: '6.5rem' }}
            onClick={() => setTab(id)}
          >
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      {tab === 'alerts' ? (
        <>
          <section className="capp-ticket" aria-label="Appearance">
            <p className="capp-label">Look</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`capp-btn ${!dark ? 'capp-btn-fill' : 'capp-btn-ghost'}`} onClick={() => setTheme('light')}>
                Light
              </button>
              <button type="button" className={`capp-btn ${dark ? 'capp-btn-fill' : 'capp-btn-ghost'}`} onClick={() => setTheme('dark')}>
                Dark
              </button>
            </div>
          </section>

          <section className="capp-ticket" aria-label="Push notifications">
            <p className="capp-label">Push</p>
            <PushToggle audience="customer" layout="panel" />
          </section>

          <section className="capp-ticket" aria-label="SMS notifications">
            <p className="capp-label">Text messages</p>
            <div className="capp-pref">
              <div>
                <strong>{smsOptIn ? 'SMS alerts on' : 'SMS alerts off'}</strong>
                <em>Status texts to {phone || 'your saved number'} when the shop has SMS on.</em>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={smsOptIn}
                disabled={smsBusy}
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
            <p className="capp-label">Inbox</p>
            {!rows.length ? (
              <div className="capp-empty">
                <strong>No alerts yet</strong>
                Enable push or SMS, then send a test.
              </div>
            ) : (
              <div className="grid gap-2">
                {rows.slice(0, 6).map((row) => (
                  <Link
                    key={row.id}
                    to={row.url || '/account'}
                    className={`capp-row${row.read_at ? '' : ' capp-row-new'}`}
                    onClick={() => markRead(row)}
                  >
                    <span className="min-w-0 flex-1">
                      <strong>{row.title}</strong>
                      <em>{row.body}</em>
                    </span>
                    <span className="capp-meta" style={{ margin: 0, textAlign: 'right', maxWidth: '6.5rem' }}>
                      {formatWhen(row.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {tab === 'account' ? (
        <>
          <form className="capp-ticket" onSubmit={saveEmail}>
            <p className="capp-label">Email</p>
            <p className="capp-meta">
              {syntheticEmail
                ? 'Add a real inbox. Shop login addresses cannot receive confirmations.'
                : 'We send a confirmation link when this changes.'}
            </p>
            <label className="capp-field">
              <span>Login email</span>
              <input id="set-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
              <Mail size={16} strokeWidth={1.75} aria-hidden />
              Update email
            </button>
          </form>

          <form
            className="capp-ticket"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await portalAction('update-birthday', { date_of_birth: birthday.trim() })
                toast.success(birthday.trim() ? 'Birthday saved' : 'Birthday cleared')
                onUpdated?.()
              } catch (err) {
                toast.error(err.message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <p className="capp-label">Birthday</p>
            <p className="capp-meta">Greeting plus one free service at any Hakum branch.</p>
            <label className="capp-field">
              <span>Date of birth</span>
              <input id="set-bday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </label>
            <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
              <Cake size={16} strokeWidth={1.75} aria-hidden />
              Save birthday
            </button>
          </form>

          <form className="capp-ticket" onSubmit={savePhone}>
            <p className="capp-label">Phone</p>
            <label className="capp-field">
              <span>Mobile number</span>
              <input id="set-phone" inputMode="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
              <Phone size={16} strokeWidth={1.75} aria-hidden />
              Update phone
            </button>
          </form>

          <form className="capp-ticket" onSubmit={savePassword}>
            <p className="capp-label">Password</p>
            <label className="capp-field">
              <span>New password</span>
              <input id="set-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="capp-field">
              <span>Confirm password</span>
              <input id="set-pw2" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </label>
            <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
              <KeyRound size={16} strokeWidth={1.75} aria-hidden />
              Change password
            </button>
          </form>
        </>
      ) : null}

      {tab === 'car' ? (
        <form className="capp-ticket" onSubmit={saveCar}>
          <p className="capp-label">{editingId ? 'Change plate' : 'Add a plate'}</p>
          <p className="capp-meta">
            {editingId
              ? 'Use this when a conduction sticker becomes an LTO plate, or the number was typed wrong.'
              : 'Prefer adding plates in person or at POS. Use this if you already know the plate.'}
          </p>
          {vehicles.length ? (
            <div className="capp-chips" style={{ marginBottom: '0.75rem' }}>
              {vehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`capp-chip capp-chip-btn${editingId === v.id ? ' is-active' : ''}`}
                  onClick={() => {
                    setEditingId(v.id)
                    setCar({
                      plate_number: v.plate_number || '',
                      vehicle_make: v.vehicle_make || '',
                      vehicle_model: v.vehicle_model || '',
                      color: v.color || '',
                      photo_url: v.photo_url || '',
                    })
                    setPhotoPreview(v.photo_url || '')
                    setPlateError('')
                  }}
                >
                  <strong>{v.plate_number}</strong>
                  <em>{[v.vehicle_make, v.vehicle_model].filter(Boolean).join(' ') || 'Saved car'}</em>
                </button>
              ))}
              <button
                type="button"
                className={`capp-chip capp-chip-btn${!editingId ? ' is-active' : ''}`}
                onClick={() => {
                  setEditingId('')
                  setCar({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '', photo_url: '' })
                  setPhotoPreview('')
                  setPlateError('')
                }}
              >
                <strong>New car</strong>
                <em>Add another plate</em>
              </button>
            </div>
          ) : null}
          <label className="capp-field">
            <span>Plate number</span>
            <input
              id="car-plate"
              required
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={plateError ? 'true' : 'false'}
              aria-describedby="car-plate-hint"
              value={car.plate_number}
              onChange={(e) => {
                setPlateError('')
                setCar((c) => ({ ...c, plate_number: e.target.value.toUpperCase() }))
              }}
            />
            <p id="car-plate-hint" className="capp-field-hint">
              {PLATE_FIELD_HINT}
            </p>
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
            variant="public"
            makeLabel="Brand"
            modelLabel="Model"
          />
          <label className="capp-field">
            <span>Color (optional)</span>
            <input id="car-color" value={car.color} onChange={(e) => setCar((c) => ({ ...c, color: e.target.value }))} />
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p className="capp-label" style={{ margin: 0 }}>Vehicle photo</p>
            <input
              ref={photoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }}
              onChange={handlePhotoFile}
            />
            <button
              type="button"
              className="capp-btn capp-btn-ghost"
              disabled={photoUploading}
              onClick={() => photoRef.current?.click()}
            >
              <Camera size={16} strokeWidth={1.75} aria-hidden />
              {photoUploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <label className="capp-field">
              <span>Or paste image URL</span>
              <input
                id="car-photo-url"
                type="url"
                placeholder="https://…"
                value={car.photo_url}
                onChange={(e) => { setCar((c) => ({ ...c, photo_url: e.target.value })); setPhotoPreview(e.target.value) }}
              />
            </label>
            {photoPreview && (
              <img
                src={photoPreview}
                alt="Vehicle preview"
                style={{ width: '100%', maxHeight: '12rem', objectFit: 'cover', borderRadius: '0.75rem', marginTop: '0.25rem' }}
                onError={() => setPhotoPreview('')}
              />
            )}
          </div>

          <button type="submit" className="capp-btn capp-btn-fill" disabled={busy}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {busy ? 'Saving…' : editingId ? 'Save plate change' : 'Save plate'}
          </button>
        </form>
      ) : null}
    </CustomerAppFrame>
  )
}

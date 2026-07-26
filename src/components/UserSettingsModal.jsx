import { useEffect, useState } from 'react'
import { KeyRound, Mail, Moon, Phone, Plus, Settings, Sun, Smartphone } from 'lucide-react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getAccessTokenFresh } from '@/lib/authToken'
import { loadUserSettings, saveSmsOptIn } from '@/lib/userSettings'
import PushToggle from '@/components/PushToggle'
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

/**
 * Shared settings for customer + ops (theme, push, SMS, email, password; garage for customers).
 * @param {'customer'|'ops'} [audience]
 */
export default function UserSettingsModal({
  open,
  onOpenChange,
  profile,
  onUpdated,
  initialTab = 'alerts',
  audience = 'customer',
  showGarage = false,
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [tab, setTab] = useState(initialTab)
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(true)
  const [smsBusy, setSmsBusy] = useState(false)
  const [car, setCar] = useState({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '' })
  const [mounted, setMounted] = useState(false)

  const isCustomer = audience === 'customer' || showGarage

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setEmail(profile?.email || '')
    setPhone(profile?.phone || '')
    setPassword('')
    setPassword2('')
    setCar({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '' })
    setTab(initialTab || 'alerts')
    loadUserSettings()
      .then((s) => setSmsOptIn(s.sms_opt_in !== false))
      .catch(() => setSmsOptIn(true))
  }, [open, profile, initialTab])

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

  async function saveEmail(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() })
      if (error) throw error
      if (isCustomer) {
        await portalAction('sync-email', { email: email.trim() })
      }
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
    if (!isCustomer) return
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

  async function saveCar(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await portalAction('add-vehicle', car)
      toast.success('Car saved to your garage')
      setCar({ plate_number: '', vehicle_make: '', vehicle_model: '', color: '' })
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
    ...(showGarage ? [['car', 'Garage']] : []),
  ]

  const dark = mounted && (resolvedTheme === 'dark' || theme === 'dark')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isCustomer
            ? 'account-sheet-modal max-h-[92svh] gap-0 overflow-y-auto p-0 sm:max-w-lg'
            : 'max-h-[92svh] gap-0 overflow-y-auto p-0 sm:max-w-lg'
        }
      >
        <div className={isCustomer ? 'account-modal-head' : 'border-b border-border bg-muted/40 px-5 py-4'}>
          <span className={isCustomer ? 'account-modal-badge' : 'mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'} aria-hidden>
            <Settings className="size-5" />
          </span>
          <DialogHeader className="gap-1 text-left">
            <p className={`text-[10px] font-extrabold tracking-[0.22em] uppercase ${isCustomer ? 'text-white/60' : 'text-muted-foreground'}`}>
              Settings
            </p>
            <DialogTitle className={isCustomer ? 'text-xl text-white' : 'text-xl'}>
              {isCustomer ? 'Your Hakum account' : 'Your preferences'}
            </DialogTitle>
            <DialogDescription className={isCustomer ? 'text-white/75' : undefined}>
              Theme, push & SMS alerts, email, and password.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div
          className={
            isCustomer
              ? `account-seg ${showGarage ? 'account-seg-3' : 'account-seg-2'} mx-4 mt-4 sm:mx-5`
              : 'mx-4 mt-4 flex gap-1 rounded-xl border border-border bg-muted/50 p-1 sm:mx-5'
          }
          role="tablist"
          aria-label="Settings sections"
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={
                isCustomer
                  ? `account-seg-btn ${tab === id ? 'is-active' : ''}`
                  : `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`
              }
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          {tab === 'alerts' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold">Appearance</p>
                <p className="text-sm text-muted-foreground">Switch light or dark for this device.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={!dark ? 'default' : 'outline'}
                    className="min-h-11"
                    onClick={() => setTheme('light')}
                  >
                    <Sun data-icon="inline-start" />
                    Light
                  </Button>
                  <Button
                    type="button"
                    variant={dark ? 'default' : 'outline'}
                    className="min-h-11"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon data-icon="inline-start" />
                    Dark
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-sm font-semibold">Push notifications</p>
                <p className="text-sm text-muted-foreground">
                  Visit and floor updates on this device when allowed.
                </p>
                <div className={`rounded-xl border border-border p-3 ${isCustomer ? 'border-[#052699]/12 bg-[#f4f6fb]' : 'bg-muted/40'}`}>
                  <PushToggle audience={audience === 'ops' ? 'ops' : 'customer'} surface="light" />
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Smartphone className="size-4" aria-hidden />
                  SMS notifications
                </div>
                <p className="text-sm text-muted-foreground">
                  Text status updates to your phone when SMS is enabled for the shop.
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={smsOptIn}
                  disabled={smsBusy}
                  onClick={() => toggleSms(!smsOptIn)}
                  className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    smsOptIn ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border bg-muted/30 text-muted-foreground'
                  }`}
                >
                  <span>{smsOptIn ? 'SMS alerts on' : 'SMS alerts off'}</span>
                  <span
                    className={`relative h-6 w-11 rounded-full transition ${smsOptIn ? 'bg-primary' : 'bg-muted-foreground/40'}`}
                    aria-hidden
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition ${smsOptIn ? 'translate-x-5' : ''}`}
                    />
                  </span>
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'account' ? (
            <div className="space-y-5">
              <form onSubmit={saveEmail} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <Mail className="size-4 text-primary" aria-hidden />
                  Email
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="set-email">Login email</Label>
                  <Input id="set-email" type="email" required className="min-h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button type="submit" className={isCustomer ? 'account-btn account-btn-primary min-h-11 w-full' : 'min-h-11 w-full'} disabled={busy}>
                  Update email
                </Button>
              </form>

              {isCustomer ? (
                <form onSubmit={savePhone} className="space-y-3 border-t border-border pt-5">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <Phone className="size-4 text-primary" aria-hidden />
                    Phone
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="set-phone">Mobile number</Label>
                    <Input id="set-phone" inputMode="tel" required className="min-h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <Button type="submit" className="account-btn account-btn-primary min-h-11 w-full" disabled={busy}>
                    Update phone
                  </Button>
                </form>
              ) : null}

              <form onSubmit={savePassword} className="space-y-3 border-t border-border pt-5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <KeyRound className="size-4 text-primary" aria-hidden />
                  Password
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="set-pw">New password</Label>
                  <Input id="set-pw" type="password" autoComplete="new-password" className="min-h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="set-pw2">Confirm password</Label>
                  <Input id="set-pw2" type="password" autoComplete="new-password" className="min-h-11" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
                <Button type="submit" className={isCustomer ? 'account-btn account-btn-primary min-h-11 w-full' : 'min-h-11 w-full'} disabled={busy}>
                  Change password
                </Button>
              </form>
            </div>
          ) : null}

          {tab === 'car' && showGarage ? (
            <form onSubmit={saveCar} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Prefer adding plates in-person or at POS. Use this only if you already know your plate.
              </p>
              <div className="grid gap-1.5">
                <Label htmlFor="car-plate">Plate number</Label>
                <Input id="car-plate" required className="min-h-11" value={car.plate_number} onChange={(e) => setCar((c) => ({ ...c, plate_number: e.target.value }))} />
              </div>
              <VehicleMakeModelFields
                make={car.vehicle_make}
                model={car.vehicle_model}
                onMakeChange={(vehicle_make) => setCar((c) => ({ ...c, vehicle_make }))}
                onModelChange={(vehicle_model) => setCar((c) => ({ ...c, vehicle_model }))}
                variant="public"
                makeLabel="Brand"
                modelLabel="Model"
              />
              <div className="grid gap-1.5">
                <Label htmlFor="car-color">Color (optional)</Label>
                <Input id="car-color" className="min-h-11" value={car.color} onChange={(e) => setCar((c) => ({ ...c, color: e.target.value }))} />
              </div>
              <DialogFooter className="pt-1 sm:flex-col">
                <Button type="submit" className="account-btn account-btn-primary min-h-12 w-full" disabled={busy}>
                  <Plus data-icon="inline-start" />
                  {busy ? 'Saving…' : 'Save plate'}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

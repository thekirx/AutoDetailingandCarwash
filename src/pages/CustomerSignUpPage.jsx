import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Cake, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import HakumAuthShell, { CUSTOMER_AUTH_BULLETS } from '../components/HakumAuthShell'
import { AuthLegalLinks } from '../components/FormLegalNotice'
import { usePageMeta } from '../lib/pageMeta'
import { resolveCustomerAuthIntent } from '../lib/customerAccountLifecycle'
import {
  ONBOARDING_STEPS,
  emptyOnboardingDraft,
  mergeTeamLeadPrefill,
  validateOnboardingField,
  validateOnboardingStep,
} from '../lib/customerOnboarding'

async function authLookup(identifier) {
  const res = await fetch('/api/customer-auth-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, action: 'lookup', site_origin: window.location.origin }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Lookup failed.')
  return data
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="hakum-auth-field-error" role="alert">
      {message}
    </p>
  )
}

export default function CustomerSignUpPage() {
  usePageMeta({
    title: 'Create account',
    description: 'Join Hakum Auto Care. Add your name, plate, and birthday for a free carwash on your day.',
    path: '/signup',
  })

  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(() => ({
    ...emptyOnboardingDraft(),
    phone: params.get('phone') || '',
  }))
  const [errors, setErrors] = useState({})
  const [banner, setBanner] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [looking, setLooking] = useState(false)
  const navigate = useNavigate()

  const stepDef = ONBOARDING_STEPS[step]
  const stepIndex = step

  useEffect(() => {
    const phone = params.get('phone')
    if (phone) setForm((f) => ({ ...f, phone }))
  }, [params])

  const update = (key) => (e) => {
    const value = key === 'accepted_terms' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      const message = validateOnboardingField(key, value, { ...form, [key]: value })
      if (message) next[key] = message
      else delete next[key]
      return next
    })
  }

  const blur = (key) => () => {
    const message = validateOnboardingField(key, form[key], form)
    setErrors((prev) => (message ? { ...prev, [key]: message } : { ...prev, [key]: undefined }))
  }

  async function lookupPhoneAndPrefill(phone) {
    setLooking(true)
    try {
      const data = await authLookup(phone)
      const intent = resolveCustomerAuthIntent({ status: data.status, flow: 'signup' })
      if (intent.action === 'block_exists') {
        return { block: intent.message }
      }
      if (intent.action === 'activate') {
        if (data.prefill) setForm((f) => mergeTeamLeadPrefill({ ...f, phone }, data.prefill))
        setBanner(intent.message)
      }
      return { block: '' }
    } catch {
      return { block: '' }
    } finally {
      setLooking(false)
    }
  }

  const goNext = async (event) => {
    event.preventDefault()
    setError('')
    const checked = validateOnboardingStep(stepDef.id, form)
    setErrors(checked.errors)
    if (!checked.ok) return

    if (stepDef.id === 'phone') {
      const { block } = await lookupPhoneAndPrefill(form.phone)
      if (block) {
        setError(block)
        return
      }
    }

    if (step < ONBOARDING_STEPS.length - 1) {
      setStep((n) => n + 1)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/customer-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          plate: form.plate,
          date_of_birth: form.date_of_birth,
          email: form.email || null,
          password: form.password,
          confirm: form.confirm,
          accepted_terms: true,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (body.fields) setErrors(body.fields)
        throw new Error(body.error || 'Unable to create account.')
      }

      const loginEmail = body.email
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: form.password,
      })
      if (signInError) {
        navigate('/signin', { replace: true, state: { justSignedUp: true, phone: form.phone } })
        return
      }
      navigate('/account', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const titles = useMemo(
    () => ({
      phone: 'Start with your number.',
      profile: 'You and your car.',
      birthday: 'Free wash on your day.',
      security: 'Lock it in.',
    }),
    [],
  )

  return (
    <HakumAuthShell
      title={titles[stepDef.id] || 'Join the Hakum circle.'}
      subtitle="A short setup. Name, plate, birthday, then a password. Sign in later with your phone."
      bullets={CUSTOMER_AUTH_BULLETS}
      footerLinks={
        <>
          <p>
            Already have an account? <Link to="/signin">Sign in</Link>
          </p>
          <p>
            <Link to="/">Back to site</Link>
          </p>
          <AuthLegalLinks />
        </>
      }
    >
      <h2>Create account</h2>
      <p className="hakum-auth-welcome">
        {form.source === 'team_lead'
          ? 'Finish what the shop started. Then you can open your account.'
          : 'Customer signup only. Team accounts are issued by Super Admin.'}
      </p>

      <ol className="hakum-auth-steps" aria-label="Account setup steps">
        {ONBOARDING_STEPS.map((row, i) => (
          <li key={row.id} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''}>
            <span aria-hidden>{i + 1}</span>
            {row.label}
          </li>
        ))}
      </ol>

      {banner ? (
        <p className="hakum-auth-info" role="status">
          {banner}
        </p>
      ) : null}
      {error ? (
        <p className="hakum-auth-alert" role="alert">
          {error}
          {error.includes('Sign in') ? (
            <>
              {' '}
              <Link to="/signin">Go to sign in</Link>
            </>
          ) : null}
        </p>
      ) : null}

      <form onSubmit={goNext} className="hakum-auth-form" noValidate>
        {stepDef.id === 'phone' ? (
          <label>
            <span>Mobile number</span>
            <input
              required
              inputMode="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={update('phone')}
              onBlur={blur('phone')}
              placeholder="09XXXXXXXXX"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'err-phone' : undefined}
            />
            <FieldError id="err-phone" message={errors.phone} />
          </label>
        ) : null}

        {stepDef.id === 'profile' ? (
          <>
            <label>
              <span>Full name</span>
              <input
                required
                autoComplete="name"
                value={form.full_name}
                onChange={update('full_name')}
                onBlur={blur('full_name')}
                aria-invalid={Boolean(errors.full_name)}
                aria-describedby={errors.full_name ? 'err-name' : undefined}
              />
              <FieldError id="err-name" message={errors.full_name} />
            </label>
            <label>
              <span>Plate number</span>
              <input
                required
                autoComplete="off"
                value={form.plate}
                onChange={update('plate')}
                onBlur={blur('plate')}
                placeholder="ABC 1234"
                aria-invalid={Boolean(errors.plate)}
                aria-describedby={errors.plate ? 'err-plate' : undefined}
              />
              <FieldError id="err-plate" message={errors.plate} />
            </label>
          </>
        ) : null}

        {stepDef.id === 'birthday' ? (
          <>
            <div className="hakum-auth-perk" role="note">
              <Cake className="size-4" aria-hidden />
              <p>
                Add your birthday and we treat you to a <strong>free carwash</strong> on your day, plus a greeting on
                your phone.
              </p>
            </div>
            <label>
              <span>Birthday</span>
              <input
                required
                type="date"
                autoComplete="bday"
                value={form.date_of_birth}
                onChange={update('date_of_birth')}
                onBlur={blur('date_of_birth')}
                aria-invalid={Boolean(errors.date_of_birth)}
                aria-describedby={errors.date_of_birth ? 'err-bday' : 'bday-help'}
              />
              <p id="bday-help" className="hakum-auth-hint">
                Used only for your birthday perk. You can change it later in Settings.
              </p>
              <FieldError id="err-bday" message={errors.date_of_birth} />
            </label>
          </>
        ) : null}

        {stepDef.id === 'security' ? (
          <>
            <label>
              <span>Email (optional)</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                onBlur={blur('email')}
                placeholder="you@email.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'err-email' : undefined}
              />
              <FieldError id="err-email" message={errors.email} />
            </label>
            <label>
              <span>Password</span>
              <div className="hakum-auth-password">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update('password')}
                  onBlur={blur('password')}
                  minLength={8}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'err-pass' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <FieldError id="err-pass" message={errors.password} />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                required
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={update('confirm')}
                onBlur={blur('confirm')}
                minLength={8}
                aria-invalid={Boolean(errors.confirm)}
                aria-describedby={errors.confirm ? 'err-confirm' : undefined}
              />
              <FieldError id="err-confirm" message={errors.confirm} />
            </label>
            <label className="hakum-auth-terms">
              <input
                type="checkbox"
                checked={form.accepted_terms}
                onChange={update('accepted_terms')}
                required
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" target="_blank" rel="noopener noreferrer">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            <FieldError id="err-terms" message={errors.accepted_terms} />
          </>
        ) : null}

        <div className="hakum-auth-wizard-nav">
          {stepIndex > 0 ? (
            <button type="button" className="hakum-auth-back" onClick={() => setStep((n) => n - 1)}>
              Back
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="hakum-auth-submit" disabled={submitting || looking}>
            {looking ? 'Checking…' : submitting ? 'Saving…' : stepIndex === ONBOARDING_STEPS.length - 1 ? 'Create account' : 'Continue'}
          </button>
        </div>
      </form>
    </HakumAuthShell>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Facebook, Instagram, Mail, MapPin, MessageSquareWarning, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { createPublicFormGuard, validatePublicFormGuard } from '@/lib/publicFormGuard'
import { usePublicBranches } from '@/lib/branches'
import FormLegalNotice from '@/components/FormLegalNotice'

const channels = [
  {
    key: 'phone',
    icon: Phone,
    label: 'Call or text',
    value: '0915 629 6096',
    hint: 'Fastest way to reach the floor team',
    href: 'tel:+639156296096',
  },
  {
    key: 'sales',
    icon: Mail,
    label: 'Sales and bookings',
    value: 'sales@hakumautocare.com',
    hint: 'Quotes, packages, and schedule questions',
    href: 'mailto:sales@hakumautocare.com',
  },
  {
    key: 'admin',
    icon: Mail,
    label: 'Admin and billing',
    value: 'admin@hakumautocare.com',
    hint: 'Invoices, records, and partnerships',
    href: 'mailto:admin@hakumautocare.com',
  },
]

const socials = [
  {
    key: 'facebook',
    icon: Facebook,
    label: 'Facebook',
    handle: 'Hakum Auto Care',
    href: 'https://www.facebook.com/share/1GHerg8pxV/',
  },
  {
    key: 'instagram',
    icon: Instagram,
    label: 'Instagram',
    handle: '@_hakumautocare',
    href: 'https://www.instagram.com/_hakumautocare',
  },
]

export default function ContactPage() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [guard, setGuard] = useState(() => createPublicFormGuard())
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' })
  const { branches } = usePublicBranches({ mode: 'visible' })

  async function submit(event) {
    event.preventDefault()
    setStatus('loading')
    setError('')
    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setError(blocked)
      setStatus('idle')
      return
    }
    const { error: e } = await supabase.from('contact_inquiries').insert({
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      subject: form.subject.trim(),
      message: form.message.trim(),
    })
    if (e) {
      setError(e.message)
      setStatus('idle')
      return
    }
    setStatus('success')
    setGuard(createPublicFormGuard())
  }

  if (status === 'success') {
    return (
      <section className="utility-hero">
        <div className="public-shell">
          <p className="eyebrow eyebrow-light">Contact</p>
          <h1 className="display-title">Message received.</h1>
          <p className="inner-hero-copy">Our team will reply shortly at sales@hakumautocare.com.</p>
          <Link className="button button-blue" to="/">Back home</Link>
        </div>
      </section>
    )
  }

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  return (
    <section className="contact-page">
      <div className="public-shell contact-intro">
        <p className="eyebrow">Talk to Hakum</p>
        <h1 className="section-title">Contact us</h1>
        <p className="contact-lede">
          Questions about services, bookings, or branches — reach us directly, or send a note at the
          bottom of this page and we will follow up.
        </p>
      </div>

      <div className="public-shell contact-channels">
        {channels.map(({ key, icon: Icon, label, value, hint, href }) => (
          <a className="contact-card" key={key} href={href}>
            <span className="contact-card-icon" aria-hidden>
              <Icon />
            </span>
            <p className="contact-card-label">{label}</p>
            <strong className="contact-card-value">{value}</strong>
            <span className="contact-card-hint">{hint}</span>
          </a>
        ))}
        <Link className="contact-card contact-card-alt" to="/complaints">
          <span className="contact-card-icon" aria-hidden>
            <MessageSquareWarning />
          </span>
          <p className="contact-card-label">Something went wrong?</p>
          <strong className="contact-card-value">Submit a complaint</strong>
          <span className="contact-card-hint">Goes straight to branch management</span>
        </Link>
      </div>

      <div className="public-shell contact-split">
        <div className="contact-block">
          <h2 className="contact-block-title">Visit a branch</h2>
          <div className="contact-branches">
            {branches.map((b) => (
              <Link
                className="contact-branch"
                key={b.slug}
                to={b.coming_soon ? '/branches' : `/queue/${b.slug}`}
              >
                <span className="contact-branch-icon" aria-hidden>
                  <MapPin />
                </span>
                <span className="contact-branch-copy">
                  <strong>{b.name.replace(/^Hakum Auto Care\s*/i, '') || b.name}</strong>
                  <small>{b.coming_soon ? 'Coming soon' : (b.address || 'Open daily')}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </Link>
            ))}
            {!branches.length ? (
              <Link className="contact-branch" to="/branches">
                <span className="contact-branch-icon" aria-hidden>
                  <MapPin />
                </span>
                <span className="contact-branch-copy">
                  <strong>Find a branch</strong>
                  <small>Locations across the Philippines</small>
                </span>
                <ArrowUpRight aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="contact-block">
          <h2 className="contact-block-title">Follow the work</h2>
          <div className="contact-socials">
            {socials.map(({ key, icon: Icon, label, handle, href }) => (
              <a className="contact-social" key={key} href={href} target="_blank" rel="noreferrer">
                <span className="contact-social-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="contact-branch-copy">
                  <strong>{label}</strong>
                  <small>{handle}</small>
                </span>
                <ArrowUpRight aria-hidden />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="public-shell contact-form-block">
        <div className="contact-form-head">
          <p className="eyebrow">Send a message</p>
          <h2 className="contact-block-title">Tell us what you need.</h2>
          <p className="contact-lede">
            Share a few details and the team will get back to you with next steps.
          </p>
        </div>
        <form onSubmit={submit} className="booking-form">
          <label>Name<input required value={form.name} onChange={update('name')} /></label>
          <label>Phone<input required value={form.phone} onChange={update('phone')} /></label>
          <label>Email<input type="email" value={form.email} onChange={update('email')} /></label>
          <label className="booking-span-2">Subject<input required value={form.subject} onChange={update('subject')} /></label>
          <label className="booking-span-2">Message<textarea required rows={4} value={form.message} onChange={update('message')} /></label>
          {/* honeypot — leave empty */}
          <label className="sr-only" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
            Company website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={guard.honeypot}
              onChange={(e) => setGuard((g) => ({ ...g, honeypot: e.target.value }))}
            />
          </label>
          <FormLegalNotice id="contact-legal" className="form-legal-notice booking-span-2" />
          {error && <p className="form-error">{error}</p>}
          <button disabled={status === 'loading'} className="button button-blue">{status === 'loading' ? 'Sending…' : 'Send message'}</button>
        </form>
      </div>
    </section>
  )
}

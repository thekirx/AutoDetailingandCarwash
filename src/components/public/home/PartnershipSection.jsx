import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { createPublicFormGuard, validatePublicFormGuard } from '../../../lib/publicFormGuard'
import {
  SITE_TYPES,
  normalizePartnershipInquiry,
  submitPartnershipInquiry,
  validatePartnershipInquiry,
} from '../../../lib/partnershipInquiry'

const EMPTY_FORM = {
  siteType: SITE_TYPES[0].value,
  name: '',
  email: '',
  contactNumber: '',
  city: '',
  message: '',
}

function FieldError({ id, children }) {
  if (!children) return null
  return <span className="partnership-error" id={id}>{children}</span>
}

export default function PartnershipSection() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle')
  const [notice, setNotice] = useState('')
  const [guard, setGuard] = useState(createPublicFormGuard)

  const update = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
    setNotice('')
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validatePartnershipInquiry(form)
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setStatus('validating')
      return
    }

    const blocked = validatePublicFormGuard(guard)
    if (blocked) {
      setStatus('blocked')
      setNotice(blocked)
      return
    }

    setStatus('submitting')
    const result = await submitPartnershipInquiry(normalizePartnershipInquiry(form), guard)
    setStatus(result.ok ? 'submitted' : result.code)
    setNotice(result.message || '')
    if (result.ok) {
      setForm(EMPTY_FORM)
      setGuard(createPublicFormGuard())
    }
  }

  const submitted = status === 'submitted'

  return (
    <section id="partnership" className="partnership-section" data-motion-section="partnership">
      <div className="public-shell partnership-layout">
        <div className="partnership-intro" data-motion="heading">
          <p className="eyebrow eyebrow-light">
            <i aria-hidden="true" />
            Hakum site partnerships
          </p>
          <h2 className="section-title light">
            Your space.
            <br />
            <em>Our standard.</em>
          </h2>
          <p className="partnership-lede">
            If you hold a property with the right traffic and the right room, we will bring the crew,
            the equipment, and the Hakum operation to it — and run it to the same standard as every
            other branch.
          </p>

          <div className="partnership-quiet">
            <p>
              We keep the specifics off the website. Terms and how the arrangement actually works are
              discussed privately, once we know the site is a fit for both sides.
            </p>
          </div>

          <ul className="partnership-marks">
            {SITE_TYPES.map((type) => <li key={type.value}>{type.label}</li>)}
          </ul>
        </div>

        <div className="partnership-card" data-motion="form">
          <div className="partnership-card-head">
            <div>
              <h3>Tell us about your site</h3>
              <p>A few details is all we need. If the location works, we will reach out to arrange a visit.</p>
            </div>
            <span className="partnership-reply-badge">
              <i aria-hidden="true" />
              Replies in 2 days
            </span>
          </div>

          <form className="partnership-form" onSubmit={submit} noValidate>
            <fieldset className="partnership-types">
              <legend>What kind of site?</legend>
              <div className="partnership-type-grid">
                {SITE_TYPES.map((type) => (
                  <label className="partnership-type" key={type.value}>
                    <input
                      type="radio"
                      name="siteType"
                      value={type.value}
                      checked={form.siteType === type.value}
                      onChange={update}
                    />
                    <span><b>{type.label}</b></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="partnership-honeypot" aria-hidden="true">
              <span>Company website</span>
              <input
                tabIndex={-1}
                autoComplete="off"
                value={guard.honeypot}
                onChange={(event) => setGuard((current) => ({ ...current, honeypot: event.target.value }))}
              />
            </label>

            <div className="partnership-field-row">
              <label>
                <span>Name</span>
                <input name="name" value={form.name} onChange={update} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'partnership-name-error' : undefined} />
                <FieldError id="partnership-name-error">{errors.name}</FieldError>
              </label>
              <label>
                <span>Email</span>
                <input type="email" name="email" value={form.email} onChange={update} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'partnership-email-error' : undefined} />
                <FieldError id="partnership-email-error">{errors.email}</FieldError>
              </label>
            </div>

            <div className="partnership-field-row">
              <label>
                <span>Contact number</span>
                <input type="tel" name="contactNumber" value={form.contactNumber} onChange={update} autoComplete="tel" aria-invalid={Boolean(errors.contactNumber)} aria-describedby={errors.contactNumber ? 'partnership-contact-error' : undefined} />
                <FieldError id="partnership-contact-error">{errors.contactNumber}</FieldError>
              </label>
              <label>
                <span>Site location</span>
                <input name="city" value={form.city} onChange={update} autoComplete="address-level2" placeholder="City or area of the property" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'partnership-city-error' : undefined} />
                <FieldError id="partnership-city-error">{errors.city}</FieldError>
              </label>
            </div>

            <label>
              <span>Message</span>
              <textarea name="message" rows="5" value={form.message} onChange={update} placeholder="Roughly how much space, and what is around it?" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'partnership-message-error' : undefined} />
              <FieldError id="partnership-message-error">{errors.message}</FieldError>
              <small className="partnership-hint">
                Whatever you are comfortable sharing. We will ask the rest in person.
              </small>
            </label>

            <div className="partnership-submit-row">
              <button type="submit" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Sending…' : 'Send inquiry'}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <p className="partnership-submit-note">
                Read only by Hakum leadership. Never shared, never added to a mailing list.
              </p>
            </div>

            <p className={`partnership-notice${submitted ? ' is-success' : ''}`} aria-live="polite">
              {notice}
              {notice && !submitted ? (
                <> <Link to="/contact">Contact us directly</Link>.</>
              ) : null}
            </p>
          </form>
        </div>
      </div>

      <div className="public-shell partnership-closing">
        <p>Every inquiry gets a real reply from our team — whether or not the site turns out to be a fit.</p>
        <Link to="/contact">Or contact us directly</Link>
      </div>
    </section>
  )
}

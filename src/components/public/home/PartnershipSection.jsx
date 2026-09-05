import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { createPublicFormGuard, validatePublicFormGuard } from '../../../lib/publicFormGuard'
import {
  BRAND_COLLAB_TYPES,
  submitBrandCollaborationInquiry,
  validateBrandCollaborationInquiry,
} from '../../../lib/partnershipInquiry'

const EMPTY_FORM = {
  collaborationType: BRAND_COLLAB_TYPES[0].value,
  contactName: '',
  brandName: '',
  email: '',
  contactNumber: '',
  website: '',
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
    const nextErrors = validateBrandCollaborationInquiry(form)
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
    const result = await submitBrandCollaborationInquiry(form, guard)
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
            Brand collaborations
          </p>
          <h2 className="section-title light">
            Better together.
            <br />
            <em>Built to matter.</em>
          </h2>
          <p className="partnership-lede">
            We work with brands that care about craft, performance, and the people behind every car.
            Bring us a product, campaign, event, or distribution idea worth building together.
          </p>

          <div className="partnership-quiet">
            <p>
              Every collaboration starts with fit. We review the idea, audience, and value for both
              sides before discussing scope, deliverables, and commercial terms.
            </p>
          </div>

          <ul className="partnership-marks">
            {BRAND_COLLAB_TYPES.map((type) => <li key={type.value}>{type.label}</li>)}
          </ul>
        </div>

        <div className="partnership-card" data-motion="form">
          <div className="partnership-card-head">
            <div>
              <h3>Pitch a collaboration</h3>
              <p>Tell us who you are and what you want to make together. A focused first note is enough.</p>
            </div>
            <span className="partnership-reply-badge">
              <i aria-hidden="true" />
              Replies in 2 days
            </span>
          </div>

          <form className="partnership-form" onSubmit={submit} noValidate>
            <fieldset className="partnership-types">
              <legend>What kind of collaboration?</legend>
              <div className="partnership-type-grid">
                {BRAND_COLLAB_TYPES.map((type) => (
                  <label className="partnership-type" key={type.value}>
                    <input
                      type="radio"
                      name="collaborationType"
                      value={type.value}
                      checked={form.collaborationType === type.value}
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
                <span>Contact name</span>
                <input name="contactName" value={form.contactName} onChange={update} autoComplete="name" aria-invalid={Boolean(errors.contactName)} aria-describedby={errors.contactName ? 'partnership-name-error' : undefined} />
                <FieldError id="partnership-name-error">{errors.contactName}</FieldError>
              </label>
              <label>
                <span>Brand or company</span>
                <input name="brandName" value={form.brandName} onChange={update} autoComplete="organization" aria-invalid={Boolean(errors.brandName)} aria-describedby={errors.brandName ? 'partnership-brand-error' : undefined} />
                <FieldError id="partnership-brand-error">{errors.brandName}</FieldError>
              </label>
            </div>

            <div className="partnership-field-row">
              <label>
                <span>Email</span>
                <input type="email" name="email" value={form.email} onChange={update} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'partnership-email-error' : undefined} />
                <FieldError id="partnership-email-error">{errors.email}</FieldError>
              </label>
              <label>
                <span>Contact number</span>
                <input type="tel" name="contactNumber" value={form.contactNumber} onChange={update} autoComplete="tel" aria-invalid={Boolean(errors.contactNumber)} aria-describedby={errors.contactNumber ? 'partnership-contact-error' : undefined} />
                <FieldError id="partnership-contact-error">{errors.contactNumber}</FieldError>
              </label>
            </div>

            <label>
              <span>Website or social page (optional)</span>
              <input name="website" value={form.website} onChange={update} placeholder="https://" inputMode="url" />
            </label>

            <label>
              <span>Collaboration idea</span>
              <textarea name="message" rows="5" value={form.message} onChange={update} placeholder="What do you want to build, who is it for, and what would each side bring?" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'partnership-message-error' : undefined} />
              <FieldError id="partnership-message-error">{errors.message}</FieldError>
              <small className="partnership-hint">
                Share the useful details. We can work through the rest together.
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
        <p>Every serious collaboration idea gets a real review from the Hakum team.</p>
        <Link to="/contact">Or contact us directly</Link>
      </div>
    </section>
  )
}

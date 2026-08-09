import { useState } from 'react'

import {
  normalizePartnershipInquiry,
  submitPartnershipInquiry,
  validatePartnershipInquiry,
} from '../../../lib/partnershipInquiry'

const EMPTY_FORM = {
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

    setStatus('submitting')
    const result = await submitPartnershipInquiry(normalizePartnershipInquiry(form))
    setStatus(result.ok ? 'submitted' : result.code)
    setNotice(result.message || '')
  }

  return (
    <section id="partnership" className="partnership-section" data-motion-section="partnership">
      <div className="public-shell partnership-layout">
        <div className="partnership-intro" data-motion="heading">
          <p className="eyebrow eyebrow-light">Grow with Hakum</p>
          <h2 className="section-title light">Inquire for partnership.</h2>
          <p>Tell us where you are and how you would like to work with Hakum Auto Care.</p>
        </div>

        <form className="partnership-form" onSubmit={submit} noValidate data-motion="form">
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
              <span>City</span>
              <input name="city" value={form.city} onChange={update} autoComplete="address-level2" aria-invalid={Boolean(errors.city)} aria-describedby={errors.city ? 'partnership-city-error' : undefined} />
              <FieldError id="partnership-city-error">{errors.city}</FieldError>
            </label>
          </div>

          <label>
            <span>Message</span>
            <textarea name="message" rows="5" value={form.message} onChange={update} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'partnership-message-error' : undefined} />
            <FieldError id="partnership-message-error">{errors.message}</FieldError>
          </label>

          <div className="partnership-submit-row">
            <button type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Checking…' : 'Send inquiry'}
            </button>
            <p aria-live="polite">{notice}</p>
          </div>
        </form>
      </div>
    </section>
  )
}

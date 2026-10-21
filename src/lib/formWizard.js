import { normalizeFields, normalizeFormSettings, validatePayload } from './opsForms.js'

export function isWizardForm(form) {
  const settings = normalizeFormSettings(form?.settings, form?.kind)
  return settings.layout === 'wizard' && settings.steps.length > 0
}

export function wizardSteps(form) {
  const { steps } = normalizeFormSettings(form?.settings, form?.kind)
  const ids = new Set(steps.map(step => step.id))
  const fields = normalizeFields(form?.fields)
  return steps.map((step, index) => ({
    ...step,
    fields: fields.filter(field => field.step === step.id || (index === 0 && !ids.has(field.step))),
  }))
}

export function wizardScreens(form) {
  const steps = wizardSteps(form)
  return normalizeFormSettings(form?.settings, form?.kind).review
    ? [...steps, { id: '__review', title: 'Check and send', hint: 'Tap Edit to change anything.', fields: [] }]
    : steps
}

export function validateStep(step, values) {
  return validatePayload(step?.fields, values)
}

export function firstInvalidStep(steps, values) {
  return steps.findIndex(step => validateStep(step, values).length > 0)
}

export function answerRows(step, values = {}) {
  return normalizeFields(step?.fields).flatMap(field => {
    const raw = values[field.key]
    if (raw == null || raw === false || String(raw).trim() === '') return []
    let value = String(raw)
    if (field.type === 'checkbox') value = 'Yes'
    if (field.type === 'date' || field.type === 'datetime') {
      // Date-only answers are calendar dates, not UTC instants.
      const date = new Date(field.type === 'date' ? `${raw}T12:00:00` : raw)
      if (!Number.isNaN(date.getTime())) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(date).map(part => [part.type, part.value]))
        value = `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`
        if (field.type === 'datetime') value += `, ${date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`
      }
    }
    return [{ key: field.key, label: field.label, value }]
  })
}

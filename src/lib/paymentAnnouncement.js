/**
 * "Toyota Vios, plate N B C, 4 8 2 1, ready na po for payment." — shared by the POS
 * browser voice and the server AI-voice route so both say the exact same words.
 */

const clean = (value) =>
  String(value ?? '')
    .replace(/[^\p{L}\p{N} .'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)

export function spellPlate(plate) {
  const runs =
    String(plate ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10)
      .match(/[A-Z]+|[0-9]+/g) || []
  return runs.map((run) => run.split('').join(' ')).join(', ')
}

export function buildPaymentAnnouncement({ make, model, plate } = {}) {
  const m = clean(make)
  const mdl = clean(model)
  const car = m && mdl.toLowerCase().startsWith(m.toLowerCase()) ? mdl : [m, mdl].filter(Boolean).join(' ')
  const spelled = spellPlate(plate)
  if (car && spelled) return `${car}, plate ${spelled}, ready na po for payment.`
  if (spelled) return `Plate ${spelled}, ready na po for payment.`
  if (car) return `${car}, ready na po for payment.`
  return 'May sasakyan na pong ready for payment.'
}

/**
 * Philippine voices first; "Natural"/"Online" voices (Edge, Android) sound far less robotic.
 * Hakum wants a female voice: Edge's Rosa (English) and Blessica (Filipino); voices expose no gender field.
 */
export function pickAnnouncerVoice(voices) {
  const usable = (voices || []).filter((v) => /^(en|fil)/i.test(v.lang))
  const natural = (v) => /natural|online/i.test(v.name)
  const female = (v) => /\b(rosa|blessica)\b/i.test(v.name)
  const ph = (lang) => (v) => new RegExp(`^${lang}-PH`, 'i').test(v.lang)
  const en = (v) => /^en/i.test(v.lang)
  return (
    usable.find((v) => ph('en')(v) && female(v)) ||
    usable.find((v) => ph('fil')(v) && female(v)) ||
    usable.find((v) => ph('en')(v) && natural(v)) ||
    usable.find((v) => ph('fil')(v) && natural(v)) ||
    usable.find(ph('en')) ||
    usable.find(ph('fil')) ||
    usable.find((v) => en(v) && natural(v)) ||
    usable.find((v) => en(v) && v.default) ||
    usable.find(en) ||
    null
  )
}

/**
 * "Toyota Vios, plate N B C, 4 8 2 1, is ready for payment." — shared by the POS
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

/** Counter voice speaks only a visit that is ready for payment. */
export function isReadyForPaymentVoice(row) {
  const booking = Array.isArray(row?.bookings) ? row.bookings[0] : row?.bookings
  return booking?.status === 'for_payment'
}

export function buildPaymentAnnouncement({ make, model, plate } = {}) {
  const m = clean(make)
  const mdl = clean(model)
  const car = m && mdl.toLowerCase().startsWith(m.toLowerCase()) ? mdl : [m, mdl].filter(Boolean).join(' ')
  const spelled = spellPlate(plate)
  if (car && spelled) return `${car}, plate ${spelled}, is ready for payment.`
  if (spelled) return `Plate ${spelled}, is ready for payment.`
  if (car) return `${car} is ready for payment.`
  return 'A car is ready for payment.'
}

const hasPhVoice = (voices) => voices.some((v) => /^(en|fil)-PH/i.test(v.lang))

/**
 * Chrome and Edge report no voices right after page load and fill the list in
 * later (Edge's online voices arrive in a second wave). Speaking before that
 * means no voice is set and Windows reads it as David. Resolves once a Philippine
 * voice is listed, or after `timeoutMs` with whatever has loaded.
 */
export function waitForVoices(synth, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const current = () => synth?.getVoices?.() || []
    if (!synth || hasPhVoice(current())) return resolve(current())
    const finish = () => {
      clearTimeout(timer)
      synth.removeEventListener?.('voiceschanged', onChange)
      resolve(current())
    }
    const onChange = () => {
      if (hasPhVoice(current())) finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    synth.addEventListener?.('voiceschanged', onChange)
  })
}

/**
 * Philippine voices first; "Natural"/"Online" (Edge, Android) and Google (Chrome)
 * voices sound far less robotic. Hakum wants a woman: Rosa (en-PH) and Blessica
 * (fil-PH) in Edge; Chrome has no PH voice, so a female English one, never David.
 */
export function pickAnnouncerVoice(voices) {
  const female = (v) => /\b(rosa|blessica|zira|samantha|karen|tessa|moira|female)\b|^google us english$/i.test(v.name)
  const usable = (voices || []).filter((v) => /^(en|fil)/i.test(v.lang)).sort((a, b) => female(b) - female(a))
  const natural = (v) => /natural|online/i.test(v.name)
  const ph = (lang) => (v) => new RegExp(`^${lang}-PH`, 'i').test(v.lang)
  const en = (v) => /^en/i.test(v.lang)
  return (
    usable.find((v) => ph('en')(v) && natural(v)) ||
    usable.find((v) => ph('fil')(v) && natural(v)) ||
    usable.find(ph('en')) ||
    usable.find(ph('fil')) ||
    usable.find((v) => en(v) && female(v) && (natural(v) || /^google/i.test(v.name))) ||
    usable.find((v) => en(v) && female(v)) ||
    usable.find((v) => en(v) && natural(v)) ||
    usable.find((v) => en(v) && v.default) ||
    usable.find(en) ||
    null
  )
}

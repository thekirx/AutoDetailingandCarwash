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

export function buildPaymentAnnouncement({ make, model, plate } = {}) {
  const m = clean(make)
  const mdl = clean(model)
  const car = m && mdl.toLowerCase().startsWith(m.toLowerCase()) ? mdl : [m, mdl].filter(Boolean).join(' ')
  const spelled = spellPlate(plate)
  if (car && spelled) return `${car}, plate ${spelled}, is ready for payment.`
  if (spelled) return `Plate ${spelled} is ready for payment.`
  if (car) return `${car} is ready for payment.`
  return 'A car is ready for payment.'
}

/** Customer auth helpers shared by login UI and tests. */

export function phoneLoginEmail(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 10) throw new Error('Enter a valid phone number.')
  return `c${digits}@customers.hakumautocare.com`
}

/**
 * Walk-in provision SMS copy (CUST-H10).
 * Never embed recovery action_link — SMS logs / handset leak = account takeover.
 */
export function buildProvisionInviteMessage({ firstName, phone, email }) {
  const name = String(firstName || 'there').trim() || 'there'
  if (email) {
    return `Hi ${name}, your Hakum Auto Care account is ready (${email}). Open the Hakum app → Sign in → Forgot password to set your password.`
  }
  return `Hi ${name}, your Hakum account login is your phone number (${phone}). Open Hakum → Sign in with your phone, then set a password (ask your Team Lead if you need a reset email on file).`
}

/** Prefer Auth uid = CRM id when creating Auth for an existing walk-in row (CUST-C3). */
export function authCreateUserIdForCrm(customerId) {
  return customerId || undefined
}

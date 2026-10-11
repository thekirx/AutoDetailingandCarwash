/**
 * Known demo / seed accounts for one-click testing (local dev) and the QA scripts.
 * Passwords are never in source: the repo is public. Each account names a
 * VITE_DEMO_PASSWORD_* var read from .env at the moment `password` is used, so
 * Node scripts that load .env after importing this still see it.
 */
export function demoPassword(name) {
  const env = import.meta.env ?? globalThis.process?.env ?? {}
  return env[name] || ''
}

const withEnvPassword = (account) =>
  Object.defineProperty(account, 'password', { enumerable: true, get: () => demoPassword(account.passwordEnv) })

export const OPS_DEMO_ACCOUNTS = [
  {
    id: 'boss',
    label: 'Super Admin',
    email: 'bossmich@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_BOSS',
    hint: 'All branches · Floor Board',
  },
  {
    id: 'asa',
    label: 'Assistant Super Admin',
    email: 'assistant@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_ASA',
    hint: 'Elevated · grant toggles',
  },
  {
    id: 'admin',
    label: 'Admin',
    email: 'admin@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_ADMIN',
    hint: 'Primary shop scoped',
  },
  {
    id: 'opslead',
    label: 'Operations Lead',
    email: 'opslead@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_OPSLEAD',
    hint: 'All branches · Queue home · CRM view only · no clock',
  },
  {
    id: 'tl',
    label: 'Team Lead',
    email: 'teamlead@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_TL',
    hint: 'Floor lead · home branch',
  },
  {
    id: 'sales',
    label: 'Sales',
    email: 'sales@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_SALES',
    hint: 'Multi-branch form bookings',
  },
  {
    id: 'crew1',
    label: 'Crew 1',
    email: 'staff1@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_STAFF',
    hint: 'Assignable crew',
  },
  {
    id: 'crew2',
    label: 'Crew 2',
    email: 'staff2@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_STAFF',
    hint: 'Assignable crew',
  },
  {
    id: 'crew3',
    label: 'Crew 3',
    email: 'staff3@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_STAFF',
    hint: 'Assignable · may be 2nd branch',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    email: 'marketing@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_MARKETING',
    hint: 'CRM + SMS only',
  },
  {
    id: 'detailer',
    label: 'Detailer',
    email: 'detailer@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_DETAILER',
    hint: 'Detailing on Bookings · FloorApp',
  },
  {
    id: 'video',
    label: 'Video Editor',
    email: 'video@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_VIDEO',
    hint: 'Calendar + my tasks',
  },
  {
    id: 'investor',
    label: 'Investor',
    email: 'investor@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_INVESTOR',
    hint: 'Bacoor read-only: Floor, POS, Finance, Reports',
  },
  {
    id: 'investor2',
    label: 'Investor (Batangas)',
    email: 'investor2@hakumautocare.com',
    passwordEnv: 'VITE_DEMO_PASSWORD_INVESTOR',
    hint: 'Batangas read-only: Floor, POS, Finance, Reports',
  },
].map(withEnvPassword)

export const CUSTOMER_DEMO_ACCOUNT = withEnvPassword({
  id: 'customer',
  label: 'Demo customer',
  email: 'demo.customer@hakumautocare.com',
  passwordEnv: 'VITE_DEMO_PASSWORD_CUSTOMER',
  phone: '09180000001',
  hint: 'Ready password — no invite needed',
})

/** Known demo / seed accounts for one-click testing. Passwords match scripts/seed-floor-accounts.mjs */

export const OPS_DEMO_ACCOUNTS = [
  {
    id: 'boss',
    label: 'Super Admin',
    email: 'bossmich@hakumautocare.com',
    password: 'HakumBoss2026!',
    hint: 'All branches · console',
  },
  {
    id: 'admin',
    label: 'Admin',
    email: 'admin@hakumautocare.com',
    password: 'HakumAdmin2026!',
    hint: 'Bacoor scoped',
  },
  {
    id: 'tl',
    label: 'Team Lead',
    email: 'teamlead@hakumautocare.com',
    password: 'HakumTL2026!',
    hint: 'Bacoor floor',
  },
  {
    id: 'staff',
    label: 'Staff',
    email: 'staff1@hakumautocare.com',
    password: 'HakumStaff2026!',
    hint: 'My tasks',
  },
]

export const CUSTOMER_DEMO_ACCOUNT = {
  id: 'customer',
  label: 'Demo customer',
  email: 'demo.customer@hakumautocare.com',
  password: 'HakumCustomer2026!',
  phone: '09180000001',
  hint: 'Ready password — no invite needed',
}

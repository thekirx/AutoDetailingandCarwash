/**
 * Generate docs/audits/2026-09-role-qa/roles/*.md from tmp-role-matrix.json
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'

mkdirSync('docs/audits/2026-09-role-qa/roles', { recursive: true })
const matrix = JSON.parse(readFileSync('tmp-role-matrix.json', 'utf8'))

const meta = {
  team_lead: {
    file: 'team_lead.md',
    title: 'Team Lead',
    guide: 'docs/guides/roles/team-lead.md',
    demo: 'teamlead@hakumautocare.com',
    wave: 'B',
    mustDeny: ['pos', 'finance', 'payroll', 'people', 'console'],
    happy: 'Queue → advance lane / New ticket',
    fail: 'Deep-link /operations/pos → access-denied',
    buttons: 'New ticket, lane advance, attendance exception',
    dock: 'getTeamLeadDock',
  },
  admin: {
    file: 'admin.md',
    title: 'Branch Admin',
    guide: 'docs/guides/roles/branch-admin.md',
    demo: 'admin@hakumautocare.com',
    wave: 'B',
    mustDeny: ['finance', 'crm', 'people', 'console', 'memberships', 'settings'],
    happy: 'POS sale + inventory',
    fail: 'Finance URL denied',
    buttons: 'POS checkout, EoS wizard open, inventory adjust',
    dock: 'Command nav BA allowlist',
  },
  staff: {
    file: 'staff.md',
    title: 'Staff / Crew',
    guide: 'docs/guides/roles/crew-staff.md',
    demo: 'staff1@hakumautocare.com',
    wave: 'B',
    mustDeny: ['pos', 'finance', 'people', 'queue', 'payroll'],
    happy: 'Attendance clock + my-tasks',
    fail: 'POS denied',
    buttons: 'Clock in/out, open task',
    dock: 'getStaffDock',
  },
  BossMich: {
    file: 'BossMich.md',
    title: 'Super Admin (BossMich)',
    guide: 'docs/guides/roles/super-admin-asa.md',
    demo: 'bossmich@hakumautocare.com',
    wave: 'C',
    mustDeny: ['my-pay'],
    happy: 'Console → Finance shift-close tab',
    fail: 'N/A (full access except my-pay)',
    buttons: 'EoS accept, payroll confirm, people grants',
    dock: 'Command full nav',
  },
  asa: {
    file: 'asa.md',
    title: 'Assistant Super Admin',
    guide: 'docs/guides/roles/super-admin-asa.md',
    demo: 'assistant@hakumautocare.com',
    wave: 'C',
    mustDeny: ['(grant-dependent)'],
    happy: 'Console with default grants',
    fail: 'Explicit false grant denies route',
    buttons: 'Grant editor honesty',
    dock: 'Command nav filtered by grants',
  },
  operations_lead: {
    file: 'operations_lead.md',
    title: 'Operations Lead',
    guide: 'docs/guides/roles/operations-lead.md',
    demo: 'opslead@hakumautocare.com',
    wave: 'C',
    mustDeny: ['people', 'branches', 'payroll'],
    happy: 'Roadmap / Floor / POS network view',
    fail: 'People denied',
    buttons: 'Ops Lab items, queue override',
    dock: 'Command OL set',
  },
  investor: {
    file: 'investor.md',
    title: 'Investor',
    guide: 'docs/guides/roles/investor.md',
    demo: 'investor@hakumautocare.com',
    wave: 'C',
    mustDeny: ['pos', 'people', 'queue', 'payroll', 'my-pay'],
    happy: 'Finance hub',
    fail: 'Any ops write surface denied',
    buttons: 'Finance tabs read',
    dock: 'Finance only',
  },
  sales: {
    file: 'sales.md',
    title: 'Sales',
    guide: 'docs/guides/roles/sales.md',
    demo: 'sales@hakumautocare.com',
    wave: 'D',
    mustDeny: ['queue', 'pos', 'finance', 'crm'],
    happy: 'Bookings board',
    fail: 'Queue denied',
    buttons: 'Booking stage updates',
    dock: 'getSalesDock',
  },
  detailer: {
    file: 'detailer.md',
    title: 'Detailer',
    guide: 'docs/guides/roles/detailer.md',
    demo: 'detailer@hakumautocare.com',
    wave: 'D',
    mustDeny: ['queue', 'dashboard', 'crew', 'kpi', 'pos', 'finance'],
    happy: 'Bookings detailing pipeline',
    fail: 'Wash queue deep-link denied',
    buttons: 'Stage/proof, attendance',
    dock: 'getDetailerDock',
  },
  marketing: {
    file: 'marketing.md',
    title: 'Marketing',
    guide: 'docs/guides/roles/marketing.md',
    demo: 'marketing@hakumautocare.com',
    wave: 'D',
    mustDeny: ['pos', 'finance', 'people', 'queue'],
    happy: 'CRM home + planner/forms',
    fail: 'POS denied',
    buttons: 'CRM SMS, forms/QR',
    dock: 'getMarketingDock',
  },
  video_editor: {
    file: 'video_editor.md',
    title: 'Video Editor',
    guide: 'docs/guides/roles/video-editor.md',
    demo: 'video@hakumautocare.com',
    wave: 'D',
    mustDeny: ['queue', 'pos', 'finance', 'crm'],
    happy: 'Planning calendar + my-tasks',
    fail: 'Queue denied',
    buttons: 'Task complete',
    dock: 'getVideoEditorDock',
  },
  customer: {
    file: 'customer.md',
    title: 'Customer (portal)',
    guide: 'docs/guides/roles/customer.md',
    demo: 'demo.customer@hakumautocare.com',
    wave: 'E',
    mustDeny: ['/operations/*'],
    happy: 'Sign-in → /account',
    fail: 'Bad credentials soft error',
    buttons: 'Book, queue, loyalty, more',
    dock: 'Customer account nav',
  },
}

function rowFor(id) {
  if (id === 'asa') return matrix.rows.find((r) => r.id === 'asa_bare')
  return matrix.rows.find((r) => r.id === id)
}

function tick(list) {
  return list.map((k) => '`' + k + '`').join(', ')
}

for (const [id, m] of Object.entries(meta)) {
  const r = rowFor(id)
  const allowed = r ? tick(r.allowed) : '(portal `/account/*`)'
  const deniedSample = r
    ? tick(r.denied.slice(0, 12)) + (r.denied.length > 12 ? ' …' : '')
    : '`/operations/*`'
  const home = r ? r.home : '/account'
  const shell = r ? r.shell : 'customer PWA'
  const nav = r ? r.nav.map((i) => i.label).join(' · ') : 'Account · Book · Queue · Loyalty · More'
  const bugs =
    id === 'detailer'
      ? '- **P0 fixed (Wave A):** wash queue deep-link denied.'
      : '- None opened yet — update when found.'

  const md = `# ${m.title}

- **Wave:** ${m.wave}
- **Demo:** \`${m.demo}\`
- **Guide:** [${m.guide}](../../../${m.guide})
- **Home:** \`${home}\`
- **Shell:** ${shell}

## Allowed routes (must load)

${allowed}

## Denied routes (must wall / absent from nav)

Must-deny focus: ${tick(m.mustDeny)}

Code-denied sample: ${deniedSample}

## Nav / dock

${nav}

Dock helper: ${m.dock}

## Primary buttons / modals / filters

${m.buttons}

## Happy path

${m.happy}

## Failure path

${m.fail}

## Empty / loading / error

Expect shared ops/customer empty + toast patterns; flag dead controls as P0/P1.

## Screenshot refs + commands

- Pack: \`e2e-evidence/role-qa/${id}/\` (when captured)
- Related: \`e2e-evidence/ui-p0/\`, \`e2e-evidence/ui-money/\`
- Commands: \`npm run e2e:ui-p0\`, \`npm run e2e:ui-money\`, targeted login checks

## Bugs this wave

${bugs}
`
  writeFileSync('docs/audits/2026-09-role-qa/roles/' + m.file, md)
}

console.log('roles written', Object.keys(meta).length)

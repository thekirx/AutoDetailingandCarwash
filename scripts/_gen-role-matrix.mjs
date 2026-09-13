/**
 * One-shot: regenerate docs/audits/2026-09-role-qa/MATRIX.md from permissions.js
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import {
  ROLES,
  allowRoute,
  getOperationsNav,
  redirectForRole,
  BRANCH_ADMIN_ROUTE_KEYS,
  usesFloorAppShell,
  usesCommandShell,
} from '../src/auth/permissions.js'

const keys = [
  'console',
  'dashboard',
  'queue',
  'queue-new',
  'bookings',
  'crew',
  'attendance',
  'kpi',
  'my-tasks',
  'pos',
  'inventory',
  'crm',
  'reviews',
  'memberships',
  'finance',
  'payroll',
  'my-pay',
  'planning',
  'roadmap',
  'history',
  'notifications',
  'people',
  'branches',
  'cars',
  'content',
  'audit',
  'data-center',
  'inquiries',
  'settings',
  'reports',
]

function toKey(to) {
  const rest = String(to).replace('/operations/', '').split('?')[0]
  if (rest === 'sms') return 'crm'
  if (rest === 'broadcast') return 'notifications'
  if (rest === 'services' || rest === 'products') return 'inventory'
  if (rest === 'queue/new') return 'queue-new'
  return rest.split('/')[0]
}

const personas = [
  { id: 'BossMich', role: ROLES.SUPER_ADMIN },
  {
    id: 'asa_full',
    role: ROLES.ASSISTANT_SUPER_ADMIN,
    permission_grants: {
      branches_all: true,
      people: true,
      finance: true,
      payroll: true,
      pos: true,
      inventory: true,
      content: true,
      settings: true,
      reports: true,
      crm: true,
      notifications: true,
    },
  },
  { id: 'asa_bare', role: ROLES.ASSISTANT_SUPER_ADMIN, permission_grants: {} },
  { id: 'admin', role: ROLES.ADMIN, branch_slug: 'bacoor' },
  { id: 'operations_lead', role: ROLES.OPERATIONS_LEAD },
  { id: 'team_lead', role: ROLES.TEAM_LEAD, branch_slug: 'bacoor' },
  { id: 'staff', role: ROLES.STAFF, branch_slug: 'bacoor' },
  { id: 'sales', role: ROLES.SALES },
  { id: 'marketing', role: ROLES.MARKETING },
  { id: 'detailer', role: ROLES.DETAILER, branch_slug: 'bacoor' },
  { id: 'video_editor', role: ROLES.VIDEO_EDITOR },
  { id: 'investor', role: ROLES.INVESTOR },
]

const rows = personas.map((p) => {
  const profile = {
    role: p.role,
    branch_slug: p.branch_slug,
    permission_grants: p.permission_grants,
  }
  const navItems = getOperationsNav(profile)
  const navKeys = [...new Set(navItems.map((i) => toKey(i.to)))]
  const allowed = keys.filter((k) => allowRoute(profile, k))
  const denied = keys.filter((k) => !allowRoute(profile, k))
  const navButDenied = navKeys.filter((k) => k && !allowRoute(profile, k))
  const allowButNoNav = allowed.filter(
    (k) => !navKeys.includes(k) && !['queue-new', 'reports'].includes(k),
  )
  return {
    id: p.id,
    role: p.role,
    home: redirectForRole(p.role),
    shell: usesFloorAppShell(profile)
      ? 'floor'
      : usesCommandShell(profile)
        ? 'command'
        : '?',
    allowed,
    denied,
    navKeys,
    navButDenied,
    allowButNoNav,
    nav: navItems.map((i) => ({ label: i.label, to: i.to })),
  }
})

mkdirSync('docs/audits/2026-09-role-qa/roles', { recursive: true })
writeFileSync('tmp-role-matrix.json', JSON.stringify({ keys, baKeys: BRANCH_ADMIN_ROUTE_KEYS, rows }, null, 2))

const lines = []
lines.push('# Role × route matrix (code-actual)')
lines.push('')
lines.push(
  'Generated from `src/auth/permissions.js` (`allowRoute` + `getOperationsNav`). Customer portal is separate (`/account/*`). Marketing landing `/home` out of scope.',
)
lines.push('')
lines.push('## Legend')
lines.push('')
lines.push('- **A+N** = allowRoute true and in ops nav')
lines.push('- **A** = allowRoute true, not primary nav (deep-link / overflow / intentional)')
lines.push('- **N!** = in nav but allowRoute false (P0)')
lines.push('- **—** = denied')
lines.push('')
lines.push('## Branch Admin hard allowlist')
lines.push('')
lines.push('`' + BRANCH_ADMIN_ROUTE_KEYS.join(', ') + '`')
lines.push('')
lines.push('| Route | ' + rows.map((r) => r.id).join(' | ') + ' |')
lines.push('|-------|' + rows.map(() => '---').join('|') + '|')
for (const k of keys) {
  const cells = rows.map((r) => {
    const a = r.allowed.includes(k)
    const n = r.navKeys.includes(k)
    if (a && n) return 'A+N'
    if (a) return 'A'
    if (n) return 'N!'
    return '—'
  })
  lines.push('| `' + k + '` | ' + cells.join(' | ') + ' |')
}
lines.push('')
lines.push('## Homes + shells')
lines.push('')
lines.push('| Persona | Role | Home | Shell |')
lines.push('|---------|------|------|-------|')
for (const r of rows) {
  lines.push('| ' + r.id + ' | `' + r.role + '` | `' + r.home + '` | ' + r.shell + ' |')
}
lines.push('')
lines.push('## Nav vs allow notes')
lines.push('')
const mismatches = rows.filter((r) => r.navButDenied.length || r.allowButNoNav.length)
if (!mismatches.length) {
  lines.push('None.')
} else {
  for (const r of mismatches) {
    lines.push(
      `- **${r.id}**: navButDenied=[${r.navButDenied.join(',') || '—'}] allowButNoNav=[${r.allowButNoNav.join(',') || '—'}]`,
    )
  }
  lines.push('')
  lines.push(
    '`allowButNoNav` is usually intentional (deep-link / overflow / grant surface without primary nav). `navButDenied` is a P0.',
  )
}
lines.push('')
lines.push('## Wave A P0 fixed')
lines.push('')
lines.push(
  '- Detailer removed from `QUEUE_VIEWER_ROLES` so wash Queue / Floor / Crew / KPI deep-links deny (Bookings-only IA).',
)
lines.push(
  '- Puppeteer landing tests renamed to `*.browser.test.js` so `npm test` stays preview-free.',
)
lines.push('')

writeFileSync('docs/audits/2026-09-role-qa/MATRIX.md', lines.join('\n'))
console.log('wrote MATRIX.md; detailer allowed=', rows.find((r) => r.id === 'detailer').allowed.join(','))

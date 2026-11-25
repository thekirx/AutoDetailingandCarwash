import { Link, Navigate } from 'react-router-dom'
import { Bell, Bot, Clock3, Database, ShoppingCart, SlidersHorizontal, Sun, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessDataCenter,
  canAccessNotifications,
  canAccessPos,
  canEditAttendanceRoles,
  canEditAttendanceSettings,
  isSuperAdmin,
} from '@/auth/permissions'
import { canReviewDailySheet } from '@/lib/dailySheet'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { SETTINGS_HUB_COPY } from '@/components/ops/opsGuideCopy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Policy destinations only — People / Branches / Audit / Content stay in Command nav. */
const TILES = [
  { key: 'tint-finder', title: 'Tint Finder', description: 'Page title, film specifications, package prices, recommendation rules, and customer requests.', to: '/operations/settings/tint-finder', icon: Sun, allow: isSuperAdmin },
  {
    key: 'chatbot',
    title: 'Hakum Concierge Chatbot',
    description: 'Turn the movable customer chatbot ON/OFF and customize its greeting across public and customer screens.',
    to: '/operations/settings/chatbot',
    icon: Bot,
    allow: isSuperAdmin,
  },
  {
    key: 'pos',
    title: 'POS settings',
    description: 'Payment methods, expense kinds, and end-of-shift field labels.',
    to: '/operations/settings/pos',
    icon: ShoppingCart,
    allow: canAccessPos,
  },
  {
    key: 'daily-sheet-rules',
    title: 'Daily sheet rules',
    description: 'Wash pool, detailing splits, attendance weights and Team Lead daily rates.',
    to: '/operations/settings/daily-sheet',
    icon: Wallet,
    allow: canReviewDailySheet,
  },
  {
    key: 'notifications',
    title: 'Notifications & SMS',
    description: 'System push & BusyBee SMS copy, employee announcements, and broadcast alerts.',
    to: '/operations/notifications?tab=templates',
    icon: Bell,
    allow: canAccessNotifications,
  },
  {
    key: 'notification-config',
    title: 'Notification Settings & SMS Policy',
    description: 'Global BusyBee SMS toggles, category scopes, stage matrix, quiet hours, and device coverage.',
    to: '/operations/notifications?tab=settings',
    icon: SlidersHorizontal,
    allow: isSuperAdmin,
  },
  {
    key: 'attendance-rules',
    title: 'Attendance & Shift Rules',
    description: 'Check-in windows, grace period, late weights, and attendance role policies.',
    to: '/operations/employees?tab=settings',
    icon: Clock3,
    allow: (p) => canEditAttendanceSettings(p) || canEditAttendanceRoles(p),
  },
  {
    key: 'system-data',
    title: 'System & Data Center',
    description: 'JSON catalog/CRM exports, retention rules, and PITR backup readiness.',
    to: '/operations/system?tab=data-center',
    icon: Database,
    allow: canAccessDataCenter,
  },
]

/** Settings hub — POS / Daily sheet policy tiles (not a second nav). */
export default function SettingsHubPage() {
  const { profile } = useAuth()
  const tiles = TILES.filter((t) => t.allow(profile))

  if (!tiles.length) {
    return <Navigate to="/operations/access-denied" replace />
  }

  return (
    <OpsPageShell
      className="hakum-settings-hub"
      eyebrow={SETTINGS_HUB_COPY.eyebrow}
      title={SETTINGS_HUB_COPY.title}
      breadcrumbs={[{ label: 'Ops', to: '/operations/settings' }, { label: 'Settings' }]}
      description={SETTINGS_HUB_COPY.description}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.key}
              to={tile.to}
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition group-hover:border-primary/40">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <span className="rounded-lg border border-border bg-muted/40 p-2">
                    <Icon className="size-5 text-primary" aria-hidden />
                  </span>
                  <div>
                    <CardTitle className="text-lg">{tile.title}</CardTitle>
                    <CardDescription className="mt-1">{tile.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="text-sm font-medium text-primary">Open →</CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </OpsPageShell>
  )
}

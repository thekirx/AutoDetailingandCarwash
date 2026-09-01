import { Link, Navigate } from 'react-router-dom'
import { ShoppingCart, Wallet } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessConsole,
  canAccessPayroll,
} from '@/auth/permissions'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { SETTINGS_HUB_COPY } from '@/components/ops/opsGuideCopy'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/** Policy destinations only — People / Branches / Audit / Content stay in Command nav. */
const TILES = [
  {
    key: 'pos',
    title: 'POS settings',
    description: 'Payment methods, expense kinds, and end-of-shift field labels.',
    to: '/operations/settings/pos',
    icon: ShoppingCart,
    allow: canAccessConsole,
  },
  {
    key: 'payroll-settings',
    title: 'Payroll settings',
    description: 'Attendance weights, pending-floor policy, and cash-advance netting.',
    to: '/operations/settings/payroll',
    icon: Wallet,
    allow: canAccessPayroll,
  },
]

/** Settings hub — POS / Payroll policy tiles (not a second nav). */
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

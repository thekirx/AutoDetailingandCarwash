import { Link, Navigate } from 'react-router-dom'
import { Building2, ScrollText, Shield, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessAudit,
  canAccessConsole,
  canManageBranches,
  canManagePeople,
} from '@/auth/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const TILES = [
  {
    key: 'branches',
    title: 'Branches',
    description: 'Create and edit company sites.',
    to: '/operations/branches',
    icon: Building2,
    allow: canManageBranches,
  },
  {
    key: 'people',
    title: 'Employees',
    description: 'Create accounts per branch, deactivate access, assign ASA grants.',
    to: '/operations/people',
    icon: UserPlus,
    allow: canManagePeople,
  },
  {
    key: 'audit',
    title: 'Audit / Logs',
    description: 'Review operational and admin activity.',
    to: '/operations/audit',
    icon: ScrollText,
    allow: canAccessAudit,
  },
  {
    key: 'permissions',
    title: 'Permission assignment',
    description: 'ASA grants live on People. Console for Super Admin pulse.',
    to: '/operations/people',
    icon: Shield,
    allow: (p) => canManagePeople(p) || canAccessConsole(p),
  },
]

/** Settings hub — client command category for branch/people/audit/permissions. */
export default function SettingsHubPage() {
  const { profile } = useAuth()
  const tiles = TILES.filter((t) => t.allow(profile))

  if (!tiles.length) {
    return <Navigate to="/operations/access-denied" replace />
  }

  return (
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Company settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branches, employees, audit logs, and permission assignment.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link key={tile.key} to={tile.to} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Building2, DollarSign, Newspaper, ScrollText, Shield, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  canAccessAudit,
  canAccessConsole,
  canManageBranches,
  canManagePeople,
  canManageSiteContent,
  isSuperAdmin,
} from '@/auth/permissions'
import { DEFAULT_COMPENSATION_RULES, normalizeCompensationSettings, toCompensationSettingsRow } from '@/lib/compensation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

const TILES = [
  {
    key: 'content',
    title: 'Blogs & Events',
    description: 'Publish journal posts and event pages with images, video, and form buttons.',
    to: '/operations/content',
    icon: Newspaper,
    allow: canManageSiteContent,
  },
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

const COMP_FIELDS = [
  { key: 'wash_pool_pct', label: 'Wash pool %', step: '1' },
  { key: 'ceramic_shirt_deduction_minor', label: 'Shirt deduction (centavos)', step: '100' },
  { key: 'ceramic_card_fee_pct', label: 'Card fee %', step: '0.1' },
  { key: 'ceramic_crew_solo_pct', label: 'Crew solo %', step: '1' },
  { key: 'ceramic_crew_split_pct', label: 'Crew split %', step: '1' },
  { key: 'ceramic_detailer_split_pct', label: 'Detailer split %', step: '1' },
]

function CompensationSettings() {
  const [rules, setRules] = useState({ ...DEFAULT_COMPENSATION_RULES })
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('compensation_settings')
      .select(
        'wash_pool_pct, ceramic_shirt_deduction_minor, ceramic_card_fee_pct, ceramic_crew_solo_pct, ceramic_crew_split_pct, ceramic_detailer_split_pct',
      )
      .eq('id', 1)
      .maybeSingle()
    setRules(normalizeCompensationSettings(data))
    setLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('compensation_settings')
      .upsert({ ...toCompensationSettingsRow(rules), updated_at: new Date().toISOString() })
    setSaving(false)
    if (error) toast.error(error.message)
    else toast.success('Compensation rules saved')
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <span className="rounded-lg border border-border bg-muted/40 p-2">
          <DollarSign className="size-5 text-primary" aria-hidden />
        </span>
        <div>
          <CardTitle className="text-lg">Compensation rules</CardTitle>
          <CardDescription className="mt-1">
            Wash pool split % and ceramic detailing pay rules. Payroll lines reference these values.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COMP_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`comp-${f.key}`}>{f.label}</Label>
              <Input
                id={`comp-${f.key}`}
                type="number"
                step={f.step}
                min="0"
                value={rules[f.key] ?? ''}
                onChange={(e) => setRules((prev) => ({ ...prev, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save compensation rules'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

/** Settings hub — branches / people / audit / permissions / compensation. */
export default function SettingsHubPage() {
  const { profile } = useAuth()
  const tiles = TILES.filter((t) => t.allow(profile))
  const showComp = isSuperAdmin(profile)

  if (!tiles.length && !showComp) {
    return <Navigate to="/operations/access-denied" replace />
  }

  return (
    <section className="flex flex-col gap-6 pb-8">
      <header className="border-b border-border pb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Settings</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Company settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branches, employees, audit logs, permission assignment, and compensation.
        </p>
      </header>
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
      {showComp && <CompensationSettings />}
    </section>
  )
}

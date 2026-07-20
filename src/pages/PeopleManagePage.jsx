import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canCreateAdminAccounts, canManagePeople, isSuperAdmin } from '@/auth/permissions'
import { listBranches, listStaffPeople, provisionStaff } from '@/lib/adminApi'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const ROLE_LABELS = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
  cashier: 'Cashier',
  marketing: 'Marketing',
  sales: 'Sales',
  BossMich: 'Super Admin',
}

export default function PeopleManagePage() {
  const { profile } = useAuth()
  const [people, setPeople] = useState([])
  const [branches, setBranches] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff',
    branch_slug: '',
    temporary_password: '',
  })

  const roleOptions = useMemo(() => {
    const base = [
      { value: 'team_lead', label: 'Team Lead' },
      { value: 'staff', label: 'Staff' },
      { value: 'cashier', label: 'Cashier' },
    ]
    if (canCreateAdminAccounts(profile)) {
      return [
        { value: 'admin', label: 'Admin (lesser RBAC)' },
        ...base,
        { value: 'marketing', label: 'Marketing' },
        { value: 'sales', label: 'Sales' },
      ]
    }
    return base
  }, [profile])

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([listStaffPeople(), listBranches()])
    setPeople(p)
    setBranches(b)
    const defaultBranch = profile?.branch_slug || b[0]?.slug || ''
    setForm((f) => ({ ...f, branch_slug: f.branch_slug || defaultBranch }))
  }, [profile?.branch_slug])

  useEffect(() => {
    if (canManagePeople(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  if (!canManagePeople(profile)) return <Navigate to="/operations/access-denied" replace />

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const needsBranch = ['admin', 'team_lead', 'staff', 'cashier', 'marketing', 'sales'].includes(form.role)
      await provisionStaff({
        ...form,
        branch_slug: needsBranch ? form.branch_slug || null : null,
      })
      toast.success('Account created — invite queued if phone was set')
      setForm((f) => ({ ...f, full_name: '', email: '', phone: '', temporary_password: '' }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">People</p>
        <h1 className="text-3xl font-semibold tracking-tight">Accounts & branch assignment</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSuperAdmin(profile)
            ? 'Super Admin creates Admins (each assigned to a branch), Team Leads, and staff.'
            : 'You can create Team Leads, staff, and cashiers for your assigned branch only.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus size={18} /> Create account</CardTitle>
            <CardDescription>Creates Auth login + staff profile. Optional temp password; otherwise a recovery link is generated.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-phone">Phone (optional notify)</Label>
                <Input id="p-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="09XXXXXXXXX" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(role) => setForm((f) => ({ ...f, role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.role !== 'BossMich' && (
                <div className="flex flex-col gap-2">
                  <Label>Branch{form.role === 'admin' ? ' (required for Admin)' : ''}</Label>
                  <Select
                    value={form.branch_slug}
                    onValueChange={(branch_slug) => setForm((f) => ({ ...f, branch_slug }))}
                    disabled={!isSuperAdmin(profile) && Boolean(profile?.branch_slug)}
                  >
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-pass">Temporary password (optional)</Label>
                <Input id="p-pass" type="text" value={form.temporary_password} onChange={(e) => setForm((f) => ({ ...f, temporary_password: e.target.value }))} placeholder="Leave blank to auto-generate" />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>{people.length} active profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.full_name}</TableCell>
                    <TableCell><Badge variant="secondary">{ROLE_LABELS[row.role] || row.role}</Badge></TableCell>
                    <TableCell>{row.branch_slug || 'All / HQ'}</TableCell>
                    <TableCell>{row.phone || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

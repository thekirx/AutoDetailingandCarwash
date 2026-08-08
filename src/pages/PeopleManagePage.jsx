import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Pencil, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  ASSISTANT_GRANT_KEYS,
  ASSISTANT_GRANT_LABELS,
  DEFAULT_ASSISTANT_GRANTS,
  ROLES,
  canCreateAdminAccounts,
  canEditAssistantGrants,
  canManagePeople,
  isSuperAdmin,
} from '@/auth/permissions'
import {
  deactivateStaffPerson,
  listBranches,
  listStaffPeople,
  provisionStaff,
  updateStaffPerson,
} from '@/lib/adminApi'
import { filterBranchesForProfile, filterPeopleForProfile, pickDefaultBranchSlug } from '@/queue/queueLogic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const ROLE_LABELS = {
  admin: 'Admin',
  assistant_super_admin: 'Assistant Super Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
  sales: 'Sales',
  marketing: 'Marketing',
  BossMich: 'Super Admin',
}

function toggleSlug(list, slug) {
  const set = new Set(list || [])
  if (set.has(slug)) set.delete(slug)
  else set.add(slug)
  return [...set]
}

function usesMultiBranch(role, grants) {
  if (role === 'admin' || role === 'marketing') return true
  if (role === 'assistant_super_admin' && grants && grants.branches_all === false) return true
  return false
}

function showBranchPicker(role, grants) {
  if (['admin', 'team_lead', 'staff', 'marketing', 'sales'].includes(role)) return true
  if (role === 'assistant_super_admin' && grants && grants.branches_all === false) return true
  return false
}

function canMutateDirectoryPerson(actor, target) {
  if (!target || target.role === 'BossMich') return false
  if (isSuperAdmin(actor)) return true
  // ASA/Admin peers: only Super Admin may edit or deactivate
  if (target.role === 'assistant_super_admin' || target.role === 'admin') return false
  return canManagePeople(actor)
}

export default function PeopleManagePage() {
  const { profile } = useAuth()
  const [people, setPeople] = useState([])
  const [branches, setBranches] = useState([])
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff',
    branch_slug: '',
    branch_slugs: [],
    temporary_password: '',
    permission_grants: { ...DEFAULT_ASSISTANT_GRANTS },
  })

  const roleOptions = useMemo(() => {
    const base = [
      { value: 'team_lead', label: 'Team Lead' },
      { value: 'staff', label: 'Staff' },
    ]
    if (canCreateAdminAccounts(profile)) {
      return [
        { value: 'admin', label: 'Admin (multi-branch)' },
        { value: 'assistant_super_admin', label: 'Assistant Super Admin' },
        ...base,
        { value: 'sales', label: 'Sales (form bookings)' },
        { value: 'marketing', label: 'Marketing' },
      ]
    }
    return base
  }, [profile])

  const load = useCallback(async () => {
    const [p, b] = await Promise.all([listStaffPeople({ includeInactive: true }), listBranches()])
    const scopedBranches = filterBranchesForProfile(b, profile)
    const scopedPeople = filterPeopleForProfile(p, profile)
    setPeople(scopedPeople)
    setBranches(scopedBranches)
    const defaultBranch = pickDefaultBranchSlug(profile, scopedBranches)
    setForm((f) => ({
      ...f,
      branch_slug: f.branch_slug || defaultBranch,
      branch_slugs: f.branch_slugs.length ? f.branch_slugs : defaultBranch ? [defaultBranch] : [],
    }))
  }, [profile])

  useEffect(() => {
    if (canManagePeople(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  if (!canManagePeople(profile)) return <Navigate to="/operations/access-denied" replace />

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const grants = form.role === ROLES.ASSISTANT_SUPER_ADMIN ? form.permission_grants : null
      const needsBranch = showBranchPicker(form.role, grants)
      const multi = usesMultiBranch(form.role, grants)
      const slugs = multi ? form.branch_slugs : form.branch_slug ? [form.branch_slug] : []
      await provisionStaff({
        ...form,
        branch_slug: needsBranch ? slugs[0] || form.branch_slug || null : null,
        branch_slugs: needsBranch ? slugs : [],
        permission_grants: form.role === ROLES.ASSISTANT_SUPER_ADMIN ? form.permission_grants : {},
      })
      toast.success('Account created')
      setForm((f) => ({ ...f, full_name: '', email: '', phone: '', temporary_password: '' }))
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editing) return
    if (!canMutateDirectoryPerson(profile, editing)) {
      toast.error('Only Super Admin can edit this account.')
      return
    }
    setSaving(true)
    try {
      const grants = editing.role === ROLES.ASSISTANT_SUPER_ADMIN ? editing.permission_grants : null
      const payload = {
        id: editing.id,
        full_name: editing.full_name,
        role: editing.role,
        branch_slug: editing.branch_slugs?.[0] || editing.branch_slug,
        branch_slugs: editing.branch_slugs,
        phone: editing.phone,
        is_active: editing.is_active,
      }
      if (editing.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile)) {
        payload.permission_grants = editing.permission_grants
      }
      // Keep branch_slugs when scoped ASA (branches_all false)
      if (editing.role === ROLES.ASSISTANT_SUPER_ADMIN && grants?.branches_all === false) {
        payload.branch_slugs = editing.branch_slugs || []
      }
      await updateStaffPerson(payload)
      toast.success('Staff updated')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function onDeactivate(row, archive) {
    if (!canMutateDirectoryPerson(profile, row)) return
    if (!window.confirm(`${archive ? 'Archive' : 'Deactivate'} ${row.full_name}?`)) return
    try {
      await deactivateStaffPerson(row.id, { archive })
      toast.success(archive ? 'Archived' : 'Deactivated')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">RBAC</p>
        <h1 className="text-3xl font-semibold tracking-tight">People & access control</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSuperAdmin(profile)
            ? 'Create roles, assign multi-branch scope, and toggle Assistant Super Admin grants. Reload after edits; open sessions pick up grant changes on next auth refresh.'
            : canEditAssistantGrants(profile)
              ? 'Manage people and ASA grants for your authority. Branch-scoped data follows assignments.'
              : 'Create Team Leads and staff for your assigned branch.'}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserPlus size={18} /> Create account</CardTitle>
            <CardDescription>Auth login + staff profile. Optional temp password.</CardDescription>
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
                <Label htmlFor="p-phone">Phone (optional)</Label>
                <Input id="p-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
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
              {showBranchPicker(form.role, form.permission_grants) && usesMultiBranch(form.role, form.permission_grants) && (
                <div className="flex flex-col gap-2">
                  <Label>Branches (multi)</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                    {branches.map((b) => (
                      <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={form.branch_slugs.includes(b.slug)}
                          onChange={() => setForm((f) => ({ ...f, branch_slugs: toggleSlug(f.branch_slugs, b.slug) }))}
                        />
                        {b.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {showBranchPicker(form.role, form.permission_grants) && !usesMultiBranch(form.role, form.permission_grants) && (
                <div className="flex flex-col gap-2">
                  <Label>Branch</Label>
                  <Select
                    value={form.branch_slug}
                    onValueChange={(branch_slug) => setForm((f) => ({ ...f, branch_slug, branch_slugs: [branch_slug] }))}
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
              {form.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile) && (
                <div className="flex flex-col gap-2">
                  <Label>Permission grants</Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                    {ASSISTANT_GRANT_KEYS.map((key) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(form.permission_grants[key])}
                          onChange={() =>
                            setForm((f) => ({
                              ...f,
                              permission_grants: { ...f.permission_grants, [key]: !f.permission_grants[key] },
                            }))
                          }
                        />
                        <span>
                          <span className="font-medium">{ASSISTANT_GRANT_LABELS[key] || key}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({key})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-pass">Temporary password (optional)</Label>
                <Input id="p-pass" type="text" value={form.temporary_password} onChange={(e) => setForm((f) => ({ ...f, temporary_password: e.target.value }))} />
              </div>
              <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
            <CardDescription>{people.length} profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div>{row.full_name}</div>
                      <div className="text-xs text-muted-foreground">{row.phone || '—'}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{ROLE_LABELS[row.role] || row.role}</Badge></TableCell>
                    <TableCell className="max-w-[10rem] truncate text-xs">
                      {(row.branch_slugs || []).join(', ') || row.branch_slug || 'All / HQ'}
                    </TableCell>
                    <TableCell>
                      {row.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {canMutateDirectoryPerson(profile, row) && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setEditing({
                                ...row,
                                branch_slugs: row.branch_slugs || (row.branch_slug ? [row.branch_slug] : []),
                                permission_grants: { ...DEFAULT_ASSISTANT_GRANTS, ...(row.permission_grants || {}) },
                              })
                            }
                          >
                            <Pencil size={14} className="mr-1" /> Edit
                          </Button>
                          {row.is_active && (
                            <Button size="sm" variant="ghost" onClick={() => onDeactivate(row, false)}>Deactivate</Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => onDeactivate(row, true)}>Archive</Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit staff</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Full name</Label>
                <Input required value={editing.full_name} onChange={(e) => setEditing((r) => ({ ...r, full_name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Phone</Label>
                <Input value={editing.phone || ''} onChange={(e) => setEditing((r) => ({ ...r, phone: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={editing.role} onValueChange={(role) => setEditing((r) => ({ ...r, role }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {showBranchPicker(editing.role, editing.permission_grants) && (
                  <div className="flex flex-col gap-2">
                  <Label>{usesMultiBranch(editing.role, editing.permission_grants) ? 'Branches (multi)' : 'Branch'}</Label>
                  {usesMultiBranch(editing.role, editing.permission_grants) ? (
                    <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                      {branches.map((b) => (
                        <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={(editing.branch_slugs || []).includes(b.slug)}
                            onChange={() =>
                              setEditing((r) => ({ ...r, branch_slugs: toggleSlug(r.branch_slugs, b.slug) }))
                            }
                          />
                          {b.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Select
                      value={editing.branch_slug || editing.branch_slugs?.[0] || ''}
                      onValueChange={(branch_slug) => setEditing((r) => ({ ...r, branch_slug, branch_slugs: [branch_slug] }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {editing.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile) && (
                <div className="flex flex-col gap-2">
                  <Label>Permission grants</Label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
                    {ASSISTANT_GRANT_KEYS.map((key) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={Boolean(editing.permission_grants?.[key])}
                          onChange={() =>
                            setEditing((r) => ({
                              ...r,
                              permission_grants: {
                                ...r.permission_grants,
                                [key]: !r.permission_grants?.[key],
                              },
                            }))
                          }
                        />
                        <span>
                          <span className="font-medium">{ASSISTANT_GRANT_LABELS[key] || key}</span>
                          <span className="ml-1 text-xs text-muted-foreground">({key})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={editing.is_active ? 'active' : 'inactive'}
                  onValueChange={(v) => setEditing((r) => ({ ...r, is_active: v === 'active' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

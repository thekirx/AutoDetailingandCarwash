import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Pencil, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import {
  ROLES,
  ASSISTANT_GRANT_KEYS,
  DEFAULT_ASSISTANT_GRANTS,
  canCreateAdminAccounts,
  canEditAssistantGrants,
  canManagePeople,
  isSuperAdmin,
  normalizeAssistantGrants,
} from '@/auth/permissions'
import AssistantGrantsEditor from '@/components/AssistantGrantsEditor'
import {
  deactivateStaffPerson,
  listBranches,
  listStaffPeople,
  provisionStaff,
  updateStaffPerson,
  updateStaffAccountFields,
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
import { supabase } from '@/lib/supabase'
import { validateRoleDefinition, BASELINE_TEMPLATES } from '@/lib/roleDefinitions'

const ROLE_LABELS = {
  admin: 'Admin',
  assistant_super_admin: 'Assistant Super Admin',
  operations_lead: 'Operations Lead',
  team_lead: 'Team Lead',
  staff: 'Staff',
  sales: 'Sales',
  marketing: 'Marketing',
  detailer: 'Detailer',
  video_editor: 'Video Editor',
  investor: 'Investor',
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

function DirectoryPersonActions({ profile, row, onEdit, onDeactivate }) {
  if (!canMutateDirectoryPerson(profile, row)) return null
  return (
    <div className="people-directory-actions">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onEdit({
            ...row,
            branch_slugs: row.branch_slugs || (row.branch_slug ? [row.branch_slug] : []),
            permission_grants: normalizeAssistantGrants(row.permission_grants),
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
  )
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
    permission_grants: normalizeAssistantGrants({}),
    attendance_enabled: true,
    geofence_enabled: true,
    employment_type: 'permanent',
  })
  const [roleDefs, setRoleDefs] = useState([])
  const [roleDefForm, setRoleDefForm] = useState({
    role_key: '',
    label: '',
    baseline_template: 'staff',
    grants: { ...DEFAULT_ASSISTANT_GRANTS },
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
        { value: 'operations_lead', label: 'Operations Lead (all branches)' },
        ...base,
        { value: 'detailer', label: 'Detailer' },
        { value: 'sales', label: 'Sales (form bookings)' },
        { value: 'marketing', label: 'Marketing' },
        { value: 'video_editor', label: 'Video Editor' },
        { value: 'investor', label: 'Investor' },
      ]
    }
    return base
  }, [profile])

  const load = useCallback(async () => {
    const [p, b, defs] = await Promise.all([
      listStaffPeople({ includeInactive: true }),
      listBranches(),
      supabase.from('role_definitions').select('*').eq('is_active', true).order('label'),
    ])
    const scopedBranches = filterBranchesForProfile(b, profile)
    const scopedPeople = filterPeopleForProfile(p, profile)
    setPeople(scopedPeople)
    setBranches(scopedBranches)
    if (!defs.error) setRoleDefs(defs.data || [])
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
        attendance_enabled: form.role === 'operations_lead' ? false : form.attendance_enabled,
        geofence_enabled: form.geofence_enabled,
        employment_type: form.employment_type,
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
        attendance_enabled: editing.attendance_enabled,
        geofence_enabled: editing.geofence_enabled,
        employment_type: editing.employment_type,
      }
      if (editing.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile)) {
        payload.permission_grants = editing.permission_grants
      }
      // Keep branch_slugs when scoped ASA (branches_all false)
      if (editing.role === ROLES.ASSISTANT_SUPER_ADMIN && grants?.branches_all === false) {
        payload.branch_slugs = editing.branch_slugs || []
      }
      await updateStaffPerson(payload)
      if (String(editing.temporary_password || '').trim()) {
        await updateStaffAccountFields({
          id: editing.id,
          temporary_password: editing.temporary_password.trim(),
        })
      }
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
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Users & Access</p>
        <h1 className="text-3xl font-semibold tracking-tight">Users & Access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSuperAdmin(profile)
            ? 'Create roles, assign multi-branch scope, and toggle Assistant Super Admin grants. Reload after edits; open sessions pick up grant changes on next auth refresh.'
            : canEditAssistantGrants(profile)
              ? 'Manage people and ASA grants for your authority. Branch-scoped data follows assignments.'
              : 'Create Team Leads and staff for your assigned branch.'}
        </p>
      </div>

      {isSuperAdmin(profile) ? (
        <Card>
          <CardHeader>
            <CardTitle>Custom roles</CardTitle>
            <CardDescription>
              Option A: baseline system template + grants overlay. Assign via custom_role_key on a person (keeps profile_role enum).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const check = validateRoleDefinition(roleDefForm)
                if (!check.ok) {
                  toast.error(Object.values(check.errors)[0])
                  return
                }
                const { error } = await supabase.from('role_definitions').upsert({
                  role_key: check.role_key,
                  label: check.label,
                  baseline_template: check.baseline_template,
                  grants: check.grants,
                  is_active: true,
                  updated_at: new Date().toISOString(),
                })
                if (error) toast.error(error.message)
                else {
                  toast.success('Role definition saved')
                  setRoleDefForm({ role_key: '', label: '', baseline_template: 'staff', grants: { ...DEFAULT_ASSISTANT_GRANTS } })
                  load()
                }
              }}
            >
              <Input
                placeholder="role_key (snake_case)"
                value={roleDefForm.role_key}
                onChange={(e) => setRoleDefForm((f) => ({ ...f, role_key: e.target.value }))}
              />
              <Input
                placeholder="Label"
                value={roleDefForm.label}
                onChange={(e) => setRoleDefForm((f) => ({ ...f, label: e.target.value }))}
              />
              <Select
                value={roleDefForm.baseline_template}
                onValueChange={(baseline_template) => setRoleDefForm((f) => ({ ...f, baseline_template }))}
              >
                <SelectTrigger><SelectValue placeholder="Baseline template" /></SelectTrigger>
                <SelectContent>
                  {BASELINE_TEMPLATES.map((t) => (
                    <SelectItem key={t} value={t}>{ROLE_LABELS[t] || t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" className="min-h-11">Save definition</Button>
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Grant keys whitelist: {ASSISTANT_GRANT_KEYS.slice(0, 6).join(', ')}…
              </p>
            </form>
            <ul className="space-y-2 text-sm">
              {roleDefs.map((d) => (
                <li key={d.role_key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <span>
                    <strong>{d.label}</strong> · {d.role_key} → {d.baseline_template}
                  </span>
                </li>
              ))}
              {!roleDefs.length ? <li className="text-muted-foreground">No custom roles yet.</li> : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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
                <Select
                  value={form.role}
                  onValueChange={(role) =>
                    setForm((f) => ({
                      ...f,
                      role,
                      attendance_enabled: role === 'operations_lead' ? false : f.attendance_enabled,
                    }))
                  }
                >
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
                <AssistantGrantsEditor
                  grants={form.permission_grants}
                  onChange={(permission_grants) => setForm((f) => ({ ...f, permission_grants }))}
                />
              )}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff toggles</Label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.attendance_enabled} onChange={() => setForm((f) => ({ ...f, attendance_enabled: !f.attendance_enabled }))} />
                  Attendance clock enabled
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.geofence_enabled} onChange={() => setForm((f) => ({ ...f, geofence_enabled: !f.geofence_enabled }))} />
                  Geofence enabled
                </label>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Employment type</Label>
                  <Select value={form.employment_type} onValueChange={(employment_type) => setForm((f) => ({ ...f, employment_type }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="on_call">On-call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
            <ul className="people-directory-cards">
              {people.map((row) => (
                <li key={row.id} className="people-directory-card">
                  <div>
                    <strong>{row.full_name}</strong>
                    <p>{row.phone || 'No phone'}</p>
                    <p>{(row.branch_slugs || []).join(', ') || row.branch_slug || 'All / HQ'}</p>
                  </div>
                  <div className="people-directory-card-meta">
                    <Badge variant="secondary">{ROLE_LABELS[row.role] || row.role}</Badge>
                    {row.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <DirectoryPersonActions
                    profile={profile}
                    row={row}
                    onEdit={setEditing}
                    onDeactivate={onDeactivate}
                  />
                </li>
              ))}
            </ul>
            <div className="people-directory-table overflow-x-auto">
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
                      <DirectoryPersonActions
                        profile={profile}
                        row={row}
                        onEdit={setEditing}
                        onDeactivate={onDeactivate}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
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
                <AssistantGrantsEditor
                  grants={editing.permission_grants}
                  onChange={(permission_grants) => setEditing((r) => ({ ...r, permission_grants }))}
                />
              )}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staff toggles</Label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.attendance_enabled !== false} onChange={() => setEditing((r) => ({ ...r, attendance_enabled: !(r.attendance_enabled !== false) }))} />
                  Attendance clock enabled
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.geofence_enabled !== false} onChange={() => setEditing((r) => ({ ...r, geofence_enabled: !(r.geofence_enabled !== false) }))} />
                  Geofence enabled
                </label>
                <div className="flex flex-col gap-1">
                  <Label className="text-sm">Employment type</Label>
                  <Select value={editing.employment_type || 'permanent'} onValueChange={(employment_type) => setEditing((r) => ({ ...r, employment_type }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="on_call">On-call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Temporary password</Label>
                <Input
                  type="text"
                  autoComplete="new-password"
                  value={editing.temporary_password || ''}
                  onChange={(e) => setEditing((r) => ({ ...r, temporary_password: e.target.value }))}
                  placeholder="Leave blank to keep the current password"
                />
              </div>
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

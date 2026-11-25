import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  Clock,
  KeyRound,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useUrlQueryState } from '@/hooks/useUrlQueryState'
import {
  ROLES,
  ASSISTANT_GRANT_KEYS,
  ASSISTANT_GRANT_LABELS,
  DEFAULT_ASSISTANT_GRANTS,
  canCreateAdminAccounts,
  canEditAssistantGrants,
  canManagePeople,
  countEnabledAssistantGrants,
  isSuperAdmin,
  normalizeAssistantGrants,
} from '@/auth/permissions'
import AssistantGrantsEditor from '@/components/AssistantGrantsEditor'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsStatTile from '@/components/ops/OpsStatTile'
import ConfirmDialog from '@/components/ops/ConfirmDialog'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import {
  canCreateStaffRoleOverride,
  canRevokeStaffRoleOverride,
} from '@/lib/ownerRevisionsPhase7'
import {
  filterDirectoryPeople,
  PEOPLE_DIRECTORY_TABS,
  personDirectoryTab,
  showBranchPicker,
  supervisorCandidates,
  usesMultiBranch,
} from '@/lib/peopleDirectory'
import { BASELINE_TEMPLATES, validateRoleDefinition } from '@/lib/roleDefinitions'
import { generalAdminSheetGrants, internalRoleLabel, roleAccessSummary } from '@/auth/internalRoles'
import { cn } from '@/lib/utils'
import '@/styles/employees-hub.css'

const ROLE_LABELS = {
  admin: internalRoleLabel('admin'),
  assistant_super_admin: internalRoleLabel('assistant_super_admin'),
  operations_lead: internalRoleLabel('operations_lead'),
  team_lead: internalRoleLabel('team_lead'),
  staff: internalRoleLabel('staff'),
  sales: internalRoleLabel('sales'),
  marketing: internalRoleLabel('marketing'),
  detailer: internalRoleLabel('detailer'),
  video_editor: internalRoleLabel('video_editor'),
  investor: internalRoleLabel('investor'),
  BossMich: internalRoleLabel('BossMich'),
}

const ROLE_DEF_COLS = 'role_key, label, baseline_template, grants, is_active'
const DIRECTORY_FILTER_PILLS = Object.freeze([
  { id: 'all', label: 'All employees' },
  ...PEOPLE_DIRECTORY_TABS,
])

function toggleSlug(list, slug) {
  const set = new Set(list || [])
  if (set.has(slug)) set.delete(slug)
  else set.add(slug)
  return [...set]
}

function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'ST'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function formatBranchScopeLabel(row, branchMap) {
  const slugs = row.branch_slugs?.length ? row.branch_slugs : row.branch_slug ? [row.branch_slug] : []
  if (!slugs.length) return 'All branches / HQ'
  return slugs.map((slug) => branchMap.get(slug) || slug).join(', ')
}

function canMutateDirectoryPerson(actor, target) {
  if (!target || target.role === 'BossMich') return false
  if (isSuperAdmin(actor)) return true
  if (target.role === 'assistant_super_admin' || target.role === 'admin') return false
  return canManagePeople(actor)
}

function openEditDraft(row, onEdit) {
  onEdit({
    ...row,
    branch_slugs: row.branch_slugs || (row.branch_slug ? [row.branch_slug] : []),
    permission_grants: normalizeAssistantGrants(row.permission_grants),
  })
}

function DirectoryPersonActions({ profile, row, onEdit, onDeactivate, compact = false }) {
  if (!canMutateDirectoryPerson(profile, row)) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', compact ? 'justify-start' : 'justify-end')}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="min-h-10 gap-1"
        onClick={() => openEditDraft(row, onEdit)}
      >
        <Pencil className="size-3.5" aria-hidden />
        Edit
      </Button>
      {row.is_active ? (
        <Button type="button" size="sm" variant="ghost" className="min-h-10" onClick={() => onDeactivate(row, false)}>
          Deactivate
        </Button>
      ) : null}
      <Button type="button" size="sm" variant="ghost" className="min-h-10 text-muted-foreground" onClick={() => onDeactivate(row, true)}>
        Archive
      </Button>
    </div>
  )
}

function EmployeesSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="emp-summary-grid">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

/**
 * Employee Directory + RBAC Delegation manager.
 * Mounts standalone at /operations/people or embedded inside EmployeesHubPage (view="directory" | "access").
 */
export default function PeopleManagePage({ embedded = false, view = 'all', openCreateSignal = 0 } = {}) {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [people, setPeople] = useState([])
  const [branches, setBranches] = useState([])
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [archiveRoleTarget, setArchiveRoleTarget] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [tempTlOpen, setTempTlOpen] = useState(false)
  const [dirQuery, setDirQuery] = useUrlQueryState()
  const [dirBranch, setDirBranch] = useState('')
  const [dirStatus, setDirStatus] = useState('active')
  const [localRoleFilter, setLocalRoleFilter] = useState(() => {
    const p = searchParams.get('dtab') || (!embedded ? searchParams.get('tab') : '')
    return PEOPLE_DIRECTORY_TABS.some((t) => t.id === p) ? p : 'all'
  })
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
    is_supervisor: false,
    reports_to: '',
  })
  const [roleDefs, setRoleDefs] = useState([])
  const [roleDefForm, setRoleDefForm] = useState({
    role_key: '',
    label: '',
    baseline_template: 'staff',
    grants: { ...DEFAULT_ASSISTANT_GRANTS },
  })
  const [overrideForm, setOverrideForm] = useState({
    staff_id: '',
    branch_slug: '',
    on_date: getLocalCalendarDate(),
  })
  const [overrides, setOverrides] = useState([])

  const showDirectory = view === 'all' || view === 'directory'
  const showAccess = view === 'all' || view === 'access'
  const needRbacData = showAccess && (isSuperAdmin(profile) || canCreateStaffRoleOverride(profile))
  const lastCreateSignalRef = useRef(0)

  useEffect(() => {
    if (view !== 'access' && openCreateSignal > lastCreateSignalRef.current) {
      lastCreateSignalRef.current = openCreateSignal
      setCreateOpen(true)
    }
  }, [openCreateSignal, view])

  const roleOptions = useMemo(() => {
    const base = [
      { value: 'team_lead', label: 'Team Lead' },
      { value: 'staff', label: 'Crew' },
    ]
    if (canCreateAdminAccounts(profile)) {
      return [
        { value: 'admin', label: 'Branch Admin (assigned branches)' },
        { value: 'assistant_super_admin', label: 'General Admin (all branches)' },
        { value: 'operations_lead', label: 'Operations Lead (all branches)' },
        ...base,
        { value: 'detailer', label: 'Detailer' },
        { value: 'sales', label: 'Customer Rep (all branches)' },
        { value: 'marketing', label: 'Marketing (all branches)' },
        { value: 'video_editor', label: 'Video Editor' },
        { value: 'investor', label: 'Investor (specific branch)' },
      ]
    }
    return base
  }, [profile])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, b, defs, ov] = await Promise.all([
        listStaffPeople({ includeInactive: true }),
        listBranches(),
        needRbacData && isSuperAdmin(profile)
          ? supabase.from('role_definitions').select(ROLE_DEF_COLS).eq('is_active', true).order('label')
          : Promise.resolve({ data: null, error: null }),
        needRbacData && canCreateStaffRoleOverride(profile)
          ? supabase
            .from('staff_role_overrides')
            .select('id, staff_id, role, branch_slug, on_date, created_at')
            .gte('on_date', getLocalCalendarDate())
            .order('on_date', { ascending: true })
            .limit(40)
          : Promise.resolve({ data: null, error: null }),
      ])
      const scopedBranches = filterBranchesForProfile(b, profile)
      const scopedPeople = filterPeopleForProfile(p, profile)
      setPeople(scopedPeople)
      setBranches(scopedBranches)
      if (defs?.error) toast.error(defs.error.message || 'Unable to load custom role templates')
      else if (Array.isArray(defs?.data)) setRoleDefs(defs.data)
      if (ov?.error) toast.error(ov.error.message || 'Unable to load temporary Team Lead overrides')
      else if (Array.isArray(ov?.data)) setOverrides(ov.data)
      const defaultBranch = pickDefaultBranchSlug(profile, scopedBranches)
      setForm((f) => ({
        ...f,
        branch_slug: f.branch_slug || defaultBranch,
        branch_slugs: f.branch_slugs.length ? f.branch_slugs : defaultBranch ? [defaultBranch] : [],
      }))
      setOverrideForm((f) => ({
        ...f,
        branch_slug: f.branch_slug || defaultBranch,
      }))
    } finally {
      setLoading(false)
    }
  }, [profile, needRbacData])

  useEffect(() => {
    if (canManagePeople(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  const dirTab = embedded
    ? localRoleFilter
    : PEOPLE_DIRECTORY_TABS.some((t) => t.id === searchParams.get('tab'))
      ? searchParams.get('tab')
      : localRoleFilter

  const directory = useMemo(
    () =>
      filterDirectoryPeople(people, { tab: dirTab, q: dirQuery, branch: dirBranch, status: dirStatus }),
    [people, dirTab, dirQuery, dirBranch, dirStatus],
  )

  const branchMap = useMemo(
    () => new Map(branches.map((b) => [b.slug, b.name || b.slug])),
    [branches],
  )
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const supervisors = useMemo(() => supervisorCandidates(people), [people])

  const dirStats = useMemo(() => {
    let active = 0
    let onCallOrNoClock = 0
    let supervisorsCount = 0
    const byGroup = { all: people.length, crew: 0, tl: 0, admins: 0, office: 0 }
    for (const row of people) {
      const grp = personDirectoryTab(row.role)
      byGroup[grp] = (byGroup[grp] || 0) + 1
      if (row.is_active) active += 1
      if (row.is_active && row.is_supervisor) supervisorsCount += 1
      if (row.employment_type === 'on_call' || row.attendance_enabled === false) onCallOrNoClock += 1
    }
    return { active, inactive: people.length - active, supervisorsCount, onCallOrNoClock, byGroup }
  }, [people])

  const generalAdmins = useMemo(
    () => people.filter((row) => row.role === ROLES.ASSISTANT_SUPER_ADMIN),
    [people],
  )

  if (!canManagePeople(profile)) return <Navigate to="/operations/access-denied" replace />

  function setDirTab(id) {
    setLocalRoleFilter(id)
    if (!embedded) {
      const next = new URLSearchParams(searchParams)
      if (!id || id === 'all') next.delete('tab')
      else next.set('tab', id)
      setSearchParams(next, { replace: true })
    }
  }

  async function createTempTl(event) {
    event.preventDefault()
    if (!canCreateStaffRoleOverride(profile)) {
      toast.error('Only SA/ASA or branch admin can assign a temp Team Lead.')
      return
    }
    if (!overrideForm.staff_id || !overrideForm.branch_slug || !overrideForm.on_date) {
      toast.error('Pick crew, branch, and date.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('staff_role_overrides').insert({
        staff_id: overrideForm.staff_id,
        role: 'team_lead',
        branch_slug: overrideForm.branch_slug,
        on_date: overrideForm.on_date,
        created_by: profile.id,
      })
      if (error) throw error
      toast.success('Temp Team Lead set for that day')
      setTempTlOpen(false)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function revokeOverride(id) {
    if (!canRevokeStaffRoleOverride(profile)) {
      toast.error('Only Super Admin can revoke overrides.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('staff_role_overrides').delete().eq('id', id)
      if (error) throw error
      toast.success('Override revoked')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

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
      toast.success('Employee account created')
      setForm((f) => ({ ...f, full_name: '', email: '', phone: '', temporary_password: '', is_supervisor: false, reports_to: '' }))
      setCreateOpen(false)
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
        is_supervisor: Boolean(editing.is_supervisor),
        reports_to: editing.reports_to || null,
      }
      if (editing.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile)) {
        payload.permission_grants = editing.permission_grants
      }
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
      toast.success('Employee updated')
      setEditing(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function onDeactivate(row, archive) {
    if (!canMutateDirectoryPerson(profile, row)) return
    setDeactivateTarget({ row, archive })
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    const { row, archive } = deactivateTarget
    if (!canMutateDirectoryPerson(profile, row)) return
    setSaving(true)
    try {
      await deactivateStaffPerson(row.id, { archive })
      toast.success(archive ? 'Archived' : 'Deactivated')
      setDeactivateTarget(null)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const directorySection = showDirectory ? (
    <div className="flex flex-col gap-5">
      {loading && !people.length ? (
        <EmployeesSkeleton />
      ) : (
        <>
          <div className="emp-summary-grid">
            <OpsStatTile label="Active employees" value={dirStats.active} hint={`${dirStats.inactive} inactive`} icon={UserCheck} mono />
            <OpsStatTile label="Crew & Detailers" value={dirStats.byGroup.crew || 0} hint="Floor bay roster" icon={Users} mono />
            <OpsStatTile label="Leads & Admins" value={(dirStats.byGroup.tl || 0) + (dirStats.byGroup.admins || 0)} hint={`${dirStats.supervisorsCount} tagged supervisors`} icon={UserCog} mono />
            <OpsStatTile label="Clock off / On-call" value={dirStats.onCallOrNoClock} hint="Exempt or flexible schedule" icon={Clock} mono />
          </div>

          <Card className="border-border/80 shadow-sm">
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>Employee directory</CardTitle>
                  <CardDescription>
                    Showing <span className="font-mono tabular-nums text-foreground">{directory.length}</span> of{' '}
                    <span className="font-mono tabular-nums text-foreground">{people.length}</span> profiles
                  </CardDescription>
                </div>
                {embedded ? (
                  <Button type="button" className="min-h-11 gap-1.5" onClick={() => setCreateOpen(true)}>
                    <UserPlus className="size-4" aria-hidden />
                    Add employee
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Employee role groups">
                {DIRECTORY_FILTER_PILLS.map((pill) => {
                  const count = dirStats.byGroup[pill.id] ?? 0
                  const selected = dirTab === pill.id
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={cn(
                        'min-h-11 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                      )}
                      onClick={() => setDirTab(pill.id)}
                    >
                      {pill.label} <span className="ml-1 font-mono opacity-80">{count}</span>
                    </button>
                  )
                })}
              </div>

              <div className="emp-filter-bar">
                <Input
                  type="search"
                  value={dirQuery}
                  onChange={(e) => setDirQuery(e.target.value)}
                  placeholder="Search name, phone, role, branch…"
                  aria-label="Search employees"
                  className="min-h-11"
                />
                <Select value={dirBranch || 'all'} onValueChange={(v) => setDirBranch(v === 'all' ? '' : v)}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="Filter by branch">
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.slug} value={b.slug}>
                        {b.name || b.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dirStatus} onValueChange={setDirStatus}>
                  <SelectTrigger className="min-h-11 w-full" aria-label="Filter by status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active only</SelectItem>
                    <SelectItem value="inactive">Inactive only</SelectItem>
                    <SelectItem value="all">All statuses</SelectItem>
                  </SelectContent>
                </Select>
                {(dirQuery.trim() || dirBranch || dirStatus !== 'active' || dirTab !== 'all') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11 shrink-0"
                    onClick={() => {
                      setDirQuery('')
                      setDirBranch('')
                      setDirStatus('active')
                      setDirTab('all')
                    }}
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <ul className="people-directory-cards emp-dir-cards" aria-label="Employee cards">
                {directory.map((row) => {
                  const supervisor = row.reports_to ? peopleById.get(row.reports_to) : null
                  return (
                    <li key={row.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="emp-avatar" aria-hidden>
                            {initialsOf(row.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{row.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">{row.phone || 'No phone on file'}</p>
                          </div>
                        </div>
                        <span className={cn('emp-status-pill shrink-0', row.is_active ? 'is-active' : 'is-inactive')}>
                          {row.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">{ROLE_LABELS[row.role] || row.role}</Badge>
                        {row.is_supervisor ? <Badge variant="outline">Supervisor</Badge> : null}
                        {row.employment_type === 'on_call' ? <span className="emp-flag-tag">On-call</span> : null}
                        {row.attendance_enabled === false ? <span className="emp-flag-tag">No clock</span> : null}
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          {formatBranchScopeLabel(row, branchMap)}
                        </span>
                        {supervisor ? (
                          <span>Reports to: <strong className="font-medium text-foreground">{supervisor.full_name}</strong></span>
                        ) : null}
                      </div>

                      <DirectoryPersonActions
                        profile={profile}
                        row={row}
                        onEdit={setEditing}
                        onDeactivate={onDeactivate}
                        compact
                      />
                    </li>
                  )
                })}
              </ul>

              <div className="emp-dir-table overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Branches</TableHead>
                      <TableHead>Supervisor & schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {directory.map((row) => {
                      const supervisor = row.reports_to ? peopleById.get(row.reports_to) : null
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <span className="emp-avatar" aria-hidden>
                                {initialsOf(row.full_name)}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground">{row.full_name}</div>
                                <div className="text-xs text-muted-foreground tabular-nums">{row.phone || 'No phone'}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{ROLE_LABELS[row.role] || row.role}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[13rem] text-xs text-muted-foreground">
                            {formatBranchScopeLabel(row, branchMap)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              {row.is_supervisor ? <Badge variant="outline">Supervisor</Badge> : null}
                              {supervisor ? <span className="text-foreground">{supervisor.full_name}</span> : !row.is_supervisor ? <span className="text-muted-foreground">—</span> : null}
                              {row.employment_type === 'on_call' ? <span className="emp-flag-tag">On-call</span> : null}
                              {row.attendance_enabled === false ? <span className="emp-flag-tag">Clock off</span> : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={cn('emp-status-pill', row.is_active ? 'is-active' : 'is-inactive')}>
                              {row.is_active ? 'Active' : 'Inactive'}
                            </span>
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
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {!directory.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">No employees match the current filters.</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Switch role group pills, clear the search query, or include inactive profiles.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  ) : null

  const accessSection = showAccess ? (
    <div className="flex flex-col gap-5">
      {canEditAssistantGrants(profile) || isSuperAdmin(profile) ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" aria-hidden />
                  RBAC Delegation · General Admins
                </CardTitle>
                <CardDescription>
                  Fine-grained permissions for each General Admin (Assistant Super Admin). Edit grants directly without leaving the Employees hub.
                </CardDescription>
              </div>
              {isSuperAdmin(profile) ? (
                <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => setCreateOpen(true)}>
                  <UserPlus className="size-4" aria-hidden />
                  Add General Admin
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {generalAdmins.length ? (
              <div className="emp-rbac-grid">
                {generalAdmins.map((adminRow) => {
                  const grants = normalizeAssistantGrants(adminRow.permission_grants)
                  const enabledCount = countEnabledAssistantGrants(grants)
                  const activeKeys = ASSISTANT_GRANT_KEYS.filter((k) => grants[k])
                  const canEditRow = canMutateDirectoryPerson(profile, adminRow) && canEditAssistantGrants(profile)
                  return (
                    <article
                      key={adminRow.id}
                      className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="emp-avatar" aria-hidden>
                              {initialsOf(adminRow.full_name)}
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate font-semibold text-foreground">{adminRow.full_name}</h3>
                              <p className="text-xs text-muted-foreground">
                                {grants.branches_all === false
                                  ? `Branch scope: ${formatBranchScopeLabel(adminRow, branchMap)}`
                                  : 'Branch scope: All branches'}
                              </p>
                            </div>
                          </div>
                          <span className="emp-status-pill shrink-0 is-active font-mono tabular-nums">
                            {enabledCount} / {ASSISTANT_GRANT_KEYS.length} on
                          </span>
                        </div>

                        <div className="emp-grant-chips" aria-label={`Enabled permissions for ${adminRow.full_name}`}>
                          {activeKeys.slice(0, 8).map((key) => (
                            <span key={key} className="emp-grant-chip">
                              {ASSISTANT_GRANT_LABELS[key] || key}
                            </span>
                          ))}
                          {activeKeys.length > 8 ? (
                            <span className="emp-grant-chip is-muted">+{activeKeys.length - 8} more</span>
                          ) : null}
                          {!activeKeys.length ? (
                            <span className="emp-grant-chip is-muted">Read-only baseline</span>
                          ) : null}
                        </div>
                      </div>

                      {canEditRow ? (
                        <div className="flex justify-end border-t border-border/70 pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 gap-1.5"
                            onClick={() => openEditDraft(adminRow, setEditing)}
                          >
                            <KeyRound className="size-4" aria-hidden />
                            Configure RBAC grants
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No General Admin (Assistant Super Admin) accounts yet. Create one to delegate branch or finance capabilities.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canCreateStaffRoleOverride(profile) ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle>Temp Team Lead delegation</CardTitle>
              <CardDescription>
                Promote crew as acting Team Lead for one Manila calendar day (branch-scoped). Super Admin can revoke any time.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => setTempTlOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Assign temp TL
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {overrides.map((row) => {
                const name = peopleById.get(row.staff_id)?.full_name || row.staff_id.slice(0, 8)
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5">
                    <span className="min-w-0">
                      <strong className="text-foreground">{name}</strong>{' '}
                      <span className="text-muted-foreground">
                        · {branchMap.get(row.branch_slug) || row.branch_slug} ·{' '}
                        <span className="font-mono tabular-nums">{String(row.on_date).slice(0, 10)}</span> · {ROLE_LABELS[row.role] || row.role}
                      </span>
                    </span>
                    {canRevokeStaffRoleOverride(profile) ? (
                      <Button type="button" size="sm" variant="ghost" className="min-h-10" disabled={saving} onClick={() => revokeOverride(row.id)}>
                        Revoke
                      </Button>
                    ) : null}
                  </li>
                )
              })}
              {!overrides.length ? (
                <li className="text-muted-foreground">No active or upcoming Team Lead overrides.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {isSuperAdmin(profile) ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
              <CardTitle>Custom role templates</CardTitle>
              <CardDescription>
                Baseline system role + grant overlay (`role_definitions`). Assign via custom role key on an employee account.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" className="min-h-11 gap-1.5" onClick={() => setRoleOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New role
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {roleDefs.map((d) => (
                <li key={d.role_key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3.5 py-2.5">
                  <span>
                    <strong className="text-foreground">{d.label}</strong>{' '}
                    <span className="font-mono text-xs text-muted-foreground">({d.role_key})</span> →{' '}
                    <Badge variant="secondary">{ROLE_LABELS[d.baseline_template] || d.baseline_template}</Badge>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        setRoleDefForm({
                          role_key: d.role_key,
                          label: d.label || '',
                          baseline_template: d.baseline_template || 'staff',
                          grants: normalizeAssistantGrants(d.grants || {}),
                        })
                        setRoleOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={saving}
                      onClick={() => setArchiveRoleTarget(d)}
                    >
                      Archive
                    </Button>
                  </div>
                </li>
              ))}
              {!roleDefs.length ? <li className="text-muted-foreground">No custom role templates defined yet.</li> : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  ) : null

  function handleRoleDialogChange(open) {
    setRoleOpen(open)
    if (!open) {
      setRoleDefForm({ role_key: '', label: '', baseline_template: 'staff', grants: { ...DEFAULT_ASSISTANT_GRANTS } })
    }
  }

  const modals = (
    <>
      <Dialog open={roleOpen} onOpenChange={handleRoleDialogChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{roleDefs.some((d) => d.role_key === roleDefForm.role_key) ? 'Edit custom role' : 'New custom role'}</DialogTitle>
            <DialogDescription>Baseline system template plus a grants overlay.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const check = validateRoleDefinition({
                roleKey: roleDefForm.role_key,
                label: roleDefForm.label,
                baselineTemplate: roleDefForm.baseline_template,
                grants: roleDefForm.grants,
              })
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
                setRoleOpen(false)
                load()
              }
            }}
          >
            <Input
              aria-label="Role key"
              placeholder="role_key (snake_case)"
              className="min-h-11"
              value={roleDefForm.role_key}
              onChange={(e) => setRoleDefForm((f) => ({ ...f, role_key: e.target.value }))}
            />
            <Input
              aria-label="Label"
              placeholder="Label"
              className="min-h-11"
              value={roleDefForm.label}
              onChange={(e) => setRoleDefForm((f) => ({ ...f, label: e.target.value }))}
            />
            <Select
              value={roleDefForm.baseline_template}
              onValueChange={(baseline_template) => setRoleDefForm((f) => ({ ...f, baseline_template }))}
            >
              <SelectTrigger className="min-h-11 w-full"><SelectValue placeholder="Baseline template" /></SelectTrigger>
              <SelectContent>
                {BASELINE_TEMPLATES.map((t) => (
                  <SelectItem key={t} value={t}>{ROLE_LABELS[t] || t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <AssistantGrantsEditor
              grants={normalizeAssistantGrants(roleDefForm.grants)}
              onChange={(grants) => setRoleDefForm((f) => ({ ...f, grants }))}
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setRoleOpen(false)}>Cancel</Button>
              <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Save definition'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tempTlOpen} onOpenChange={setTempTlOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign temp Team Lead</DialogTitle>
            <DialogDescription>One Manila calendar day, scoped to the branch you pick.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTempTl} className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Label>Crew</Label>
              <Select
                value={overrideForm.staff_id}
                onValueChange={(staff_id) => setOverrideForm((f) => ({ ...f, staff_id }))}
              >
                <SelectTrigger className="min-h-11 w-full"><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {people
                    .filter((p) => p.is_active && ['staff', 'team_lead'].includes(p.role))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({ROLE_LABELS[p.role] || p.role})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Branch</Label>
              <Select
                value={overrideForm.branch_slug}
                onValueChange={(branch_slug) => setOverrideForm((f) => ({ ...f, branch_slug }))}
              >
                <SelectTrigger className="min-h-11 w-full"><SelectValue placeholder="Branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>{b.name || b.slug}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                className="min-h-11"
                value={overrideForm.on_date}
                onChange={(e) => setOverrideForm((f) => ({ ...f, on_date: e.target.value }))}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setTempTlOpen(false)}>Cancel</Button>
              <Button type="submit" className="min-h-11" disabled={saving}>
                {saving ? 'Saving…' : 'Assign temp TL'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create employee account</DialogTitle>
            <DialogDescription>
              Provision a staff profile, role permissions, branch scope, and attendance defaults.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="p-name">Full name</Label>
                <Input id="p-name" className="min-h-11" required value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" className="min-h-11" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="p-phone">Phone (optional)</Label>
                <Input id="p-phone" className="min-h-11" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
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
                    permission_grants: role === ROLES.ASSISTANT_SUPER_ADMIN ? generalAdminSheetGrants() : f.permission_grants,
                  }))
                }
              >
                <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {roleAccessSummary(form.role) ? (
                <p className="text-xs text-muted-foreground">{roleAccessSummary(form.role)}</p>
              ) : null}
            </div>
            {!showBranchPicker(form.role, form.permission_grants) ? (
              <p className="text-sm text-muted-foreground">Branch access: all branches.</p>
            ) : null}
            {showBranchPicker(form.role, form.permission_grants) && usesMultiBranch(form.role, form.permission_grants) ? (
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
            ) : null}
            {showBranchPicker(form.role, form.permission_grants) && !usesMultiBranch(form.role, form.permission_grants) ? (
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select
                  value={form.branch_slug}
                  onValueChange={(branch_slug) => setForm((f) => ({ ...f, branch_slug, branch_slugs: [branch_slug] }))}
                  disabled={!isSuperAdmin(profile) && Boolean(profile?.branch_slug)}
                >
                  <SelectTrigger className="min-h-11"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {form.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile) ? (
              <AssistantGrantsEditor
                grants={form.permission_grants}
                onChange={(permission_grants) => setForm((f) => ({ ...f, permission_grants }))}
              />
            ) : null}
            <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance & work schedule</Label>
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
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="on_call">On-call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {isSuperAdmin(profile) ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_supervisor)}
                    onChange={() => setForm((f) => ({ ...f, is_supervisor: !f.is_supervisor }))}
                  />
                  Tag as supervisor
                </label>
                <div className="flex flex-col gap-2">
                  <Label>Reports to</Label>
                  <Select
                    value={form.reports_to || 'none'}
                    onValueChange={(v) => setForm((f) => ({ ...f, reports_to: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger className="min-h-11"><SelectValue placeholder="No supervisor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supervisor</SelectItem>
                      {supervisors.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} ({ROLE_LABELS[p.role] || p.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-pass">Temporary password (optional, min 8 characters)</Label>
              <Input
                id="p-pass"
                type="text"
                minLength={8}
                className="min-h-11"
                value={form.temporary_password}
                onChange={(e) => setForm((f) => ({ ...f, temporary_password: e.target.value }))}
                placeholder="Min 8 characters if set"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              Update role, branch assignments, permissions, and attendance settings.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Full name</Label>
                  <Input className="min-h-11" required value={editing.full_name} onChange={(e) => setEditing((r) => ({ ...r, full_name: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Phone</Label>
                  <Input className="min-h-11" value={editing.phone || ''} onChange={(e) => setEditing((r) => ({ ...r, phone: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select value={editing.role} onValueChange={(role) => setEditing((r) => ({ ...r, role }))}>
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roleAccessSummary(editing.role) ? (
                  <p className="text-xs text-muted-foreground">{roleAccessSummary(editing.role)}</p>
                ) : null}
              </div>
              {!showBranchPicker(editing.role, editing.permission_grants) ? (
                <p className="text-sm text-muted-foreground">Branch access: all branches.</p>
              ) : null}
              {showBranchPicker(editing.role, editing.permission_grants) ? (
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
                      <SelectTrigger className="min-h-11"><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : null}
              {editing.role === ROLES.ASSISTANT_SUPER_ADMIN && canEditAssistantGrants(profile) ? (
                <AssistantGrantsEditor
                  grants={editing.permission_grants}
                  onChange={(permission_grants) => setEditing((r) => ({ ...r, permission_grants }))}
                />
              ) : null}
              <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance & work schedule</Label>
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
                    <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
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
                  minLength={8}
                  autoComplete="new-password"
                  className="min-h-11"
                  value={editing.temporary_password || ''}
                  onChange={(e) => setEditing((r) => ({ ...r, temporary_password: e.target.value }))}
                  placeholder="Leave blank to keep current password (min 8 chars)"
                />
              </div>
              {isSuperAdmin(profile) ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(editing.is_supervisor)}
                      onChange={() => setEditing((r) => ({ ...r, is_supervisor: !r.is_supervisor }))}
                    />
                    Tag as supervisor
                  </label>
                  <div className="flex flex-col gap-2">
                    <Label>Reports to</Label>
                    <Select
                      value={editing.reports_to || 'none'}
                      onValueChange={(v) => setEditing((r) => ({ ...r, reports_to: v === 'none' ? null : v }))}
                    >
                      <SelectTrigger className="min-h-11"><SelectValue placeholder="No supervisor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No supervisor</SelectItem>
                        {supervisors
                          .filter((p) => p.id !== editing.id)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.full_name} ({ROLE_LABELS[p.role] || p.role})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={editing.is_active ? 'active' : 'inactive'}
                  onValueChange={(v) => setEditing((r) => ({ ...r, is_active: v === 'active' }))}
                >
                  <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
        title={`${deactivateTarget?.archive ? 'Archive' : 'Deactivate'} ${deactivateTarget?.row?.full_name || 'employee'}?`}
        description={
          deactivateTarget?.archive
            ? 'This archives the employee record and revokes floor access.'
            : 'This deactivates the employee account.'
        }
        confirmLabel={deactivateTarget?.archive ? 'Archive' : 'Deactivate'}
        destructive
        pending={saving}
        onConfirm={confirmDeactivate}
      />

      <ConfirmDialog
        open={Boolean(archiveRoleTarget)}
        onOpenChange={(open) => {
          if (!open) setArchiveRoleTarget(null)
        }}
        title={`Archive custom role "${archiveRoleTarget?.label || ''}" (${archiveRoleTarget?.role_key || ''})?`}
        description="Existing staff keep current access until reassigned."
        confirmLabel="Archive"
        destructive
        pending={saving}
        onConfirm={async () => {
          if (!archiveRoleTarget) return
          setSaving(true)
          try {
            const { error } = await supabase
              .from('role_definitions')
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq('role_key', archiveRoleTarget.role_key)
            if (error) throw error
            toast.success('Role template archived')
            setArchiveRoleTarget(null)
            await load()
          } catch (err) {
            toast.error(err.message)
          } finally {
            setSaving(false)
          }
        }}
      />
    </>
  )

  if (embedded) {
    return (
      <div className="hakum-employees flex flex-col gap-5">
        {directorySection}
        {accessSection}
        {modals}
      </div>
    )
  }

  return (
    <OpsPageShell
      className="hakum-people hakum-employees"
      eyebrow="Human Resource"
      title="Employees & RBAC"
      description={
        isSuperAdmin(profile)
          ? 'Manage employee accounts, role permissions, custom role templates, and temporary Team Lead delegation.'
          : canEditAssistantGrants(profile)
            ? 'Manage employee profiles and General Admin grants across assigned branches.'
            : 'Create and manage Team Leads and bay crew for your assigned branch.'
      }
      actions={
        <Button type="button" className="min-h-11 gap-1.5" onClick={() => setCreateOpen(true)}>
          <UserPlus className="size-4" aria-hidden />
          Add employee
        </Button>
      }
    >
      {directorySection}
      {accessSection}
      {modals}
    </OpsPageShell>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Building2, MoreHorizontal, Pencil, Plus, Search } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canCreateBranches, canManageBranches } from '@/auth/permissions'
import { archiveBranch, createBranch, listBranches, listBranchOperatingHours, saveBranchOperatingHours, setBranchGoogleReviewUrl, updateBranch } from '@/lib/adminApi'
import { filterBranchesForProfile } from '@/queue/queueLogic'
import { branchStatusLabel } from '@/lib/branches'
import { BRANCH_LIST_FILTERS, countBranchRows, filterBranchRows } from '@/lib/branchListFilter'
import { liveQueuePath, shopTvPath } from '@/lib/liveQueuePath'
import {
  WEEKDAY_LABELS,
  defaultWeekHours,
  formatHoursSummary,
  normalizeWeekHours,
} from '@/lib/branchOperatingHours'
import { cn } from '@/lib/utils'
import BranchLocationPicker from '@/components/BranchLocationPicker'
import BranchLaunchDialog from '@/components/ops/BranchLaunchDialog'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

const empty = {
  name: '',
  slug: '',
  code: '',
  address: '',
  latitude: null,
  longitude: null,
  status: 'active',
  google_review_url: '',
}

const STATUS_ACTIONS = [
  ['active', 'Activate'],
  ['coming_soon', 'Set coming soon'],
  ['inactive', 'Deactivate'],
]

function statusFromRow(row) {
  if (row.coming_soon) return 'coming_soon'
  if (row.is_active) return 'active'
  return 'inactive'
}

export default function BranchesManagePage() {
  const { profile } = useAuth()
  const canCreate = canCreateBranches(profile)
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(empty)
  const [editingSlug, setEditingSlug] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [hours, setHours] = useState(() => defaultWeekHours(''))
  const [saving, setSaving] = useState(false)
  const [launch, setLaunch] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('current')

  const load = useCallback(async () => {
    const all = await listBranches({ includeArchived: true })
    // SA/ASA with branches grant see all; branch Admin only assigned sites
    setRows(canCreateBranches(profile) ? all : filterBranchesForProfile(all, profile))
  }, [profile])

  useEffect(() => {
    if (canManageBranches(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  const counts = useMemo(() => countBranchRows(rows), [rows])
  const visible = useMemo(() => filterBranchRows(rows, { q: query, status: statusFilter }), [rows, query, statusFilter])

  if (!canManageBranches(profile)) return <Navigate to="/operations/access-denied" replace />

  function closeForm() {
    setFormOpen(false)
    setEditingSlug(null)
    setForm(empty)
    setHours(defaultWeekHours(''))
  }

  function openCreate() {
    setEditingSlug(null)
    setForm(empty)
    setHours(defaultWeekHours(''))
    setFormOpen(true)
  }

  async function onSubmit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        code: form.code,
        address: form.address || '',
        latitude: form.latitude,
        longitude: form.longitude,
        status: form.status,
      }
      if (editingSlug) {
        await updateBranch({ slug: editingSlug, ...payload })
        await saveBranchOperatingHours(editingSlug, hours)
        if (canCreate) await setBranchGoogleReviewUrl(editingSlug, form.google_review_url)
        toast.success('Branch updated')
      } else {
        if (!canCreate) throw new Error('Only Super Admin can open new company sites.')
        await createBranch(payload)
        await saveBranchOperatingHours(payload.slug, hours.length ? hours : defaultWeekHours(payload.slug))
        if (form.google_review_url) await setBranchGoogleReviewUrl(payload.slug, form.google_review_url)
        setLaunch({ slug: payload.slug, name: payload.name, status: form.status })
        toast.success(
          form.status === 'coming_soon'
            ? 'Branch announced as coming soon'
            : 'Branch created — live queue and shop TV use this slug',
        )
      }
      closeForm()
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function startEdit(row) {
    setEditingSlug(row.slug)
    setForm({
      name: row.name,
      slug: row.slug,
      code: row.code,
      address: row.address || '',
      latitude: row.latitude,
      longitude: row.longitude,
      status: statusFromRow(row),
      google_review_url: row.google_review_url || '',
    })
    setFormOpen(true)
    try {
      const week = await listBranchOperatingHours(row.slug)
      setHours(normalizeWeekHours(week, row.slug))
    } catch (err) {
      toast.error(err.message)
      setHours(defaultWeekHours(row.slug))
    }
  }

  function patchHour(day, patch) {
    setHours((current) =>
      current.map((row) => (row.day_of_week === day ? { ...row, ...patch } : row)),
    )
  }

  async function setStatus(row, status) {
    try {
      await updateBranch({
        slug: row.slug,
        name: row.name,
        code: row.code,
        address: row.address || '',
        latitude: row.latitude,
        longitude: row.longitude,
        status,
      })
      toast.success(`Branch set to ${status.replace('_', ' ')}`)
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function onArchive(slug) {
    if (!canCreate) {
      toast.error('Only Super Admin can archive company sites.')
      return
    }
    if (!window.confirm(`Archive branch ${slug}? Staff scoped here keep their slug until reassigned.`)) return
    try {
      await archiveBranch(slug)
      toast.success('Branch archived')
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function rowActions(row) {
    if (row.is_archived) return null
    const current = statusFromRow(row)
    return (
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" className="min-h-11 xl:min-h-8" onClick={() => startEdit(row)}>
          <Pencil size={14} aria-hidden /> Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="sm" variant="outline" className="min-h-11 min-w-11 xl:min-h-8 xl:min-w-8" />}
            aria-label={`More actions for ${row.name}`}
          >
            <MoreHorizontal size={16} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setLaunch({ slug: row.slug, name: row.name, status: current })}>
                Setup links
              </DropdownMenuItem>
              {STATUS_ACTIONS.filter(([value]) => value !== current).map(([value, label]) => (
                <DropdownMenuItem key={value} onClick={() => setStatus(row, value)}>
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {canCreate ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onArchive(row.slug)}>
                  Archive
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  function statusBadge(row) {
    return row.is_archived ? (
      <Badge variant="outline">Archived</Badge>
    ) : (
      <Badge variant={row.coming_soon ? 'secondary' : row.is_active ? 'default' : 'outline'}>
        {branchStatusLabel(row)}
      </Badge>
    )
  }

  function shopLinks(row, className, linkClass = '') {
    if (row.is_active && !row.coming_soon) {
      return (
        <div className={className}>
          <Link className={cn('text-[11px] text-primary hover:underline', linkClass)} to={liveQueuePath(row.slug)} target="_blank" rel="noreferrer">
            Customer queue
          </Link>
          <Link className={cn('text-[11px] text-primary hover:underline', linkClass)} to={shopTvPath(row.slug)} target="_blank" rel="noreferrer">
            Shop TV
          </Link>
        </div>
      )
    }
    if (row.coming_soon) {
      return (
        <div className={className}>
          <Link className={cn('text-[11px] text-muted-foreground hover:underline', linkClass)} to={shopTvPath(row.slug)} target="_blank" rel="noreferrer">
            Preview TV
          </Link>
        </div>
      )
    }
    return null
  }

  return (
    <OpsPageShell
      className="hakum-branches"
      eyebrow="Sites"
      title="Branches"
      description={
        canCreate
          ? 'Active branches automatically get live queue, shop TV, booking, and staff assignment — the slug is the only switch. Coming soon sites appear on the public branches page without accepting bookings yet.'
          : 'Update geo and status for your assigned sites. Opening or archiving company sites is Super Admin only.'
      }
      actions={
        canCreate ? (
          <Button type="button" className="min-h-11" onClick={openCreate}>
            <Plus size={16} className="mr-1.5" aria-hidden />
            New branch
          </Button>
        ) : null
      }
    >
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2">
            <Building2 size={18} aria-hidden /> {canCreate ? 'All branches' : 'My branches'}
            <span className="text-sm font-normal text-muted-foreground tabular-nums">
              {visible.length} of {rows.length}
            </span>
          </CardTitle>
          <CardDescription>
            <p>
              After create: assign staff under{' '}
              <Link className="text-primary underline-offset-2 hover:underline" to="/operations/people">
                People
              </Link>
              . Live queue and shop TV exist as soon as the slug does — pin the TV link on the shop display.
            </p>
          </CardDescription>
          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative block lg:w-80">
              <span className="sr-only">Search branches</span>
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, slug, code, address…"
                className="min-h-11 pl-9"
              />
            </label>
            <div role="tablist" aria-label="Filter by status" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:pb-0">
              {BRANCH_LIST_FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === id}
                  onClick={() => setStatusFilter(id)}
                  className={cn(
                    'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold whitespace-nowrap',
                    statusFilter === id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                  <span className="tabular-nums opacity-70">{counts[id]}</span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 md:hidden">
            {visible.map((row) => (
              <li key={row.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <code>{row.slug}</code> · {row.code}
                    </p>
                  </div>
                  {statusBadge(row)}
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{row.address || 'No address'}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {shopLinks(row, 'flex gap-4', 'inline-flex min-h-11 items-center text-xs') || <span />}
                  {rowActions(row)}
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="max-w-[260px] truncate text-xs text-muted-foreground">{row.address || 'No address'}</div>
                      {row.latitude != null ? (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{row.slug}</code>
                      {shopLinks(row, 'flex flex-col items-start', 'inline-flex min-h-11 items-center xl:min-h-0')}
                    </TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>{statusBadge(row)}</TableCell>
                    <TableCell className="text-right">{rowActions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!visible.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {rows.length ? 'No branches match this search or filter.' : 'No branches yet.'}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-border p-4 pr-14">
            <DialogTitle className="flex items-center gap-2">
              {editingSlug ? <Pencil size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
              {editingSlug ? 'Edit branch' : 'New branch'}
            </DialogTitle>
            <DialogDescription>
              {editingSlug
                ? `Editing ${editingSlug} — slug cannot change.`
                : 'Slug is the permanent ID used in queue URLs, bookings, and staff scope.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-name">Name</Label>
                  <Input id="b-name" required className="min-h-11" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hakum Auto Care Imus" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-code">Code</Label>
                  <Input
                    id="b-code"
                    required
                    className="min-h-11"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="IMS"
                    maxLength={5}
                    minLength={2}
                    pattern="[A-Z]{2,5}"
                  />
                </div>
              </div>
              {!editingSlug && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-slug">Slug</Label>
                  <Input
                    id="b-slug"
                    required
                    className="min-h-11"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                    placeholder="imus"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Lowercase letters, numbers, and hyphens"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Becomes {liveQueuePath(form.slug || 'imus')} and {shopTvPath(form.slug || 'imus')} — no extra TV setup.
                  </p>
                </div>
              )}

              <fieldset className="flex flex-col gap-2">
                <Legend>Status</Legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ['active', 'Active', 'Book + queue'],
                    ['coming_soon', 'Coming soon', 'Announce only'],
                    ['inactive', 'Inactive', 'Hidden'],
                  ].map(([value, label, hint]) => (
                    <label
                      key={value}
                      className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-sm ${
                        form.status === value ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <input
                          type="radio"
                          name="branch-status"
                          value={value}
                          checked={form.status === value}
                          onChange={() => setForm((f) => ({ ...f, status: value }))}
                        />
                        {label}
                      </span>
                      <span className="mt-1 pl-5 text-[11px] text-muted-foreground">{hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <BranchLocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                address={form.address}
                onChange={({ latitude, longitude, address }) =>
                  setForm((f) => ({ ...f, latitude, longitude, address: address || f.address }))
                }
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="b-addr">Address</Label>
                <Input
                  id="b-addr"
                  className="min-h-11"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Filled from search or pin — editable"
                />
              </div>

              {canCreate ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-review">Google review link</Label>
                  <Input
                    id="b-review"
                    type="url"
                    inputMode="url"
                    className="min-h-11"
                    value={form.google_review_url}
                    onChange={(e) => setForm((f) => ({ ...f, google_review_url: e.target.value }))}
                    placeholder="https://share.google/…"
                  />
                  <p className="text-xs text-muted-foreground">
                    A thumbs up on the customer&apos;s visit opens this page. One link per branch.
                  </p>
                </div>
              ) : null}

              <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-3">
                <Legend>Operating hours</Legend>
                <p className="text-[11px] text-muted-foreground">
                  Asia/Manila shop day. Public /branches shows this schedule and open/closed now.
                  {hours.length ? ` Preview: ${formatHoursSummary(hours)}` : ''}
                </p>
                <div className="flex flex-col gap-2">
                  {WEEKDAY_LABELS.map(({ day, short }) => {
                    const row = hours.find((h) => h.day_of_week === day) || defaultWeekHours('')[day]
                    return (
                      <div key={day} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[2.25rem_auto_1fr_1fr]">
                        <div className="col-span-2 flex items-center justify-between sm:contents">
                        <span className="text-xs font-medium tabular-nums">{short}</span>
                        <label className="flex min-h-11 items-center gap-1 text-[11px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={Boolean(row.is_closed)}
                            onChange={(e) =>
                              patchHour(day, {
                                is_closed: e.target.checked,
                                opens_at: e.target.checked ? null : row.opens_at || '08:00',
                                closes_at: e.target.checked ? null : row.closes_at || '18:00',
                              })
                            }
                          />
                          Closed
                        </label>
                        </div>
                        <Input
                          type="time"
                          className="min-h-11"
                          disabled={row.is_closed}
                          value={row.opens_at || ''}
                          onChange={(e) => patchHour(day, { opens_at: e.target.value, is_closed: false })}
                          aria-label={`${short} opens`}
                        />
                        <Input
                          type="time"
                          className="min-h-11"
                          disabled={row.is_closed}
                          value={row.closes_at || ''}
                          onChange={(e) => patchHour(day, { closes_at: e.target.value, is_closed: false })}
                          aria-label={`${short} closes`}
                        />
                      </div>
                    )
                  })}
                </div>
              </fieldset>
            </div>
            <DialogFooter className="m-0 rounded-none">
              <Button type="button" variant="outline" className="min-h-11" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={saving} className="min-h-11">
                {saving ? 'Saving…' : editingSlug ? 'Save changes' : 'Create branch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <BranchLaunchDialog branch={launch} onClose={() => setLaunch(null)} />
    </OpsPageShell>
  )
}

function Legend({ children }) {
  return <legend className="mb-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</legend>
}

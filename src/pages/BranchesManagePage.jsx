import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Building2, Pencil, Plus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canCreateBranches, canManageBranches } from '@/auth/permissions'
import { archiveBranch, createBranch, listBranches, setBranchHours, updateBranch } from '@/lib/adminApi'
import { filterBranchesForProfile } from '@/queue/queueLogic'
import { branchStatusLabel } from '@/lib/branches'
import { dayOfWeekToIso } from '@/lib/branchHours'
import BranchLocationPicker from '@/components/BranchLocationPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  opensAt: '',
  closesAt: '',
  closedWeekdays: [],
}

/* ISO weekday numbering (1 = Monday); converted to the table's 0=Sunday
   day_of_week when saved. */
const WEEKDAYS = [
  { iso: 1, label: 'Mon' },
  { iso: 2, label: 'Tue' },
  { iso: 3, label: 'Wed' },
  { iso: 4, label: 'Thu' },
  { iso: 5, label: 'Fri' },
  { iso: 6, label: 'Sat' },
  { iso: 7, label: 'Sun' },
]

/** Postgres hands back "08:00:00"; <input type="time"> wants "08:00". */
function timeForInput(value) {
  const match = /^(\d{2}:\d{2})/.exec(String(value || ''))
  return match ? match[1] : ''
}

/* branch_operating_hours holds a row per weekday. The editor exposes one
   opening window plus closed-day toggles, so the form takes its times from the
   first trading day and lists the rest as closed. */
function hoursForForm(rows) {
  const week = Array.isArray(rows) ? rows : []
  const open = week.find((row) => !row.is_closed && row.opens_at && row.closes_at)
  return {
    opensAt: timeForInput(open?.opens_at),
    closesAt: timeForInput(open?.closes_at),
    closedWeekdays: week
      .filter((row) => row.is_closed)
      .map((row) => dayOfWeekToIso(row.day_of_week))
      .sort((a, b) => a - b),
  }
}

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
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const all = await listBranches({ includeArchived: true })
    // SA/ASA with branches grant see all; branch Admin only assigned sites
    setRows(canCreateBranches(profile) ? all : filterBranchesForProfile(all, profile))
  }, [profile])

  useEffect(() => {
    if (canManageBranches(profile)) load().catch((e) => toast.error(e.message))
  }, [load, profile])

  if (!canManageBranches(profile)) return <Navigate to="/operations/access-denied" replace />

  /* Hours ride on the same save button but go through their own RPC, so a
     branch whose hours fail to write still keeps the rest of the edit. */
  async function saveHours(slug) {
    await setBranchHours({
      slug,
      opensAt: form.opensAt || null,
      closesAt: form.closesAt || null,
      closedWeekdays: form.closedWeekdays,
    })
  }

  function toggleClosedWeekday(iso) {
    setForm((f) => ({
      ...f,
      closedWeekdays: f.closedWeekdays.includes(iso)
        ? f.closedWeekdays.filter((day) => day !== iso)
        : [...f.closedWeekdays, iso].sort((a, b) => a - b),
    }))
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
        await saveHours(editingSlug)
        toast.success('Branch updated')
        setEditingSlug(null)
      } else {
        if (!canCreate) throw new Error('Only Super Admin can open new company sites.')
        await createBranch(payload)
        await saveHours(form.slug)
        toast.success(
          form.status === 'coming_soon'
            ? 'Branch announced as coming soon'
            : 'Branch created — ready for queue, staff, and bookings',
        )
      }
      setForm(empty)
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row) {
    setEditingSlug(row.slug)
    setForm({
      name: row.name,
      slug: row.slug,
      code: row.code,
      address: row.address || '',
      latitude: row.latitude,
      longitude: row.longitude,
      status: statusFromRow(row),
      ...hoursForForm(row.hours),
    })
  }

  function cancelEdit() {
    setEditingSlug(null)
    setForm(empty)
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
      if (editingSlug === slug) cancelEdit()
      await load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <section className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-xs font-bold tracking-[0.22em] text-primary uppercase">Sites</p>
        <h1 className="text-3xl font-semibold tracking-tight">Branches</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {canCreate
            ? 'Add a Philippine site with map pin. Active branches get live queue, booking, staff assignment, and show on customer visits. Coming soon sites appear on the public branches page without accepting bookings yet.'
            : 'Update geo and status for your assigned sites. Opening or archiving company sites is Super Admin only.'}
        </p>
      </div>

      <div className={`grid gap-6 ${canCreate || editingSlug ? 'xl:grid-cols-[minmax(0,420px)_1fr]' : ''}`}>
        {(canCreate || editingSlug) ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingSlug ? <Pencil size={18} /> : <Plus size={18} />}
              {editingSlug ? 'Edit branch' : 'New branch'}
            </CardTitle>
            <CardDescription>
              {editingSlug
                ? `Editing ${editingSlug} — slug cannot change.`
                : 'Slug is the permanent ID used in queue URLs, bookings, and staff scope.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-name">Name</Label>
                <Input id="b-name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Hakum Auto Care Imus" />
              </div>
              {!editingSlug && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="b-slug">Slug</Label>
                  <Input
                    id="b-slug"
                    required
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                    placeholder="imus"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Lowercase letters, numbers, and hyphens"
                  />
                  <p className="text-[11px] text-muted-foreground">Becomes /queue/{form.slug || 'imus'} and bookings.branch</p>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="b-code">Code</Label>
                <Input
                  id="b-code"
                  required
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="IMS"
                  maxLength={5}
                  minLength={2}
                  pattern="[A-Z]{2,5}"
                />
              </div>

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
                      className={`flex cursor-pointer flex-col rounded-xl border px-3 py-2 text-sm ${
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
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Filled from search or pin — editable"
                />
              </div>

              <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Opening hours
                </legend>
                <p className="text-[11px] text-muted-foreground">
                  Shown on the public homepage. Leave both times empty to hide open/closed status
                  and show queue length only.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="b-opens">Opens</Label>
                    <Input
                      id="b-opens"
                      type="time"
                      value={form.opensAt}
                      onChange={(e) => setForm((f) => ({ ...f, opensAt: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="b-closes">Closes</Label>
                    <Input
                      id="b-closes"
                      type="time"
                      value={form.closesAt}
                      onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] text-muted-foreground">Closed on</span>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const isClosed = form.closedWeekdays.includes(day.iso)
                      return (
                        <button
                          key={day.iso}
                          type="button"
                          onClick={() => toggleClosedWeekday(day.iso)}
                          aria-pressed={isClosed}
                          className={`min-h-9 rounded-md border px-3 text-[11px] font-semibold uppercase tracking-wider ${
                            isClosed ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </fieldset>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? 'Saving…' : editingSlug ? 'Save changes' : 'Create branch'}
                </Button>
                {editingSlug && (
                  <Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={18} /> {canCreate ? 'All branches' : 'My branches'}</CardTitle>
            <CardDescription>
              After create: assign staff under <Link className="text-primary underline-offset-2 hover:underline" to="/operations/people">People</Link>,
              open queue at /queue/&#123;slug&#125;, and take bookings — branch slug is stored on every visit.
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="max-w-[220px] truncate text-xs text-muted-foreground">{row.address || 'No address'}</div>
                      {row.latitude != null ? (
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {Number(row.latitude).toFixed(4)}, {Number(row.longitude).toFixed(4)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{row.slug}</code>
                      {row.is_active && !row.coming_soon ? (
                        <div>
                          <Link className="text-[11px] text-primary hover:underline" to={`/queue/${row.slug}`} target="_blank" rel="noreferrer">
                            Open queue
                          </Link>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.code}</TableCell>
                    <TableCell>
                      {row.is_archived ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : (
                        <Badge variant={row.coming_soon ? 'secondary' : row.is_active ? 'default' : 'outline'}>
                          {branchStatusLabel(row)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.is_archived && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
                          {statusFromRow(row) !== 'active' && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(row, 'active')}>Activate</Button>
                          )}
                          {statusFromRow(row) !== 'coming_soon' && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(row, 'coming_soon')}>Coming soon</Button>
                          )}
                          {statusFromRow(row) !== 'inactive' && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(row, 'inactive')}>Deactivate</Button>
                          )}
                          {canCreate ? (
                            <Button size="sm" variant="ghost" onClick={() => onArchive(row.slug)}>Archive</Button>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!rows.length ? <p className="text-sm text-muted-foreground">No branches yet.</p> : null}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function Legend({ children }) {
  return <legend className="mb-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{children}</legend>
}
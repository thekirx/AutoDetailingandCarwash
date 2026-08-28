import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Contact, MessageSquare, Pencil, Plus, Search, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessCrm, canWriteFinance, canViewQueueOperations, getBranchScopeList, isAdmin } from '@/auth/permissions'
import { listBranches, listMembershipTiers } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { applyBranchScope, chunkIds, collectPaged } from '@/lib/crmInsights'
import {
  CRM_SMART_GROUP_PRESETS,
  deleteSavedSmartGroup,
  filterCustomersBySmartGroup,
  loadSavedSmartGroups,
  saveSmartGroup,
} from '@/lib/crmSmartGroups'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/queue/queueApi'
import { plateValidationError, PLATE_FIELD_HINT, normalizePlate } from '@/lib/customerAuth'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import CustomerNotesPanel from '@/components/CustomerNotesPanel'
import CrmInsightsPanel from '@/pages/CrmInsightsPanel'
import SmsPage from '@/pages/SmsPage'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { CRM_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { opsTabSearchParams, resolveOpsTab } from '@/lib/opsShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  VEHICLE_ICON_PRESETS,
  normalizeVehicleIcon,
  vehicleIconGlyph,
} from '@/lib/ownerRevisionsPhase7'

const CRM_TABS = ['directory', 'groups', 'insights', 'sms']

/** Source-scan contract — keep literal ids for ops shell tests. */
const CRM_SHELL_TABS = Object.freeze([
  { id: 'directory', label: 'Directory', icon: Contact },
  { id: 'groups', label: 'Smart groups', icon: UserPlus },
  { id: 'insights', label: 'Insights', icon: Search },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
])
const emptyForm = { first_name: '', last_name: '', phone: '', email: '', plate: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'sedan' }
const emptyVehicle = { plate_number: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'sedan', color: '', icon: '' }

async function provisionCustomer(body) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/provision-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, site_origin: window.location.origin }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || 'Unable to register customer.')
  return json
}

export default function CrmPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolveOpsTab(searchParams.get('tab'), CRM_TABS, 'directory')
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [vehicles, setVehicles] = useState([])
  const [bookings, setBookings] = useState([])
  const [loyalty, setLoyalty] = useState([])
  const [membership, setMembership] = useState(null)
  const [tiers, setTiers] = useState([])
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageForm, setMessageForm] = useState({ title: '', body: '', sendSms: true })
  const [saving, setSaving] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [visitRows, setVisitRows] = useState([])
  const [activeGroupId, setActiveGroupId] = useState('visited_30d')
  const [savedGroups, setSavedGroups] = useState([])
  const [customGroupName, setCustomGroupName] = useState('')
  const [expenseCats, setExpenseCats] = useState([])
  const [newExpenseCat, setNewExpenseCat] = useState({ name: '', kind: 'general' })

  const loadCustomers = useCallback(async () => {
    const scope = getBranchScopeList(profile)
    let customerIds = null
    if (Array.isArray(scope)) {
      if (!scope.length) {
        setCustomers([])
        return
      }
      let bookingRows = []
      try {
        bookingRows = await collectPaged(async (from, to) => {
          let bookingQuery = supabase
            .from('bookings')
            .select('customer_id')
            .not('customer_id', 'is', null)
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .range(from, to)
          bookingQuery = applyBranchScope(bookingQuery, scope)
          const { data, error } = await bookingQuery
          if (error) throw error
          return data || []
        }, 1000)
      } catch (bookingErr) {
        toast.error(bookingErr.message)
        setCustomers([])
        return
      }
      customerIds = [...new Set(bookingRows.map((r) => r.customer_id).filter(Boolean))]
      if (!customerIds.length) {
        setCustomers([])
        return
      }
    }

    const select =
      'id, full_name, first_name, last_name, phone, email, loyalty_points, loyalty_stamps, created_at, notify_sms, notify_push, is_disabled'
    try {
      if (customerIds) {
        const rows = []
        for (const chunk of chunkIds(customerIds, 200)) {
          const { data, error } = await supabase
            .from('customers')
            .select(select)
            .eq('role', 'customer')
            .eq('is_archived', false)
            .in('id', chunk)
          if (error) throw error
          rows.push(...(data || []))
        }
        rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
        setCustomers(rows)
        return
      }
      const rows = await collectPaged(async (from, to) => {
        const { data, error } = await supabase
          .from('customers')
          .select(select)
          .eq('role', 'customer')
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
          .range(from, to)
        if (error) throw error
        return data || []
      }, 200)
      setCustomers(rows)
    } catch (error) {
      toast.error(error.message)
      setCustomers([])
    }
  }, [profile])

  useEffect(() => {
    if (!canAccessCrm(profile)) return
    loadCustomers()
    listMembershipTiers().then(setTiers).catch((err) => toast.error(err.message))
    listBranches().then(setBranches).catch((err) => toast.error(err.message))
  }, [loadCustomers, profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((row) =>
      [row.full_name, row.phone, row.email].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [customers, query])

  async function openCustomer(row) {
    setSelected(row)
    setLoadingDetail(true)
    const [v, b, l, m] = await Promise.all([
      supabase.from('vehicles').select('id, plate_number, vehicle_make, vehicle_model, vehicle_year, vehicle_type, color, icon').eq('customer_id', row.id).eq('is_archived', false),
      supabase
        .from('bookings')
        .select('id, status, branch, scheduled_start, vehicle_plate, queue_number, final_price_minor, service_id')
        .eq('customer_id', row.id)
        .order('scheduled_start', { ascending: false })
        .limit(30),
      supabase.from('loyalty_ledger').select('id, delta, reason, created_at').eq('customer_id', row.id).order('created_at', { ascending: false }).limit(20),
      supabase
        .from('customer_memberships')
        .select('id, tier_id, starts_at, ends_at, is_active, membership_tiers(name)')
        .eq('customer_id', row.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (v.error) toast.error(v.error.message)
    if (b.error) toast.error(b.error.message)
    if (l.error) toast.error(l.error.message)
    if (m.error) toast.error(m.error.message)
    setVehicles(v.data || [])
    setBookings(b.data || [])
    setLoyalty(l.data || [])
    setMembership(m.data || null)
    setLoadingDetail(false)
  }

  async function createCustomer(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const plate = form.plate.trim()
      if (plate) {
        const plateError = plateValidationError(plate)
        if (plateError) throw new Error(plateError)
      }
      // Always provision Auth + customers row so portal visits link correctly
      await provisionCustomer({
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email || null,
        plate: plate || null,
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        vehicle_type: form.vehicle_type || 'sedan',
      })
      toast.success('Customer registered — account invite queued')
      setForm(emptyForm)
      setRegisterOpen(false)
      await loadCustomers()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(event) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const full_name = `${editing.first_name || ''} ${editing.last_name || ''}`.trim() || editing.full_name
      const { error } = await supabase
        .from('customers')
        .update({
          first_name: editing.first_name?.trim() || null,
          last_name: editing.last_name?.trim() || null,
          full_name,
          phone: editing.phone?.trim() || null,
          email: editing.email?.trim() || null,
          notify_sms: editing.notify_sms !== false,
          notify_push: editing.notify_push !== false,
          is_disabled: Boolean(editing.is_disabled),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
      if (error) throw error
      toast.success('Customer updated')
      setEditing(null)
      await loadCustomers()
      if (selected?.id === editing.id) {
        const next = { ...selected, ...editing, full_name }
        setSelected(next)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addVehicle(event) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const plate = vehicleForm.plate_number.trim().toUpperCase()
      const plateError = plateValidationError(plate)
      if (plateError) throw new Error(plateError)
      const { error } = await supabase.from('vehicles').insert({
        customer_id: selected.id,
        plate_number: plate,
        normalized_plate_number: normalizePlate(plate),
        vehicle_make: vehicleForm.vehicle_make.trim() || null,
        vehicle_model: vehicleForm.vehicle_model.trim() || null,
        vehicle_type: vehicleForm.vehicle_type || 'sedan',
        color: vehicleForm.color.trim() || null,
        icon: normalizeVehicleIcon(vehicleForm.icon),
        is_archived: false,
      })
      if (error) throw error
      toast.success('Vehicle added')
      setVehicleForm(emptyVehicle)
      setAddingVehicle(false)
      await openCustomer(selected)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function sendCustomerMessage(event) {
    event.preventDefault()
    if (!selected) return
    const title = messageForm.title.trim()
    const body = messageForm.body.trim()
    if (!title || !body) {
      toast.error('Title and message are required.')
      return
    }
    setSaving(true)
    try {
      const token = await getAccessTokenFresh()
      if (!token) throw new Error('Sign in required.')

      const pushRes = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          targets: [{ userId: selected.id }],
          title,
          body,
          url: '/account',
          tag: `crm-${selected.id}-${Date.now()}`,
          kind: 'crm_message',
        }),
      })
      const pushJson = await pushRes.json().catch(() => ({}))
      if (!pushRes.ok) throw new Error(pushJson.error || 'Unable to send inbox/push.')

      let smsNote = ''
      if (messageForm.sendSms && selected.phone) {
        const smsRes = await fetch('/api/busybee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ phone: selected.phone, message: `Hakum Auto Care: ${body}` }),
        })
        const smsJson = await smsRes.json().catch(() => ({}))
        if (!smsRes.ok || smsJson.ok === false) {
          smsNote = ` · SMS failed (${smsJson.error || smsJson.status || 'provider'})`
        } else {
          smsNote = ' · SMS queued'
        }
      }

      toast.success(`Notification sent${smsNote} (push ${pushJson.sent ?? 0})`)
      setMessageOpen(false)
      setMessageForm({ title: '', body: '', sendSms: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!canAccessCrm(profile)) return
    setSavedGroups(loadSavedSmartGroups(profile?.id))
    let q = supabase
      .from('bookings')
      .select('customer_id, created_at, scheduled_start, completed_at, branch')
      .eq('is_archived', false)
      .not('customer_id', 'is', null)
      .limit(4000)
    const scope = getBranchScopeList(profile)
    if (Array.isArray(scope)) q = applyBranchScope(q, scope)
    q.then(({ data, error }) => {
      if (error) toast.error(error.message)
      else setVisitRows(data || [])
    })
    if (canWriteFinance(profile)) {
      supabase
        .from('expense_categories')
        .select('id, name, kind, is_active')
        .order('name')
        .then(({ data, error }) => {
          if (!error) setExpenseCats(data || [])
        })
    }
  }, [profile])

  const activeGroup =
    CRM_SMART_GROUP_PRESETS.find((g) => g.id === activeGroupId) ||
    savedGroups.find((g) => g.id === activeGroupId) ||
    CRM_SMART_GROUP_PRESETS[1]

  const smartGroupCustomers = useMemo(
    () => filterCustomersBySmartGroup(customers, visitRows, activeGroup),
    [customers, visitRows, activeGroup],
  )

  if (!canAccessCrm(profile)) return <Navigate to="/operations/access-denied" replace />

  const branchName = (slug) => branches.find((b) => b.slug === slug)?.name || slug

  function setShellTab(next) {
    setSearchParams(opsTabSearchParams(next, 'directory'), { replace: true })
  }

  const crmStepIcons = {
    directory: Contact,
    groups: UserPlus,
    insights: Search,
    sms: MessageSquare,
  }

  return (
    <OpsPageShell
      className="hakum-crm"
      eyebrow="CRM"
      title="Customer CRM"
      description="Directory, smart visit groups, behavior insights, and SMS. Expense categories can be created here when you have Finance write access."
      actions={
        <>
          {isAdmin(profile) ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/operations/memberships">Memberships</Link>
            </Button>
          ) : null}
          {isAdmin(profile) ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setRegisterOpen(true)}>
              <UserPlus data-icon="inline-start" /> Register account
            </Button>
          ) : null}
        </>
      }
    >
      <OpsGuideCard
        title="How CRM works"
        description="Find customers, segment by visits, read sales insights, and send SMS from one screen."
        steps={CRM_WORKFLOW_STEPS}
        stepIcons={crmStepIcons}
      />

      <Tabs value={tab} onValueChange={setShellTab}>
        <OpsTabList tabs={CRM_SHELL_TABS} aria-label="CRM sections" />

        <TabsContent value="groups" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart groups</CardTitle>
              <CardDescription>
                Filter customers who visited Hakum in different timelines. Presets + your saved groups.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {CRM_SMART_GROUP_PRESETS.map((g) => (
                  <Button
                    key={g.id}
                    type="button"
                    size="sm"
                    variant={activeGroupId === g.id ? 'default' : 'outline'}
                    onClick={() => setActiveGroupId(g.id)}
                  >
                    {g.label}
                  </Button>
                ))}
                {savedGroups.map((g) => (
                  <Button
                    key={g.id}
                    type="button"
                    size="sm"
                    variant={activeGroupId === g.id ? 'default' : 'secondary'}
                    onClick={() => setActiveGroupId(g.id)}
                  >
                    {g.name}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                  <Label>Save current filter as</Label>
                  <Input
                    value={customGroupName}
                    onChange={(e) => setCustomGroupName(e.target.value)}
                    placeholder="VIP 30-day visitors"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    const preset = CRM_SMART_GROUP_PRESETS.find((g) => g.id === activeGroupId) || activeGroup
                    const saved = saveSmartGroup(profile?.id, {
                      name: customGroupName || preset.label || 'Custom group',
                      mode: preset.mode,
                      days: preset.days,
                    })
                    setSavedGroups(loadSavedSmartGroups(profile?.id))
                    setActiveGroupId(saved.id)
                    setCustomGroupName('')
                    toast.success('Smart group saved')
                  }}
                >
                  Save group
                </Button>
                {savedGroups.some((g) => g.id === activeGroupId) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setSavedGroups(deleteSavedSmartGroup(profile?.id, activeGroupId))
                      setActiveGroupId('visited_30d')
                      toast.success('Group removed')
                    }}
                  >
                    Delete saved
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {smartGroupCustomers.length} customer(s) in “{activeGroup.label || activeGroup.name}”
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smartGroupCustomers.slice(0, 100).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell>{row.phone || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => { setSearchParams({}, { replace: true }); openCustomer(row) }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!smartGroupCustomers.length && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-muted-foreground">No customers in this group.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {canWriteFinance(profile) ? (
            <Card>
              <CardHeader>
                <CardTitle>Expense categories</CardTitle>
                <CardDescription>
                  Categories used by Finance. Also editable under Finance → Categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const name = newExpenseCat.name.trim()
                    if (!name) return toast.error('Name required')
                    const { error } = await supabase.from('expense_categories').insert({
                      name,
                      kind: newExpenseCat.kind || 'general',
                      is_active: true,
                    })
                    if (error) return toast.error(error.message)
                    toast.success('Category created')
                    setNewExpenseCat({ name: '', kind: 'general' })
                    const { data } = await supabase.from('expense_categories').select('id, name, kind, is_active').order('name')
                    setExpenseCats(data || [])
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <Label>Name</Label>
                    <Input value={newExpenseCat.name} onChange={(e) => setNewExpenseCat({ ...newExpenseCat, name: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Kind</Label>
                    <Select value={newExpenseCat.kind} onValueChange={(kind) => setNewExpenseCat({ ...newExpenseCat, kind })}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['general', 'payroll', 'marketing', 'utilities', 'chemicals', 'equipment'].map((k) => (
                          <SelectItem key={k} value={k}>{k}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit">Add category</Button>
                  <Button type="button" variant="outline" asChild>
                    <Link to="/operations/finance?tab=categories">Open Finance</Link>
                  </Button>
                </form>
                <ul className="text-sm text-muted-foreground">
                  {expenseCats.map((c) => (
                    <li key={c.id}>{c.name} · {c.kind}{c.is_active ? '' : ' (off)'}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">
              Expense categories live in Finance. Ask Super Admin for finance write access to create them here.
            </p>
          )}
        </TabsContent>

        <TabsContent value="directory" className="mt-6 flex flex-col gap-6">
          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Contact size={18} /> Directory</CardTitle>
                <CardDescription>{filtered.length} customers from Admin/POS accounts</CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search name, phone, email" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Loyalty</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id} className={selected?.id === row.id ? 'bg-muted/40' : ''}>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell>{row.phone || '—'}</TableCell>
                      <TableCell className="tabular-nums">{row.loyalty_points ?? 0} pts · {row.loyalty_stamps ?? 0} stamps</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openCustomer(row)}>View</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-muted-foreground">No customers match.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{selected ? selected.full_name : 'Customer detail'}</CardTitle>
            <CardDescription>
              {selected
                ? `${selected.phone || 'No phone'} · ${selected.email || 'No email'}`
                : 'Select someone from the directory.'}
            </CardDescription>
          </div>
          {selected && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setMessageForm({
                    title: 'Hakum Auto Care',
                    body: '',
                    sendSms: Boolean(selected.phone),
                  })
                  setMessageOpen(true)
                }}
              >
                <MessageSquare className="mr-1 size-4" /> Message
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing({
                  id: selected.id,
                  first_name: selected.first_name || '',
                  last_name: selected.last_name || '',
                  full_name: selected.full_name,
                  phone: selected.phone || '',
                  email: selected.email || '',
                  notify_sms: selected.notify_sms !== false,
                  notify_push: selected.notify_push !== false,
                  is_disabled: Boolean(selected.is_disabled),
                })}
              >
                <Pencil className="mr-1 size-4" /> Edit profile
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!selected && <p className="text-sm text-muted-foreground">Choose a customer to view vehicles, visits by branch, loyalty, and membership.</p>}
          {selected && loadingDetail && <p className="text-sm text-muted-foreground">Loading…</p>}
          {selected && !loadingDetail && (
            <Tabs defaultValue="visits">
              <TabsList className="mb-4">
                <TabsTrigger value="visits">Visits</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="visits" className="space-y-3">
                {membership && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                    Active membership: <strong>{membership.membership_tiers?.name || 'Tier'}</strong>
                  </div>
                )}
                {bookings.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
                    <div>
                      <p className="font-medium">
                        {b.vehicle_plate || '—'} · {branchName(b.branch)}
                        {b.queue_number != null ? ` · Q-${String(b.queue_number).padStart(3, '0')}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(b.scheduled_start).toLocaleString('en-PH')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">{formatMoney(b.final_price_minor)}</span>
                      <Badge variant="secondary">{b.status}</Badge>
                      {canViewQueueOperations(profile) && (
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/operations/queue/${b.id}`}>Ticket</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {!bookings.length && <p className="text-sm text-muted-foreground">No visits yet.</p>}
              </TabsContent>
              <TabsContent value="vehicles" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setAddingVehicle(true)}>
                    <Plus className="mr-1 size-4" /> Add vehicle
                  </Button>
                </div>
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
                    <span className="mt-0.5 text-lg" aria-hidden>{vehicleIconGlyph(v.icon)}</span>
                    <div>
                      <p className="font-medium">{v.plate_number}</p>
                      <p className="text-muted-foreground">
                        {[v.vehicle_make, v.vehicle_model, v.vehicle_type, v.color].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                ))}
                {!vehicles.length && <p className="text-sm text-muted-foreground">No vehicles on file.</p>}
              </TabsContent>
              <TabsContent value="loyalty" className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label="Points" value={selected.loyalty_points ?? 0} />
                  <Stat label="Stamps" value={selected.loyalty_stamps ?? 0} />
                  <Stat label="Tiers on file" value={tiers.length} />
                </div>
                {loyalty.map((row) => (
                  <div key={row.id} className="flex justify-between rounded-xl border border-border p-3 text-sm">
                    <div>
                      <p>{row.reason}</p>
                      <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('en-PH')}</p>
                    </div>
                    <span className="tabular-nums font-medium">{row.delta > 0 ? `+${row.delta}` : row.delta}</span>
                  </div>
                ))}
                {!loyalty.length && <p className="text-sm text-muted-foreground">No loyalty ledger entries.</p>}
              </TabsContent>
              <TabsContent value="notes" className="space-y-3">
                <CustomerNotesPanel customerId={selected.id} plate={selected.primary_plate || ''} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <CrmInsightsPanel profile={profile} />
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <SmsPage embedded />
        </TabsContent>
      </Tabs>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Register customer account</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Secondary path — prefer Admin/POS provision. Creates login for portal visits.</p>
          <form onSubmit={createCustomer} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label>First name</Label><Input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Last name</Label><Input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="flex flex-col gap-2"><Label>Phone</Label><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXXX" /></div>
            <div className="flex flex-col gap-2"><Label>Email (optional)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="flex flex-col gap-2">
              <Label>Plate / sticker (optional)</Label>
              <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="ABC 1234 or 847291" />
              <p className="text-xs text-muted-foreground">{PLATE_FIELD_HINT}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <VehicleMakeModelFields
                make={form.vehicle_make}
                model={form.vehicle_model}
                onMakeChange={(vehicle_make) => setForm((f) => ({ ...f, vehicle_make }))}
                onModelChange={(vehicle_model) => setForm((f) => ({ ...f, vehicle_model }))}
                variant="crm"
                required={false}
                makeLabel="Brand"
                modelLabel="Model"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2"><Label>First name</Label><Input value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
                <div className="flex flex-col gap-2"><Label>Last name</Label><Input value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-2"><Label>Phone</Label><Input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Email</Label><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <Label className="mb-1">Notifications</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.notify_sms !== false}
                    onChange={(e) => setEditing({ ...editing, notify_sms: e.target.checked })}
                  />
                  SMS updates
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.notify_push !== false}
                    onChange={(e) => setEditing({ ...editing, notify_push: e.target.checked })}
                  />
                  Push notifications
                </label>
                <label className="flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
                  <input
                    type="checkbox"
                    checked={Boolean(editing.is_disabled)}
                    onChange={(e) => setEditing({ ...editing, is_disabled: e.target.checked })}
                  />
                  Disable account (mute all)
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addingVehicle} onOpenChange={(open) => !open && setAddingVehicle(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
          <form onSubmit={addVehicle} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Plate / sticker</Label>
              <Input required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })} placeholder="ABC 1234 or 847291" />
              <p className="text-xs text-muted-foreground">{PLATE_FIELD_HINT}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2"><Label>Make</Label><Input value={vehicleForm.vehicle_make} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_make: e.target.value })} /></div>
              <div className="flex flex-col gap-2"><Label>Model</Label><Input value={vehicleForm.vehicle_model} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_model: e.target.value })} /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <Select value={vehicleForm.vehicle_type} onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['sedan', 'suv', 'pickup', 'van', 'motorcycle', 'other'].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2"><Label>Color</Label><Input value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} /></div>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {VEHICLE_ICON_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.label}
                    className={`min-h-11 min-w-11 rounded-xl border px-2 text-lg ${
                      vehicleForm.icon === p.key
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card'
                    }`}
                    onClick={() => setVehicleForm({ ...vehicleForm, icon: p.key })}
                  >
                    {p.glyph}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddingVehicle(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add vehicle'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={messageOpen} onOpenChange={(open) => !open && setMessageOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {selected?.full_name || 'customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendCustomerMessage} className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Sends inbox + web push. Optional SMS uses their phone on file.
            </p>
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input required value={messageForm.title} onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Message</Label>
              <Input required value={messageForm.body} onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })} placeholder="Your car is ready for pickup…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={messageForm.sendSms}
                disabled={!selected?.phone}
                onChange={(e) => setMessageForm({ ...messageForm, sendSms: e.target.checked })}
              />
              Also send SMS{selected?.phone ? ` to ${selected.phone}` : ' (no phone on file)'}
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send notification'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </OpsPageShell>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
      <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

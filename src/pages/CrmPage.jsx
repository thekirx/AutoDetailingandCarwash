import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Contact, MessageSquare, Search, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canAccessCrm, canEditCrm, canWriteFinance, getBranchScopeList, isAdmin } from '@/auth/permissions'
import { listBranches } from '@/lib/adminApi'
import { getAccessTokenFresh } from '@/lib/authToken'
import { applyBranchScope, chunkIds, collectPaged } from '@/lib/crmInsights'
import { supabase } from '@/lib/supabase'
import { plateValidationError, PLATE_FIELD_HINT, normalizePlate } from '@/lib/customerAuth'
import { normalizePricingSize, PRICING_SIZES } from '@/lib/servicePricing'
import VehicleMakeModelFields from '@/components/VehicleMakeModelFields'
import CrmInsightsPanel from '@/pages/CrmInsightsPanel'
import CrmSmartGroupsPanel from '@/pages/crm/CrmSmartGroupsPanel'
import CustomerProfileDialog from '@/pages/crm/CustomerProfileDialog'
import SmsPage from '@/pages/SmsPage'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { CRM_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { opsTabSearchParams, resolveOpsTab } from '@/lib/opsShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  VEHICLE_ICON_PRESETS,
  normalizeVehicleIcon,
} from '@/lib/ownerRevisionsPhase7'

const CRM_TABS = ['directory', 'groups', 'insights', 'sms']

/** Source-scan contract — keep literal ids for ops shell tests. */
const CRM_SHELL_TABS = Object.freeze([
  { id: 'directory', label: 'Directory', icon: Contact },
  { id: 'groups', label: 'Smart groups', icon: UserPlus },
  { id: 'insights', label: 'Insights', icon: Search },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
])
const emptyForm = { first_name: '', last_name: '', phone: '', email: '', plate: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'medium' }
const emptyVehicle = { plate_number: '', vehicle_make: '', vehicle_model: '', vehicle_type: 'medium', color: '', icon: '' }

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
  const crmEdit = canEditCrm(profile)
  const tab = resolveOpsTab(searchParams.get('tab'), crmEdit ? CRM_TABS : CRM_TABS.filter((id) => id !== 'sms'), 'directory')
  const [customers, setCustomers] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [profileReload, setProfileReload] = useState(0)
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageForm, setMessageForm] = useState({ title: '', body: '', sendSms: true })
  const [saving, setSaving] = useState(false)
  const [visitRows, setVisitRows] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(true)
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
    listBranches().then(setBranches).catch((err) => toast.error(err.message))
  }, [loadCustomers, profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((row) =>
      [row.full_name, row.phone, row.email].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [customers, query])

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
        vehicle_type: normalizePricingSize(form.vehicle_type),
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
        vehicle_type: normalizePricingSize(vehicleForm.vehicle_type),
        color: vehicleForm.color.trim() || null,
        icon: normalizeVehicleIcon(vehicleForm.icon),
        is_archived: false,
      })
      if (error) throw error
      toast.success('Vehicle added')
      setVehicleForm(emptyVehicle)
      setAddingVehicle(false)
      setProfileReload((n) => n + 1)
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
    const scope = getBranchScopeList(profile)
    setVisitsLoading(true)
    collectPaged(async (from, to) => {
      let q = supabase
        .from('bookings')
        .select('id, customer_id, status, completed_at, branch, visit_group_id, final_price_minor, price_minor')
        .eq('is_archived', false)
        .eq('status', 'completed')
        .not('customer_id', 'is', null)
      if (Array.isArray(scope)) q = applyBranchScope(q, scope)
      const { data, error } = await q.order('id', { ascending: true }).range(from, to)
      if (error) throw error
      return data || []
    })
      .then(setVisitRows)
      .catch((err) => toast.error(err.message))
      .finally(() => setVisitsLoading(false))
    if (canWriteFinance(profile)) {
      supabase
        .from('expense_categories')
        .select('id, name, kind')
        .order('name')
        .then(({ data, error }) => {
          if (!error) setExpenseCats(data || [])
        })
    }
  }, [profile])

  const scopedBranches = useMemo(() => {
    const scope = getBranchScopeList(profile)
    return Array.isArray(scope) ? branches.filter((b) => scope.includes(b.slug)) : branches
  }, [branches, profile])

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
      description={
        crmEdit
          ? 'Directory, smart visit groups, behavior insights, and SMS. Expense categories can be created here when you have Finance write access.'
          : 'View only. Look up customers, vehicles, visits, and insights. Edits and messages stay with Marketing and Super Admin.'
      }
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
        steps={crmEdit ? CRM_WORKFLOW_STEPS : CRM_WORKFLOW_STEPS.filter((s) => s.id !== 'sms')}
        stepIcons={crmStepIcons}
      />

      <Tabs value={tab} onValueChange={setShellTab}>
        <OpsTabList tabs={crmEdit ? CRM_SHELL_TABS : CRM_SHELL_TABS.filter((t) => t.id !== 'sms')} aria-label="CRM sections" />

        <TabsContent value="groups" className="mt-6 flex flex-col gap-6">
          <CrmSmartGroupsPanel
            customers={customers}
            visits={visitRows}
            branches={scopedBranches}
            userId={profile?.id}
            branchName={branchName}
            onView={setSelected}
            loading={visitsLoading}
          />

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
                    })
                    if (error) return toast.error(error.message)
                    toast.success('Category created')
                    setNewExpenseCat({ name: '', kind: 'general' })
                    const { data } = await supabase.from('expense_categories').select('id, name, kind').order('name')
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
                    <li key={c.id}>{c.name} · {c.kind}</li>
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
                        <Button size="sm" variant="outline" aria-label={`View ${row.full_name || 'customer'}`} onClick={() => setSelected(row)}>View</Button>
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

        </TabsContent>

        <TabsContent value="insights" className="mt-6">
          <CrmInsightsPanel profile={profile} />
        </TabsContent>

        {crmEdit ? (
          <TabsContent value="sms" className="mt-6">
            <SmsPage embedded />
          </TabsContent>
        ) : null}
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
                onSizeSuggest={(vehicle_type) => setForm((f) => ({ ...f, vehicle_type }))}
                variant="crm"
                required={false}
                makeLabel="Brand"
                modelLabel="Model"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="crm-reg-size">Car size</Label>
              <select
                id="crm-reg-size"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.vehicle_type || 'medium'}
                onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}
              >
                {PRICING_SIZES.map((sz) => (
                  <option key={sz.slug} value={sz.slug}>
                    {sz.label}
                  </option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save customer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerProfileDialog
        customer={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        profile={profile}
        branchName={branchName}
        reloadKey={profileReload}
        onMessage={crmEdit ? () => {
            setMessageForm({
              title: 'Hakum Auto Care',
              body: '',
              sendSms: Boolean(selected.phone),
            })
            setMessageOpen(true)
          } : undefined}
        onEdit={crmEdit ? () => setEditing({
            id: selected.id,
            first_name: selected.first_name || '',
            last_name: selected.last_name || '',
            full_name: selected.full_name,
            phone: selected.phone || '',
            email: selected.email || '',
            notify_sms: selected.notify_sms !== false,
            notify_push: selected.notify_push !== false,
            is_disabled: Boolean(selected.is_disabled),
          }) : undefined}
        onAddVehicle={crmEdit ? () => setAddingVehicle(true) : undefined}
      >
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
                <VehicleMakeModelFields
                  make={vehicleForm.vehicle_make}
                  model={vehicleForm.vehicle_model}
                  onMakeChange={(vehicle_make) => setVehicleForm((f) => ({ ...f, vehicle_make }))}
                  onModelChange={(vehicle_model) => setVehicleForm((f) => ({ ...f, vehicle_model }))}
                  onSizeSuggest={(vehicle_type) => setVehicleForm((f) => ({ ...f, vehicle_type }))}
                  variant="crm"
                  required={false}
                  makeLabel="Make"
                  modelLabel="Model"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Car size</Label>
                  <Select value={normalizePricingSize(vehicleForm.vehicle_type)} onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_SIZES.map((t) => (
                        <SelectItem key={t.slug} value={t.slug}>{t.label}</SelectItem>
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
      </CustomerProfileDialog>
    </OpsPageShell>
  )
}

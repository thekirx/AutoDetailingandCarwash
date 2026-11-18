import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeftRight,
  Contact,
  Inbox,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { useUrlQueryState } from '@/hooks/useUrlQueryState'
import {
  canAccessCrm,
  canAccessInquiries,
  canEditCrm,
  canSendCustomerSms,
  canWriteFinance,
  getBranchScopeList,
  isAssistantSuperAdmin,
  isSuperAdmin,
} from '@/auth/permissions'
import { canTransferVehicle } from '@/lib/vehicleTransfer'
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
import VehicleTransferPanel from '@/pages/crm/VehicleTransferPanel'
import SmsPage from '@/pages/SmsPage'
import OpsGuideCard from '@/components/ops/OpsGuideCard'
import OpsPageShell from '@/components/ops/OpsPageShell'
import OpsTabList from '@/components/ops/OpsTabBar'
import { CRM_WORKFLOW_STEPS } from '@/components/ops/opsGuideCopy'
import { opsTabSearchParams, resolveOpsTab } from '@/lib/opsShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { VEHICLE_ICON_PRESETS, normalizeVehicleIcon } from '@/lib/ownerRevisionsPhase7'
import '@/styles/crm-hub.css'

const InquiriesPage = lazy(() => import('@/pages/InquiriesPage'))

const PRICING_SIZE_ITEMS = PRICING_SIZES.map((sz) => ({ value: sz.slug, label: sz.label }))
const EXPENSE_KIND_OPTIONS = ['general', 'payroll', 'marketing', 'utilities', 'chemicals', 'equipment'].map((k) => ({ value: k, label: k }))
const SYNTHETIC_EMAIL = /@customers\.hakumautocare\.com$/i

/** Source-scan contract — keep literal ids for ops shell tests. */
const CRM_SHELL_TABS = Object.freeze([
  { id: 'directory', label: 'Directory', icon: Contact },
  { id: 'transfer', label: 'Transfer car', icon: ArrowLeftRight },
  { id: 'inquiries', label: 'Inquiries', icon: Inbox },
  { id: 'groups', label: 'Smart groups', icon: UserPlus },
  { id: 'insights', label: 'Insights', icon: Search },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
])

const emptyForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  plate: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_type: 'medium',
}

const emptyVehicle = {
  plate_number: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  vehicle_type: 'medium',
  color: '',
  icon: '',
}

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

async function manageCustomerApi(body) {
  const token = await getAccessTokenFresh()
  if (!token) throw new Error('Sign in required.')
  const res = await fetch('/api/customer?operation=manage-customer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || 'Unable to update customer.')
    err.status = res.status
    throw err
  }
  return json
}

function visibleEmail(email) {
  if (!email || SYNTHETIC_EMAIL.test(email)) return ''
  return email
}

export default function CrmPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const crmEdit = canEditCrm(profile)
  const canLifecycle = isSuperAdmin(profile) || isAssistantSuperAdmin(profile)

  const visibleTabs = useMemo(
    () =>
      CRM_SHELL_TABS.filter((t) => {
        if (t.id === 'transfer') return canTransferVehicle(profile)
        if (t.id === 'inquiries') return canAccessInquiries(profile)
        if (t.id === 'sms') return crmEdit && canSendCustomerSms(profile)
        return true
      }),
    [profile, crmEdit],
  )

  const tab = resolveOpsTab(searchParams.get('tab'), visibleTabs.map((t) => t.id), 'directory')

  const [customers, setCustomers] = useState([])
  const [archivedCustomers, setArchivedCustomers] = useState([])
  const [vehiclesByCustomer, setVehiclesByCustomer] = useState(() => new Map())
  const [tierByCustomer, setTierByCustomer] = useState(() => new Map())
  const [dirFilter, setDirFilter] = useState('all')
  const [query, setQuery] = useUrlQueryState()
  const [loadingList, setLoadingList] = useState(true)
  const [selected, setSelected] = useState(null)
  const [profileReload, setProfileReload] = useState(0)
  const [branches, setBranches] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle)
  const [addingVehicle, setAddingVehicle] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState(null)
  const [archivingVehicle, setArchivingVehicle] = useState(null)
  const [transferSeedVehicle, setTransferSeedVehicle] = useState(null)
  const [messageOpen, setMessageOpen] = useState(false)
  const [messageForm, setMessageForm] = useState({ title: '', body: '', sendSms: true })
  const [saving, setSaving] = useState(false)
  const [visitRows, setVisitRows] = useState([])
  const [visitsLoading, setVisitsLoading] = useState(true)
  const [expenseCats, setExpenseCats] = useState([])
  const [newExpenseCat, setNewExpenseCat] = useState({ name: '', kind: 'general' })

  const loadCustomers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingList(true)
    const scope = getBranchScopeList(profile)
    let customerIds = null
    if (Array.isArray(scope)) {
      if (!scope.length) {
        setCustomers([])
        setVehiclesByCustomer(new Map())
        setTierByCustomer(new Map())
        setLoadingList(false)
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
        setLoadingList(false)
        return
      }
      customerIds = [...new Set(bookingRows.map((r) => r.customer_id).filter(Boolean))]
      if (!customerIds.length) {
        setCustomers([])
        setVehiclesByCustomer(new Map())
        setTierByCustomer(new Map())
        setLoadingList(false)
        return
      }
    }

    const select =
      'id, full_name, first_name, last_name, phone, email, date_of_birth, loyalty_points, loyalty_stamps, created_at, notify_sms, notify_push, is_disabled'
    try {
      let rows = []
      if (customerIds) {
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
      } else {
        rows = await collectPaged(async (from, to) => {
          const { data, error } = await supabase
            .from('customers')
            .select(select)
            .eq('role', 'customer')
            .eq('is_archived', false)
            .order('created_at', { ascending: false })
            .range(from, to)
          if (error) throw error
          return data || []
        }, 500)
      }
      setCustomers(rows)

      const loadedIds = rows.map((r) => r.id).filter(Boolean)
      const vMap = new Map()
      const tMap = new Map()
      if (loadedIds.length) {
        const vehiclePromise = customerIds
          ? Promise.all(
              chunkIds(loadedIds, 200).map((chunk) =>
                supabase
                  .from('vehicles')
                  .select('id, customer_id, plate_number, vehicle_make, vehicle_model, vehicle_type, vehicle_year, color, icon')
                  .eq('is_archived', false)
                  .in('customer_id', chunk)
                  .then((res) => res.data || []),
              ),
            ).then((chunks) => chunks.flat())
          : collectPaged(async (from, to) => {
              const { data, error } = await supabase
                .from('vehicles')
                .select('id, customer_id, plate_number, vehicle_make, vehicle_model, vehicle_type, vehicle_year, color, icon')
                .eq('is_archived', false)
                .order('created_at', { ascending: false })
                .range(from, to)
              if (error) throw error
              return data || []
            }, 500)

        const tierPromise = collectPaged(async (from, to) => {
          const { data, error } = await supabase
            .from('customer_memberships')
            .select('customer_id, membership_tiers(name)')
            .eq('is_active', true)
            .order('customer_id', { ascending: true })
            .range(from, to)
          if (error) throw error
          return data || []
        }, 1000).catch(() => [])

        const archivedPromise = canLifecycle
          ? manageCustomerApi({ action: 'list-archived' }).then((res) => res.customers || []).catch(() => [])
          : Promise.resolve([])

        const [vehRows, tierRows, archRows] = await Promise.all([vehiclePromise, tierPromise, archivedPromise])
        for (const v of vehRows) {
          if (!v.customer_id) continue
          const arr = vMap.get(v.customer_id) || []
          arr.push(v)
          vMap.set(v.customer_id, arr)
        }
        for (const m of tierRows) {
          if (m.customer_id && m.membership_tiers?.name && !tMap.has(m.customer_id)) {
            tMap.set(m.customer_id, m.membership_tiers.name)
          }
        }
        if (canLifecycle) setArchivedCustomers(archRows)
      } else if (canLifecycle) {
        const arch = await manageCustomerApi({ action: 'list-archived' }).then((r) => r.customers || []).catch(() => [])
        setArchivedCustomers(arch)
      }

      setVehiclesByCustomer(vMap)
      setTierByCustomer(tMap)
    } catch (error) {
      toast.error(error.message)
      setCustomers([])
    } finally {
      setLoadingList(false)
    }
  }, [profile, canLifecycle])

  useEffect(() => {
    if (!canAccessCrm(profile)) return
    loadCustomers()
    listBranches().then(setBranches).catch((err) => toast.error(err.message))
  }, [loadCustomers, profile])

  const dirCounts = useMemo(() => {
    let active = 0
    let disabled = 0
    let members = 0
    for (const c of customers) {
      if (c.is_disabled) disabled += 1
      else active += 1
      if (tierByCustomer.has(c.id)) members += 1
    }
    return {
      all: customers.length,
      active,
      disabled,
      members,
      archived: archivedCustomers.length,
    }
  }, [customers, tierByCustomer, archivedCustomers])

  const filtered = useMemo(() => {
    const source = dirFilter === 'archived' ? archivedCustomers : customers
    const q = query.trim().toLowerCase()
    return source.filter((row) => {
      if (dirFilter === 'active' && row.is_disabled) return false
      if (dirFilter === 'disabled' && !row.is_disabled) return false
      if (dirFilter === 'members' && !tierByCustomer.has(row.id)) return false
      if (!q) return true
      const veh = (vehiclesByCustomer.get(row.id) || [])
        .map((v) => `${v.plate_number || ''} ${v.vehicle_make || ''} ${v.vehicle_model || ''}`)
        .join(' ')
      const tier = tierByCustomer.get(row.id) || ''
      return [row.full_name, row.phone, visibleEmail(row.email), veh, tier]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [customers, archivedCustomers, dirFilter, query, tierByCustomer, vehiclesByCustomer])

  async function createCustomer(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const plate = form.plate.trim()
      if (plate) {
        const plateError = plateValidationError(plate)
        if (plateError) throw new Error(plateError)
      }
      await provisionCustomer({
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email || null,
        date_of_birth: form.date_of_birth || null,
        plate: plate || null,
        vehicle_make: form.vehicle_make || null,
        vehicle_model: form.vehicle_model || null,
        vehicle_type: normalizePricingSize(form.vehicle_type),
      })
      toast.success('Customer created — portal account ready')
      setForm(emptyForm)
      setRegisterOpen(false)
      await loadCustomers({ silent: true })
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
      const { customer: updated } = await manageCustomerApi({
        action: 'update',
        customer_id: editing.id,
        first_name: editing.first_name,
        last_name: editing.last_name,
        phone: editing.phone,
        email: editing.email,
        date_of_birth: editing.date_of_birth || null,
        notify_sms: editing.notify_sms !== false,
        notify_push: editing.notify_push !== false,
        is_disabled: Boolean(editing.is_disabled),
      })
      toast.success('Customer updated')
      setEditing(null)
      await loadCustomers({ silent: true })
      if (selected?.id === editing.id && updated) {
        setSelected(updated)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function archiveCustomer(customer) {
    if (!customer?.id) return
    setSaving(true)
    try {
      await manageCustomerApi({ action: 'archive', customer_id: customer.id })
      toast.success(`${customer.full_name || 'Customer'} archived`)
      setDeleting(null)
      if (selected?.id === customer.id) setSelected(null)
      await loadCustomers({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function restoreCustomer(customer) {
    if (!customer?.id) return
    setSaving(true)
    try {
      await manageCustomerApi({ action: 'restore', customer_id: customer.id })
      toast.success(`${customer.full_name || 'Customer'} restored`)
      await loadCustomers({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteCustomerPermanent(customer) {
    if (!customer?.id) return
    setSaving(true)
    try {
      await manageCustomerApi({ action: 'delete', customer_id: customer.id })
      toast.success(`${customer.full_name || 'Customer'} permanently deleted`)
      setDeleting(null)
      if (selected?.id === customer.id) setSelected(null)
      await loadCustomers({ silent: true })
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
      const yearNum = Number(vehicleForm.vehicle_year)
      const { error } = await supabase.from('vehicles').insert({
        customer_id: selected.id,
        plate_number: plate,
        normalized_plate_number: normalizePlate(plate),
        vehicle_make: vehicleForm.vehicle_make.trim() || null,
        vehicle_model: vehicleForm.vehicle_model.trim() || null,
        vehicle_year: Number.isInteger(yearNum) && yearNum >= 1950 && yearNum <= 2100 ? yearNum : null,
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
      await loadCustomers({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveVehicleEdit(event) {
    event.preventDefault()
    if (!editingVehicle) return
    setSaving(true)
    try {
      await manageCustomerApi({
        action: 'update-vehicle',
        vehicle_id: editingVehicle.id,
        plate_number: editingVehicle.plate_number,
        vehicle_make: editingVehicle.vehicle_make,
        vehicle_model: editingVehicle.vehicle_model,
        vehicle_year: editingVehicle.vehicle_year,
        vehicle_type: normalizePricingSize(editingVehicle.vehicle_type),
        color: editingVehicle.color,
        icon: normalizeVehicleIcon(editingVehicle.icon),
      })
      toast.success('Vehicle updated')
      setEditingVehicle(null)
      setProfileReload((n) => n + 1)
      await loadCustomers({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmArchiveVehicle(vehicle) {
    if (!vehicle?.id) return
    setSaving(true)
    try {
      await manageCustomerApi({ action: 'archive-vehicle', vehicle_id: vehicle.id })
      toast.success(`Removed vehicle ${vehicle.plate_number}`)
      setArchivingVehicle(null)
      setProfileReload((n) => n + 1)
      await loadCustomers({ silent: true })
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

  function openEditDialog(customer) {
    setEditing({
      id: customer.id,
      first_name: customer.first_name || '',
      last_name: customer.last_name || '',
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      email: visibleEmail(customer.email),
      date_of_birth: customer.date_of_birth ? String(customer.date_of_birth).slice(0, 10) : '',
      notify_sms: customer.notify_sms !== false,
      notify_push: customer.notify_push !== false,
      is_disabled: Boolean(customer.is_disabled),
    })
  }

  const crmStepIcons = {
    directory: Contact,
    groups: UserPlus,
    insights: Search,
    sms: MessageSquare,
  }

  const filterPills = [
    { id: 'all', label: 'All', count: dirCounts.all },
    { id: 'active', label: 'Active', count: dirCounts.active },
    { id: 'members', label: 'Members', count: dirCounts.members },
    { id: 'disabled', label: 'Disabled', count: dirCounts.disabled },
    ...(canLifecycle ? [{ id: 'archived', label: 'Archived', count: dirCounts.archived }] : []),
  ]

  return (
    <OpsPageShell
      className="hakum-crm"
      eyebrow="Customers"
      title="Customer Users & CRM"
      description={
        crmEdit
          ? 'Search and manage all customer accounts, vehicles, car ownership transfers, inquiries, smart groups, and SMS in one place.'
          : 'View only. Search customers, vehicles, visit history, and insights.'
      }
      actions={
        crmEdit ? (
          <Button type="button" className="min-h-11" onClick={() => setRegisterOpen(true)}>
            <UserPlus data-icon="inline-start" aria-hidden /> New customer
          </Button>
        ) : null
      }
    >
      <OpsGuideCard
        title="How CRM works"
        description="Find customers, transfer car ownership, manage inquiries, segment visits, and send SMS from one screen."
        steps={crmEdit ? CRM_WORKFLOW_STEPS : CRM_WORKFLOW_STEPS.filter((s) => s.id !== 'sms')}
        stepIcons={crmStepIcons}
      />

      <Tabs value={tab} onValueChange={setShellTab}>
        <OpsTabList tabs={visibleTabs} aria-label="Customer hub sections" />

        <TabsContent value="directory" className="mt-6 crm-dir-shell">
          <div className="crm-dir-toolbar">
            <div className="crm-filter-pills" role="tablist" aria-label="Filter customer accounts">
              {filterPills.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={dirFilter === pill.id}
                  className={`crm-filter-pill ${dirFilter === pill.id ? 'is-selected' : ''}`}
                  onClick={() => setDirFilter(pill.id)}
                >
                  {pill.label}
                  <span>{pill.count}</span>
                </button>
              ))}
            </div>

            <div className="crm-search-row">
              <div className="crm-search-box">
                <Search className="crm-search-icon" aria-hidden />
                <Input
                  placeholder="Search name, phone, email, plate, or car…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search customer accounts"
                />
              </div>
              {query.trim() || dirFilter !== 'all' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 gap-1.5"
                  onClick={() => {
                    setQuery('')
                    setDirFilter('all')
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Reset
                </Button>
              ) : null}
            </div>
          </div>

          {loadingList ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading customers">
              <div className="planner-skel h-16" />
              <div className="planner-skel h-16" />
              <div className="planner-skel h-16" />
            </div>
          ) : !filtered.length ? (
            <Card>
              <CardContent className="flex flex-col items-start gap-3 py-8">
                <p className="font-semibold text-foreground">
                  {query.trim() || dirFilter !== 'all' ? 'No customers match your filters' : 'No customer accounts yet'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {query.trim() || dirFilter !== 'all'
                    ? 'Clear search or switch status filter to see more accounts.'
                    : 'Create your first customer profile and link their vehicle plate.'}
                </p>
                {crmEdit && !query.trim() && dirFilter === 'all' ? (
                  <Button type="button" className="min-h-11" onClick={() => setRegisterOpen(true)}>
                    <UserPlus data-icon="inline-start" aria-hidden /> New customer
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="crm-mobile-cards">
                {filtered.map((row) => {
                  const veh = vehiclesByCustomer.get(row.id) || []
                  const tier = tierByCustomer.get(row.id)
                  const email = visibleEmail(row.email)
                  const isArchived = dirFilter === 'archived' || Boolean(row.is_archived)
                  return (
                    <article key={row.id} className="crm-mobile-card">
                      <div className="crm-mobile-head">
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground">{row.full_name || 'Unnamed customer'}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {row.phone || 'No phone'}{email ? ` · ${email}` : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {isArchived ? (
                            <span className="crm-status-pill is-archived">Archived</span>
                          ) : row.is_disabled ? (
                            <span className="crm-status-pill is-disabled">Disabled</span>
                          ) : (
                            <span className="crm-status-pill is-active">Active</span>
                          )}
                          {tier ? <span className="crm-status-pill is-member">{tier}</span> : null}
                        </div>
                      </div>
                      {veh.length ? (
                        <div className="crm-plates-wrap">
                          {veh.slice(0, 3).map((v) => (
                            <span key={v.id} className="crm-plate-chip">{v.plate_number}</span>
                          ))}
                          {veh.length > 3 ? <span className="text-xs text-muted-foreground">+{veh.length - 3}</span> : null}
                        </div>
                      ) : null}
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {row.loyalty_points ?? 0} pts · {row.loyalty_stamps ?? 0} stamps
                      </div>
                      <div className="crm-mobile-actions">
                        {isArchived ? (
                          canLifecycle ? (
                            <>
                              <Button type="button" size="sm" variant="outline" onClick={() => restoreCustomer(row)} disabled={saving}>
                                <RotateCcw className="size-3.5" aria-hidden /> Restore
                              </Button>
                              <Button type="button" size="sm" variant="destructive" onClick={() => setDeleting(row)} disabled={saving}>
                                <Trash2 className="size-3.5" aria-hidden /> Delete forever
                              </Button>
                            </>
                          ) : null
                        ) : (
                          <>
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(row)}>View</Button>
                            {crmEdit ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(row)}>
                                <Pencil className="size-3.5" aria-hidden /> Edit
                              </Button>
                            ) : null}
                            {canLifecycle ? (
                              <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(row)}>
                                <Trash2 className="size-3.5" aria-hidden /> Remove
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="crm-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Vehicles</TableHead>
                      <TableHead>Loyalty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const veh = vehiclesByCustomer.get(row.id) || []
                      const tier = tierByCustomer.get(row.id)
                      const email = visibleEmail(row.email)
                      const isArchived = dirFilter === 'archived' || Boolean(row.is_archived)
                      return (
                        <TableRow key={row.id} className={selected?.id === row.id ? 'bg-muted/40' : ''}>
                          <TableCell>
                            <div className="font-semibold text-foreground">{row.full_name || 'Unnamed customer'}</div>
                            {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">{row.phone || '—'}</TableCell>
                          <TableCell>
                            {veh.length ? (
                              <div className="crm-plates-wrap">
                                {veh.slice(0, 2).map((v) => (
                                  <span key={v.id} className="crm-plate-chip">{v.plate_number}</span>
                                ))}
                                {veh.length > 2 ? <span className="text-xs text-muted-foreground">+{veh.length - 2}</span> : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <div>{row.loyalty_points ?? 0} pts · {row.loyalty_stamps ?? 0} stamps</div>
                            {tier ? <span className="crm-status-pill is-member mt-1">{tier}</span> : null}
                          </TableCell>
                          <TableCell>
                            {isArchived ? (
                              <span className="crm-status-pill is-archived">Archived</span>
                            ) : row.is_disabled ? (
                              <span className="crm-status-pill is-disabled">Disabled</span>
                            ) : (
                              <span className="crm-status-pill is-active">Active</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {isArchived ? (
                                canLifecycle ? (
                                  <>
                                    <Button type="button" size="sm" variant="outline" className="min-h-11 gap-1.5" onClick={() => restoreCustomer(row)} disabled={saving}>
                                      <RotateCcw className="size-3.5" aria-hidden /> Restore
                                    </Button>
                                    <Button type="button" size="sm" variant="destructive" className="min-h-11" onClick={() => setDeleting(row)} disabled={saving}>
                                      Delete forever
                                    </Button>
                                  </>
                                ) : null
                              ) : (
                                <>
                                  <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`View ${row.full_name || 'customer'}`} onClick={() => setSelected(row)}>
                                    View
                                  </Button>
                                  {crmEdit ? (
                                    <Button type="button" size="sm" variant="outline" className="min-h-11" aria-label={`Edit ${row.full_name || 'customer'}`} onClick={() => openEditDialog(row)}>
                                      <Pencil className="size-3.5" aria-hidden />
                                    </Button>
                                  ) : null}
                                  {canLifecycle ? (
                                    <Button type="button" size="sm" variant="ghost" className="min-h-11 text-destructive hover:text-destructive" aria-label={`Archive or delete ${row.full_name || 'customer'}`} onClick={() => setDeleting(row)}>
                                      <Trash2 className="size-3.5" aria-hidden />
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        {canTransferVehicle(profile) ? (
          <TabsContent value="transfer" className="mt-6">
            <VehicleTransferPanel
              initialVehicle={transferSeedVehicle}
              onTransferred={() => {
                setTransferSeedVehicle(null)
                loadCustomers({ silent: true })
              }}
            />
          </TabsContent>
        ) : null}

        {canAccessInquiries(profile) ? (
          <TabsContent value="inquiries" className="mt-6">
            <Suspense fallback={<p className="py-6 text-sm text-muted-foreground">Loading inquiries…</p>}>
              <InquiriesPage embedded />
            </Suspense>
          </TabsContent>
        ) : null}

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
                    <Input className="min-h-11" value={newExpenseCat.name} onChange={(e) => setNewExpenseCat({ ...newExpenseCat, name: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Kind</Label>
                    <Select value={newExpenseCat.kind} onValueChange={(kind) => setNewExpenseCat({ ...newExpenseCat, kind })} items={EXPENSE_KIND_OPTIONS}>
                      <SelectTrigger className="h-11 w-44 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_KIND_OPTIONS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="min-h-11">Add category</Button>
                  <Button type="button" variant="outline" className="min-h-11" asChild>
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

        <TabsContent value="insights" className="mt-6">
          <CrmInsightsPanel profile={profile} />
        </TabsContent>

        {crmEdit ? (
          <TabsContent value="sms" className="mt-6">
            <SmsPage embedded />
          </TabsContent>
        ) : null}
      </Tabs>

      {/* Create Customer Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create customer account</DialogTitle>
            <DialogDescription>
              Provision a customer profile, portal login, and optional initial vehicle.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createCustomer} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="crm-create-first">First name</Label>
                <Input id="crm-create-first" className="min-h-11" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="crm-create-last">Last name</Label>
                <Input id="crm-create-last" className="min-h-11" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="crm-create-phone">Phone</Label>
                <Input id="crm-create-phone" className="min-h-11" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="09XXXXXXXXX" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="crm-create-dob">Birthday (optional)</Label>
                <Input id="crm-create-dob" type="date" className="min-h-11" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-create-email">Email (optional)</Label>
              <Input id="crm-create-email" type="email" className="min-h-11" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-create-plate">Plate / sticker (optional)</Label>
              <Input id="crm-create-plate" className="min-h-11 uppercase placeholder:normal-case" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="ABC 1234 or 847291" />
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="crm-reg-size">Car size</Label>
              <Select value={normalizePricingSize(form.vehicle_type)} onValueChange={(v) => setForm({ ...form, vehicle_type: v })} items={PRICING_SIZE_ITEMS}>
                <SelectTrigger id="crm-reg-size" className="h-11 w-full cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICING_SIZE_ITEMS.map((sz) => (
                    <SelectItem key={sz.value} value={sz.value}>{sz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Create customer'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          {editing ? (
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="crm-edit-first">First name</Label><Input id="crm-edit-first" className="min-h-11" required value={editing.first_name} onChange={(e) => setEditing({ ...editing, first_name: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="crm-edit-last">Last name</Label><Input id="crm-edit-last" className="min-h-11" value={editing.last_name} onChange={(e) => setEditing({ ...editing, last_name: e.target.value })} /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5"><Label htmlFor="crm-edit-phone">Phone</Label><Input id="crm-edit-phone" className="min-h-11" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="flex flex-col gap-1.5"><Label htmlFor="crm-edit-dob">Birthday</Label><Input id="crm-edit-dob" type="date" className="min-h-11" value={editing.date_of_birth || ''} onChange={(e) => setEditing({ ...editing, date_of_birth: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-1.5"><Label htmlFor="crm-edit-email">Email</Label><Input id="crm-edit-email" type="email" className="min-h-11" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <Label className="mb-1">Account &amp; notifications</Label>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.notify_sms !== false} onChange={(e) => setEditing({ ...editing, notify_sms: e.target.checked })} />
                  SMS updates
                </label>
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" checked={editing.notify_push !== false} onChange={(e) => setEditing({ ...editing, notify_push: e.target.checked })} />
                  Push notifications
                </label>
                <label className="flex min-h-9 items-center gap-2 text-sm text-destructive">
                  <input type="checkbox" checked={Boolean(editing.is_disabled)} onChange={(e) => setEditing({ ...editing, is_disabled: e.target.checked })} />
                  Disable account (mute alerts &amp; block login)
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Archive / Delete Customer Confirmation Dialog */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleting?.is_archived ? 'Delete archived customer' : 'Archive or delete customer'}</DialogTitle>
            <DialogDescription>
              {deleting?.full_name || 'Customer'} {deleting?.phone ? `(${deleting.phone})` : ''}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleting?.is_archived
              ? 'Permanent deletion removes this customer profile, vehicles, and portal login completely. Accounts with past visits or receipts cannot be hard-deleted.'
              : 'Archiving hides the customer from active lists and blocks portal sign-in while keeping historical receipts intact. Permanent deletion works only when zero visits or receipts exist.'}
          </p>
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDeleting(null)}>Cancel</Button>
            {!deleting?.is_archived ? (
              <Button type="button" variant="secondary" className="min-h-11 gap-1.5" disabled={saving} onClick={() => archiveCustomer(deleting)}>
                <Archive className="size-4" aria-hidden /> Archive account
              </Button>
            ) : null}
            <Button type="button" variant="destructive" className="min-h-11 gap-1.5" disabled={saving} onClick={() => deleteCustomerPermanent(deleting)}>
              <Trash2 className="size-4" aria-hidden /> Delete permanently
            </Button>
          </DialogFooter>
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
        onEdit={crmEdit ? () => openEditDialog(selected) : undefined}
        onDelete={canLifecycle ? () => setDeleting(selected) : undefined}
        onAddVehicle={crmEdit ? () => setAddingVehicle(true) : undefined}
        onEditVehicle={crmEdit ? (v) => setEditingVehicle({ ...v, vehicle_year: v.vehicle_year ? String(v.vehicle_year) : '' }) : undefined}
        onArchiveVehicle={crmEdit ? (v) => setArchivingVehicle(v) : undefined}
        onTransferVehicle={canTransferVehicle(profile) ? (v) => {
          setTransferSeedVehicle({
            ...v,
            customer_id: selected.id,
            customers: { id: selected.id, full_name: selected.full_name, phone: selected.phone },
          })
          setSelected(null)
          setShellTab('transfer')
        } : undefined}
      >
        <Dialog open={addingVehicle} onOpenChange={(open) => !open && setAddingVehicle(false)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add vehicle</DialogTitle></DialogHeader>
            <form onSubmit={addVehicle} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Plate / sticker</Label>
                <Input className="min-h-11 uppercase placeholder:normal-case" required value={vehicleForm.plate_number} onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value.toUpperCase() })} placeholder="ABC 1234 or 847291" />
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Car size</Label>
                  <Select value={normalizePricingSize(vehicleForm.vehicle_type)} onValueChange={(v) => setVehicleForm({ ...vehicleForm, vehicle_type: v })} items={PRICING_SIZE_ITEMS}>
                    <SelectTrigger className="h-11 w-full cursor-pointer"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRICING_SIZE_ITEMS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5"><Label>Year</Label><Input type="number" min="1950" max="2100" className="min-h-11" value={vehicleForm.vehicle_year} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_year: e.target.value })} placeholder="2024" /></div>
                <div className="flex flex-col gap-1.5"><Label>Color</Label><Input className="min-h-11" value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} /></div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Icon</Label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_ICON_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.label}
                      className={`min-h-11 min-w-11 rounded-xl border px-2 text-lg ${
                        vehicleForm.icon === p.key ? 'border-primary bg-primary/10' : 'border-border bg-card'
                      }`}
                      onClick={() => setVehicleForm({ ...vehicleForm, icon: p.key })}
                    >
                      {p.glyph}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setAddingVehicle(false)}>Cancel</Button>
                <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Add vehicle'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(editingVehicle)} onOpenChange={(open) => !open && setEditingVehicle(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit vehicle</DialogTitle></DialogHeader>
            {editingVehicle ? (
              <form onSubmit={saveVehicleEdit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Plate / sticker</Label>
                  <Input className="min-h-11 uppercase placeholder:normal-case" required value={editingVehicle.plate_number || ''} onChange={(e) => setEditingVehicle({ ...editingVehicle, plate_number: e.target.value.toUpperCase() })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <VehicleMakeModelFields
                    make={editingVehicle.vehicle_make || ''}
                    model={editingVehicle.vehicle_model || ''}
                    onMakeChange={(vehicle_make) => setEditingVehicle((v) => ({ ...v, vehicle_make }))}
                    onModelChange={(vehicle_model) => setEditingVehicle((v) => ({ ...v, vehicle_model }))}
                    onSizeSuggest={(vehicle_type) => setEditingVehicle((v) => ({ ...v, vehicle_type }))}
                    variant="crm"
                    required={false}
                    makeLabel="Make"
                    modelLabel="Model"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Car size</Label>
                    <Select value={normalizePricingSize(editingVehicle.vehicle_type)} onValueChange={(val) => setEditingVehicle({ ...editingVehicle, vehicle_type: val })} items={PRICING_SIZE_ITEMS}>
                      <SelectTrigger className="h-11 w-full cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRICING_SIZE_ITEMS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5"><Label>Year</Label><Input type="number" min="1950" max="2100" className="min-h-11" value={editingVehicle.vehicle_year || ''} onChange={(e) => setEditingVehicle({ ...editingVehicle, vehicle_year: e.target.value })} /></div>
                  <div className="flex flex-col gap-1.5"><Label>Color</Label><Input className="min-h-11" value={editingVehicle.color || ''} onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditingVehicle(null)}>Cancel</Button>
                  <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Saving…' : 'Save vehicle'}</Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(archivingVehicle)} onOpenChange={(open) => !open && setArchivingVehicle(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Remove vehicle {archivingVehicle?.plate_number}</DialogTitle>
              <DialogDescription>
                This archives the vehicle from {selected?.full_name || 'the customer'} while keeping past service tickets intact.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setArchivingVehicle(null)}>Cancel</Button>
              <Button type="button" variant="destructive" className="min-h-11" disabled={saving} onClick={() => confirmArchiveVehicle(archivingVehicle)}>
                {saving ? 'Removing…' : 'Remove vehicle'}
              </Button>
            </DialogFooter>
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
                <Input className="min-h-11" required value={messageForm.title} onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Message</Label>
                <Input className="min-h-11" required value={messageForm.body} onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })} placeholder="Your car is ready for pickup…" />
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
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setMessageOpen(false)}>Cancel</Button>
                <Button type="submit" className="min-h-11" disabled={saving}>{saving ? 'Sending…' : 'Send notification'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CustomerProfileDialog>
    </OpsPageShell>
  )
}

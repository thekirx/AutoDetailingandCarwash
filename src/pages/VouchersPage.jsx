import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, CopyPlus, Dices, Pencil, Plus, RotateCcw, Search, TicketPercent, Trash2, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageVouchers, canViewVouchers } from '@/auth/permissions'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import {
  formatPromoDiscount,
  formatPromoScope,
  mintPromoCode,
  normalizePromoCode,
  promoCodeShapeError,
  promoVoucherRemaining,
  promoVoucherStatus,
} from '@/lib/promoVoucher'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import '@/styles/vouchers.css'

const DISCOUNT_KIND_OPTIONS = [
  { value: 'percent', label: 'Percent off (%)' },
  { value: 'fixed', label: 'Fixed amount off (₱)' },
  { value: 'free', label: 'Free service' },
]

const APPLIES_TO_OPTIONS = [
  { value: 'any', label: 'Wash, packages, detailing (All)' },
  { value: 'wash', label: 'Wash and packages' },
  { value: 'detailing', label: 'Detailing only' },
  { value: 'service', label: 'Specific service…' },
]

const SCOPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All scopes' },
  { value: 'any', label: 'All services' },
  { value: 'wash', label: 'Wash and packages' },
  { value: 'detailing', label: 'Detailing only' },
  { value: 'service', label: 'Specific service' },
]

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'paused', label: 'Paused' },
  { id: 'ended', label: 'Used up / Expired' },
]

const emptyForm = {
  code: '',
  title: '',
  rules_text: 'Show this code to the Team Lead at the branch.',
  discount_kind: 'percent',
  discount_percent: '10',
  discount_amount: '300',
  applies_to: 'any',
  service_id: '',
  starts_on: '',
  ends_on: '',
  max_uses: '10',
  max_per_customer: '1',
}

function formatDateChip(iso) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatVoucherWindow(startsOn, endsOn) {
  const start = startsOn ? formatDateChip(startsOn) : ''
  const end = endsOn ? formatDateChip(endsOn) : ''
  if (start && end) return `${start} – ${end}`
  if (start) return `From ${start}`
  if (end) return `Until ${end}`
  return 'No expiry date'
}

/** SA / ASA board: create promo codes with a use limit, date window, fixed or percent discount, and optional service scope. */
export default function VouchersPage({ embedded = false } = {}) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [services, setServices] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingRow, setEditingRow] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [scopeFilter, setScopeFilter] = useState('all')
  const [searchParams] = useSearchParams()
  const urlQ = searchParams.get('q') || ''
  const [q, setQ] = useState(urlQ)

  useEffect(() => {
    if (urlQ) setQ(urlQ)
  }, [urlQ])
  const [copiedId, setCopiedId] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState('')
  const titleInputRef = useRef(null)

  const todayKey = getLocalCalendarDate()

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    const [{ data, error }, { data: svcData }] = await Promise.all([
      supabase
        .from('promo_vouchers')
        .select(
          'id, code, title, rules_text, discount_kind, discount_percent, discount_amount_minor, applies_to, service_id, starts_on, ends_on, max_uses, uses_count, max_per_customer, is_active, created_at, services(id, name, slug)',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('services')
        .select('id, name, slug, pay_category')
        .order('name'),
    ])
    if (error) toast.error(error.message)
    setRows(data || [])
    setServices((svcData || []).filter((s) => !s.name?.startsWith('Audit Svc') && !s.name?.startsWith('CRUD Service')))
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const serviceOptions = useMemo(
    () => services.map((s) => ({ value: s.id, label: s.name })),
    [services],
  )

  const enrichedRows = useMemo(
    () =>
      rows.map((row) => {
        const statusMeta = promoVoucherStatus(row, todayKey)
        return {
          ...row,
          _status: statusMeta,
          _remaining: promoVoucherRemaining(row),
          _discountLabel: formatPromoDiscount(row),
          _scopeLabel: formatPromoScope(row, row.services?.name),
        }
      }),
    [rows, todayKey],
  )

  const statusCounts = useMemo(() => {
    const counts = { all: enrichedRows.length, active: 0, scheduled: 0, paused: 0, ended: 0 }
    for (const r of enrichedRows) {
      if (r._status.id === 'active') counts.active += 1
      else if (r._status.id === 'scheduled') counts.scheduled += 1
      else if (r._status.id === 'paused') counts.paused += 1
      else counts.ended += 1
    }
    return counts
  }, [enrichedRows])

  const visibleRows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return enrichedRows.filter((r) => {
      if (statusFilter === 'ended') {
        if (r._status.id !== 'exhausted' && r._status.id !== 'expired') return false
      } else if (statusFilter !== 'all' && r._status.id !== statusFilter) {
        return false
      }
      if (scopeFilter !== 'all' && (r.applies_to || 'any') !== scopeFilter) return false
      if (needle) {
        const hay = `${r.code || ''} ${r.title || ''} ${r.rules_text || ''} ${r._scopeLabel || ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [enrichedRows, statusFilter, scopeFilter, q])

  const previewServiceName = useMemo(
    () => services.find((s) => s.id === form.service_id)?.name || '',
    [services, form.service_id],
  )

  const previewVoucher = useMemo(() => {
    const code = normalizePromoCode(form.code) || 'VK••••'
    const maxUses = Math.max(1, Math.floor(Number(form.max_uses) || 0))
    const perCustomer = Math.max(1, Math.floor(Number(form.max_per_customer) || 1))
    const discountAmountMinor = form.discount_kind === 'fixed'
      ? Math.round((Number(form.discount_amount) || 0) * 100)
      : 0
    return {
      code,
      title: form.title.trim() || 'Untitled promo voucher',
      rules_text: form.rules_text.trim(),
      discount_kind: form.discount_kind,
      discount_percent: Number(form.discount_percent) || 0,
      discount_amount_minor: discountAmountMinor,
      applies_to: form.applies_to,
      service_id: form.applies_to === 'service' ? form.service_id : null,
      max_uses: maxUses,
      max_per_customer: perCustomer,
      starts_on: form.starts_on,
      ends_on: form.ends_on,
    }
  }, [form])

  if (!canViewVouchers(profile)) return <Navigate to="/operations/access-denied" replace />
  const canMint = canManageVouchers(profile)

  function resetComposer() {
    setForm(emptyForm)
    setEditingRow(null)
  }

  function startEditing(row) {
    setEditingRow(row)
    setConfirmDeleteId('')
    setForm({
      code: row.code || '',
      title: row.title || '',
      rules_text: row.rules_text || '',
      discount_kind: row.discount_kind || 'percent',
      discount_percent: String(row.discount_percent ?? '10'),
      discount_amount: String(row.discount_amount_minor != null ? Math.round(row.discount_amount_minor / 100) : '300'),
      applies_to: row.applies_to || 'any',
      service_id: row.service_id || '',
      starts_on: row.starts_on ? String(row.starts_on).slice(0, 10) : '',
      ends_on: row.ends_on ? String(row.ends_on).slice(0, 10) : '',
      max_uses: String(row.max_uses ?? '10'),
      max_per_customer: String(row.max_per_customer ?? '1'),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => titleInputRef.current?.focus(), 120)
  }

  function duplicateVoucher(row) {
    setEditingRow(null)
    setConfirmDeleteId('')
    setForm({
      code: mintPromoCode(),
      title: row.title ? `${row.title} (Copy)` : '',
      rules_text: row.rules_text || emptyForm.rules_text,
      discount_kind: row.discount_kind || 'percent',
      discount_percent: String(row.discount_percent ?? '10'),
      discount_amount: String(row.discount_amount_minor != null ? Math.round(row.discount_amount_minor / 100) : '300'),
      applies_to: row.applies_to || 'any',
      service_id: row.service_id || '',
      starts_on: row.starts_on ? String(row.starts_on).slice(0, 10) : '',
      ends_on: row.ends_on ? String(row.ends_on).slice(0, 10) : '',
      max_uses: String(row.max_uses ?? '10'),
      max_per_customer: String(row.max_per_customer ?? '1'),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => titleInputRef.current?.focus(), 120)
    toast.info('Cloned voucher settings with a new code.')
  }

  async function saveVoucher(event) {
    event.preventDefault()
    const rawCode = form.code.trim()
    const code = rawCode ? normalizePromoCode(rawCode) : mintPromoCode()
    const shapeErr = rawCode ? promoCodeShapeError(code) : null
    if (shapeErr) {
      toast.error(shapeErr)
      return
    }
    const maxUses = Math.floor(Number(form.max_uses) || 0)
    if (maxUses < 1) {
      toast.error('Set how many times this code can be used.')
      return
    }
    if (editingRow && maxUses < Number(editingRow.uses_count || 0)) {
      toast.error(`Max uses cannot be lower than already redeemed (${editingRow.uses_count}).`)
      return
    }
    if (form.starts_on && form.ends_on && form.ends_on < form.starts_on) {
      toast.error('End date must be on or after the start date.')
      return
    }
    if (form.discount_kind === 'percent') {
      const pct = Number(form.discount_percent)
      if (!(pct > 0 && pct <= 100)) {
        toast.error('Percent off must be between 1 and 100.')
        return
      }
    }
    if (form.discount_kind === 'fixed') {
      const amt = Number(form.discount_amount)
      if (!(amt > 0)) {
        toast.error('Exact voucher discount amount must be greater than ₱0.')
        return
      }
    }
    if (form.applies_to === 'service' && !form.service_id) {
      toast.error('Please select the specific service this voucher applies to.')
      return
    }

    setSaving(true)
    const discountAmountMinor = form.discount_kind === 'fixed'
      ? Math.round(Number(form.discount_amount) * 100)
      : 0

    const payload = {
      code,
      title: form.title.trim() || code,
      rules_text: form.rules_text.trim(),
      discount_kind: form.discount_kind,
      discount_percent: form.discount_kind === 'free' ? 100 : form.discount_kind === 'percent' ? Number(form.discount_percent) || 0 : 0,
      discount_amount_minor: discountAmountMinor,
      applies_to: form.applies_to,
      service_id: form.applies_to === 'service' && form.service_id ? form.service_id : null,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      max_uses: maxUses,
      max_per_customer: Math.max(1, Math.floor(Number(form.max_per_customer) || 1)),
    }

    const { error } = editingRow
      ? await supabase
          .from('promo_vouchers')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingRow.id)
      : await supabase.from('promo_vouchers').insert({
          ...payload,
          created_by: profile?.id || null,
        })

    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(editingRow ? `Updated voucher ${code}.` : `Voucher ${code} is ready.`)
    resetComposer()
    await load({ silent: true })
  }

  async function toggleActive(row) {
    if (!canMint) return
    const { error } = await supabase
      .from('promo_vouchers')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) toast.error(error.message)
    else {
      toast.success(row.is_active ? `${row.code} paused.` : `${row.code} turned back on.`)
      await load({ silent: true })
    }
  }

  async function deleteUnusedVoucher(row) {
    if (!canMint || Number(row.uses_count || 0) > 0) return
    const { error } = await supabase.from('promo_vouchers').delete().eq('id', row.id)
    setConfirmDeleteId('')
    if (error) {
      toast.error(error.message)
      return
    }
    if (editingRow?.id === row.id) resetComposer()
    toast.success(`Deleted unused voucher ${row.code}.`)
    await load({ silent: true })
  }

  async function copyCode(row) {
    try {
      await navigator.clipboard.writeText(row.code)
      setCopiedId(row.id)
      toast.success(`Copied ${row.code}`)
      setTimeout(() => setCopiedId((prev) => (prev === row.id ? '' : prev)), 1800)
    } catch {
      toast.error('Copy failed. Please copy the code manually.')
    }
  }

  const hasActiveFilters = statusFilter !== 'all' || scopeFilter !== 'all' || q.trim() !== ''

  const inner = (
      <div className="voucher-shell">
        {canMint ? (
          <section className="voucher-composer" aria-label={editingRow ? `Edit voucher ${editingRow.code}` : 'Create voucher'}>
            <form className="voucher-form voucher-form-sections" onSubmit={saveVoucher}>
              <div className="voucher-composer-head">
                <div>
                  <h2>{editingRow ? `Editing ${editingRow.code}` : 'New promo voucher'}</h2>
                  <p>
                    {editingRow
                      ? 'Update rules, use cap, or date window without losing past redemptions.'
                      : 'Leave code blank to auto-mint a 6-character code starting with VK.'}
                  </p>
                </div>
                {editingRow ? (
                  <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={resetComposer}>
                    <X className="size-4" aria-hidden />
                    Cancel edit
                  </Button>
                ) : null}
              </div>

              <div className="voucher-group">
                <h3 className="voucher-group-title">1. Code & identity</h3>
                <div className="voucher-grid-identity">
                  <div className="voucher-field">
                    <Label htmlFor="voucher-code">Code</Label>
                    <div className="voucher-code-row">
                      <Input
                        id="voucher-code"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                        placeholder="Auto-mint (VK…)"
                        maxLength={16}
                        autoComplete="off"
                        disabled={Boolean(editingRow && Number(editingRow.uses_count || 0) > 0)}
                        className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 gap-1.5 px-3"
                        disabled={Boolean(editingRow && Number(editingRow.uses_count || 0) > 0)}
                        onClick={() => setForm((f) => ({ ...f, code: mintPromoCode() }))}
                        aria-label="Generate random code"
                        title="Generate random code"
                      >
                        <Dices className="size-4" aria-hidden />
                        <span className="hidden sm:inline">Mint</span>
                      </Button>
                    </div>
                    {editingRow && Number(editingRow.uses_count || 0) > 0 ? (
                      <p className="voucher-field-hint">Code locked after first redemption ({editingRow.uses_count} used).</p>
                    ) : null}
                  </div>

                  <div className="voucher-field">
                    <Label htmlFor="voucher-title">Title</Label>
                    <Input
                      ref={titleInputRef}
                      id="voucher-title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="e.g. Rainy Day Tint 10% Off"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="voucher-group">
                <h3 className="voucher-group-title">2. Discount & eligible services</h3>
                <div className="voucher-grid-offer">
                  <div className="voucher-field">
                    <Label htmlFor="voucher-discount-kind">Discount type</Label>
                    <Select
                      value={form.discount_kind}
                      onValueChange={(v) => setForm({ ...form, discount_kind: v })}
                      items={DISCOUNT_KIND_OPTIONS}
                    >
                      <SelectTrigger id="voucher-discount-kind" className="h-11 w-full cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DISCOUNT_KIND_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.discount_kind === 'percent' ? (
                    <div className="voucher-field">
                      <Label htmlFor="voucher-pct">Percent off (%)</Label>
                      <Input
                        id="voucher-pct"
                        type="number"
                        min="1"
                        max="100"
                        value={form.discount_percent}
                        onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                        required
                      />
                    </div>
                  ) : null}

                  {form.discount_kind === 'fixed' ? (
                    <div className="voucher-field">
                      <Label htmlFor="voucher-amount">Voucher amount (₱)</Label>
                      <Input
                        id="voucher-amount"
                        type="number"
                        min="1"
                        step="any"
                        placeholder="e.g. 300"
                        value={form.discount_amount}
                        onChange={(e) => setForm({ ...form, discount_amount: e.target.value })}
                        required
                      />
                    </div>
                  ) : null}

                  <div className="voucher-field">
                    <Label htmlFor="voucher-applies-to">Applies to</Label>
                    <Select
                      value={form.applies_to}
                      onValueChange={(v) => setForm({ ...form, applies_to: v })}
                      items={APPLIES_TO_OPTIONS}
                    >
                      <SelectTrigger id="voucher-applies-to" className="h-11 w-full cursor-pointer">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLIES_TO_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.applies_to === 'service' ? (
                    <div className="voucher-field">
                      <Label htmlFor="voucher-service-id">Choose service</Label>
                      <Select
                        value={form.service_id}
                        onValueChange={(v) => setForm({ ...form, service_id: v })}
                        items={serviceOptions}
                      >
                        <SelectTrigger id="voucher-service-id" className="h-11 w-full cursor-pointer">
                          <SelectValue placeholder="Select specific service" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceOptions.map((svc) => (
                            <SelectItem key={svc.value} value={svc.value}>
                              {svc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="voucher-group">
                <h3 className="voucher-group-title">3. Limits & valid window</h3>
                <div className="voucher-grid-limits">
                  <div className="voucher-field">
                    <Label htmlFor="voucher-max">Max uses</Label>
                    <Input
                      id="voucher-max"
                      type="number"
                      min={editingRow ? Math.max(1, Number(editingRow.uses_count || 0)) : 1}
                      value={form.max_uses}
                      onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                      required
                    />
                  </div>
                  <div className="voucher-field">
                    <Label htmlFor="voucher-per">Per customer</Label>
                    <Input
                      id="voucher-per"
                      type="number"
                      min="1"
                      value={form.max_per_customer}
                      onChange={(e) => setForm({ ...form, max_per_customer: e.target.value })}
                    />
                  </div>
                  <div className="voucher-field">
                    <Label htmlFor="voucher-start">Starts</Label>
                    <Input
                      id="voucher-start"
                      type="date"
                      value={form.starts_on}
                      onChange={(e) => setForm({ ...form, starts_on: e.target.value })}
                    />
                  </div>
                  <div className="voucher-field">
                    <Label htmlFor="voucher-end">Ends</Label>
                    <Input
                      id="voucher-end"
                      type="date"
                      value={form.ends_on}
                      min={form.starts_on || undefined}
                      onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="voucher-field">
                <Label htmlFor="voucher-rules">Customer rules</Label>
                <Textarea
                  id="voucher-rules"
                  rows={2}
                  value={form.rules_text}
                  onChange={(e) => setForm({ ...form, rules_text: e.target.value })}
                  placeholder="Instructions shown to customers and staff…"
                />
              </div>

              <div className="voucher-form-actions">
                <Button type="submit" disabled={saving} className="min-h-11 gap-2 px-5">
                  {editingRow ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                  {saving ? 'Saving…' : editingRow ? 'Save changes' : 'Create voucher'}
                </Button>
                {editingRow ? (
                  <Button type="button" variant="outline" className="min-h-11" onClick={resetComposer}>
                    Discard changes
                  </Button>
                ) : null}
              </div>
            </form>

            <aside className="voucher-preview" aria-label="Live voucher preview">
              <span className="voucher-preview-label">Live ticket preview</span>
              <div className="voucher-preview-ticket">
                <div className="voucher-preview-top">
                  <span className="voucher-preview-code">{previewVoucher.code}</span>
                  <span className="voucher-status is-active">
                    {formatPromoDiscount(previewVoucher)}
                  </span>
                </div>
                <p className="voucher-preview-title">{previewVoucher.title}</p>
                <div className="voucher-preview-meta">
                  <span>{formatPromoScope(previewVoucher, previewServiceName)}</span>
                  <span>·</span>
                  <span>{previewVoucher.max_uses} total uses ({previewVoucher.max_per_customer}/customer)</span>
                </div>
                <div className="voucher-preview-meta">
                  <span>{formatVoucherWindow(previewVoucher.starts_on, previewVoucher.ends_on)}</span>
                </div>
                {previewVoucher.rules_text ? (
                  <p className="voucher-preview-rules">{previewVoucher.rules_text}</p>
                ) : null}
              </div>
            </aside>
          </section>
        ) : (
          <p className="voucher-readonly-note">
            Read-only access. Voucher codes are created and updated by Owner, Super Admin, or General Admin.
          </p>
        )}

        <section className="voucher-directory" aria-label="Voucher directory">
          <div className="voucher-toolbar">
            <div className="voucher-filter-tabs" role="tablist" aria-label="Filter vouchers by status">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f.id}
                  className={`voucher-filter-pill ${statusFilter === f.id ? 'is-selected' : ''}`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                  <span>{statusCounts[f.id]}</span>
                </button>
              ))}
            </div>

            <div className="voucher-search-row">
              <div className="voucher-search-input">
                <Search className="voucher-search-icon" aria-hidden />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search code, title, or rule…"
                  aria-label="Search vouchers"
                />
              </div>
              <div className="voucher-scope-select">
                <Select value={scopeFilter} onValueChange={setScopeFilter} items={SCOPE_FILTER_OPTIONS}>
                  <SelectTrigger className="h-11 w-full cursor-pointer" aria-label="Filter by eligible services">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCOPE_FILTER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 gap-1.5"
                  onClick={() => {
                    setStatusFilter('all')
                    setScopeFilter('all')
                    setQ('')
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  Reset
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Loading vouchers">
              <div className="planner-skel h-16" />
              <div className="planner-skel h-16" />
              <div className="planner-skel h-16" />
            </div>
          ) : !visibleRows.length ? (
            <div className="voucher-empty">
              <strong>{hasActiveFilters ? 'No matching vouchers' : 'No vouchers created yet'}</strong>
              <p>
                {hasActiveFilters
                  ? 'Try clearing your search or switching the status filter.'
                  : 'Use the form above to mint your first promo code for customers and queue tickets.'}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 min-h-11"
                  onClick={() => {
                    setStatusFilter('all')
                    setScopeFilter('all')
                    setQ('')
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="voucher-mobile-list md:hidden">
                {visibleRows.map((row) => {
                  const pctUsed = row.max_uses > 0 ? Math.min(100, Math.round(((row.uses_count || 0) / row.max_uses) * 100)) : 0
                  const isCopied = copiedId === row.id
                  const canDelete = canMint && Number(row.uses_count || 0) === 0
                  return (
                    <article key={row.id} className="voucher-mobile-card">
                      <div className="voucher-mobile-top">
                        <span className="voucher-code-chip">{row.code}</span>
                        <span className={`voucher-status is-${row._status.id}`}>{row._status.label}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row._discountLabel} · {row._scopeLabel} · {row.max_per_customer}/customer
                        </div>
                      </div>
                      <div className="voucher-usage">
                        <span className="voucher-usage-text">
                          {row._remaining} of {row.max_uses} uses left
                        </span>
                        <div className="voucher-usage-track" aria-hidden="true">
                          <div
                            className={`voucher-usage-fill ${row._remaining === 0 ? 'is-depleted' : ''}`}
                            style={{ width: `${pctUsed}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Window: {formatVoucherWindow(row.starts_on, row.ends_on)}
                      </div>
                      <div className="voucher-mobile-actions">
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => copyCode(row)}>
                          {isCopied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </Button>
                        {canMint ? (
                          <>
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => startEditing(row)}>
                              <Pencil className="size-3.5" aria-hidden />
                              Edit
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => duplicateVoucher(row)}>
                              <CopyPlus className="size-3.5" aria-hidden />
                              Clone
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => toggleActive(row)}>
                              {row.is_active ? 'Turn off' : 'Turn on'}
                            </Button>
                            {canDelete ? (
                              confirmDeleteId === row.id ? (
                                <Button type="button" variant="destructive" size="sm" onClick={() => deleteUnusedVoucher(row)}>
                                  Confirm delete
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmDeleteId(row.id)}
                                  aria-label={`Delete ${row.code}`}
                                >
                                  <Trash2 className="size-3.5" aria-hidden />
                                </Button>
                              )
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="voucher-table-wrap hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Offer &amp; Scope</TableHead>
                      <TableHead>Uses left</TableHead>
                      <TableHead>Window</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row) => {
                      const pctUsed = row.max_uses > 0 ? Math.min(100, Math.round(((row.uses_count || 0) / row.max_uses) * 100)) : 0
                      const isCopied = copiedId === row.id
                      const canDelete = canMint && Number(row.uses_count || 0) === 0
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => copyCode(row)}
                              className="voucher-code-chip cursor-pointer hover:border-primary/40"
                              title={`Copy ${row.code}`}
                            >
                              <span>{row.code}</span>
                              {isCopied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5 text-muted-foreground" aria-hidden />}
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-foreground">{row.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {row._discountLabel} · {row._scopeLabel} · {row.max_per_customer}/customer
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="voucher-usage">
                              <span className="voucher-usage-text">
                                {row._remaining} / {row.max_uses}
                              </span>
                              <div className="voucher-usage-track" aria-hidden="true">
                                <div
                                  className={`voucher-usage-fill ${row._remaining === 0 ? 'is-depleted' : ''}`}
                                  style={{ width: `${pctUsed}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatVoucherWindow(row.starts_on, row.ends_on)}
                          </TableCell>
                          <TableCell>
                            <span className={`voucher-status is-${row._status.id}`}>{row._status.label}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {canMint ? (
                                <>
                                  <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => startEditing(row)}>
                                    <Pencil className="size-3.5" aria-hidden />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="min-h-11"
                                    onClick={() => duplicateVoucher(row)}
                                    title={`Duplicate ${row.code}`}
                                    aria-label={`Duplicate ${row.code}`}
                                  >
                                    <CopyPlus className="size-3.5" aria-hidden />
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => toggleActive(row)}>
                                    {row.is_active ? 'Turn off' : 'Turn on'}
                                  </Button>
                                  {canDelete ? (
                                    confirmDeleteId === row.id ? (
                                      <Button type="button" variant="destructive" size="sm" className="min-h-11" onClick={() => deleteUnusedVoucher(row)}>
                                        Confirm
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="min-h-11"
                                        onClick={() => setConfirmDeleteId(row.id)}
                                        aria-label={`Delete ${row.code}`}
                                        title="Delete unused voucher"
                                      >
                                        <Trash2 className="size-3.5" aria-hidden />
                                      </Button>
                                    )
                                  ) : null}
                                </>
                              ) : (
                                <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5" onClick={() => copyCode(row)}>
                                  {isCopied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
                                  {isCopied ? 'Copied' : 'Copy'}
                                </Button>
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
        </section>
      </div>
  )

  if (embedded) return inner

  return (
    <OpsPageShell
      title="Vouchers"
      description="Create promo codes. Team Leads apply them on queue tickets, and POS tracks redemptions."
      icon={TicketPercent}
    >
      {inner}
    </OpsPageShell>
  )
}

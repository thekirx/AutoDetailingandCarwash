import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, TicketPercent } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { canManageVouchers, canViewVouchers } from '@/auth/permissions'
import { mintPromoCode, normalizePromoCode, promoVoucherRemaining } from '@/lib/promoVoucher'
import { supabase } from '@/lib/supabase'
import OpsPageShell from '@/components/ops/OpsPageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const emptyForm = {
  code: '',
  title: '',
  rules_text: 'Show this code to the Team Lead at the branch.',
  discount_kind: 'percent',
  discount_percent: '10',
  applies_to: 'any',
  starts_on: '',
  ends_on: '',
  max_uses: '10',
  max_per_customer: '1',
}

/** SA / ASA board: create promo codes with a use limit and date window. */
export default function VouchersPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('promo_vouchers')
      .select(
        'id, code, title, rules_text, discount_kind, discount_percent, applies_to, starts_on, ends_on, max_uses, uses_count, max_per_customer, is_active, created_at',
      )
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (!canViewVouchers(profile)) return <Navigate to="/operations/access-denied" replace />
  const canMint = canManageVouchers(profile)

  async function createVoucher(event) {
    event.preventDefault()
    const code = normalizePromoCode(form.code) || mintPromoCode()
    const maxUses = Math.floor(Number(form.max_uses) || 0)
    if (maxUses < 1) {
      toast.error('Set how many times this code can be used.')
      return
    }
    if (form.discount_kind === 'percent') {
      const pct = Number(form.discount_percent)
      if (!(pct > 0 && pct <= 100)) {
        toast.error('Percent off must be between 1 and 100.')
        return
      }
    }
    setSaving(true)
    const { error } = await supabase.from('promo_vouchers').insert({
      code,
      title: form.title.trim() || code,
      rules_text: form.rules_text.trim(),
      discount_kind: form.discount_kind,
      discount_percent: form.discount_kind === 'free' ? 100 : Number(form.discount_percent) || 0,
      applies_to: form.applies_to,
      starts_on: form.starts_on || null,
      ends_on: form.ends_on || null,
      max_uses: maxUses,
      max_per_customer: Math.max(1, Math.floor(Number(form.max_per_customer) || 1)),
      created_by: profile?.id || null,
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success(`Voucher ${code} is ready.`)
    setForm({ ...emptyForm, code: '' })
    load()
  }

  async function toggleActive(row) {
    const { error } = await supabase
      .from('promo_vouchers')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) toast.error(error.message)
    else load()
  }

  return (
    <OpsPageShell
      title="Vouchers"
      description="Create promo codes. The Team Lead types them on the queue. POS counts each use."
      icon={TicketPercent}
    >
      {canMint ? <form className="mb-8 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={createVoucher}>
        <label className="grid gap-1.5">
          <Label htmlFor="voucher-code">Code</Label>
          <Input
            id="voucher-code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            placeholder="Blank mints VK…"
            maxLength={16}
            autoComplete="off"
            className="uppercase"
          />
        </label>
        <label className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="voucher-title">Title</Label>
          <Input id="voucher-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label className="grid gap-1.5">
          <Label>Discount</Label>
          <Select value={form.discount_kind} onValueChange={(v) => setForm({ ...form, discount_kind: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent off</SelectItem>
              <SelectItem value="free">Free service</SelectItem>
            </SelectContent>
          </Select>
        </label>
        {form.discount_kind === 'percent' ? (
          <label className="grid gap-1.5">
            <Label htmlFor="voucher-pct">Percent</Label>
            <Input id="voucher-pct" type="number" min="1" max="100" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
          </label>
        ) : null}
        <label className="grid gap-1.5">
          <Label>Applies to</Label>
          <Select value={form.applies_to} onValueChange={(v) => setForm({ ...form, applies_to: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Wash, packages, detailing</SelectItem>
              <SelectItem value="wash">Wash and packages</SelectItem>
              <SelectItem value="detailing">Detailing only</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5">
          <Label htmlFor="voucher-max">Max uses</Label>
          <Input id="voucher-max" type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} required />
        </label>
        <label className="grid gap-1.5">
          <Label htmlFor="voucher-per">Per customer</Label>
          <Input id="voucher-per" type="number" min="1" value={form.max_per_customer} onChange={(e) => setForm({ ...form, max_per_customer: e.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <Label htmlFor="voucher-start">Starts</Label>
          <Input id="voucher-start" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} />
        </label>
        <label className="grid gap-1.5">
          <Label htmlFor="voucher-end">Ends</Label>
          <Input id="voucher-end" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} />
        </label>
        <label className="grid gap-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="voucher-rules">Customer rules</Label>
          <Textarea id="voucher-rules" rows={2} value={form.rules_text} onChange={(e) => setForm({ ...form, rules_text: e.target.value })} />
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit" disabled={saving} className="min-h-11 gap-2">
            <Plus className="size-4" aria-hidden />
            {saving ? 'Saving…' : 'Create voucher'}
          </Button>
        </div>
      </form> : <p className="mb-6 text-sm text-muted-foreground">Read only. Voucher codes are created by Owner, Super Admin, or General Admin.</p>}

      {loading ? <p className="text-sm text-muted-foreground">Loading vouchers…</p> : null}
      {!loading && !rows.length ? <p className="text-sm text-muted-foreground">No vouchers yet.</p> : null}
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Uses left</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono font-semibold">{row.code}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.discount_kind === 'free' ? 'Free service' : `${row.discount_percent}% off`} · {row.applies_to}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {promoVoucherRemaining(row)} / {row.max_uses}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {(row.starts_on || 'open').slice(0, 10)} → {(row.ends_on || 'open').slice(0, 10)}
                </TableCell>
                <TableCell>{row.is_active ? 'Active' : 'Off'}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => toggleActive(row)}>
                    {row.is_active ? 'Turn off' : 'Turn on'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </OpsPageShell>
  )
}

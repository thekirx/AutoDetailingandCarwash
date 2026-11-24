import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const KIND_OPTIONS = [
  { value: 'general', label: 'General & administrative' },
  { value: 'payroll', label: 'Employee salary & incentives (office payroll, not commission %)' },
  { value: 'chemicals', label: 'Chemicals, apparel & supplies' },
  { value: 'utilities', label: 'Rent & operating utilities' },
  { value: 'equipment', label: 'Equipment, tools & repairs' },
  { value: 'marketing', label: 'Marketing & promotions' },
]

export function FinanceAccountDialog({ open, onOpenChange, account, onSaved }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('general')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setCode(account?.code != null ? String(account.code) : '')
    setName(account?.name || '')
    setKind(account?.kind || 'general')
  }, [open, account])

  async function save(e) {
    e?.preventDefault?.()
    const num = Number.parseInt(String(code).trim(), 10)
    const cleanName = String(name || '').trim()
    if (!Number.isFinite(num) || num < 1 || num > 999) {
      toast.error('Account code must be a whole number from 1 to 999 (e.g. 10 to 21).')
      return
    }
    if (!cleanName) {
      toast.error('Account name is required.')
      return
    }
    setSaving(true)
    try {
      try {
        await callFinanceOwnerOps({
          action: 'manage-category',
          sub_action: 'save',
          id: account?.id || null,
          code: num,
          name: cleanName,
          kind,
        })
      } catch (apiErr) {
        // Fallback to direct Supabase query if running against local/direct session
        const payload = { code: num, name: cleanName, kind, active: true }
        const res = account?.id
          ? await supabase.from('expense_categories').update(payload).eq('id', account.id)
          : await supabase.from('expense_categories').insert(payload)
        if (res.error) throw apiErr || res.error
      }
      toast.success(account?.id ? 'Expense category updated.' : 'Expense category created.')
      onOpenChange(false)
      await onSaved?.()
    } catch (err) {
      toast.error(err?.message || 'Could not save category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-slate-200/90 bg-white">
        <DialogHeader>
          <DialogTitle>{account?.id ? 'Edit expense category' : 'New expense category'}</DialogTitle>
          <DialogDescription>
            Standard chart codes use 10–21 (Account 14 is fixed for office payroll, not commission %). Every bill and daily sheet expense line links to a category.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4 py-1">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="acct-code">Code</Label>
              <Input
                id="acct-code"
                type="number"
                min="1"
                max="999"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="22"
                className="mt-1 tabular-nums"
                required
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="acct-name">Category name</Label>
              <Input
                id="acct-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Shop Consumables"
                className="mt-1"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="acct-kind">Group / kind</Label>
            <Select id="acct-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1">
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#0e1540] text-white hover:bg-[#17205c]" disabled={saving}>
              {saving ? 'Saving…' : account?.id ? 'Save changes' : 'Create category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default FinanceAccountDialog


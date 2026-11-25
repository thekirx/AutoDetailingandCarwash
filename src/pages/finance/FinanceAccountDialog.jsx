import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { callFinanceOwnerOps } from '@/lib/financeOwnerClient'
import { buildAccountRow, catalogWriteError, isSalaryAccount } from '@/lib/financeBooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
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
  const locked14 = isSalaryAccount(account)
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
    const built = buildAccountRow({
      name,
      code: locked14 ? '14' : code,
      kind: locked14 ? 'payroll' : kind,
      is_chemical: kind === 'chemicals',
    })
    if (!built.ok) {
      toast.error(built.error)
      return
    }
    const cleanCode = built.row.code
    if (cleanCode && !/^\d{1,3}$/.test(cleanCode)) {
      toast.error('Account code should be a 1 to 3 digit number (e.g. 10 to 22).')
      return
    }
    setSaving(true)
    try {
      try {
        await callFinanceOwnerOps({
          action: 'manage-category',
          sub_action: 'save',
          id: account?.id || null,
          ...built.row,
        })
      } catch (apiErr) {
        const sortOrder = cleanCode && /^\d+$/.test(cleanCode) ? Number(cleanCode) : 99
        const payload = { ...built.row, sort_order: sortOrder, ...(account?.id ? {} : { is_archived: false }) }
        const res = account?.id
          ? await supabase.from('expense_categories').update(payload).eq('id', account.id)
          : await supabase.from('expense_categories').insert(payload)
        if (res.error) throw new Error(catalogWriteError(res.error, 'category') || apiErr?.message)
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
                type="text"
                inputMode="numeric"
                value={code}
                disabled={locked14}
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
            <NamedSelect id="acct-kind" value={kind} disabled={locked14} onChange={setKind} options={KIND_OPTIONS} className="mt-1" />
            {locked14 ? (
              <p className="mt-1 text-xs text-slate-500">
                Account 14 code and Payroll kind are locked because Daily Sheets and Monthly Salaries post to it automatically. You can rename it here.
              </p>
            ) : null}
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

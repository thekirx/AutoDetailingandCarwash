/** Add or edit one expense account (expense_categories). Used by Finance → Categories and the New bill form. */
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { supabase } from '@/lib/supabase'
import { ACCOUNT_KINDS, buildAccountRow, catalogWriteError, isSalaryAccount } from '@/lib/financeBooks'

const toForm = (c) => ({
  name: c?.name || '',
  code: c?.code || '',
  kind: c?.kind || 'general',
  is_chemical: Boolean(c?.is_chemical),
})

export default function FinanceAccountDialog({ open, onOpenChange, editing = null, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? <AccountForm key={editing?.id || 'new'} editing={editing} onDone={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AccountForm({ editing, onDone, onSaved }) {
  const [form, setForm] = useState(() => toForm(editing))
  const [saving, setSaving] = useState(false)
  const locked = isSalaryAccount(editing)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function save(event) {
    event.preventDefault()
    const res = buildAccountRow(form)
    if (!res.ok) return toast.error(res.error)
    setSaving(true)
    const q = editing
      ? supabase.from('expense_categories').update(res.row).eq('id', editing.id)
      : supabase.from('expense_categories').insert(res.row)
    const { data, error } = await q.select().single()
    setSaving(false)
    if (error) return toast.error(catalogWriteError(error, 'category'))
    toast.success(editing ? 'Category updated' : 'Category added')
    onSaved?.(data)
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit category' : 'Add category'}</DialogTitle>
        <DialogDescription>
          The account a bill, expense report or POS sheet line posts to. Code sets the order in every picker; kind sets the P&L group.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-[7rem_1fr]" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="acct-code">Code</Label>
          <Input id="acct-code" maxLength={10} className="min-h-11 tabular-nums" placeholder="e.g. 22" disabled={locked} value={form.code} onChange={(e) => set({ code: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="acct-name">Name</Label>
          <Input id="acct-name" required maxLength={80} className="min-h-11" placeholder="e.g. Coffee and supplies" autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="acct-kind">Kind</Label>
          <NamedSelect id="acct-kind" value={form.kind} disabled={locked} onChange={(kind) => set({ kind })} options={ACCOUNT_KINDS} className="min-h-11" />
          {form.kind === 'payroll' ? <p className="text-xs text-muted-foreground">Posted payroll grouping, not commission %.</p> : null}
        </div>
        {locked ? (
          <p className="text-xs text-muted-foreground sm:col-span-2">Shift-close payroll posts salaries to account 14, so its code and kind stay fixed. You can rename it.</p>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={form.is_chemical || form.kind === 'chemicals'}
            disabled={form.kind === 'chemicals'}
            onChange={(e) => set({ is_chemical: e.target.checked })}
          />
          Needs approval before it can be paid
        </label>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-11 cursor-pointer" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save category' : 'Add category'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

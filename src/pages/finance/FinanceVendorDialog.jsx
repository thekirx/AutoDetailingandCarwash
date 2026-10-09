/** Add or edit one vendor. Used by Finance → Vendors and the New bill form. */
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'
import { normalizeVendorPayload } from '@/lib/financeCorporate'
import { catalogWriteError } from '@/lib/financeBooks'

export default function FinanceVendorDialog({ open, onOpenChange, editing = null, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        {open ? <VendorForm key={editing?.id || 'new'} editing={editing} onDone={() => onOpenChange(false)} onSaved={onSaved} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function VendorForm({ editing, onDone, onSaved }) {
  const [form, setForm] = useState(() => ({ name: editing?.name || '', contact: editing?.contact || '', notes: editing?.notes || '' }))
  const [saving, setSaving] = useState(false)

  async function save(event) {
    event.preventDefault()
    const payload = normalizeVendorPayload({ ...form, is_active: editing ? editing.is_active : true })
    if (!payload) return toast.error('Enter the vendor name.')
    setSaving(true)
    const q = editing
      ? supabase.from('vendors').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id)
      : supabase.from('vendors').insert(payload)
    const { data, error } = await q.select('id, name, contact, notes, is_active, created_at').single()
    setSaving(false)
    if (error) return toast.error(catalogWriteError(error, 'vendor'))
    toast.success(editing ? 'Vendor updated' : 'Vendor added')
    onSaved?.(data)
    onDone()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit vendor' : 'Add vendor'}</DialogTitle>
        <DialogDescription>Who bills come from. Inactive vendors stay on old bills but leave the New bill list.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="vendor-name">Name</Label>
          <Input id="vendor-name" required maxLength={120} autoFocus className="min-h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="vendor-contact">Contact</Label>
          <Input id="vendor-contact" className="min-h-11" placeholder="Phone, email, or person" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="vendor-notes">Notes</Label>
          <Textarea id="vendor-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <DialogFooter className="sm:col-span-2">
          <Button type="button" variant="outline" className="min-h-11 cursor-pointer" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-11 cursor-pointer" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save vendor' : 'Add vendor'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

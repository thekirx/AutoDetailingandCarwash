/** Xero-style New bill: From, Date, Due date, Reference, then lines (Item, Description, Qty, Unit price, Account,
 * Branch, Amount) with subtotal and total. Each line is saved as one expenses row; editing works on one line. */
import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NamedSelect } from '@/components/ui/named-select'
import { supabase } from '@/lib/supabase'
import { getLocalCalendarDate } from '@/lib/localCalendarDate'
import { formatAccounting } from '@/lib/dailySheet'
import { activeAccounts, billLineMinor, buildBillRows } from '@/lib/financeBooks'
import FinanceAccountDialog from './FinanceAccountDialog'
import FinanceVendorDialog from './FinanceVendorDialog'

const NEW = '__new__'
const blankLine = (branch = '', category_id = '') => ({ item: '', description: '', quantity: '1', unit_price: '', category_id, branch })

function fromRow(row) {
  return {
    header: {
      vendor_id: row.vendor_id || '',
      date: row.created_at ? getLocalCalendarDate(row.created_at) : getLocalCalendarDate(),
      due_date: row.due_date || '',
      reference: row.bill_reference || '',
    },
    lines: [
      {
        item: row.title || '',
        description: row.description || '',
        quantity: String(row.quantity ?? '1'),
        unit_price: String((row.unit_cost_minor ?? 0) / 100),
        category_id: row.category_id || '',
        branch: row.branch || '',
      },
    ],
  }
}

const accountLabel = (c) => `${c.code ? `${c.code} · ` : ''}${c.name}${c.is_chemical ? ' (needs approval)' : ''}`

export default function FinanceBillForm({ editing = null, categories, vendors, writableBranches, onSaved, onCancel, onCatalogAdd }) {
  const defaultBranch = writableBranches[0]?.slug || ''
  const [header, setHeader] = useState(() =>
    editing ? fromRow(editing).header : { vendor_id: '', date: getLocalCalendarDate(), due_date: '', reference: '' },
  )
  const [lines, setLines] = useState(() => (editing ? fromRow(editing).lines : [blankLine(defaultBranch), blankLine(defaultBranch)]))
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(null)

  const accountOptions = useMemo(
    () => [...activeAccounts(categories, [editing?.category_id]).map((c) => ({ value: c.id, label: accountLabel(c) })), { value: NEW, label: '+ New category…' }],
    [categories, editing],
  )
  const branchOptions = useMemo(() => writableBranches.map((b) => ({ value: b.slug, label: b.name })), [writableBranches])
  const vendorOptions = useMemo(() => [...vendors.map((v) => ({ value: v.id, label: v.name })), { value: NEW, label: '+ New vendor…' }], [vendors])
  const totalMinor = lines.reduce((s, l) => s + (Number.isFinite(billLineMinor(l)) ? billLineMinor(l) : 0), 0)

  const setLine = (i, patch) => setLines((list) => list.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  async function save(event) {
    event.preventDefault()
    const res = buildBillRows(header, lines)
    if (!res.ok) return toast.error(res.error)
    setSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('expenses').update(res.rows[0]).eq('id', editing.id)
        if (error) throw error
        toast.success('Bill updated')
      } else {
        const needsApproval = (row) => categories.find((c) => c.id === row.category_id)?.is_chemical || row.total_minor > 500000
        const { error } = await supabase
          .from('expenses')
          .insert(res.rows.map((row) => ({ ...row, status: needsApproval(row) ? 'pending_approval' : 'draft' })))
        if (error) throw error
        const waiting = res.rows.filter(needsApproval).length
        toast.success(waiting ? `Bill saved · ${waiting} line${waiting === 1 ? '' : 's'} need approval` : 'Bill saved as draft')
      }
      onSaved?.()
    } catch (err) {
      toast.error(err.message || 'Could not save the bill. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <form onSubmit={save} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-from">From</Label>
          <NamedSelect id="bill-from" value={header.vendor_id} onChange={(v) => (v === NEW ? setAdding({ kind: 'vendor' }) : setHeader({ ...header, vendor_id: v }))} options={vendorOptions} placeholder="Choose a vendor" className="min-h-11" />
          {vendors.length ? null : (
            <Button type="button" variant="link" className="h-auto min-h-11 w-fit cursor-pointer p-0 text-xs" onClick={() => setAdding({ kind: 'vendor' })}>
              <Plus data-icon="inline-start" />
              No vendors yet. Add the first one
            </Button>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-date">Date</Label>
          <Input id="bill-date" type="date" className="min-h-11" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-due">Due date</Label>
          <Input id="bill-due" type="date" className="min-h-11" min={header.date} value={header.due_date} onChange={(e) => setHeader({ ...header, due_date: e.target.value })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bill-ref">Reference</Label>
          <Input id="bill-ref" maxLength={80} className="min-h-11" placeholder="Invoice number" value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} />
        </div>
      </div>

      <div className="flex flex-col gap-3" role="group" aria-label="Bill lines">
        <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[1.1fr_1.5fr_0.55fr_0.85fr_1.4fr_1fr_0.9fr_44px]">
          <span>Item</span>
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit price</span>
          <span>Account</span>
          <span>Branch</span>
          <span className="text-right">Amount</span>
          <span className="sr-only">Remove</span>
        </div>
        {lines.map((l, i) => {
          const amount = billLineMinor(l)
          const id = (f) => `bill-${i}-${f}`
          return (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 lg:grid-cols-[1.1fr_1.5fr_0.55fr_0.85fr_1.4fr_1fr_0.9fr_44px] lg:items-center lg:border-0 lg:p-0">
              <div className="col-span-2 flex flex-col gap-1 lg:col-span-1">
                <Label htmlFor={id('item')} className="lg:sr-only">Item</Label>
                <Input id={id('item')} className="min-h-11" value={l.item} onChange={(e) => setLine(i, { item: e.target.value })} />
              </div>
              <div className="col-span-2 flex flex-col gap-1 lg:col-span-1">
                <Label htmlFor={id('desc')} className="lg:sr-only">Description</Label>
                <Input id={id('desc')} className="min-h-11" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={id('qty')} className="lg:sr-only">Qty</Label>
                <Input id={id('qty')} inputMode="decimal" className="min-h-11 text-right tabular-nums" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={id('unit')} className="lg:sr-only">Unit price</Label>
                <Input id={id('unit')} inputMode="decimal" className="min-h-11 text-right tabular-nums" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
              </div>
              <div className="col-span-2 flex flex-col gap-1 lg:col-span-1">
                <Label htmlFor={id('acct')} className="lg:sr-only">Account</Label>
                <NamedSelect id={id('acct')} value={l.category_id} onChange={(v) => (v === NEW ? setAdding({ kind: 'account', line: i }) : setLine(i, { category_id: v }))} options={accountOptions} placeholder="Account" className="min-h-11" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor={id('branch')} className="lg:sr-only">Branch</Label>
                <NamedSelect id={id('branch')} value={l.branch} onChange={(v) => setLine(i, { branch: v })} options={branchOptions} placeholder="Branch" className="min-h-11" />
              </div>
              <div className="flex flex-col items-end justify-center gap-1">
                <span className="text-xs text-muted-foreground lg:sr-only">Amount</span>
                <span className="ds-num font-medium">{Number.isFinite(amount) ? formatAccounting(amount) : '—'}</span>
              </div>
              {!editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="col-span-2 size-11 cursor-pointer justify-self-end lg:col-span-1"
                  aria-label={`Remove line ${i + 1}`}
                  disabled={lines.length === 1}
                  onClick={() => setLines((list) => list.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          )
        })}
        {!editing ? (
          <Button type="button" variant="outline" className="min-h-11 w-fit cursor-pointer" onClick={() => setLines((list) => [...list, blankLine(list.at(-1)?.branch || defaultBranch, list.at(-1)?.category_id || '')])}>
            <Plus data-icon="inline-start" />
            Add a line
          </Button>
        ) : null}
      </div>

      <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="ds-num text-right">{formatAccounting(totalMinor)}</dd>
        <dt className="border-t border-foreground/40 pt-1 font-semibold">Total</dt>
        <dd className="ds-num border-t border-foreground/40 pt-1 text-right font-semibold">{formatAccounting(totalMinor)}</dd>
      </dl>

      <p className="text-xs text-muted-foreground">Chemicals and lines over ₱5,000 wait for approval. Bills reach the P&L once paid.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11 cursor-pointer" disabled={saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save bill'}
        </Button>
        <Button type="button" variant="ghost" className="min-h-11 cursor-pointer" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>

    <FinanceVendorDialog
        open={adding?.kind === 'vendor'}
        onOpenChange={(open) => { if (!open) setAdding(null) }}
        onSaved={(vendor) => {
          onCatalogAdd?.({ vendor })
          setHeader((h) => ({ ...h, vendor_id: vendor.id }))
        }}
      />
      <FinanceAccountDialog
        open={adding?.kind === 'account'}
        onOpenChange={(open) => { if (!open) setAdding(null) }}
        onSaved={(category) => {
          onCatalogAdd?.({ category })
          setLine(adding.line, { category_id: category.id })
        }}
      />
    </>
  )
}

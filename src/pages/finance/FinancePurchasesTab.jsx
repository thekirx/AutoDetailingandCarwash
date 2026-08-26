/** Finance Bills & expenses — status flow + CRUD, dashboard chrome. */
import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { formatMoney } from '@/queue/queueApi'
import { downloadCsv, downloadExcel, formatFinanceWindow, printAsPdf } from '@/lib/financeData'
import {
  FinanceEmpty,
  FinanceMetricCell,
  FinanceMetricStrip,
  FinancePanel,
  FinanceTabSkeleton,
} from './FinanceChrome'

const STATUS_FLOW = ['draft', 'pending_approval', 'approved', 'pending_payment', 'paid', 'posted']
const STATUS_LABEL = {
  draft: 'Draft',
  pending_approval: 'Awaiting approval',
  approved: 'Approved',
  pending_payment: 'Awaiting payment',
  paid: 'Paid',
  posted: 'Posted',
}
const STATUS_BADGE = {
  draft: 'secondary',
  pending_approval: 'outline',
  approved: 'secondary',
  pending_payment: 'outline',
  paid: 'default',
  posted: 'default',
}

export default function FinancePurchasesTab({
  expenses,
  categories,
  branches,
  writableBranches,
  canWrite,
  range,
  loading,
  onReload,
}) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    quantity: '1',
    unit_cost: '',
    branch: '',
    category_id: '',
  })

  const filtered = useMemo(() => {
    let rows = [...(expenses || [])]
    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter(
        (r) => (r.title || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [expenses, statusFilter, query])

  const metrics = useMemo(() => {
    const all = expenses || []
    const total = filtered.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    const draft = all.filter((r) => r.status === 'draft').length
    const awaiting = all.filter((r) => r.status === 'pending_approval' || r.status === 'pending_payment').length
    const booked = all.filter((r) => r.status === 'paid' || r.status === 'posted')
    const bookedMinor = booked.reduce((s, r) => s + Number(r.total_minor || 0), 0)
    return { total, draft, awaiting, bookedCount: booked.length, bookedMinor }
  }, [expenses, filtered])

  const exportColumns = useMemo(
    () => [
      { key: 'title', label: 'Title' },
      {
        key: 'branch',
        label: 'Branch',
        value: (row) => branches.find((b) => b.slug === row.branch)?.name || row.branch || '—',
      },
      {
        key: 'category_id',
        label: 'Category',
        value: (row) => categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized',
      },
      { key: 'total_minor', label: 'Amount', value: (row) => formatMoney(row.total_minor) },
      { key: 'status', label: 'Status', value: (row) => STATUS_LABEL[row.status] || row.status },
      { key: 'created_at', label: 'Created', value: (row) => new Date(row.created_at).toLocaleString() },
    ],
    [branches, categories],
  )

  const windowLabel = formatFinanceWindow(range.start, range.end)
  const subtitle = `${windowLabel} · ${filtered.length} bill${filtered.length === 1 ? '' : 's'}`
  const fileBase = `hakum-purchases-${range.start}-to-${range.end}`

  function openCreate() {
    setEditing(null)
    setForm({
      title: '',
      description: '',
      quantity: '1',
      unit_cost: '',
      branch: writableBranches[0]?.slug || '',
      category_id: categories[0]?.id || '',
    })
    setShowForm(true)
  }

  function openEdit(row) {
    setEditing(row)
    setForm({
      title: row.title || '',
      description: row.description || '',
      quantity: String(row.quantity ?? '1'),
      unit_cost: String((row.unit_cost_minor ?? 0) / 100),
      branch: row.branch || '',
      category_id: row.category_id || '',
    })
    setShowForm(true)
  }

  async function save(event) {
    event.preventDefault()
    if (!canWrite) return toast.error('You do not have finance write access')
    const qty = Number(form.quantity)
    const unitPesos = Number(String(form.unit_cost).replace(/,/g, '').trim())
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitPesos) || unitPesos < 0) {
      return toast.error('Enter a valid quantity and unit cost')
    }
    if (!form.branch || !form.category_id) return toast.error('Branch and category are required')
    const unit = Math.round(unitPesos * 100)
    const total = Math.round(qty * unit)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      quantity: qty,
      unit_cost_minor: unit,
      total_minor: total,
      branch: form.branch,
      category_id: form.category_id,
    }
    if (editing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', editing.id)
      if (error) return toast.error(error.message)
      toast.success('Expense updated')
    } else {
      const cat = categories.find((c) => c.id === form.category_id)
      const needsApproval = cat?.is_chemical || total > 500000
      const { error } = await supabase
        .from('expenses')
        .insert({ ...payload, status: needsApproval ? 'pending_approval' : 'draft' })
        .select('id')
        .single()
      if (error) return toast.error(error.message)
      toast.success(needsApproval ? 'Expense submitted for approval' : 'Expense saved as draft')
    }
    setShowForm(false)
    onReload?.()
  }

  async function transition(row, status) {
    if (!canWrite) return
    const { error } = await supabase.rpc('transition_expense', {
      p_expense_id: row.id,
      p_new_status: status,
      p_notes: null,
    })
    if (error) toast.error(error.message)
    else {
      toast.success(`Marked ${STATUS_LABEL[status] || status}`)
      onReload?.()
    }
  }

  async function remove(row) {
    if (!canWrite) return
    if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', row.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Expense deleted')
      onReload?.()
    }
  }

  if (loading) return <FinanceTabSkeleton metrics={4} />

  return (
    <div className="finance-dash flex flex-col gap-5">
      <FinanceMetricStrip label="Bills totals">
        <FinanceMetricCell label="Filtered total" value={formatMoney(metrics.total)} hint={subtitle} tone="ink" />
        <FinanceMetricCell label="Drafts" value={String(metrics.draft)} hint="In window" tone="muted" />
        <FinanceMetricCell label="Awaiting action" value={String(metrics.awaiting)} hint="Approval or payment" tone="muted" />
        <FinanceMetricCell
          label="Paid + posted"
          value={formatMoney(metrics.bookedMinor)}
          hint={`${metrics.bookedCount} bills hit P&L`}
          tone="up"
        />
      </FinanceMetricStrip>

      <div className="finance-toolbar">
        <div className="finance-toolbar-search">
          <Search aria-hidden />
          <input
            type="search"
            placeholder="Search by title or description"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search bills"
          />
        </div>
        <div className="finance-toolbar-actions">
          <select
            className="finance-toolbar-select min-h-10"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {STATUS_FLOW.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {canWrite ? (
            <Button type="button" className="min-h-10 cursor-pointer" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              New bill
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadCsv(filtered, exportColumns, `${fileBase}.csv`)}
          >
            <Download data-icon="inline-start" />
            CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => downloadExcel(filtered, exportColumns, `${fileBase}.xls`, 'Hakum Purchases')}
          >
            <FileSpreadsheet data-icon="inline-start" />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 cursor-pointer"
            onClick={() => printAsPdf(filtered, exportColumns, 'Hakum Purchases', subtitle)}
          >
            <FileText data-icon="inline-start" />
            PDF
          </Button>
        </div>
      </div>

      {showForm && canWrite ? (
        <FinancePanel title={editing ? 'Edit bill' : 'New bill'} description="Branch and category required. Chemicals and large bills need approval.">
          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="exp-title">Title</Label>
              <Input
                id="exp-title"
                required
                className="min-h-10"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="exp-desc">Description</Label>
              <Textarea
                id="exp-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-qty">Quantity</Label>
              <Input
                id="exp-qty"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="min-h-10"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-unit">Unit cost (₱)</Label>
              <Input
                id="exp-unit"
                required
                className="min-h-10"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-branch">Branch</Label>
              <select
                id="exp-branch"
                className="finance-toolbar-select min-h-10 w-full"
                value={form.branch}
                onChange={(e) => setForm({ ...form, branch: e.target.value })}
              >
                {writableBranches.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="exp-cat">Category</Label>
              <select
                id="exp-cat"
                className="finance-toolbar-select min-h-10 w-full"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.is_chemical ? ' (pre-approval)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button type="submit" className="min-h-10 cursor-pointer">
                {editing ? 'Save changes' : 'Save bill'}
              </Button>
              <Button type="button" variant="ghost" className="min-h-10 cursor-pointer" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </FinancePanel>
      ) : null}

      <FinancePanel title="Bills" description={subtitle}>
        {filtered.length === 0 ? (
          <FinanceEmpty
            title="No bills match these filters"
            body={canWrite ? 'Record a bill with New bill, or widen status / search.' : 'Widen status or search, or ask someone with write access to post spend.'}
            action={canWrite ? { label: 'New bill', onClick: openCreate } : null}
          />
        ) : (
          <>
            <div className="finance-mobile-list">
              {filtered.map((row) => (
                <article key={`m-${row.id}`} className="finance-mobile-card">
                  <div>
                    <p className="finance-mobile-title">{row.title}</p>
                    <p className="finance-mobile-sub">
                      {branches.find((b) => b.slug === row.branch)?.name || row.branch} ·{' '}
                      {categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized'}
                    </p>
                  </div>
                  <div className="finance-mobile-amount">
                    <span className="tabular-nums">{formatMoney(row.total_minor)}</span>
                    <Badge variant={STATUS_BADGE[row.status] || 'secondary'}>
                      {STATUS_LABEL[row.status] || row.status}
                    </Badge>
                  </div>
                  {canWrite ? (
                    <div className="finance-mobile-actions">
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(row)}>
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      {nextStatus(row.status) ? (
                        <Button size="sm" className="cursor-pointer" onClick={() => transition(row, nextStatus(row.status))}>
                          {STATUS_LABEL[nextStatus(row.status)]}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(row)}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="finance-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.title}</TableCell>
                      <TableCell>{branches.find((b) => b.slug === row.branch)?.name || row.branch}</TableCell>
                      <TableCell>{categories.find((c) => c.id === row.category_id)?.name || 'Uncategorized'}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(row.total_minor)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[row.status] || 'secondary'}>
                          {STATUS_LABEL[row.status] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {canWrite ? (
                            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => openEdit(row)}>
                              <Pencil data-icon="inline-start" />
                              Edit
                            </Button>
                          ) : null}
                          {canWrite && nextStatus(row.status) ? (
                            <Button size="sm" className="cursor-pointer" onClick={() => transition(row, nextStatus(row.status))}>
                              {STATUS_LABEL[nextStatus(row.status)]}
                            </Button>
                          ) : null}
                          {canWrite ? (
                            <Button size="sm" variant="ghost" className="cursor-pointer" onClick={() => remove(row)}>
                              <Trash2 data-icon="inline-start" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </FinancePanel>
    </div>
  )
}

function nextStatus(status) {
  const i = STATUS_FLOW.indexOf(status)
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null
  return STATUS_FLOW[i + 1]
}
